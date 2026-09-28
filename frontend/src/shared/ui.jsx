import { useEffect } from 'react';
import { EMPLOYMENT_TYPE_LABELS } from './format.js';

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Alert({ kind = 'info', children }) {
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function ErrorAlert({ error }) {
  if (!error) return null;
  return (
    <Alert kind="error">
      {error.message}
      {Array.isArray(error.details) && (
        <ul>
          {error.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

export const Loading = () => <p className="muted loading">Loading…</p>;

export const Empty = ({ children }) => <p className="empty">{children}</p>;

export function Badge({ tone = 'neutral', children, title }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}

export function TypeBadge({ type }) {
  return <Badge tone={type === 'SSF' ? 'ssf' : 'nonssf'}>{EMPLOYMENT_TYPE_LABELS[type] ?? type}</Badge>;
}

export function EmployeeStatusBadge({ employee }) {
  if (employee.deleted_at) return <Badge tone="danger">Removed</Badge>;
  return employee.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="warning">Inactive</Badge>;
}

export function Field({ label, hint, children, wide = false }) {
  return (
    <label className={`field${wide ? ' field-wide' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <div className={`stat${tone ? ` stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          className={`tab${active === tab.id ? ' tab-active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** All / SSF / Non-SSF segmented filter. value: '' | 'SSF' | 'NON_SSF'. */
export function EmploymentTypeFilter({ value, onChange }) {
  const options = [
    ['', 'All'],
    ['SSF', 'SSF'],
    ['NON_SSF', 'Non-SSF'],
  ];
  return (
    <div className="segmented" role="group" aria-label="Employment type">
      {options.map(([optionValue, label]) => (
        <button
          key={label}
          type="button"
          className={value === optionValue ? 'active' : ''}
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
