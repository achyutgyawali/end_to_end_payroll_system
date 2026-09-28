// Indian/Nepali digit grouping: 1,00,000.00
const amountFormat = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plainFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export const formatAmount = (value) => (value == null ? '—' : amountFormat.format(value));
export const formatMoney = (value) => (value == null ? '—' : `Rs. ${amountFormat.format(value)}`);
export const formatNumber = (value) => (value == null ? '—' : plainFormat.format(value));

export const EMPLOYMENT_TYPE_LABELS = { SSF: 'SSF', NON_SSF: 'Non-SSF' };

/** '2026-09' -> 'Sep 2026' */
export function formatPeriod(period) {
  if (!period) return '—';
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** '2026-09-27' -> '27 Sep 2026' */
export function formatDate(date) {
  if (!date) return '—';
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Same arithmetic as the backend: 'YYYY-MM' plus n months. */
export function addMonths(period, count) {
  const [year, month] = period.split('-').map(Number);
  const index = year * 12 + (month - 1) + count;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
