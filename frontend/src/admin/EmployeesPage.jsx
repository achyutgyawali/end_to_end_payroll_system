import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, qs } from '../shared/api.js';
import { useApi } from '../shared/hooks.js';
import { EmployeeTable } from '../shared/tables.jsx';
import { Card, EmploymentTypeFilter, ErrorAlert, Loading, Modal, PageHeader } from '../shared/ui.jsx';
import EmployeeForm from './EmployeeForm.jsx';

export default function EmployeesPage() {
  const [params, setParams] = useSearchParams();
  const employmentType = params.get('employment_type') ?? '';
  const includeRemoved = params.get('include_removed') === 'true';
  const { data, error, loading } = useApi(
    `/employees${qs({ employment_type: employmentType, include_removed: includeRemoved || undefined })}`,
  );
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const create = async (values) => {
    const employee = await api('/employees', { method: 'POST', body: values });
    navigate(`/employees/${employee.id}`);
  };

  return (
    <>
      <PageHeader
        title="Employees"
        subtitle="Manage employee records."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            + Add employee
          </button>
        }
      />
      <Card>
        <div className="toolbar">
          <EmploymentTypeFilter value={employmentType} onChange={(value) => setFilter('employment_type', value)} />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeRemoved}
              onChange={(event) => setFilter('include_removed', event.target.checked ? 'true' : '')}
            />{' '}
            Show removed
          </label>
        </div>
        <ErrorAlert error={error} />
        {loading && !data ? <Loading /> : data && <EmployeeTable employees={data} />}
      </Card>

      {adding && (
        <Modal title="Add employee" onClose={() => setAdding(false)}>
          <EmployeeForm submitLabel="Create employee" onSubmit={create} onCancel={() => setAdding(false)} />
        </Modal>
      )}
    </>
  );
}
