// Overtime entries, can only be added for the current month
import { Router } from 'express';
import { assertPeriodPayable, requireEmployee } from '../db/lookups.js';
import { pool, withTransaction } from '../db/pool.js';
import { badRequest, notFound } from '../lib/httpError.js';
import * as v from '../lib/validate.js';
import { currentPeriod } from '../services/periods.js';

const router = Router({ mergeParams: true });

const COLUMNS = 'id, employee_id, pay_period, hours, multiplier, created_at';

// GET /employees/:id/overtime?period=YYYY-MM
router.get('/', async (req, res) => {
  const employeeId = v.id(req.params);
  const period = v.period(req.query, 'period', { optional: true }) ?? null;
  await requireEmployee(pool, employeeId, { allowRemoved: true });
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM overtime_entries
     WHERE employee_id = $1 AND ($2::text IS NULL OR pay_period = $2)
     ORDER BY pay_period DESC, id DESC`,
    [employeeId, period],
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const employeeId = v.id(req.params);
  const hours = v.number(req.body, 'hours', { exclusiveMin: 0, max: 744 });
  const multiplier = v.number(req.body, 'multiplier', { optional: true, exclusiveMin: 0, max: 99.99 }) ?? 1.5;
  const period = currentPeriod();
  const requested = v.period(req.body, 'pay_period', { optional: true });
  if (requested && requested !== period) {
    throw badRequest(`Overtime can only be recorded for the current pay period (${period})`);
  }

  const entry = await withTransaction(async (client) => {
    const employee = await requireEmployee(client, employeeId, { forUpdate: true });
    await assertPeriodPayable(client, employee, period);
    const { rows } = await client.query(
      `INSERT INTO overtime_entries (employee_id, pay_period, hours, multiplier) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [employeeId, period, hours, multiplier],
    );
    return rows[0];
  });
  res.status(201).json(entry);
});

// Fix an entry, only before that month's payslip is generated
router.delete('/:overtimeId', async (req, res) => {
  const employeeId = v.id(req.params);
  const overtimeId = v.id(req.params, 'overtimeId');
  await withTransaction(async (client) => {
    const employee = await requireEmployee(client, employeeId, { allowRemoved: true, forUpdate: true });
    const { rows } = await client.query('SELECT pay_period FROM overtime_entries WHERE id = $1 AND employee_id = $2', [
      overtimeId,
      employeeId,
    ]);
    if (!rows[0]) throw notFound('Overtime entry not found');
    await assertPeriodPayable(client, employee, rows[0].pay_period);
    await client.query('DELETE FROM overtime_entries WHERE id = $1', [overtimeId]);
  });
  res.status(204).end();
});

export default router;
