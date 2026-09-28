// POST /employees/:id/advance, GET /employees/:id/advances
import { Router } from 'express';
import { assertPeriodPayable, latestPayslipPeriod, listFiscalYears, requireEmployee } from '../db/lookups.js';
import { pool, withTransaction } from '../db/pool.js';
import { badRequest, conflict } from '../lib/httpError.js';
import * as v from '../lib/validate.js';
import { PayrollInputError } from '../services/errors.js';
import { fiscalYearForPeriod } from '../services/fiscalYears.js';
import { nextPayslipPeriod } from '../services/payslipSchedule.js';
import { currentPeriod, maxOf } from '../services/periods.js';

const router = Router({ mergeParams: true });

const COLUMNS = `a.id, a.employee_id, a.fiscal_year_id, fy.label AS fiscal_year_label, a.total_amount,
  a.monthly_deduction_amount, a.outstanding_balance, a.started_pay_period, a.status, a.created_at, a.updated_at`;

async function loadAdvance(db, id) {
  const { rows } = await db.query(
    `SELECT ${COLUMNS} FROM advances a JOIN fiscal_years fy ON fy.id = a.fiscal_year_id WHERE a.id = $1`,
    [id],
  );
  return rows[0];
}

router.get('/advances', async (req, res) => {
  const employeeId = v.id(req.params);
  await requireEmployee(pool, employeeId, { allowRemoved: true });
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM advances a JOIN fiscal_years fy ON fy.id = a.fiscal_year_id
     WHERE a.employee_id = $1 ORDER BY a.started_pay_period DESC`,
    [employeeId],
  );
  res.json(rows);
});

// Body: { total_amount, monthly_deduction_amount, started_pay_period? }
// Only one advance per employee per fiscal year.
router.post('/advance', async (req, res) => {
  const employeeId = v.id(req.params);
  const totalAmount = v.amount(req.body, 'total_amount');
  const monthlyDeduction = v.amount(req.body, 'monthly_deduction_amount');
  const requestedStart = v.period(req.body, 'started_pay_period', { optional: true });
  if (monthlyDeduction > totalAmount) throw badRequest('monthly_deduction_amount cannot exceed total_amount');

  const id = await withTransaction(async (client) => {
    const employee = await requireEmployee(client, employeeId, { forUpdate: true });
    let startPeriod = requestedStart;
    if (!startPeriod) {
      const next = nextPayslipPeriod(employee, await latestPayslipPeriod(client, employeeId), await listFiscalYears(client));
      startPeriod = maxOf(next ?? currentPeriod(), currentPeriod());
    }
    const { fiscalYears } = await assertPeriodPayable(client, employee, startPeriod);
    const fiscalYear = fiscalYearForPeriod(fiscalYears, startPeriod);
    if (!fiscalYear) throw new PayrollInputError(`No fiscal year covers pay period ${startPeriod}`);

    const { rows: existing } = await client.query(
      'SELECT status FROM advances WHERE employee_id = $1 AND fiscal_year_id = $2',
      [employeeId, fiscalYear.id],
    );
    if (existing[0]) {
      throw conflict(
        `This employee already had an advance in fiscal year ${fiscalYear.label} (${existing[0].status.toLowerCase()}); only one is allowed per fiscal year`,
      );
    }
    const { rows } = await client.query(
      `INSERT INTO advances (employee_id, fiscal_year_id, total_amount, monthly_deduction_amount,
                             outstanding_balance, started_pay_period, status)
       VALUES ($1, $2, $3, $4, $3, $5, 'ACTIVE') RETURNING id`,
      [employeeId, fiscalYear.id, totalAmount, monthlyDeduction, startPeriod],
    );
    return rows[0].id;
  });
  res.status(201).json(await loadAdvance(pool, id));
});

export default router;
