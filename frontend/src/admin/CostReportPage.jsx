import { Link, useSearchParams } from 'react-router-dom';
import { qs } from '../shared/api.js';
import { formatAmount, formatMoney, formatPeriod } from '../shared/format.js';
import { useApi } from '../shared/hooks.js';
import { Alert, Card, Empty, EmploymentTypeFilter, ErrorAlert, Field, Loading, PageHeader, Stat, TypeBadge } from '../shared/ui.jsx';

export default function CostReportPage() {
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? '';
  const employmentType = params.get('employment_type') ?? '';
  const report = useApi(`/admin/cost-report${qs({ period, employment_type: employmentType })}`);
  const data = report.data;

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Internal cost report"
      />
      <Card>
        <div className="toolbar">
          <Field label="Pay period">
            <select value={data?.period ?? period} onChange={(event) => setFilter('period', event.target.value)}>
              {data && !data.available_periods.includes(data.period) && (
                <option value={data.period}>{formatPeriod(data.period)}</option>
              )}
              {data?.available_periods.map((value) => (
                <option key={value} value={value}>
                  {formatPeriod(value)}
                </option>
              ))}
            </select>
          </Field>
          <EmploymentTypeFilter value={employmentType} onChange={(value) => setFilter('employment_type', value)} />
        </div>
        <ErrorAlert error={report.error} />
        {report.loading && !data && <Loading />}
        {data && (
          <>
            <div className="stats">
              <Stat label="Net pay (paid out)" value={formatMoney(data.totals.net_pay)} />
              <Stat label="Employer SSF" value={formatMoney(data.totals.ssf_employer_amount)} />
              <Stat label="Secret salary" value={formatMoney(data.totals.secret_salary)} tone="admin" />
              <Stat label="Total employer cost" value={formatMoney(data.totals.total_employer_cost)} tone="info" />
            </div>
            {data.rows.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th className="num">Gross</th>
                      <th className="num">Net pay</th>
                      <th className="num">Employer SSF</th>
                      <th className="num">Secret salary</th>
                      <th className="num">Total employer cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.payslip_id}>
                        <td>
                          <Link to={`/employees/${row.employee_id}/payslips/${row.payslip_id}`} className="strong-link">
                            {row.employee_name}
                          </Link>
                          <div className="row-detail">{row.department}</div>
                        </td>
                        <td>
                          <TypeBadge type={row.employment_type} />
                        </td>
                        <td className="num">{formatAmount(row.gross_earnings)}</td>
                        <td className="num">{formatAmount(row.net_pay)}</td>
                        <td className="num">{formatAmount(row.ssf_employer_amount)}</td>
                        <td className="num">{row.secret_salary ? formatAmount(row.secret_salary) : '—'}</td>
                        <td className="num strong">{formatAmount(row.total_employer_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={2}>Total · {data.totals.employees} employee(s)</td>
                      <td className="num">{formatAmount(data.totals.gross_earnings)}</td>
                      <td className="num">{formatAmount(data.totals.net_pay)}</td>
                      <td className="num">{formatAmount(data.totals.ssf_employer_amount)}</td>
                      <td className="num">{formatAmount(data.totals.secret_salary)}</td>
                      <td className="num">{formatAmount(data.totals.total_employer_cost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <Empty>No payslips have been generated for {formatPeriod(data.period)} yet.</Empty>
            )}
          </>
        )}
      </Card>
    </>
  );
}
