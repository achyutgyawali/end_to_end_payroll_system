// Admin-only reports (mounted behind requireAdmin)
import { Router } from 'express';
import { pool } from '../db/pool.js';
import * as v from '../lib/validate.js';
import { buildCostReport } from '../services/costReport.js';
import { currentPeriod } from '../services/periods.js';

const router = Router();

// GET /admin/cost-report?period=YYYY-MM&employment_type=SSF|NON_SSF
// Defaults to the most recent period that has payslips.
router.get('/cost-report', async (req, res) => {
  const employmentType = v.oneOf(req.query, 'employment_type', v.EMPLOYMENT_TYPES, { optional: true }) ?? null;
  const { rows: periods } = await pool.query('SELECT DISTINCT pay_period FROM payslips ORDER BY pay_period DESC');
  const availablePeriods = periods.map((row) => row.pay_period);
  const period = v.period(req.query, 'period', { optional: true }) ?? availablePeriods[0] ?? currentPeriod();

  const { rows: payslips } = await pool.query(
    `SELECT id AS payslip_id, employee_id, employee_name, department, employment_type, pay_period,
            gross_earnings, total_deductions, net_pay, ssf_employer_amount
     FROM payslips
     WHERE pay_period = $1 AND ($2::text IS NULL OR employment_type = $2)
     ORDER BY employee_name`,
    [period, employmentType],
  );
  const { rows: secretSalaries } = await pool.query(
    'SELECT employee_id, amount, assigned_at, revoked_at FROM secret_salaries WHERE employee_id = ANY($1)',
    [payslips.map((payslip) => payslip.employee_id)],
  );

  res.json({
    period,
    employment_type: employmentType,
    available_periods: availablePeriods,
    ...buildCostReport(payslips, secretSalaries, period),
  });
});

export default router;
