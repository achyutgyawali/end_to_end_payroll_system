import { useState } from 'react';
import { useAction } from '../shared/hooks.js';
import { ErrorAlert, Field } from '../shared/ui.jsx';

const EMPTY = {
  name: '',
  department: '',
  employment_type: 'SSF',
  basic_pay: '',
  joining_date: '',
  dummy_bank_acc_no: '',
  is_active: true,
};

/** Create/edit form. `onSubmit(values)` performs the request. */
export default function EmployeeForm({ initial, submitLabel, onSubmit, onCancel }) {
  // Only the editable fields — never echo back anything else from the record.
  const [values, setValues] = useState(() =>
    Object.fromEntries(Object.entries(EMPTY).map(([field, fallback]) => [field, initial?.[field] ?? fallback])),
  );
  const { run, pending, error } = useAction(onSubmit);
  const set = (field) => (event) =>
    setValues((prev) => ({ ...prev, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const submit = (event) => {
    event.preventDefault();
    run({ ...values, basic_pay: Number(values.basic_pay) });
  };

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-grid">
        <Field label="Full name">
          <input value={values.name} onChange={set('name')} required autoFocus />
        </Field>
        <Field label="Department">
          <input value={values.department} onChange={set('department')} required />
        </Field>
        <Field label="Employment type">
          <select value={values.employment_type} onChange={set('employment_type')}>
            <option value="SSF">SSF</option>
            <option value="NON_SSF">Non-SSF</option>
          </select>
        </Field>
        <Field label="Basic pay (monthly, Rs.)">
          <input type="number" min="0" step="0.01" value={values.basic_pay} onChange={set('basic_pay')} required />
        </Field>
        <Field label="Joining date">
          <input type="date" value={values.joining_date} onChange={set('joining_date')} required />
        </Field>
        <Field label="Bank account no.">
          <input value={values.dummy_bank_acc_no} onChange={set('dummy_bank_acc_no')} required />
        </Field>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={values.is_active} onChange={set('is_active')} /> Active (eligible for payroll)
      </label>
      <ErrorAlert error={error} />
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
