import { useState } from 'react';
import { api } from '../../shared/api.js';
import { addMonths, formatAmount, formatDate, formatPeriod, todayLocal } from '../../shared/format.js';
import { useAction, useApi } from '../../shared/hooks.js';
import { Badge, Empty, ErrorAlert, Field, Loading } from '../../shared/ui.jsx';

// A dynamic allowance pays from the month after it's assigned
const firstPeriodFor = (assignedAt) => addMonths(assignedAt.slice(0, 7), 1);

export default function AllowancesPanel({ employee, readOnly }) {
  const allowances = useApi(`/employees/${employee.id}/dynamic-allowances`);
  const fixed = useApi('/fixed-allowances');
  const [form, setForm] = useState({ name: '', amount: '', assigned_at: todayLocal() });

  const add = useAction(
    () => api(`/employees/${employee.id}/dynamic-allowances`, { method: 'POST', body: { ...form, amount: Number(form.amount) } }),
    {
      onSuccess: () => {
        setForm({ name: '', amount: '', assigned_at: todayLocal() });
        allowances.reload();
      },
    },
  );
  const stop = useAction(
    (id) => api(`/employees/${employee.id}/dynamic-allowances/${id}`, { method: 'DELETE' }),
    { onSuccess: allowances.reload },
  );

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <>
      <h3 className="section-title">Dynamic allowances</h3>
      <p className="muted">
        Assigned to this employee only and paid every period until stopped. An allowance applies from the first pay
        period that starts after its assignment date.
      </p>

      {!readOnly && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            add.run();
          }}
        >
          <Field label="Name">
            <input value={form.name} onChange={set('name')} required placeholder="e.g. Team Lead Allowance" />
          </Field>
          <Field label="Monthly amount (Rs.)">
            <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required />
          </Field>
          <Field label="Assigned on" hint={form.assigned_at && `Applies from ${formatPeriod(firstPeriodFor(form.assigned_at))}`}>
            <input type="date" value={form.assigned_at} onChange={set('assigned_at')} required />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={add.pending}>
            Assign
          </button>
        </form>
      )}
      <ErrorAlert error={add.error ?? stop.error ?? allowances.error} />

      {allowances.loading && !allowances.data ? (
        <Loading />
      ) : allowances.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Amount</th>
                <th>Assigned</th>
                <th>Applies from</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {allowances.data.map((allowance) => (
                <tr key={allowance.id} className={allowance.stopped_at ? 'row-muted' : undefined}>
                  <td>{allowance.name}</td>
                  <td className="num">{formatAmount(allowance.amount)}</td>
                  <td>{formatDate(allowance.assigned_at)}</td>
                  <td>{formatPeriod(firstPeriodFor(allowance.assigned_at))}</td>
                  <td>
                    {allowance.stopped_at ? (
                      <Badge>Stopped {formatDate(allowance.stopped_at)}</Badge>
                    ) : (
                      <Badge tone="success">Active</Badge>
                    )}
                  </td>
                  <td className="actions">
                    {!allowance.stopped_at && !readOnly && (
                      <button
                        type="button"
                        className="btn btn-small btn-danger-ghost"
                        disabled={stop.pending}
                        onClick={() => window.confirm(`Stop "${allowance.name}" from today?`) && stop.run(allowance.id)}
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
        <Empty>No dynamic allowances assigned.</Empty>
      )}

      <h3 className="section-title">Fixed allowances (all employees)</h3>
      {fixed.data && (
        <ul className="pill-list">
          {fixed.data
            .filter((allowance) => allowance.is_active)
            .map((allowance) => (
              <li key={allowance.id}>
                {allowance.name} · Rs. {formatAmount(allowance.amount)}
              </li>
            ))}
        </ul>
      )}
    </>
  );
}
