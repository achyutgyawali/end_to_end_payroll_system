import { Router } from 'express';
import { pool, withTransaction } from '../db/pool.js';
import { badRequest, conflict, notFound } from '../lib/httpError.js';
import * as v from '../lib/validate.js';
import { periodsCoveredBy } from '../services/fiscalYears.js';
import { validateTaxSlabs } from '../services/tax.js';

const router = Router();

/** Fiscal years with their SSF, tax-slab and security-fund configs nested. */
async function loadFiscalYears(db, id = null) {
  const { rows: years } = await db.query(
    `SELECT fy.id, fy.label, fy.start_date, fy.end_date, fy.is_active, fy.created_at,
            (SELECT count(*) FROM payslips p WHERE p.fiscal_year_id = fy.id) AS payslip_count
     FROM fiscal_years fy
     WHERE $1::int IS NULL OR fy.id = $1
     ORDER BY fy.start_date DESC`,
    [id],
  );
  const ids = years.map((fy) => fy.id);
  const [ssf, slabs, securityFund] = await Promise.all([
    db.query('SELECT fiscal_year_id, employee_pct, employer_pct, updated_at FROM ssf_configs WHERE fiscal_year_id = ANY($1)', [ids]),
    db.query(
      'SELECT fiscal_year_id, slab_order, upper_bound, rate_pct FROM tax_slabs WHERE fiscal_year_id = ANY($1) ORDER BY slab_order',
      [ids],
    ),
    db.query('SELECT fiscal_year_id, percentage, updated_at FROM security_fund_configs WHERE fiscal_year_id = ANY($1)', [ids]),
  ]);
  const withoutFy = ({ fiscal_year_id, ...rest }) => rest;
  return years.map((fy) => ({
    ...fy,
    ...periodsCoveredBy(fy),
    ssf_config: ssf.rows.filter((row) => row.fiscal_year_id === fy.id).map(withoutFy)[0] ?? null,
    tax_slabs: slabs.rows.filter((row) => row.fiscal_year_id === fy.id).map(withoutFy),
    security_fund_config: securityFund.rows.filter((row) => row.fiscal_year_id === fy.id).map(withoutFy)[0] ?? null,
  }));
}

async function loadFiscalYear(db, id) {
  const [fiscalYear] = await loadFiscalYears(db, id);
  if (!fiscalYear) throw notFound('Fiscal year not found');
  return fiscalYear;
}

router.get('/', async (req, res) => {
  res.json(await loadFiscalYears(pool));
});

router.get('/:id', async (req, res) => {
  res.json(await loadFiscalYear(pool, v.id(req.params)));
});

router.post('/', async (req, res) => {
  const label = v.text(req.body, 'label');
  const startDate = v.date(req.body, 'start_date');
  const endDate = v.date(req.body, 'end_date');
  const isActive = v.boolean(req.body, 'is_active', { optional: true }) ?? false;
  if (endDate <= startDate) throw badRequest('end_date must be after start_date');

  const id = await withTransaction(async (client) => {
    if (isActive) await client.query('UPDATE fiscal_years SET is_active = FALSE WHERE is_active');
    const { rows } = await client.query(
      'INSERT INTO fiscal_years (label, start_date, end_date, is_active) VALUES ($1, $2, $3, $4) RETURNING id',
      [label, startDate, endDate, isActive],
    );
    return rows[0].id;
  });
  res.status(201).json(await loadFiscalYear(pool, id));
});

router.put('/:id', async (req, res) => {
  const id = v.id(req.params);
  const existing = await loadFiscalYear(pool, id);
  const label = v.text(req.body, 'label', { optional: true }) ?? existing.label;
  const startDate = v.date(req.body, 'start_date', { optional: true }) ?? existing.start_date;
  const endDate = v.date(req.body, 'end_date', { optional: true }) ?? existing.end_date;
  const isActive = v.boolean(req.body, 'is_active', { optional: true }) ?? existing.is_active;
  if (endDate <= startDate) throw badRequest('end_date must be after start_date');

  await withTransaction(async (client) => {
    if (startDate !== existing.start_date || endDate !== existing.end_date) {
      // dates are locked once anything uses this fiscal year
      const { rows } = await client.query(
        `SELECT EXISTS (SELECT 1 FROM payslips WHERE fiscal_year_id = $1)
             OR EXISTS (SELECT 1 FROM advances WHERE fiscal_year_id = $1)
             OR EXISTS (SELECT 1 FROM one_time_reimbursements WHERE fiscal_year_id = $1) AS in_use`,
        [id],
      );
      if (rows[0].in_use) throw conflict('Dates cannot change once payslips, advances or reimbursements reference this fiscal year');
    }
    if (isActive && !existing.is_active) await client.query('UPDATE fiscal_years SET is_active = FALSE WHERE is_active');
    await client.query(
      'UPDATE fiscal_years SET label = $2, start_date = $3, end_date = $4, is_active = $5 WHERE id = $1',
      [id, label, startDate, endDate, isActive],
    );
  });
  res.json(await loadFiscalYear(pool, id));
});

router.delete('/:id', async (req, res) => {
  const id = v.id(req.params);
  await loadFiscalYear(pool, id);
  // Configs cascade; payslips/advances/reimbursements block deletion (FK -> 409).
  await pool.query('DELETE FROM fiscal_years WHERE id = $1', [id]);
  res.status(204).end();
});

router.post('/:id/ssf-config', async (req, res) => {
  const id = v.id(req.params);
  const employeePct = v.percentage(req.body, 'employee_pct');
  const employerPct = v.percentage(req.body, 'employer_pct');
  await loadFiscalYear(pool, id);
  await pool.query(
    `INSERT INTO ssf_configs (fiscal_year_id, employee_pct, employer_pct) VALUES ($1, $2, $3)
     ON CONFLICT (fiscal_year_id)
     DO UPDATE SET employee_pct = EXCLUDED.employee_pct, employer_pct = EXCLUDED.employer_pct, updated_at = now()`,
    [id, employeePct, employerPct],
  );
  res.json(await loadFiscalYear(pool, id));
});

// Replaces all slabs. Body: { slabs: [{ upper_bound, rate_pct }] }, last upper_bound is null
router.post('/:id/tax-slabs', async (req, res) => {
  const id = v.id(req.params);
  if (!Array.isArray(req.body?.slabs)) throw badRequest('slabs must be an array');
  const slabs = req.body.slabs.map((slab, index) => ({
    slab_order: index + 1,
    upper_bound: slab?.upper_bound === null || slab?.upper_bound === '' ? null : Number(slab?.upper_bound),
    rate_pct: Number(slab?.rate_pct),
  }));
  const errors = validateTaxSlabs(slabs);
  if (errors.length) throw badRequest('Invalid tax slabs', errors);

  await loadFiscalYear(pool, id);
  await withTransaction(async (client) => {
    await client.query('DELETE FROM tax_slabs WHERE fiscal_year_id = $1', [id]);
    for (const slab of slabs) {
      await client.query(
        'INSERT INTO tax_slabs (fiscal_year_id, slab_order, upper_bound, rate_pct) VALUES ($1, $2, $3, $4)',
        [id, slab.slab_order, slab.upper_bound, slab.rate_pct],
      );
    }
  });
  res.json(await loadFiscalYear(pool, id));
});

router.post('/:id/security-fund-config', async (req, res) => {
  const id = v.id(req.params);
  const percentage = v.percentage(req.body, 'percentage');
  await loadFiscalYear(pool, id);
  await pool.query(
    `INSERT INTO security_fund_configs (fiscal_year_id, percentage) VALUES ($1, $2)
     ON CONFLICT (fiscal_year_id) DO UPDATE SET percentage = EXCLUDED.percentage, updated_at = now()`,
    [id, percentage],
  );
  res.json(await loadFiscalYear(pool, id));
});

export default router;
