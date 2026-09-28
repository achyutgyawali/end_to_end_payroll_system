// Which employee items apply to a given pay period

import { periodEndDate, periodStartDate } from './periods.js';

const notStoppedBy = (stoppedAt, period) => stoppedAt == null || stoppedAt > periodEndDate(period);

// assigned before the month starts and not stopped
export function dynamicAllowanceApplies(allowance, period) {
  return allowance.assigned_at < periodStartDate(period) && notStoppedBy(allowance.stopped_at, period);
}

// from the month of started_at until stopped
export function recurringReimbursementApplies(reimbursement, period) {
  return reimbursement.started_at <= periodEndDate(period) && notStoppedBy(reimbursement.stopped_at, period);
}

// only its own month
export function oneTimeReimbursementApplies(reimbursement, period) {
  return reimbursement.pay_period === period;
}

// only its own month
export function overtimeApplies(entry, period) {
  return entry.pay_period === period;
}

// active advance, from its start month onwards
export function advanceApplies(advance, period) {
  return advance.status === 'ACTIVE' && advance.outstanding_balance > 0 && advance.started_pay_period <= period;
}

// secret salary active during the month (cost report only)
export function secretSalaryApplies(secretSalary, period) {
  return secretSalary.assigned_at <= periodEndDate(period) && notStoppedBy(secretSalary.revoked_at, period);
}
