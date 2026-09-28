// Payslip pages for both roles, the API decides what each role gets
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { qs } from './api.js';
import { useApi } from './hooks.js';
import PayslipView from './PayslipView.jsx';
import { PayslipTable } from './tables.jsx';
import { Card, EmploymentTypeFilter, ErrorAlert, Field, Loading, PageHeader } from './ui.jsx';

export function PayslipsPage() {
  const [params, setParams] = useSearchParams();
  const employmentType = params.get('employment_type') ?? '';
  const period = params.get('period') ?? '';
  const { data, error, loading } = useApi(`/payslips${qs({ employment_type: employmentType, period })}`);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title="Payslips" subtitle="Every generated payslip. Filter SSF and Non-SSF employees separately." />
      <Card>
        <div className="toolbar">
          <EmploymentTypeFilter value={employmentType} onChange={(value) => setFilter('employment_type', value)} />
          <Field label="Pay period">
            <input
              type="month"
              value={period}
              placeholder="YYYY-MM"
              onChange={(event) => setFilter('period', event.target.value)}
            />
          </Field>
          {period && (
            <button type="button" className="btn btn-ghost" onClick={() => setFilter('period', '')}>
              All periods
            </button>
          )}
        </div>
        <ErrorAlert error={error} />
        {loading && !data ? <Loading /> : data && <PayslipTable payslips={data} showEmployee emptyText="No payslips match this filter." />}
      </Card>
    </>
  );
}

export function PayslipDetailPage() {
  const { id, payslipId } = useParams();
  const { data, error, loading } = useApi(`/employees/${id}/payslips/${payslipId}`);

  return (
    <>
      <p className="breadcrumb">
        <Link to={`/employees/${id}`}>← Back to employee</Link>
      </p>
      <ErrorAlert error={error} />
      {loading && <Loading />}
      {data && (
        <Card>
          <PayslipView payslip={data} />
        </Card>
      )}
    </>
  );
}
