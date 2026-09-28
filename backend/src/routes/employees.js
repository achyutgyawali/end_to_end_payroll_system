import { Router } from 'express';
import { listFiscalYears, requireEmployee } from '../db/lookups.js';
import { pool } from '../db/pool.js';
import { notFound } from '../lib/httpError.js';
import * as v from '../lib/validate.js';
import { serializeEmployee } from '../serializers.js';
import { nextPayslipPeriod } from '../services/payslipSchedule.js';

const router = Router();

// Secret salary is loaded here and stripped for the employee role by serializeEmployee
const EMPLOYEE_VIEW_SQL = `
  SELECT e.id, e.name, e.department, e.employment_type, e.basic_pay, e.joining_date,
         e.dummy_bank_acc_no, e.is_active, e.created_at, e.updated_at, e.deleted_at,
         lp.latest_payslip_period,
         ss.id AS secret_salary_id, ss.amount AS secret_salary_amount, ss.assigned_at AS secret_salary_assigned_at
  FROM employees e
  LEFT JOIN LATERAL (
    SELECT max(p.pay_period) AS latest_payslip_period FROM payslips p WHERE p.employee_id = e.id
  ) lp ON TRUE
  LEFT JOIN secret_salaries ss ON ss.employee_id = e.id AND ss.revoked_at IS NULL`;

function toEmployeeView(row, fiscalYears) {
  const { secret_salary_id, secret_salary_amount, secret_salary_assigned_at, ...employee } = row;
  return {
    ...employee,
    next_payslip_period: employee.deleted_at
      ? null
      : nextPayslipPeriod(employee, employee.latest_payslip_period, fiscalYears),
    secret_salary: secret_salary_id
      ? { id: secret_salary_id, amount: secret_salary_amount, assigned_at: secret_salary_assigned_at }
      : null,
  };
}

async function loadEmployeeView(db, id) {
  const { rows } = await db.query(`${EMPLOYEE_VIEW_SQL} WHERE e.id = $1`, [id]);
  if (!rows[0]) throw notFound('Employee not found');
  return toEmployeeView(rows[0], await listFiscalYears(db));
}

function readEmployeeFields(body, { partial }) {
  const optional = partial;
  return {
    name: v.text(body, 'name', { optional }),
    department: v.text(body, 'department', { optional }),
    employment_type: v.oneOf(body, 'employment_type', v.EMPLOYMENT_TYPES, { optional }),
    basic_pay: v.number(body, 'basic_pay', { min: 0, optional }),
    joining_date: v.date(body, 'joining_date', { optional }),
    dummy_bank_acc_no: v.text(body, 'dummy_bank_acc_no', { optional }),
    is_active: v.boolean(body, 'is_active', { optional: true }),
  };
}

// GET /employees?employment_type=SSF|NON_SSF&include_removed=true
router.get('/', async (req, res) => {
  const employmentType = v.oneOf(req.query, 'employment_type', v.EMPLOYMENT_TYPES, { optional: true }) ?? null;
  const includeRemoved = v.boolean(req.query, 'include_removed', { optional: true }) ?? false;
  const { rows } = await pool.query(
    `${EMPLOYEE_VIEW_SQL}
     WHERE ($1::text IS NULL OR e.employment_type = $1)
       AND ($2::boolean OR e.deleted_at IS NULL)
     ORDER BY e.deleted_at IS NOT NULL, e.name`,
    [employmentType, includeRemoved],
  );
  const fiscalYears = await listFiscalYears(pool);
  res.json(rows.map((row) => serializeEmployee(toEmployeeView(row, fiscalYears), req.role)));
});

// Removed employees stay readable so their payslip history remains viewable.
router.get('/:id', async (req, res) => {
  const employee = await loadEmployeeView(pool, v.id(req.params));
  res.json(serializeEmployee(employee, req.role));
});

router.post('/', async (req, res) => {
  const fields = readEmployeeFields(req.body, { partial: false });
  const { rows } = await pool.query(
    `INSERT INTO employees (name, department, employment_type, basic_pay, joining_date, dummy_bank_acc_no, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      fields.name,
      fields.department,
      fields.employment_type,
      fields.basic_pay,
      fields.joining_date,
      fields.dummy_bank_acc_no,
      fields.is_active ?? true,
    ],
  );
  res.status(201).json(serializeEmployee(await loadEmployeeView(pool, rows[0].id), req.role));
});

// Fields left out of the body keep their current values.
router.put('/:id', async (req, res) => {
  const id = v.id(req.params);
  const existing = await requireEmployee(pool, id);
  const updates = readEmployeeFields(req.body, { partial: true });
  const merged = { ...existing };
  for (const [field, value] of Object.entries(updates)) {
    if (value !== undefined) merged[field] = value;
  }
  await pool.query(
    `UPDATE employees
     SET name = $2, department = $3, employment_type = $4, basic_pay = $5, joining_date = $6,
         dummy_bank_acc_no = $7, is_active = $8, updated_at = now()
     WHERE id = $1`,
    [
      id,
      merged.name,
      merged.department,
      merged.employment_type,
      merged.basic_pay,
      merged.joining_date,
      merged.dummy_bank_acc_no,
      merged.is_active,
    ],
  );
  res.json(serializeEmployee(await loadEmployeeView(pool, id), req.role));
});

// Soft delete only — historical payslips must stay viewable.
router.delete('/:id', async (req, res) => {
  const id = v.id(req.params);
  await requireEmployee(pool, id);
  await pool.query(
    'UPDATE employees SET deleted_at = now(), is_active = FALSE, updated_at = now() WHERE id = $1',
    [id],
  );
  res.json(serializeEmployee(await loadEmployeeView(pool, id), req.role));
});

export default router;
