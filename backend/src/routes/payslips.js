// Payslip generation, preview, history and bulk payroll run
import { Router } from 'express';
import { latestPayslipPeriod, listFiscalYears, requireEmployee } from '../db/lookups.js';
import { pool, withTransaction } from '../db/pool.js';
import { HttpError, badRequest, notFound } from '../lib/httpError.js';
import * as v from '../lib/validate.js';
import { requireAdmin } from '../middleware/role.js';
import { serializePayslip } from '../serializers.js';
import { PayrollInputError } from '../services/errors.js';
import { calculatePayslip } from '../services/payrollCalculator.js';
import { checkPayslipGeneration, nextPayslipPeriod } from '../services/payslipSchedule.js';
import { currentPeriod, localDate } from '../services/periods.js';

const router = Router();

const SUMMARY_COLUMNS = `id, employee_id, pay_period, fiscal_year_id, fiscal_year_label, employee_name, department,
  employment_type, basic_pay, gross_earnings, total_deductions, net_pay, ssf_employer_pct, ssf_employer_amount, generated_at`;
const FULL_COLUMNS = `${SUMMARY_COLUMNS}, joining_date, dummy_bank_acc_no, earnings, deductions`;

// Loads everything the calculator needs for one employee
async function loadPayrollInputs(db, employee, period, fiscalYear, { lockAdvances }) {
  const rows = async (sql, params) => (await db.query(sql, params)).rows;
  const [ssfConfig] = await rows('SELECT employee_pct, employer_pct FROM ssf_configs WHERE fiscal_year_id = $1', [fiscalYear.id]);
  const [securityFundConfig] = await rows('SELECT percentage FROM security_fund_configs WHERE fiscal_year_id = $1', [fiscalYear.id]);
  return {
    period,
    employee,
    fiscalYear,
    ssfConfig: ssfConfig ?? null,
    securityFundConfig: securityFundConfig ?? null,
    taxSlabs: await rows(
      'SELECT slab_order, upper_bound, rate_pct FROM tax_slabs WHERE fiscal_year_id = $1 ORDER BY slab_order',
      [fiscalYear.id],
    ),
    fixedAllowances: await rows('SELECT id, name, amount, is_active FROM fixed_allowances WHERE is_active ORDER BY id'),
    dynamicAllowances: await rows(
      'SELECT id, name, amount, assigned_at, stopped_at FROM dynamic_allowances WHERE employee_id = $1 ORDER BY id',
      [employee.id],
    ),
    overtimeEntries: await rows(
      'SELECT id, pay_period, hours, multiplier FROM overtime_entries WHERE employee_id = $1 AND pay_period = $2 ORDER BY id',
      [employee.id, period],
    ),
    oneTimeReimbursements: await rows(
      'SELECT id, pay_period, amount, description FROM one_time_reimbursements WHERE employee_id = $1 AND pay_period = $2 ORDER BY id',
      [employee.id, period],
    ),
    recurringReimbursements: await rows(
      'SELECT id, amount, description, started_at, stopped_at FROM recurring_reimbursements WHERE employee_id = $1 ORDER BY id',
      [employee.id],
    ),
    advances: await rows(
      `SELECT id, total_amount, monthly_deduction_amount, outstanding_balance, started_pay_period, status
       FROM advances WHERE employee_id = $1 AND status = 'ACTIVE' ORDER BY id${lockAdvances ? ' FOR UPDATE' : ''}`,
      [employee.id],
    ),
  };
}

// Checks the forward-only rule and computes the payslip. Pass lock when saving.
async function computePayslip(db, employeeId, period, { lock }) {
  const employee = await requireEmployee(db, employeeId, { allowRemoved: true, forUpdate: lock });
  const fiscalYears = await listFiscalYears(db);
  const latestPeriod = await latestPayslipPeriod(db, employeeId);
  const target = period ?? nextPayslipPeriod(employee, latestPeriod, fiscalYears) ?? currentPeriod();
  const check = checkPayslipGeneration({ employee, period: target, latestPeriod, fiscalYears, today: localDate() });
  if (!check.ok) {
    throw new HttpError(409, check.reason, { code: check.code, expected_period: check.expected_period });
  }
  const inputs = await loadPayrollInputs(db, employee, target, check.fiscalYear, { lockAdvances: lock });
  return calculatePayslip(inputs);
}

// Saves the payslip and updates the advance balance in one transaction
async function generatePayslip(employeeId, period) {
  return withTransaction(async (client) => {
    const payslip = await computePayslip(client, employeeId, period, { lock: true });
    const { rows } = await client.query(
      `INSERT INTO payslips (
         employee_id, pay_period, fiscal_year_id, fiscal_year_label,
         employee_name, department, employment_type, basic_pay, joining_date, dummy_bank_acc_no,
         earnings, deductions, gross_earnings, total_deductions, net_pay,
         ssf_employer_pct, ssf_employer_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       RETURNING ${FULL_COLUMNS}`,
      [
        payslip.employee_id,
        payslip.pay_period,
        payslip.fiscal_year_id,
        payslip.fiscal_year_label,
        payslip.employee_name,
        payslip.department,
        payslip.employment_type,
        payslip.basic_pay,
        payslip.joining_date,
        payslip.dummy_bank_acc_no,
        JSON.stringify(payslip.earnings),
        JSON.stringify(payslip.deductions),
        payslip.gross_earnings,
        payslip.total_deductions,
        payslip.net_pay,
        payslip.ssf_employer_pct,
        payslip.ssf_employer_amount,
      ],
    );
    for (const installment of payslip.deductions.advances) {
      await client.query(
        `UPDATE advances
         SET outstanding_balance = $2,
             status = CASE WHEN $2::numeric = 0 THEN 'COMPLETED' ELSE 'ACTIVE' END,
             updated_at = now()
         WHERE id = $1`,
        [installment.advance_id, installment.outstanding_after],
      );
    }
    return rows[0];
  });
}

// POST /employees/:id/payslips/generate?period=YYYY-MM
router.post('/employees/:id/payslips/generate', async (req, res) => {
  const employeeId = v.id(req.params);
  const period = v.period(req.query, 'period', { optional: true }) ?? v.period(req.body, 'period', { optional: true });
  if (!period) throw badRequest('period is required (YYYY-MM)');
  const payslip = await generatePayslip(employeeId, period);
  res.status(201).json(serializePayslip(payslip, req.role));
});

// GET /employees/:id/payslips/preview?period=YYYY-MM — computes without saving.
router.get('/employees/:id/payslips/preview', requireAdmin, async (req, res) => {
  const employeeId = v.id(req.params);
  const period = v.period(req.query, 'period', { optional: true });
  const payslip = await computePayslip(pool, employeeId, period, { lock: false });
  res.json({ preview: true, ...serializePayslip(payslip, req.role) });
});

// GET /employees/:id/payslips?employment_type=SSF|NON_SSF
router.get('/employees/:id/payslips', async (req, res) => {
  const employeeId = v.id(req.params);
  const employmentType = v.oneOf(req.query, 'employment_type', v.EMPLOYMENT_TYPES, { optional: true }) ?? null;
  await requireEmployee(pool, employeeId, { allowRemoved: true });
  const { rows } = await pool.query(
    `SELECT ${SUMMARY_COLUMNS} FROM payslips
     WHERE employee_id = $1 AND ($2::text IS NULL OR employment_type = $2)
     ORDER BY pay_period DESC`,
    [employeeId, employmentType],
  );
  res.json(rows.map((row) => serializePayslip(row, req.role)));
});

router.get('/employees/:id/payslips/:payslipId', async (req, res) => {
  const { rows } = await pool.query(`SELECT ${FULL_COLUMNS} FROM payslips WHERE id = $1 AND employee_id = $2`, [
    v.id(req.params, 'payslipId'),
    v.id(req.params),
  ]);
  if (!rows[0]) throw notFound('Payslip not found');
  res.json(serializePayslip(rows[0], req.role));
});

// GET /payslips?employment_type=SSF|NON_SSF&period=YYYY-MM — all employees.
router.get('/payslips', async (req, res) => {
  const employmentType = v.oneOf(req.query, 'employment_type', v.EMPLOYMENT_TYPES, { optional: true }) ?? null;
  const period = v.period(req.query, 'period', { optional: true }) ?? null;
  const { rows } = await pool.query(
    `SELECT ${SUMMARY_COLUMNS} FROM payslips
     WHERE ($1::text IS NULL OR employment_type = $1) AND ($2::text IS NULL OR pay_period = $2)
     ORDER BY pay_period DESC, employee_name`,
    [employmentType, period],
  );
  res.json(rows.map((row) => serializePayslip(row, req.role)));
});

/** Per-employee status for one period: GENERATED, READY or BLOCKED (with reason). */
async function payrollStatus(period, employmentType) {
  const { rows } = await pool.query(
    `SELECT e.id, e.name, e.department, e.employment_type, e.basic_pay, e.joining_date, e.is_active, e.deleted_at,
            lp.latest_period, p.id AS payslip_id, p.net_pay AS payslip_net_pay
     FROM employees e
     LEFT JOIN LATERAL (SELECT max(pay_period) AS latest_period FROM payslips WHERE employee_id = e.id) lp ON TRUE
     LEFT JOIN payslips p ON p.employee_id = e.id AND p.pay_period = $1
     WHERE e.deleted_at IS NULL AND ($2::text IS NULL OR e.employment_type = $2)
     ORDER BY e.name`,
    [period, employmentType],
  );
  const fiscalYears = await listFiscalYears(pool);
  const today = localDate();
  return rows.map(({ latest_period, payslip_id, payslip_net_pay, ...employee }) => {
    const base = {
      employee_id: employee.id,
      name: employee.name,
      department: employee.department,
      employment_type: employee.employment_type,
      latest_payslip_period: latest_period,
      next_payslip_period: nextPayslipPeriod(employee, latest_period, fiscalYears),
    };
    if (payslip_id) return { ...base, status: 'GENERATED', payslip_id, net_pay: payslip_net_pay };
    const check = checkPayslipGeneration({ employee, period, latestPeriod: latest_period, fiscalYears, today });
    return check.ok ? { ...base, status: 'READY' } : { ...base, status: 'BLOCKED', code: check.code, reason: check.reason };
  });
}

// GET /payroll/status?period=YYYY-MM&employment_type=SSF|NON_SSF
router.get('/payroll/status', requireAdmin, async (req, res) => {
  const period = v.period(req.query, 'period', { optional: true }) ?? currentPeriod();
  const employmentType = v.oneOf(req.query, 'employment_type', v.EMPLOYMENT_TYPES, { optional: true }) ?? null;
  res.json({ period, employees: await payrollStatus(period, employmentType) });
});

// POST /payroll/generate?period=YYYY-MM
// Generates every READY payslip, each in its own transaction
router.post('/payroll/generate', async (req, res) => {
  const period = v.period(req.query, 'period', { optional: true }) ?? v.period(req.body, 'period', { optional: true });
  if (!period) throw badRequest('period is required (YYYY-MM)');
  const employmentType = v.oneOf(req.query, 'employment_type', v.EMPLOYMENT_TYPES, { optional: true }) ?? null;

  const results = [];
  for (const row of await payrollStatus(period, employmentType)) {
    if (row.status !== 'READY') continue;
    try {
      const payslip = await generatePayslip(row.employee_id, period);
      results.push({ employee_id: row.employee_id, name: row.name, status: 'GENERATED', payslip_id: payslip.id, net_pay: payslip.net_pay });
    } catch (err) {
      const expected = err instanceof HttpError || err instanceof PayrollInputError;
      if (!expected) console.error(err);
      results.push({
        employee_id: row.employee_id,
        name: row.name,
        status: 'FAILED',
        reason: expected ? err.message : 'Unexpected error — see server log',
      });
    }
  }
  res.json({ period, results });
});

export default router;
