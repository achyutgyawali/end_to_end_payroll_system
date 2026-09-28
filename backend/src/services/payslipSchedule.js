// Payslips go one month at a time, in order, never for a future month

import { earliestFiscalYearStart, fiscalYearForPeriod } from './fiscalYears.js';
import { currentPeriod, maxOf, nextPeriod, periodOfDate } from './periods.js';

// Joining month, but not before the first configured fiscal year
export function firstEligiblePeriod(employee, fiscalYears) {
  const earliestStart = earliestFiscalYearStart(fiscalYears);
  if (!earliestStart) return null;
  return maxOf(periodOfDate(employee.joining_date), periodOfDate(earliestStart));
}

/** The only period the employee's next payslip may be generated for. */
export function nextPayslipPeriod(employee, latestPeriod, fiscalYears) {
  return latestPeriod ? nextPeriod(latestPeriod) : firstEligiblePeriod(employee, fiscalYears);
}

const blocked = (code, reason, expectedPeriod = null) => ({ ok: false, code, reason, expected_period: expectedPeriod });

// Can this month's payslip be generated today? Returns { ok, ... } or a reason why not
export function checkPayslipGeneration({ employee, period, latestPeriod, fiscalYears, today }) {
  if (employee.deleted_at) return blocked('EMPLOYEE_REMOVED', 'Employee has been removed');
  if (!employee.is_active) return blocked('EMPLOYEE_INACTIVE', 'Employee is inactive');

  const expected = nextPayslipPeriod(employee, latestPeriod, fiscalYears);
  if (!expected) return blocked('NO_FISCAL_YEAR', 'No fiscal year has been configured');

  if (latestPeriod && period <= latestPeriod) {
    return period === latestPeriod
      ? blocked('ALREADY_GENERATED', `A payslip for ${period} has already been generated`, expected)
      : blocked('ALREADY_GENERATED', `Payslips are forward-only: already generated up to ${latestPeriod}`, expected);
  }
  if (period < expected) {
    return blocked('NOT_ELIGIBLE', `The first eligible pay period for this employee is ${expected}`, expected);
  }
  if (period > expected) {
    return blocked('OUT_OF_ORDER', `Payslips must be generated in order — generate ${expected} first`, expected);
  }
  if (period > currentPeriod(today)) {
    return blocked('FUTURE_PERIOD', `Cannot generate a payslip for a future pay period (${period})`, expected);
  }

  const fiscalYear = fiscalYearForPeriod(fiscalYears, period);
  if (!fiscalYear) return blocked('NO_FISCAL_YEAR', `No fiscal year covers pay period ${period}`, expected);

  return { ok: true, fiscalYear, expected_period: expected };
}
