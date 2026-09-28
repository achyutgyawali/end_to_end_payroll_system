import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../shared/api.js';
import { formatDate, formatMoney, formatPeriod } from '../shared/format.js';
import { useAction, useApi } from '../shared/hooks.js';
import {
  Badge,
  Card,
  EmployeeStatusBadge,
  ErrorAlert,
  Loading,
  Modal,
  PageHeader,
  Stat,
  Tabs,
  TypeBadge,
} from '../shared/ui.jsx';
import EmployeeForm from './EmployeeForm.jsx';
import AdvancePanel from './panels/AdvancePanel.jsx';
import AllowancesPanel from './panels/AllowancesPanel.jsx';
import OvertimePanel from './panels/OvertimePanel.jsx';
import PayslipsPanel from './panels/PayslipsPanel.jsx';
import ReimbursementsPanel from './panels/ReimbursementsPanel.jsx';
import SecretSalaryPanel from './panels/SecretSalaryPanel.jsx';

const TABS = [
  { id: 'payslips', label: 'Payslips' },
  { id: 'allowances', label: 'Allowances' },
  { id: 'overtime', label: 'Overtime' },
  { id: 'reimbursements', label: 'Reimbursements' },
  { id: 'advance', label: 'Advance' },
  { id: 'secret-salary', label: 'Secret salary' },
];

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const { data: employee, error, loading, reload } = useApi(`/employees/${id}`);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'payslips';
  const [editing, setEditing] = useState(false);
  const remove = useAction(() => api(`/employees/${id}`, { method: 'DELETE' }), { onSuccess: reload });

  if (loading && !employee) return <Loading />;
  if (!employee) return <ErrorAlert error={error} />;

  const removed = Boolean(employee.deleted_at);

  const save = async (values) => {
    await api(`/employees/${id}`, { method: 'PUT', body: values });
    setEditing(false);
    reload();
  };

  const confirmRemove = () => {
    if (window.confirm(`Remove ${employee.name}? Their payslip history stays viewable, but no further payslips can be generated.`)) {
      remove.run();
    }
  };

  const panelProps = { employee, onChanged: reload, readOnly: removed };

  return (
    <>
      <p className="breadcrumb">
        <Link to="/employees">← Employees</Link>
      </p>
      <PageHeader
        title={
          <>
            {employee.name} <TypeBadge type={employee.employment_type} /> <EmployeeStatusBadge employee={employee} />
          </>
        }
        subtitle={employee.department}
        actions={
          !removed && (
            <>
              <button type="button" className="btn" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button type="button" className="btn btn-danger-ghost" onClick={confirmRemove} disabled={remove.pending}>
                Remove
              </button>
            </>
          )
        }
      />
      <ErrorAlert error={remove.error} />
      {removed && (
        <div className="alert alert-warning">
          Removed on {formatDate(employee.deleted_at)}. The record is kept so historical payslips remain viewable.
        </div>
      )}

      <div className="stats">
        <Stat label="Basic pay" value={formatMoney(employee.basic_pay)} />
        <Stat label="Joined" value={formatDate(employee.joining_date)} />
        <Stat label="Bank account" value={<span className="mono">{employee.dummy_bank_acc_no}</span>} />
        <Stat label="Latest payslip" value={formatPeriod(employee.latest_payslip_period)} />
        <Stat label="Next payslip" value={formatPeriod(employee.next_payslip_period)} />
        <Stat
          label={
            <>
              Secret salary <Badge tone="admin">Admin</Badge>
            </>
          }
          value={employee.secret_salary ? formatMoney(employee.secret_salary.amount) : '—'}
        />
      </div>

      <Card>
        <Tabs tabs={TABS} active={tab} onChange={(next) => setParams({ tab: next }, { replace: true })} />
        <div className="tab-panel">
          {tab === 'payslips' && <PayslipsPanel {...panelProps} />}
          {tab === 'allowances' && <AllowancesPanel {...panelProps} />}
          {tab === 'overtime' && <OvertimePanel {...panelProps} />}
          {tab === 'reimbursements' && <ReimbursementsPanel {...panelProps} />}
          {tab === 'advance' && <AdvancePanel {...panelProps} />}
          {tab === 'secret-salary' && <SecretSalaryPanel {...panelProps} />}
        </div>
      </Card>

      {editing && (
        <Modal title={`Edit ${employee.name}`} onClose={() => setEditing(false)}>
          <EmployeeForm initial={employee} submitLabel="Save changes" onSubmit={save} onCancel={() => setEditing(false)} />
        </Modal>
      )}
    </>
  );
}
