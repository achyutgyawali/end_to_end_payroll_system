import { Link } from 'react-router-dom';
import { formatAmount, formatDate, formatPeriod } from './format.js';
import { Badge, Empty, EmployeeStatusBadge, TypeBadge } from './ui.jsx';

export function EmployeeTable({ employees }) {
  if (!employees.length) return <Empty>No employees match this filter.</Empty>;
  // Only present when the server served the admin role.
  const showSecretSalary = employees.some((employee) => 'secret_salary' in employee);

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Department</th>
            <th>Type</th>
            <th className="num">Basic pay</th>
            <th>Joined</th>
            <th>Status</th>
            <th>Next payslip</th>
            {showSecretSalary && <th className="num">Secret salary</th>}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className={employee.deleted_at ? 'row-muted' : undefined}>
              <td>
                <Link to={`/employees/${employee.id}`} className="strong-link">
                  {employee.name}
                </Link>
              </td>
              <td>{employee.department}</td>
              <td>
                <TypeBadge type={employee.employment_type} />
              </td>
              <td className="num">{formatAmount(employee.basic_pay)}</td>
              <td>{formatDate(employee.joining_date)}</td>
              <td>
                <EmployeeStatusBadge employee={employee} />
              </td>
              <td>{employee.next_payslip_period ? formatPeriod(employee.next_payslip_period) : '—'}</td>
              {showSecretSalary && (
                <td className="num">{employee.secret_salary ? formatAmount(employee.secret_salary.amount) : '—'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PayslipTable({ payslips, showEmployee = false, emptyText = 'No payslips yet.' }) {
  if (!payslips.length) return <Empty>{emptyText}</Empty>;
  const showEmployerCost = payslips.some((payslip) => 'ssf_employer_amount' in payslip);

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Period</th>
            {showEmployee && <th>Employee</th>}
            {showEmployee && <th>Department</th>}
            <th>Type</th>
            <th>FY</th>
            <th className="num">Gross</th>
            <th className="num">Deductions</th>
            <th className="num">Net pay</th>
            {showEmployerCost && <th className="num">Employer SSF</th>}
          </tr>
        </thead>
        <tbody>
          {payslips.map((payslip) => (
            <tr key={payslip.id}>
              <td>
                <Link to={`/employees/${payslip.employee_id}/payslips/${payslip.id}`} className="strong-link">
                  {formatPeriod(payslip.pay_period)}
                </Link>
              </td>
              {showEmployee && (
                <td>
                  <Link to={`/employees/${payslip.employee_id}`}>{payslip.employee_name}</Link>
                </td>
              )}
              {showEmployee && <td>{payslip.department}</td>}
              <td>
                <TypeBadge type={payslip.employment_type} />
              </td>
              <td>{payslip.fiscal_year_label}</td>
              <td className="num">{formatAmount(payslip.gross_earnings)}</td>
              <td className="num">{formatAmount(payslip.total_deductions)}</td>
              <td className="num strong">{formatAmount(payslip.net_pay)}</td>
              {showEmployerCost && <td className="num">{formatAmount(payslip.ssf_employer_amount)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdvanceTable({ advances }) {
  if (!advances.length) return <Empty>No advances.</Empty>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Fiscal year</th>
            <th>Starts</th>
            <th className="num">Total</th>
            <th className="num">Monthly</th>
            <th className="num">Outstanding</th>
            <th>Recovered</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {advances.map((advance) => {
            const recovered = ((advance.total_amount - advance.outstanding_balance) / advance.total_amount) * 100;
            return (
              <tr key={advance.id}>
                <td>{advance.fiscal_year_label}</td>
                <td>{formatPeriod(advance.started_pay_period)}</td>
                <td className="num">{formatAmount(advance.total_amount)}</td>
                <td className="num">{formatAmount(advance.monthly_deduction_amount)}</td>
                <td className="num">{formatAmount(advance.outstanding_balance)}</td>
                <td>
                  <div className="progress" title={`${recovered.toFixed(0)}% recovered`}>
                    <div className="progress-bar" style={{ width: `${recovered}%` }} />
                  </div>
                </td>
                <td>
                  {advance.status === 'ACTIVE' ? <Badge tone="warning">Active</Badge> : <Badge tone="success">Completed</Badge>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
