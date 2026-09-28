// GET /meta - server's current date, so the UI uses the same current month
import { Router } from 'express';
import { listFiscalYears } from '../db/lookups.js';
import { pool } from '../db/pool.js';
import { fiscalYearForPeriod } from '../services/fiscalYears.js';
import { currentPeriod, localDate } from '../services/periods.js';

const router = Router();

router.get('/', async (req, res) => {
  const today = localDate();
  const period = currentPeriod(today);
  const fiscalYear = fiscalYearForPeriod(await listFiscalYears(pool), period);
  res.json({ role: req.role, today, current_period: period, current_fiscal_year: fiscalYear });
});

export default router;
