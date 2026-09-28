import { api, qs } from '../shared/api.js';
import { formatPeriod } from '../shared/format.js';
import { useAction, useApi } from '../shared/hooks.js';
import PayslipView from '../shared/PayslipView.jsx';
import { Alert, ErrorAlert, Loading, Modal } from '../shared/ui.jsx';

// Preview a payslip before generating it (can't be undone)
export default function PayslipPreviewModal({ employeeId, period, onClose, onGenerated }) {
  const preview = useApi(`/employees/${employeeId}/payslips/preview${qs({ period })}`);
  const generate = useAction(
    () => api(`/employees/${employeeId}/payslips/generate${qs({ period: preview.data.pay_period })}`, { method: 'POST' }),
    { onSuccess: onGenerated },
  );

  return (
    <Modal title="Review payslip before generating" onClose={onClose} wide>
      <ErrorAlert error={preview.error} />
      {preview.loading && <Loading />}
      {preview.data && (
        <>
          <PayslipView payslip={preview.data} />
          <Alert kind="warning">
            Generating is final. The payslip can never be edited or deleted, payslips are generated strictly one period
            at a time, and any advance installment shown above is deducted from the outstanding balance.
          </Alert>
          <ErrorAlert error={generate.error} />
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={generate.pending} onClick={() => generate.run()}>
              {generate.pending ? 'Generating…' : `Generate payslip for ${formatPeriod(preview.data.pay_period)}`}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
