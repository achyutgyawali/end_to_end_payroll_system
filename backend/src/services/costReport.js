import { secretSalaryApplies } from './applicability.js';
import { round2, sumAmounts } from './money.js';

// Employer cost = net pay + employer SSF + secret salary (admin only, never on the payslip)
export function buildCostReport(payslips, secretSalaries, period) {
  const rows = payslips.map((payslip) => {
    const secretSalary = sumAmounts(
      secretSalaries.filter((secret) => secret.employee_id === payslip.employee_id && secretSalaryApplies(secret, period)),
    );
    return {
      ...payslip,
      secret_salary: secretSalary,
      total_employer_cost: round2(payslip.net_pay + payslip.ssf_employer_amount + secretSalary),
    };
  });

  const total = (field) => round2(rows.reduce((sum, row) => sum + row[field], 0));
  return {
    rows,
    totals: {
      employees: rows.length,
      gross_earnings: total('gross_earnings'),
      total_deductions: total('total_deductions'),
      net_pay: total('net_pay'),
      ssf_employer_amount: total('ssf_employer_amount'),
      secret_salary: total('secret_salary'),
      total_employer_cost: total('total_employer_cost'),
    },
  };
}
