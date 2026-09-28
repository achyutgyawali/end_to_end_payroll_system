import { useState } from 'react';
import { api } from '../../shared/api.js';
import { formatAmount, formatDate, formatPeriod, todayLocal } from '../../shared/format.js';
import { useAction, useApi } from '../../shared/hooks.js';
import { Badge, Empty, ErrorAlert, Field, Loading } from '../../shared/ui.jsx';

function OneTimeReimbursements({ employee, readOnly }) {
  const list = useApi(`/employees/${employee.id}/one-time-reimbursements`);
  const blank = { pay_period: employee.next_payslip_period ?? '', amount: '', description: '' };
  const [form, setForm] = useState(blank);
  const latest = employee.latest_payslip_period;
  const isOpen = (period) => !latest || period > latest;

  const add = useAction(
    () =>
      api(`/employees/${employee.id}/one-time-reimbursements`, {
        method: 'POST',
        body: { ...form, amount: Number(form.amount) },
      }),
    {
      onSuccess: () => {
        setForm(blank);
        list.reload();
      },
    },
  );
  const remove = useAction(
    (id) => api(`/employees/${employee.id}/one-time-reimbursements/${id}`, { method: 'DELETE' }),
    { onSuccess: list.reload },
  );
  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <>
      <h3 className="section-title">One-time reimbursements</h3>
      <p className="muted">
        Paid in exactly one pay period — any period whose payslip hasn&apos;t been generated yet. Only one per fiscal
        year.
      </p>
      {!readOnly && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            add.run();
          }}
        >
          <Field label="Pay period">
            <input type="month" value={form.pay_period} onChange={set('pay_period')} placeholder="YYYY-MM" required />
          </Field>
          <Field label="Amount (Rs.)">
            <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required />
          </Field>
          <Field label="Description" wide>
            <input value={form.description} onChange={set('description')} required placeholder="e.g. Conference fee" />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={add.pending}>
            Add
          </button>
        </form>
      )}
      <ErrorAlert error={add.error ?? remove.error ?? list.error} />
      {list.loading && !list.data ? (
        <Loading />
      ) : list.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Fiscal year</th>
                <th>Pay period</th>
                <th>Description</th>
                <th className="num">Amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr key={item.id}>
                  <td>{item.fiscal_year_label}</td>
                  <td>{formatPeriod(item.pay_period)}</td>
                  <td>{item.description}</td>
                  <td className="num">{formatAmount(item.amount)}</td>
                  <td>{isOpen(item.pay_period) ? <Badge tone="warning">Pending</Badge> : <Badge tone="success">Paid</Badge>}</td>
                  <td className="actions">
                    {!readOnly && isOpen(item.pay_period) && (
                      <button
                        type="button"
                        className="btn btn-small btn-danger-ghost"
                        disabled={remove.pending}
                        onClick={() => window.confirm('Delete this reimbursement?') && remove.run(item.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No one-time reimbursements.</Empty>
      )}
    </>
  );
}

function RecurringReimbursements({ employee, readOnly }) {
  const list = useApi(`/employees/${employee.id}/recurring-reimbursements`);
  const blank = { amount: '', description: '', started_at: todayLocal() };
  const [form, setForm] = useState(blank);

  const add = useAction(
    () =>
      api(`/employees/${employee.id}/recurring-reimbursements`, {
        method: 'POST',
        body: { ...form, amount: Number(form.amount) },
      }),
    {
      onSuccess: () => {
        setForm(blank);
        list.reload();
      },
    },
  );
  const stop = useAction(
    (id) => api(`/employees/${employee.id}/recurring-reimbursements/${id}`, { method: 'PATCH' }),
    { onSuccess: list.reload },
  );
  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <>
      <h3 className="section-title">Recurring reimbursements</h3>
      <p className="muted">Paid every period from the month of the start date until stopped.</p>
      {!readOnly && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            add.run();
          }}
        >
          <Field label="Monthly amount (Rs.)">
            <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required />
          </Field>
          <Field label="Description" wide>
            <input value={form.description} onChange={set('description')} required placeholder="e.g. Internet" />
          </Field>
          <Field label="Starts on">
            <input type="date" value={form.started_at} onChange={set('started_at')} required />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={add.pending}>
            Add
          </button>
        </form>
      )}
      <ErrorAlert error={add.error ?? stop.error ?? list.error} />
      {list.loading && !list.data ? (
        <Loading />
      ) : list.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Description</th>
                <th className="num">Amount</th>
                <th>Started</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr key={item.id} className={item.stopped_at ? 'row-muted' : undefined}>
                  <td>{item.description}</td>
                  <td className="num">{formatAmount(item.amount)}</td>
                  <td>{formatDate(item.started_at)}</td>
                  <td>
                    {item.stopped_at ? <Badge>Stopped {formatDate(item.stopped_at)}</Badge> : <Badge tone="success">Active</Badge>}
                  </td>
                  <td className="actions">
                    {!item.stopped_at && !readOnly && (
                      <button
                        type="button"
                        className="btn btn-small btn-danger-ghost"
                        disabled={stop.pending}
                        onClick={() => window.confirm(`Stop "${item.description}" from today?`) && stop.run(item.id)}
                      >
                        Stop
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No recurring reimbursements.</Empty>
      )}
    </>
  );
}

export default function ReimbursementsPanel(props) {
  return (
    <>
      <OneTimeReimbursements {...props} />
      <RecurringReimbursements {...props} />
    </>
  );
}
