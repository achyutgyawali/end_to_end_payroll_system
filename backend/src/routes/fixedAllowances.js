import { Router } from 'express';
import { pool } from '../db/pool.js';
import { notFound } from '../lib/httpError.js';
import * as v from '../lib/validate.js';

const router = Router();

const COLUMNS = 'id, name, amount, is_active, created_at, updated_at';

async function requireAllowance(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM fixed_allowances WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('Fixed allowance not found');
  return rows[0];
}

router.get('/', async (req, res) => {
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM fixed_allowances ORDER BY is_active DESC, name`);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const name = v.text(req.body, 'name');
  const amount = v.amount(req.body, 'amount');
  const isActive = v.boolean(req.body, 'is_active', { optional: true }) ?? true;
  const { rows } = await pool.query(
    `INSERT INTO fixed_allowances (name, amount, is_active) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
    [name, amount, isActive],
  );
  res.status(201).json(rows[0]);
});

// Edit or reactivate (old payslips keep their own copy)
router.patch('/:id', async (req, res) => {
  const existing = await requireAllowance(v.id(req.params));
  const { rows } = await pool.query(
    `UPDATE fixed_allowances SET name = $2, amount = $3, is_active = $4, updated_at = now()
     WHERE id = $1 RETURNING ${COLUMNS}`,
    [
      existing.id,
      v.text(req.body, 'name', { optional: true }) ?? existing.name,
      v.amount(req.body, 'amount', { optional: true }) ?? existing.amount,
      v.boolean(req.body, 'is_active', { optional: true }) ?? existing.is_active,
    ],
  );
  res.json(rows[0]);
});

// Deactivates rather than deletes, so the allowance history stays on record.
router.delete('/:id', async (req, res) => {
  const existing = await requireAllowance(v.id(req.params));
  const { rows } = await pool.query(
    `UPDATE fixed_allowances SET is_active = FALSE, updated_at = now() WHERE id = $1 RETURNING ${COLUMNS}`,
    [existing.id],
  );
  res.json(rows[0]);
});

export default router;
