// Periods are 'YYYY-MM' and dates 'YYYY-MM-DD', so plain string comparison works

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n, width = 2) => String(n).padStart(width, '0');

export function isValidPeriod(value) {
  return typeof value === 'string' && PERIOD_RE.test(value);
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function addMonths(period, count) {
  const [year, month] = period.split('-').map(Number);
  const index = year * 12 + (month - 1) + count;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

export const nextPeriod = (period) => addMonths(period, 1);

export const periodOfDate = (date) => date.slice(0, 7);

export const periodStartDate = (period) => `${period}-01`;

export function periodEndDate(period) {
  const [year, month] = period.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${pad(lastDay)}`;
}

export const maxOf = (a, b) => (a >= b ? a : b);

/** Today's local calendar date as 'YYYY-MM-DD'. */
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The current pay period: the calendar month containing `today`. */
export const currentPeriod = (today = localDate()) => periodOfDate(today);
