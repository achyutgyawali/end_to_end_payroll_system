import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPeriod } from '../../shared/format.js';
import { useApi } from '../../shared/hooks.js';
import { PayslipTable } from '../../shared/tables.jsx';
import { Alert, ErrorAlert, Loading } from '../../shared/ui.jsx';
import PayslipPreviewModal from '../PayslipPreviewModal.jsx';

export default function PayslipsPanel({ employee, onChanged, readOnly }) {
  const history = useApi(`/employees/${employee.id}/payslips`);
  const meta = useApi('/meta');
  const [previewing, setPreviewing] = useState(false);
  const navigate = useNavigate();

  const next = employee.next_payslip_period;
  const currentPeriod = meta.data?.current_period;
  const isFuture = next && currentPeriod && next > currentPeriod;

  let nextNotice = null;
  if (readOnly) nextNotice = 'This employee has been removed — no further payslips can be generated.';
  else if (!employee.is_active) nextNotice = 'This employee is inactive. Reactivate them (Edit) to generate payslips.';
  else if (!next) nextNotice = 'No fiscal year is configured yet — add one under Configuration.';
  else if (isFuture) nextNotice = `The next payslip (${formatPeriod(next)}) is for a future period and can't be generated yet.`;

  const generated = (payslip) => {
    setPreviewing(false);
    onChanged();
    navigate(`/employees/${employee.id}/payslips/${payslip.id}`);
  };

  return (
    <>
      <div className="next-payslip">
        <div>
          <h3>Next payslip{next ? `: ${formatPeriod(next)}` : ''}</h3>
          <p className="muted">
            Payslips are generated one period at a time, in order, and are immutable once generated.
          </p>
        </div>
        {!nextNotice && (
          <button type="button" className="btn btn-primary" onClick={() => setPreviewing(true)}>
            Preview &amp; generate
          </button>
        )}
      </div>
      {nextNotice && <Alert kind="info">{nextNotice}</Alert>}

      <h3 className="section-title">History</h3>
      <ErrorAlert error={history.error} />
      {history.loading && !history.data ? <Loading /> : history.data && <PayslipTable payslips={history.data} />}

      {previewing && (
        <PayslipPreviewModal employeeId={employee.id} onClose={() => setPreviewing(false)} onGenerated={generated} />
      )}
    </>
  );
}
