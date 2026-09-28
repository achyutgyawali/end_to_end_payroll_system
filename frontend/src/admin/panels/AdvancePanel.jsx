import { useState } from 'react';
import { api } from '../../shared/api.js';
import { AdvanceTable } from '../../shared/tables.jsx';
import { useAction, useApi } from '../../shared/hooks.js';
import { ErrorAlert, Field, Loading } from '../../shared/ui.jsx';

export default function AdvancePanel({ employee, readOnly }) {
  const advances = useApi(`/employees/${employee.id}/advances`);
  const blank = { total_amount: '', monthly_deduction_amount: '', started_pay_period: '' };
  const [form, setForm] = useState(blank);

  const create = useAction(
    () =>
      api(`/employees/${employee.id}/advance`, {
        method: 'POST',
        body: {
          total_amount: Number(form.total_amount),
          monthly_deduction_amount: Number(form.monthly_deduction_amount),
          started_pay_period: form.started_pay_period || undefined,
        },
      }),
    {
      onSuccess: () => {
        setForm(blank);
        advances.reload();
      },
    },
  );
  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <>
      <h3 className="section-title">Advance</h3>
      {!readOnly && (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.run();
          }}
        >
          <Field label="Total amount (Rs.)">
            <input type="number" min="0.01" step="0.01" value={form.total_amount} onChange={set('total_amount')} required />
          </Field>
          <Field label="Monthly deduction (Rs.)">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.monthly_deduction_amount}
              onChange={set('monthly_deduction_amount')}
              required
            />
          </Field>
          <Field label="First deduction period" hint="Optional — defaults to the next payable period">
            <input type="month" value={form.started_pay_period} onChange={set('started_pay_period')} placeholder="YYYY-MM" />
          </Field>
          <button type="submit" className="btn btn-primary" disabled={create.pending}>
            Grant advance
          </button>
        </form>
      )}
      <ErrorAlert error={create.error ?? advances.error} />
      {advances.loading && !advances.data ? <Loading /> : advances.data && <AdvanceTable advances={advances.data} />}
    </>
  );
}
