import cors from 'cors';
import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rejectEmployeeWrites, requireAdmin, resolveRole } from './middleware/role.js';
import advances from './routes/advances.js';
import dynamicAllowances from './routes/dynamicAllowances.js';
import employees from './routes/employees.js';
import fiscalYears from './routes/fiscalYears.js';
import fixedAllowances from './routes/fixedAllowances.js';
import meta from './routes/meta.js';
import overtime from './routes/overtime.js';
import payslips from './routes/payslips.js';
import { oneTimeReimbursements, recurringReimbursements } from './routes/reimbursements.js';
import reports from './routes/reports.js';
import secretSalary from './routes/secretSalary.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ ok: true }));

  // Every route below needs an x-role header; the employee role is read-only.
  app.use(resolveRole, rejectEmployeeWrites);

  app.use('/meta', meta);
  app.use('/employees/:id/dynamic-allowances', dynamicAllowances);
  app.use('/employees/:id/overtime', overtime);
  app.use('/employees/:id/one-time-reimbursements', oneTimeReimbursements);
  app.use('/employees/:id/recurring-reimbursements', recurringReimbursements);
  app.use('/employees/:id/secret-salary', secretSalary);
  app.use('/employees/:id', advances);
  app.use('/employees', employees);
  app.use('/fiscal-years', fiscalYears);
  app.use('/fixed-allowances', fixedAllowances);
  app.use('/admin', requireAdmin, reports);
  app.use(payslips);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
