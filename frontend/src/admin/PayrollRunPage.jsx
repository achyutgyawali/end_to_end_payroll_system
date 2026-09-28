import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, qs } from '../shared/api.js';
import { formatAmount, formatPeriod } from '../shared/format.js';
import { useAction, useApi } from '../shared/hooks.js';
import {
  Alert,
  Badge,
  Card,
  Empty,
  EmploymentTypeFilter,
  ErrorAlert,
  Field,
  Loading,
  PageHeader,
  Stat,
  TypeBadge,
} from '../shared/ui.jsx';
import PayslipPreviewModal from './PayslipPreviewModal.jsx';

const STATUS_BADGES = {
  GENERATED: <Badge tone="success">Generated</Badge>,
  READY: <Badge tone="info">Ready</Badge>,
  BLOCKED: <Badge tone="neutral">Blocked</Badge>,
};

export default function PayrollRunPage() {
  const meta = useApi('/meta');
  const [params, setParams] = useSearchParams();
  const period = params.get('period') ?? meta.data?.current_period ?? '';
  const employmentType = params.get('employment_type') ?? '';
  const status = useApi(period ? `/payroll/status${qs({ period, employment_type: employmentType })}` : null);
  const [previewing, setPreviewing] = useState(null);
  const [lastRun, setLastRun] = useState(null);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
    setLastRun(null);
  };

  const rows = status.data?.employees ?? [];
  const ready = rows.filter((row) => row.status === 'READY');
  const generated = rows.filter((row) => row.status === 'GENERATED');

  const runAll = useAction(
    () => api(`/payroll/generate${qs({ period, employment_type: employmentType })}`, { method: 'POST' }),
    {
      onSuccess: (result) => {
        setLastRun(result);
        status.reload();
      },
    },
  );

  const confirmRunAll = () => {
    const message = `Generate ${ready.length} payslip(s) for ${formatPeriod(period)}? Payslips are final and cannot be edited or deleted.`;
    if (window.confirm(message)) runAll.run();
  };

  const failed = lastRun?.results.filter((result) => result.status === 'FAILED') ?? [];
  // Payslips go in order, so point at the oldest period someone is still waiting on.
  const earliestOutstanding = rows
    .filter((row) => row.status !== 'GENERATED' && row.next_payslip_period)
    .map((row) => row.next_payslip_period)
    .sort()[0];

  return (
    <>
      <PageHeader
        title="Payroll run"
        subtitle="Generate payslips for a pay period. Each employee's payslips are generated in order, one period at a time."
        actions={
          <button type="button" className="btn btn-primary" disabled={!ready.length || runAll.pending} onClick={confirmRunAll}>
            {runAll.pending ? 'Generating…' : `Generate all ready (${ready.length})`}
          </button>
        }
      />

      <Card>
        <div className="toolbar">
          <Field label="Pay period">
            <input type="month" value={period} placeholder="YYYY-MM" onChange={(event) => setFilter('period', event.target.value)} />
          </Field>
          <EmploymentTypeFilter value={employmentType} onChange={(value) => setFilter('employment_type', value)} />
          {meta.data && period !== meta.data.current_period && (
            <button type="button" className="btn btn-ghost" onClick={() => setFilter('period', '')}>
              Current period
            </button>
          )}
        </div>

        {status.data && (
          <div className="stats">
            <Stat label="Employees" value={rows.length} />
            <Stat label="Generated" value={generated.length} tone="success" />
            <Stat label="Ready" value={ready.length} tone="info" />
            <Stat label="Blocked" value={rows.length - ready.length - generated.length} />
          </div>
        )}

        {lastRun && (
          <Alert kind={failed.length ? 'warning' : 'success'}>
            Generated {lastRun.results.length - failed.length} payslip(s) for {formatPeriod(lastRun.period)}.
            {failed.length > 0 && (
              <ul>
                {failed.map((result) => (
                  <li key={result.employee_id}>
                    {result.name}: {result.reason}
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        {earliestOutstanding && earliestOutstanding < period && (
          <Alert kind="info">
            Some employees still have earlier periods outstanding — payroll must be run in order, starting with{' '}
            {formatPeriod(earliestOutstanding)}.{' '}
            <button type="button" className="btn btn-small" onClick={() => setFilter('period', earliestOutstanding)}>
              Go to {formatPeriod(earliestOutstanding)}
            </button>
          </Alert>
        )}
        <ErrorAlert error={status.error ?? runAll.error ?? meta.error} />

        {status.loading && !status.data ? (
          <Loading />
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Next payslip</th>
                  <th className="num">Net pay</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employee_id}>
                    <td>
                      <Link to={`/employees/${row.employee_id}`} className="strong-link">
                        {row.name}
                      </Link>
                      <div className="row-detail">{row.department}</div>
                    </td>
                    <td>
                      <TypeBadge type={row.employment_type} />
                    </td>
                    <td>
                      {STATUS_BADGES[row.status]}
                      {row.reason && <div className="row-detail">{row.reason}</div>}
                    </td>
                    <td>{formatPeriod(row.next_payslip_period)}</td>
                    <td className="num">
                      {row.payslip_id ? (
                        <Link to={`/employees/${row.employee_id}/payslips/${row.payslip_id}`}>{formatAmount(row.net_pay)}</Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="actions">
                      {row.status === 'READY' && (
                        <button type="button" className="btn btn-small" onClick={() => setPreviewing(row.employee_id)}>
                          Preview
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          status.data && <Empty>No employees.</Empty>
        )}
      </Card>

      {previewing && (
        <PayslipPreviewModal
          employeeId={previewing}
          period={period}
          onClose={() => setPreviewing(null)}
          onGenerated={() => {
            setPreviewing(null);
            status.reload();
          }}
        />
      )}
    </>
  );
}
