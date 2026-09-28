// Hides admin-only data (secret salary, employer SSF cost) from the employee role.
// Uses an allowlist so new fields stay hidden by default.

const EMPLOYEE_VIEW_EMPLOYEE_FIELDS = [
  'id',
  'name',
  'department',
  'employment_type',
  'basic_pay',
  'joining_date',
  'dummy_bank_acc_no',
  'is_active',
  'created_at',
  'updated_at',
  'deleted_at',
  'latest_payslip_period',
  'next_payslip_period',
];

const EMPLOYEE_VIEW_PAYSLIP_FIELDS = [
  'id',
  'employee_id',
  'pay_period',
  'fiscal_year_id',
  'fiscal_year_label',
  'employee_name',
  'department',
  'employment_type',
  'basic_pay',
  'joining_date',
  'dummy_bank_acc_no',
  'earnings',
  'deductions',
  'gross_earnings',
  'total_deductions',
  'net_pay',
  'generated_at',
];

function pick(object, fields) {
  return Object.fromEntries(fields.filter((field) => field in object).map((field) => [field, object[field]]));
}

export function serializeEmployee(employee, role) {
  return role === 'admin' ? employee : pick(employee, EMPLOYEE_VIEW_EMPLOYEE_FIELDS);
}

export function serializePayslip(payslip, role) {
  return role === 'admin' ? payslip : pick(payslip, EMPLOYEE_VIEW_PAYSLIP_FIELDS);
}
