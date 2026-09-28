// One-time and recurring reimbursements
import { Router } from 'express';
import { assertPeriodPayable, requireEmployee } from '../db/lookups.js';
import { pool, withTransaction } from '../db/pool.js';
import { conflict, notFound } from '../lib/httpError.js';
import * as v from '../lib/validate.js';
import { PayrollInputError } from '../services/errors.js';
import { fiscalYearForPeriod } from '../services/fiscalYears.js';
import { localDate } from '../services/periods.js';

// One-time: paid in a single month
export const oneTimeReimbursements = Router({ mergeParams: true });

const ONE_TIME_COLUMNS = `r.id, r.employee_id, r.fiscal_year_id, fy.label AS fiscal_year_label, r.pay_period,
  r.amount, r.description, r.created_at`;

oneTimeReimbursements.get('/', async (req, res) => {
  const employeeId = v.id(req.params);
  await requireEmployee(pool, employeeId, { allowRemoved: true });
  const { rows } = await pool.query(
    `SELECT ${ONE_TIME_COLUMNS} FROM one_time_reimbursements r JOIN fiscal_years fy ON fy.id = r.fiscal_year_id
     WHERE r.employee_id = $1 ORDER BY r.pay_period DESC, r.id DESC`,
    [employeeId],
  );
  res.json(rows);
});

oneTimeReimbursements.post('/', async (req, res) => {
  const employeeId = v.id(req.params);
  const period = v.period(req.body, 'pay_period');
  const amount = v.amount(req.body, 'amount');
  const description = v.text(req.body, 'description');

  const id = await withTransaction(async (client) => {
    const employee = await requireEmployee(client, employeeId, { forUpdate: true });
    const { fiscalYears } = await assertPeriodPayable(client, employee, period);
    const fiscalYear = fiscalYearForPeriod(fiscalYears, period);
    if (!fiscalYear) throw new PayrollInputError(`No fiscal year covers pay period ${period}`);

    // Only one per employee per fiscal year
    const { rows: existing } = await client.query(
      'SELECT pay_period FROM one_time_reimbursements WHERE employee_id = $1 AND fiscal_year_id = $2',
      [employeeId, fiscalYear.id],
    );
    if (existing[0]) {
      throw conflict(
        `This employee already has a one-time reimbursement in fiscal year ${fiscalYear.label} (${existing[0].pay_period}); only one is allowed per fiscal year`,
      );
    }
    const { rows } = await client.query(
      `INSERT INTO one_time_reimbursements (employee_id, fiscal_year_id, pay_period, amount, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [employeeId, fiscalYear.id, period, amount, description],
    );
    return rows[0].id;
  });
  const { rows } = await pool.query(
    `SELECT ${ONE_TIME_COLUMNS} FROM one_time_reimbursements r JOIN fiscal_years fy ON fy.id = r.fiscal_year_id WHERE r.id = $1`,
    [id],
  );
  res.status(201).json(rows[0]);
});

oneTimeReimbursements.delete('/:reimbursementId', async (req, res) => {
  const employeeId = v.id(req.params);
  const reimbursementId = v.id(req.params, 'reimbursementId');
  await withTransaction(async (client) => {
    const employee = await requireEmployee(client, employeeId, { allowRemoved: true, forUpdate: true });
    const { rows } = await client.query(
      'SELECT pay_period FROM one_time_reimbursements WHERE id = $1 AND employee_id = $2',
      [reimbursementId, employeeId],
    );
    if (!rows[0]) throw notFound('Reimbursement not found');
    await assertPeriodPayable(client, employee, rows[0].pay_period);
    await client.query('DELETE FROM one_time_reimbursements WHERE id = $1', [reimbursementId]);
  });
  res.status(204).end();
});

// Recurring: paid every month until stopped
export const recurringReimbursements = Router({ mergeParams: true });

const RECURRING_COLUMNS = 'id, employee_id, amount, description, started_at, stopped_at, created_at';

recurringReimbursements.get('/', async (req, res) => {
  const employeeId = v.id(req.params);
  await requireEmployee(pool, employeeId, { allowRemoved: true });
  const { rows } = await pool.query(
    `SELECT ${RECURRING_COLUMNS} FROM recurring_reimbursements WHERE employee_id = $1
     ORDER BY stopped_at IS NOT NULL, started_at DESC, id DESC`,
    [employeeId],
  );
  res.json(rows);
});

recurringReimbursements.post('/', async (req, res) => {
  const employeeId = v.id(req.params);
  const amount = v.amount(req.body, 'amount');
  const description = v.text(req.body, 'description');
  const startedAt = v.date(req.body, 'started_at', { optional: true }) ?? localDate();
  await requireEmployee(pool, employeeId);
  const { rows } = await pool.query(
    `INSERT INTO recurring_reimbursements (employee_id, amount, description, started_at)
     VALUES ($1, $2, $3, $4) RETURNING ${RECURRING_COLUMNS}`,
    [employeeId, amount, description, startedAt],
  );
  res.status(201).json(rows[0]);
});

// PATCH stops it from today (this month is no longer paid)
recurringReimbursements.patch('/:reimbursementId', async (req, res) => {
  const employeeId = v.id(req.params);
  const reimbursementId = v.id(req.params, 'reimbursementId');
  const { rows: existing } = await pool.query(
    'SELECT stopped_at FROM recurring_reimbursements WHERE id = $1 AND employee_id = $2',
    [reimbursementId, employeeId],
  );
  if (!existing[0]) throw notFound('Reimbursement not found');
  if (existing[0].stopped_at) throw conflict('Reimbursement is already stopped');
  const { rows } = await pool.query(
    `UPDATE recurring_reimbursements SET stopped_at = GREATEST(started_at, $2::date) WHERE id = $1 RETURNING ${RECURRING_COLUMNS}`,
    [reimbursementId, localDate()],
  );
  res.json(rows[0]);
});
