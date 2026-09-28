// Lookups shared by several routes

import { conflict, notFound } from '../lib/httpError.js';
import { nextPayslipPeriod } from '../services/payslipSchedule.js';

const EMPLOYEE_COLUMNS = `id, name, department, employment_type, basic_pay, joining_date,
  dummy_bank_acc_no, is_active, created_at, updated_at, deleted_at`;

// 404 if missing, 409 if removed (unless allowRemoved). forUpdate locks the row.
export async function requireEmployee(db, id, { allowRemoved = false, forUpdate = false } = {}) {
  const { rows } = await db.query(
    `SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id],
  );
  const employee = rows[0];
  if (!employee) throw notFound('Employee not found');
  if (employee.deleted_at && !allowRemoved) throw conflict('Employee has been removed');
  return employee;
}

export async function listFiscalYears(db) {
  const { rows } = await db.query('SELECT id, label, start_date, end_date, is_active FROM fiscal_years ORDER BY start_date');
  return rows;
}

export async function latestPayslipPeriod(db, employeeId) {
  const { rows } = await db.query('SELECT max(pay_period) AS latest FROM payslips WHERE employee_id = $1', [employeeId]);
  return rows[0].latest;
}

// Blocks adding items to a month that can't be paid anymore (already generated or too early)
export async function assertPeriodPayable(db, employee, period) {
  const fiscalYears = await listFiscalYears(db);
  const latest = await latestPayslipPeriod(db, employee.id);
  if (latest && period <= latest) {
    throw conflict(`Payslips for this employee are already generated through ${latest}; ${period} is closed`);
  }
  const next = nextPayslipPeriod(employee, latest, fiscalYears);
  if (next && period < next) {
    throw conflict(`${period} is before this employee's first payable period (${next})`);
  }
  return { fiscalYears, next };
}
