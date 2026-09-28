import { useSearchParams } from 'react-router-dom';
import { qs } from '../shared/api.js';
import { useApi } from '../shared/hooks.js';
import { EmployeeTable } from '../shared/tables.jsx';
import { Card, EmploymentTypeFilter, ErrorAlert, Loading, PageHeader } from '../shared/ui.jsx';

export default function EmployeesPage() {
  const [params, setParams] = useSearchParams();
  const employmentType = params.get('employment_type') ?? '';
  const { data, error, loading } = useApi(`/employees${qs({ employment_type: employmentType })}`);

  return (
    <>
      <PageHeader title="Employees" subtitle="Browse employee records and payslip history." />
      <Card>
        <div className="toolbar">
          <EmploymentTypeFilter
            value={employmentType}
            onChange={(value) => setParams(value ? { employment_type: value } : {}, { replace: true })}
          />
        </div>
        <ErrorAlert error={error} />
        {loading && !data ? <Loading /> : data && <EmployeeTable employees={data} />}
      </Card>
    </>
  );
}
