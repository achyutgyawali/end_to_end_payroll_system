import { useState } from 'react';
import { api } from '../../shared/api.js';
import { formatAmount, formatDate, todayLocal } from '../../shared/format.js';
import { useAction, useApi } from '../../shared/hooks.js';
import { Alert, Badge, Empty, ErrorAlert, Field, Loading } from '../../shared/ui.jsx';

export default function SecretSalaryPanel({ employee, onChanged, readOnly }) {
  const history = useApi(`/employees/${employee.id}/secret-salary`);
  const blank = { amount: '', assigned_at: todayLocal() };
  const [form, setForm] = useState(blank);
  const active = history.data?.find((item) => !item.revoked_at);

  const refresh = () => {
    history.reload();
    onChanged();
  };
  const assign = useAction(
    () =>
      api(`/employees/${employee.id}/secret-salary`, {
        method: 'POST',
        body: { amount: Number(form.amount), assigned_at: form.assigned_at },
      }),
    {
      onSuccess: () => {
        setForm(blank);
        refresh();
      },
    },
  );
  const revoke = useAction(() => api(`/employees/${employee.id}/secret-salary`, { method: 'PATCH' }), { onSuccess: refresh });
  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <>

      <h3 className="section-title">Current</h3>
      {history.loading && !history.data && <Loading />}
      {history.data &&
        (active ? (
          <div className="next-payslip">
            <div>
              <h3>Rs. {formatAmount(active.amount)} / month</h3>
              <p className="muted">Since {formatDate(active.assigned_at)}</p>
            </div>
            {!readOnly && (
              <button
                type="button"
                className="btn btn-danger-ghost"
                disabled={revoke.pending}
                onClick={() => window.confirm('Revoke this secret salary from today?') && revoke.run()}
              >
                Revoke
              </button>
            )}
          </div>
        ) : readOnly ? (
          <Empty>No active secret salary.</Empty>
        ) : (
          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              assign.run();
            }}
          >
            <Field label="Monthly amount (Rs.)">
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required />
            </Field>
            <Field label="Effective from">
              <input type="date" value={form.assigned_at} onChange={set('assigned_at')} required />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={assign.pending}>
              Assign secret salary
            </button>
          </form>
        ))}
      <ErrorAlert error={assign.error ?? revoke.error ?? history.error} />

      {history.data?.some((item) => item.revoked_at) && (
        <>
          <h3 className="section-title">History</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="num">Amount</th>
                  <th>From</th>
                  <th>Revoked</th>
                </tr>
              </thead>
              <tbody>
                {history.data
                  .filter((item) => item.revoked_at)
                  .map((item) => (
                    <tr key={item.id}>
                      <td className="num">{formatAmount(item.amount)}</td>
                      <td>{formatDate(item.assigned_at)}</td>
                      <td>
                        <Badge>{formatDate(item.revoked_at)}</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
