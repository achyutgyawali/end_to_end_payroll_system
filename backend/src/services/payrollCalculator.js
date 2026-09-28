import {
  advanceApplies,
  dynamicAllowanceApplies,
  oneTimeReimbursementApplies,
  overtimeApplies,
  recurringReimbursementApplies,
} from './applicability.js';
import { PayrollInputError } from './errors.js';
import { round2, sumAmounts } from './money.js';
import { calculateAnnualTax } from './tax.js';

// monthly hours used for the overtime hourly rate
export const MONTHLY_WORKING_HOURS = 208;

const percentOf = (base, pct) => round2((base * pct) / 100);
const sumValues = (object) => round2(Object.values(object).reduce((total, value) => total + value, 0));

// each entry: hours × (basic_pay / 208) × multiplier
export function calculateOvertime(basicPay, entries) {
  const hourlyRate = basicPay / MONTHLY_WORKING_HOURS;
  return entries.map((entry) => ({
    overtime_id: entry.id,
    hours: entry.hours,
    multiplier: entry.multiplier,
    hourly_rate: round2(hourlyRate),
    amount: round2(entry.hours * hourlyRate * entry.multiplier),
  }));
}

// taxable income = basic_pay × 12, monthly TDS = annual tax / 12
export function calculateIncomeTax(basicPay, taxSlabs) {
  const annualTaxableIncome = round2(basicPay * 12);
  const { annual_tax, slabs } = calculateAnnualTax(annualTaxableIncome, taxSlabs);
  return {
    annual_taxable_income: annualTaxableIncome,
    annual_tax,
    amount: round2(annual_tax / 12),
    slabs,
  };
}

// deduct min(monthly installment, outstanding balance)
export function calculateAdvanceInstallment(advance) {
  const amount = round2(Math.min(advance.monthly_deduction_amount, advance.outstanding_balance));
  return {
    advance_id: advance.id,
    total_amount: advance.total_amount,
    amount,
    outstanding_before: advance.outstanding_balance,
    outstanding_after: round2(advance.outstanding_balance - amount),
  };
}

// Builds the payslip for one employee and month (no DB access).
// Pass all of the employee's items, it picks the ones that apply.
export function calculatePayslip({
  period,
  employee,
  fiscalYear,
  ssfConfig,
  taxSlabs,
  securityFundConfig,
  fixedAllowances = [],
  dynamicAllowances = [],
  overtimeEntries = [],
  oneTimeReimbursements = [],
  recurringReimbursements = [],
  advances = [],
}) {
  const isSsf = employee.employment_type === 'SSF';
  if (isSsf && !ssfConfig) {
    throw new PayrollInputError(`SSF rates are not configured for fiscal year ${fiscalYear.label}`);
  }
  if (!taxSlabs?.length) {
    throw new PayrollInputError(`Tax slabs are not configured for fiscal year ${fiscalYear.label}`);
  }
  if (!securityFundConfig) {
    throw new PayrollInputError(`Security fund % is not configured for fiscal year ${fiscalYear.label}`);
  }

  const basicPay = employee.basic_pay;

  const earningItems = {
    fixed_allowances: fixedAllowances
      .filter((allowance) => allowance.is_active)
      .map((allowance) => ({ fixed_allowance_id: allowance.id, name: allowance.name, amount: allowance.amount })),
    dynamic_allowances: dynamicAllowances
      .filter((allowance) => dynamicAllowanceApplies(allowance, period))
      .map((allowance) => ({ dynamic_allowance_id: allowance.id, name: allowance.name, amount: allowance.amount })),
    overtime: calculateOvertime(basicPay, overtimeEntries.filter((entry) => overtimeApplies(entry, period))),
    one_time_reimbursements: oneTimeReimbursements
      .filter((item) => oneTimeReimbursementApplies(item, period))
      .map((item) => ({ reimbursement_id: item.id, description: item.description, amount: item.amount })),
    recurring_reimbursements: recurringReimbursements
      .filter((item) => recurringReimbursementApplies(item, period))
      .map((item) => ({ reimbursement_id: item.id, description: item.description, amount: item.amount })),
  };
  const earningTotals = {
    basic_pay: basicPay,
    fixed_allowances: sumAmounts(earningItems.fixed_allowances),
    dynamic_allowances: sumAmounts(earningItems.dynamic_allowances),
    overtime: sumAmounts(earningItems.overtime),
    one_time_reimbursements: sumAmounts(earningItems.one_time_reimbursements),
    recurring_reimbursements: sumAmounts(earningItems.recurring_reimbursements),
  };
  const grossEarnings = sumValues(earningTotals);

  const deductionItems = {
    ssf_employee: isSsf ? { rate_pct: ssfConfig.employee_pct, amount: percentOf(basicPay, ssfConfig.employee_pct) } : null,
    income_tax: calculateIncomeTax(basicPay, taxSlabs),
    security_fund: { rate_pct: securityFundConfig.percentage, amount: percentOf(basicPay, securityFundConfig.percentage) },
    advances: advances.filter((advance) => advanceApplies(advance, period)).map(calculateAdvanceInstallment),
  };
  const deductionTotals = {
    ssf_employee: deductionItems.ssf_employee?.amount ?? 0,
    income_tax: deductionItems.income_tax.amount,
    security_fund: deductionItems.security_fund.amount,
    advances: sumAmounts(deductionItems.advances),
  };
  const totalDeductions = sumValues(deductionTotals);

  return {
    employee_id: employee.id,
    pay_period: period,
    fiscal_year_id: fiscalYear.id,
    fiscal_year_label: fiscalYear.label,
    employee_name: employee.name,
    department: employee.department,
    employment_type: employee.employment_type,
    basic_pay: basicPay,
    joining_date: employee.joining_date,
    dummy_bank_acc_no: employee.dummy_bank_acc_no,
    earnings: { basic_pay: basicPay, ...earningItems, totals: earningTotals },
    deductions: { ...deductionItems, totals: deductionTotals },
    gross_earnings: grossEarnings,
    total_deductions: totalDeductions,
    net_pay: round2(grossEarnings - totalDeductions),
    ssf_employer_pct: isSsf ? ssfConfig.employer_pct : null,
    ssf_employer_amount: isSsf ? percentOf(basicPay, ssfConfig.employer_pct) : 0,
  };
}
