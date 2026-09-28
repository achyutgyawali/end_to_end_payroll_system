// Secret salary: admin only, for internal cost tracking. Never paid or shown on payslips.
import { Router } from 'express';
import { requireEmployee } from '../db/lookups.js';
import { pool } from '../db/pool.js';
import { conflict, notFound } from '../lib/httpError.js';
import * as v from '../lib/validate.js';
import { requireAdmin } from '../middleware/role.js';
import { localDate } from '../services/periods.js';

const router = Router({ mergeParams: true });
router.use(requireAdmin);

const COLUMNS = 'id, employee_id, amount, assigned_at, revoked_at, created_at';

router.get('/', async (req, res) => {
  const employeeId = v.id(req.params);
  await requireEmployee(pool, employeeId, { allowRemoved: true });
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM secret_salaries WHERE employee_id = $1 ORDER BY revoked_at IS NOT NULL, assigned_at DESC, id DESC`,
    [employeeId],
  );
  res.json(rows);
});

router.post('/', async (req, res) => {
  const employeeId = v.id(req.params);
  const amount = v.amount(req.body, 'amount');
  const assignedAt = v.date(req.body, 'assigned_at', { optional: true }) ?? localDate();
  await requireEmployee(pool, employeeId);
  const { rowCount } = await pool.query('SELECT 1 FROM secret_salaries WHERE employee_id = $1 AND revoked_at IS NULL', [
    employeeId,
  ]);
  if (rowCount) throw conflict('This employee already has an active secret salary — revoke it first');
  const { rows } = await pool.query(
    `INSERT INTO secret_salaries (employee_id, amount, assigned_at) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [employeeId, amount, assignedAt],
  );
  res.status(201).json(rows[0]);
});

// PATCH = revoke the active secret salary (from today).
router.patch('/', async (req, res) => {
  const employeeId = v.id(req.params);
  const { rows } = await pool.query(
    `UPDATE secret_salaries SET revoked_at = GREATEST(assigned_at, $2::date)
     WHERE employee_id = $1 AND revoked_at IS NULL RETURNING ${COLUMNS}`,
    [employeeId, localDate()],
  );
  if (!rows[0]) throw notFound('No active secret salary to revoke');
  res.json(rows[0]);
});

export default router;
