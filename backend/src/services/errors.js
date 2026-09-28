/** Payroll inputs are incomplete or inconsistent (e.g. missing fiscal-year config). */
export class PayrollInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PayrollInputError';
  }
}
