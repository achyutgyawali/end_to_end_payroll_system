import { HttpError } from '../lib/httpError.js';
import { PayrollInputError } from '../services/errors.js';

// Nicer messages for DB constraint errors (the services usually catch these first)
const CONSTRAINT_MESSAGES = {
  advances_one_per_fiscal_year: 'This employee already has an advance in that fiscal year (only one is allowed per fiscal year)',
  one_time_reimbursements_one_per_fiscal_year:
    'This employee already has a one-time reimbursement in that fiscal year (only one is allowed per fiscal year)',
  payslips_one_per_period: 'A payslip for this period has already been generated',
  fiscal_years_label_unique: 'A fiscal year with this label already exists',
  fiscal_years_no_overlap: 'Fiscal year dates overlap an existing fiscal year',
  fiscal_years_one_active: 'Another fiscal year is already active',
  secret_salaries_one_active: 'This employee already has an active secret salary — revoke it first',
};

// PostgreSQL SQLSTATE -> HTTP status
const PG_STATUS = {
  '23505': 409, // unique_violation
  '23503': 409, // foreign_key_violation
  '23P01': 409, // exclusion_violation
  '23001': 409, // restrict_violation (payslip immutability / forward-only triggers)
  '23514': 400, // check_violation
  '22P02': 400, // invalid_text_representation
  '22007': 400, // invalid_datetime_format
  '22008': 400, // datetime_field_overflow
  '22003': 400, // numeric_value_out_of_range
};

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...(err.details && { details: err.details }) });
  }
  if (err instanceof PayrollInputError) {
    return res.status(422).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  const status = PG_STATUS[err.code];
  if (status) {
    const message =
      CONSTRAINT_MESSAGES[err.constraint] ??
      (err.code === '23503' ? 'This record is still referenced by other data' : err.message);
    return res.status(status).json({ error: message });
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
