import { Link, useParams } from 'react-router-dom';
import { formatAmount, formatDate, formatMoney, formatPeriod } from '../shared/format.js';
import { useApi } from '../shared/hooks.js';
import { AdvanceTable, PayslipTable } from '../shared/tables.jsx';
import { Card, EmployeeStatusBadge, Empty, ErrorAlert, Loading, PageHeader, Stat, TypeBadge } from '../shared/ui.jsx';

function ActiveItems({ title, items, describe }) {
  const active = items?.filter((item) => !item.stopped_at) ?? [];
  return (
    <div>
      <h3 className="section-title">{title}</h3>
      {active.length ? (
        <ul className="pill-list">
          {active.map((item) => (
            <li key={item.id}>{describe(item)}</li>
          ))}
        </ul>
      ) : (
        <Empty>None.</Empty>
      )}
    </div>
  );
}

// Read-only profile (the API strips secret salary for this role anyway)
export default function EmployeeDetailPage() {
  const { id } = useParams();
  const employee = useApi(`/employees/${id}`);
  const payslips = useApi(`/employees/${id}/payslips`);
  const allowances = useApi(`/employees/${id}/dynamic-allowances`);
  const recurring = useApi(`/employees/${id}/recurring-reimbursements`);
  const advances = useApi(`/employees/${id}/advances`);

  if (employee.loading && !employee.data) return <Loading />;
  if (!employee.data) return <ErrorAlert error={employee.error} />;
  const e = employee.data;

  return (
    <>
      <p className="breadcrumb">
        <Link to="/employees">← Employees</Link>
      </p>
      <PageHeader
        title={
          <>
            {e.name} <TypeBadge type={e.employment_type} /> <EmployeeStatusBadge employee={e} />
          </>
        }
        subtitle={e.department}
      />

      <div className="stats">
        <Stat label="Basic pay" value={formatMoney(e.basic_pay)} />
        <Stat label="Joined" value={formatDate(e.joining_date)} />
        <Stat label="Bank account" value={<span className="mono">{e.dummy_bank_acc_no}</span>} />
        <Stat label="Latest payslip" value={formatPeriod(e.latest_payslip_period)} />
      </div>

      <Card title="Payslip history">
        <ErrorAlert error={payslips.error} />
        {payslips.loading && !payslips.data ? <Loading /> : payslips.data && <PayslipTable payslips={payslips.data} />}
      </Card>

      <Card title="Current allowances & reimbursements">
        <div className="two-col">
          <ActiveItems
            title="Allowances"
            items={allowances.data}
            describe={(item) => `${item.name} · Rs. ${formatAmount(item.amount)}`}
          />
          <ActiveItems
            title="Recurring reimbursements"
            items={recurring.data}
            describe={(item) => `${item.description} · Rs. ${formatAmount(item.amount)}`}
          />
        </div>
      </Card>

      <Card title="Advances">
        {advances.data ? <AdvanceTable advances={advances.data} /> : <Loading />}
      </Card>
    </>
  );
}
