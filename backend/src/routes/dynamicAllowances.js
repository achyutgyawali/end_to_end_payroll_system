// Per-employee allowances, paid every month until removed
import { Router } from 'express';
import { requireEmployee } from '../db/lookups.js';
import { pool } from '../db/pool.js';
import { conflict, notFound } from '../lib/httpError.js';
import * as v from '../lib/validate.js';
import { localDate } from '../services/periods.js';

const router = Router({ mergeParams: true });

const COLUMNS = 'id, employee_id, name, amount, assigned_at, stopped_at, created_at';

router.get('/', async (req, res) => {
  const employeeId = v.id(req.params);
  await requireEmployee(pool, employeeId, { allowRemoved: true });
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM dynamic_allowances WHERE employee_id = $1
     ORDER BY stopped_at IS NOT NULL, assigned_at DESC, id DESC`,
    [employeeId],
  );
  res.json(rows);
});

// Pays from the month after assigned_at (default today)
router.post('/', async (req, res) => {
  const employeeId = v.id(req.params);
  const name = v.text(req.body, 'name');
  const amount = v.amount(req.body, 'amount');
  const assignedAt = v.date(req.body, 'assigned_at', { optional: true }) ?? localDate();
  await requireEmployee(pool, employeeId);
  const { rows } = await pool.query(
    `INSERT INTO dynamic_allowances (employee_id, name, amount, assigned_at) VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
    [employeeId, name, amount, assignedAt],
  );
  res.status(201).json(rows[0]);
});

// "Remove" = stop it from today; the row is kept for history.
router.delete('/:allowanceId', async (req, res) => {
  const employeeId = v.id(req.params);
  const allowanceId = v.id(req.params, 'allowanceId');
  const { rows: existing } = await pool.query(
    'SELECT stopped_at FROM dynamic_allowances WHERE id = $1 AND employee_id = $2',
    [allowanceId, employeeId],
  );
  if (!existing[0]) throw notFound('Dynamic allowance not found');
  if (existing[0].stopped_at) throw conflict('Dynamic allowance is already stopped');
  const { rows } = await pool.query(
    `UPDATE dynamic_allowances SET stopped_at = GREATEST(assigned_at, $2::date) WHERE id = $1 RETURNING ${COLUMNS}`,
    [allowanceId, localDate()],
  );
  res.json(rows[0]);
});

export default router;
