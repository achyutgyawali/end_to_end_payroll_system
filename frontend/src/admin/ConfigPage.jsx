import { useState } from 'react';
import { api } from '../shared/api.js';
import { formatAmount, formatDate, formatNumber, formatPeriod } from '../shared/format.js';
import { useAction, useApi } from '../shared/hooks.js';
import { Badge, Card, Empty, ErrorAlert, Field, Loading, Modal, PageHeader } from '../shared/ui.jsx';

export default function ConfigPage() {
  return (
    <>
      <PageHeader
        title="Configuration"
        subtitle="Rates are scoped to a fiscal year. Changing them never alters payslips already generated — each payslip keeps its own snapshot."
      />
      <FiscalYears />
      <FixedAllowances />
    </>
  );
}

// Fiscal years

function ConfigStatus({ fiscalYear }) {
  const items = [
    ['SSF', fiscalYear.ssf_config],
    ['Tax', fiscalYear.tax_slabs.length > 0],
    ['Security fund', fiscalYear.security_fund_config],
  ];
  return (
    <span className="badge-row">
      {items.map(([label, ok]) => (
        <Badge key={label} tone={ok ? 'success' : 'warning'} title={ok ? 'Configured' : 'Not configured'}>
          {ok ? '✓' : '!'} {label}
        </Badge>
      ))}
    </span>
  );
}

function FiscalYears() {
  const years = useApi('/fiscal-years');
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const list = years.data ?? [];
  const selected = list.find((fy) => fy.id === selectedId) ?? list.find((fy) => fy.is_active) ?? list[0];

  return (
    <>
      <Card
        title="Fiscal years"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            + New fiscal year
          </button>
        }
      >
        <p className="muted">
          Plain AD date ranges. A pay period (calendar month) belongs to the fiscal year that contains the month&apos;s last
          day.
        </p>
        <ErrorAlert error={years.error} />
        {years.loading && !years.data ? (
          <Loading />
        ) : list.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Dates</th>
                  <th>Pay periods</th>
                  <th>Configuration</th>
                  <th className="num">Payslips</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((fy) => (
                  <tr key={fy.id} className={selected?.id === fy.id ? 'row-selected' : undefined}>
                    <td>
                      <strong>{fy.label}</strong> {fy.is_active && <Badge tone="info">Active</Badge>}
                    </td>
                    <td>
                      {formatDate(fy.start_date)} – {formatDate(fy.end_date)}
                    </td>
                    <td>
                      {formatPeriod(fy.first_period)} – {formatPeriod(fy.last_period)}
                    </td>
                    <td>
                      <ConfigStatus fiscalYear={fy} />
                    </td>
                    <td className="num">{fy.payslip_count}</td>
                    <td className="actions">
                      <button type="button" className="btn btn-small" onClick={() => setSelectedId(fy.id)}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No fiscal years yet. Create one to start running payroll.</Empty>
        )}
      </Card>

      {selected && (
        <FiscalYearEditor
          key={selected.id}
          fiscalYear={selected}
          onSaved={years.reload}
          onDeleted={() => {
            setSelectedId(null);
            years.reload();
          }}
        />
      )}

      {creating && (
        <Modal title="New fiscal year" onClose={() => setCreating(false)}>
          <FiscalYearForm
            onCreated={(fy) => {
              setCreating(false);
              setSelectedId(fy.id);
              years.reload();
            }}
            onCancel={() => setCreating(false)}
          />
        </Modal>
      )}
    </>
  );
}

function FiscalYearForm({ onCreated, onCancel }) {
  const [form, setForm] = useState({ label: '', start_date: '', end_date: '', is_active: false });
  const create = useAction(() => api('/fiscal-years', { method: 'POST', body: form }), { onSuccess: onCreated });
  const set = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        create.run();
      }}
    >
      <div className="form-grid">
        <Field label="Label">
          <input value={form.label} onChange={set('label')} placeholder="e.g. 2084/85" required autoFocus />
        </Field>
        <span />
        <Field label="Start date (AD)">
          <input type="date" value={form.start_date} onChange={set('start_date')} required />
        </Field>
        <Field label="End date (AD)">
          <input type="date" value={form.end_date} onChange={set('end_date')} required />
        </Field>
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> Mark as the active fiscal year
      </label>
      <p className="muted small">After creating it, set its SSF rates, tax slabs and security fund % before running payroll.</p>
      <ErrorAlert error={create.error} />
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={create.pending}>
          Create
        </button>
      </div>
    </form>
  );
}

function FiscalYearEditor({ fiscalYear, onSaved, onDeleted }) {
  const activate = useAction(() => api(`/fiscal-years/${fiscalYear.id}`, { method: 'PUT', body: { is_active: true } }), {
    onSuccess: onSaved,
  });
  const remove = useAction(() => api(`/fiscal-years/${fiscalYear.id}`, { method: 'DELETE' }), { onSuccess: onDeleted });

  return (
    <Card
      title={`Fiscal year ${fiscalYear.label} — rates`}
      actions={
        <>
          {!fiscalYear.is_active && (
            <button type="button" className="btn" disabled={activate.pending} onClick={() => activate.run()}>
              Set as active
            </button>
          )}
          {fiscalYear.payslip_count === 0 && (
            <button
              type="button"
              className="btn btn-danger-ghost"
              disabled={remove.pending}
              onClick={() => window.confirm(`Delete fiscal year ${fiscalYear.label} and its rates?`) && remove.run()}
            >
              Delete
            </button>
          )}
        </>
      }
    >
      <ErrorAlert error={activate.error ?? remove.error} />
      <div className="config-grid">
        <SsfForm fiscalYear={fiscalYear} onSaved={onSaved} />
        <SecurityFundForm fiscalYear={fiscalYear} onSaved={onSaved} />
        <TaxSlabsForm fiscalYear={fiscalYear} onSaved={onSaved} />
      </div>
    </Card>
  );
}

function SavedNote({ show }) {
  return show ? <span className="saved-note">Saved ✓</span> : null;
}

function SsfForm({ fiscalYear, onSaved }) {
  const [form, setForm] = useState({
    employee_pct: fiscalYear.ssf_config?.employee_pct ?? '',
    employer_pct: fiscalYear.ssf_config?.employer_pct ?? '',
  });
  const [saved, setSaved] = useState(false);
  const save = useAction(
    () =>
      api(`/fiscal-years/${fiscalYear.id}/ssf-config`, {
        method: 'POST',
        body: { employee_pct: Number(form.employee_pct), employer_pct: Number(form.employer_pct) },
      }),
    {
      onSuccess: () => {
        setSaved(true);
        onSaved();
      },
    },
  );
  const set = (field) => (event) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  return (
    <form
      className="config-block"
      onSubmit={(event) => {
        event.preventDefault();
        save.run();
      }}
    >
      <h3>SSF contribution</h3>
      <p className="muted small">Applies to SSF employees only, as a % of basic pay.</p>
      <Field label="Employee share (%)">
        <input type="number" min="0" max="100" step="0.01" value={form.employee_pct} onChange={set('employee_pct')} required />
      </Field>
      <Field label="Employer share (%)" hint="Employer cost — shown to admin only">
        <input type="number" min="0" max="100" step="0.01" value={form.employer_pct} onChange={set('employer_pct')} required />
      </Field>
      <ErrorAlert error={save.error} />
      <div className="form-actions">
        <SavedNote show={saved} />
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          Save SSF rates
        </button>
      </div>
    </form>
  );
}

function SecurityFundForm({ fiscalYear, onSaved }) {
  const [percentage, setPercentage] = useState(fiscalYear.security_fund_config?.percentage ?? '');
  const [saved, setSaved] = useState(false);
  const save = useAction(
    () =>
      api(`/fiscal-years/${fiscalYear.id}/security-fund-config`, {
        method: 'POST',
        body: { percentage: Number(percentage) },
      }),
    {
      onSuccess: () => {
        setSaved(true);
        onSaved();
      },
    },
  );

  return (
    <form
      className="config-block"
      onSubmit={(event) => {
        event.preventDefault();
        save.run();
      }}
    >
      <h3>In-house security fund</h3>
      <p className="muted small">Deducted from every employee, as a % of basic pay.</p>
      <Field label="Percentage (%)">
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={percentage}
          onChange={(event) => {
            setSaved(false);
            setPercentage(event.target.value);
          }}
          required
        />
      </Field>
      <ErrorAlert error={save.error} />
      <div className="form-actions">
        <SavedNote show={saved} />
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          Save percentage
        </button>
      </div>
    </form>
  );
}

function TaxSlabsForm({ fiscalYear, onSaved }) {
  const [rows, setRows] = useState(() =>
    fiscalYear.tax_slabs.length
      ? fiscalYear.tax_slabs.map((slab) => ({ upper_bound: slab.upper_bound ?? '', rate_pct: slab.rate_pct }))
      : [{ upper_bound: '', rate_pct: '' }],
  );
  const [saved, setSaved] = useState(false);
  const save = useAction(
    () =>
      api(`/fiscal-years/${fiscalYear.id}/tax-slabs`, {
        method: 'POST',
        body: {
          slabs: rows.map((row, index) => ({
            upper_bound: index === rows.length - 1 ? null : Number(row.upper_bound),
            rate_pct: Number(row.rate_pct),
          })),
        },
      }),
    {
      onSuccess: () => {
        setSaved(true);
        onSaved();
      },
    },
  );

  const update = (index, field, value) => {
    setSaved(false);
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };
  // New slabs go just before the open-ended top slab.
  const addSlab = () => {
    setSaved(false);
    setRows((prev) => [...prev.slice(0, -1), { upper_bound: '', rate_pct: '' }, prev[prev.length - 1]]);
  };
  const removeSlab = (index) => {
    setSaved(false);
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <form
      className="config-block config-block-wide"
      onSubmit={(event) => {
        event.preventDefault();
        save.run();
      }}
    >
      <h3>Income tax slabs</h3>
      <p className="muted small">
        Annual taxable income (basic pay × 12), taxed progressively. Enter each slab&apos;s cumulative upper limit; the last
        slab covers everything above.
      </p>
      <table className="table compact slab-table">
        <thead>
          <tr>
            <th>From (Rs.)</th>
            <th>Up to (Rs.)</th>
            <th>Rate (%)</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isLast = index === rows.length - 1;
            const from = index === 0 ? 0 : Number(rows[index - 1].upper_bound) || 0;
            return (
              <tr key={index}>
                <td className="muted">{formatNumber(from)}</td>
                <td>
                  {isLast ? (
                    <span className="muted">and above</span>
                  ) : (
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={row.upper_bound}
                      onChange={(event) => update(index, 'upper_bound', event.target.value)}
                      required
                      aria-label={`Slab ${index + 1} upper limit`}
                    />
                  )}
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={row.rate_pct}
                    onChange={(event) => update(index, 'rate_pct', event.target.value)}
                    required
                    aria-label={`Slab ${index + 1} rate`}
                  />
                </td>
                <td className="actions">
                  {!isLast && (
                    <button type="button" className="btn btn-small btn-ghost" onClick={() => removeSlab(index)}>
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ErrorAlert error={save.error} />
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={addSlab}>
          + Add slab
        </button>
        <SavedNote show={saved} />
        <button type="submit" className="btn btn-primary" disabled={save.pending}>
          Save tax slabs
        </button>
      </div>
    </form>
  );
}

// Fixed allowances

function FixedAllowances() {
  const allowances = useApi('/fixed-allowances');
  const [form, setForm] = useState({ name: '', amount: '' });
  const add = useAction(
    () => api('/fixed-allowances', { method: 'POST', body: { name: form.name, amount: Number(form.amount) } }),
    {
      onSuccess: () => {
        setForm({ name: '', amount: '' });
        allowances.reload();
      },
    },
  );
  const toggle = useAction(
    (allowance) =>
      allowance.is_active
        ? api(`/fixed-allowances/${allowance.id}`, { method: 'DELETE' })
        : api(`/fixed-allowances/${allowance.id}`, { method: 'PATCH', body: { is_active: true } }),
    { onSuccess: allowances.reload },
  );
  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  return (
    <Card title="Fixed allowances">
      <p className="muted">Global monthly allowances: every active one is added to every employee&apos;s payslip, every period.</p>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          add.run();
        }}
      >
        <Field label="Name">
          <input value={form.name} onChange={set('name')} required placeholder="e.g. Transport" />
        </Field>
        <Field label="Monthly amount (Rs.)">
          <input type="number" min="0.01" step="0.01" value={form.amount} onChange={set('amount')} required />
        </Field>
        <button type="submit" className="btn btn-primary" disabled={add.pending}>
          Add allowance
        </button>
      </form>
      <ErrorAlert error={add.error ?? toggle.error ?? allowances.error} />
      {allowances.loading && !allowances.data ? (
        <Loading />
      ) : allowances.data?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Monthly amount</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {allowances.data.map((allowance) => (
                <tr key={allowance.id} className={allowance.is_active ? undefined : 'row-muted'}>
                  <td>{allowance.name}</td>
                  <td className="num">{formatAmount(allowance.amount)}</td>
                  <td>{allowance.is_active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className="actions">
                    <button
                      type="button"
                      className={`btn btn-small ${allowance.is_active ? 'btn-danger-ghost' : ''}`}
                      disabled={toggle.pending}
                      onClick={() => toggle.run(allowance)}
                    >
                      {allowance.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>No fixed allowances.</Empty>
      )}
    </Card>
  );
}
