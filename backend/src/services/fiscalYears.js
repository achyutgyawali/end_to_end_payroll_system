import { addMonths, periodEndDate, periodOfDate } from './periods.js';

// A month belongs to the fiscal year containing its last day
export function fiscalYearForPeriod(fiscalYears, period) {
  const end = periodEndDate(period);
  return fiscalYears.find((fy) => fy.start_date <= end && end <= fy.end_date) ?? null;
}

// First and last months of a fiscal year
export function periodsCoveredBy(fiscalYear) {
  const endPeriod = periodOfDate(fiscalYear.end_date);
  return {
    first_period: periodOfDate(fiscalYear.start_date),
    last_period: periodEndDate(endPeriod) === fiscalYear.end_date ? endPeriod : addMonths(endPeriod, -1),
  };
}

export function earliestFiscalYearStart(fiscalYears) {
  return fiscalYears.reduce((earliest, fy) => (earliest === null || fy.start_date < earliest ? fy.start_date : earliest), null);
}
