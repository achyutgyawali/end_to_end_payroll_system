import { useState } from 'react';
import { api } from '../../shared/api.js';
import { formatAmount, formatDateTime, formatNumber, formatPeriod } from '../../shared/format.js';
import { useAction, useApi } from '../../shared/hooks.js';
import { Alert, Empty, ErrorAlert, Field, Loading } from '../../shared/ui.jsx';

const MONTHLY_WORKING_HOURS = 208;

export default function OvertimePanel({ employee, readOnly }) {
  const meta = useApi('/meta');
  const entries = useApi(`/employees/${employee.id}/overtime`);
  const [form, setForm] = useState({ hours: '', multiplier: '1.5' });

  const hourlyRate = employee.basic_pay / MONTHLY_WORKING_HOURS;
  const period = meta.data?.current_period;
  const latest = employee.latest_payslip_period;
  const periodClosed = period && latest && period <= latest;
  const isOpen = (entryPeriod) => !latest || entryPeriod > latest;

  const add = useAction(
    () =>
      api(`/employees/${employee.id}/overtime`, {
        method: 'POST',
        body: { hours: Number(form.hours), multiplier: Number(form.multiplier) },
      }),
    {
      onSuccess: () => {
        setForm((prev) => ({ ...prev, hours: '' }));
        entries.reload();
      },
    },
  );
  const remove = useAction((id) => api(`/employees/${employee.id}/overtime/${id}`, { method: 'DELETE' }), {
    onSuccess: entries.reload,
  });

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));
  const estimate = Number(form.hours) * hourlyRate * Number(form.multiplier || 0);

  return (
    <>
      <h3 className="section-title">Record overtime{period ? ` · ${formatPeriod(period)}` : ''}</h3>

      {readOnly ? null : periodClosed ? (
        <Alert kind="info">The {formatPeriod(period)} payslip is already generated, so overtime for this period is closed.</Alert>
      ) : (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            add.run();
          }}
        >
          <Field label="Hours">
            <input type="number" min="0.25" max="744" step="0.25" value={form.hours} onChange={set('hours')} required />
          </Field>
          <Field label="Multiplier">
            <input type="number" min="0.01" step="0.01" value={form.multiplier} onChange={set('multiplier')} required />
          </Field>
          <Field label="Estimated pay">
            <output className="output">{form.hours ? `Rs. ${formatAmount(estimate)}` : '—'}</output>
          </Field>
          <button type="submit" className="btn btn-primary" disabled={add.pending || !period}>
            Add entry
          </button>
        </form>
      )}
      <ErrorAlert error={add.error ?? remove.error ?? entries.error} />

      {entries.loading && !entries.data ? (
        <Loading />
      ) : entries.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th className="num">Hours</th>
                <th className="num">Multiplier</th>
                <th className="num">Est. amount</th>
                <th>Recorded</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {entries.data.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatPeriod(entry.pay_period)}</td>
                  <td className="num">{formatNumber(entry.hours)}</td>
                  <td className="num">× {entry.multiplier}</td>
                  <td className="num">{formatAmount(entry.hours * hourlyRate * entry.multiplier)}</td>
                  <td>{formatDateTime(entry.created_at)}</td>
                  <td className="actions">
                    {!readOnly && isOpen(entry.pay_period) && (
                      <button
                        type="button"
                        className="btn btn-small btn-danger-ghost"
                        disabled={remove.pending}
                        onClick={() => window.confirm('Delete this overtime entry?') && remove.run(entry.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Estimates use the current basic pay; the payslip records the exact amount at generation time.
          </p>
        </div>
      ) : (
        <Empty>No overtime recorded.</Empty>
      )}
    </>
  );
}
