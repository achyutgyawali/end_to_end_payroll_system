import { formatAmount, formatDate, formatDateTime, formatMoney, formatNumber, formatPeriod } from './format.js';
import { Badge, TypeBadge } from './ui.jsx';

function Row({ label, detail, amount, total = false }) {
  return (
    <tr className={total ? 'total-row' : undefined}>
      <td>
        {label}
        {detail && <div className="row-detail">{detail}</div>}
      </td>
      <td className="num">{formatAmount(amount)}</td>
    </tr>
  );
}

function slabRange(slab) {
  return slab.upper_bound == null
    ? `Above ${formatNumber(slab.lower_bound)}`
    : `${formatNumber(slab.lower_bound)} – ${formatNumber(slab.upper_bound)}`;
}

// Renders a payslip or preview. Order is set here since JSONB doesn't keep key order.
export default function PayslipView({ payslip }) {
  const { earnings, deductions } = payslip;
  const tax = deductions.income_tax;
  const showEmployerCost = 'ssf_employer_amount' in payslip;

  return (
    <article className="payslip">
      <header className="payslip-header">
        <div>
          <h2>Payslip · {formatPeriod(payslip.pay_period)}</h2>
          <p className="muted">
            Fiscal year {payslip.fiscal_year_label} ·{' '}
            {payslip.preview ? 'Preview — nothing saved yet' : `Generated ${formatDateTime(payslip.generated_at)}`}
          </p>
        </div>
        {payslip.preview ? <Badge tone="warning">Preview</Badge> : <Badge>Final · immutable</Badge>}
      </header>

      <dl className="payslip-employee">
        <div>
          <dt>Employee</dt>
          <dd>{payslip.employee_name}</dd>
        </div>
        <div>
          <dt>Department</dt>
          <dd>{payslip.department}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>
            <TypeBadge type={payslip.employment_type} />
          </dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{formatDate(payslip.joining_date)}</dd>
        </div>
        <div>
          <dt>Bank account</dt>
          <dd className="mono">{payslip.dummy_bank_acc_no}</dd>
        </div>
      </dl>

      <div className="payslip-columns">
        <table className="table payslip-table">
          <thead>
            <tr>
              <th>Earnings</th>
              <th className="num">Rs.</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Basic pay" amount={earnings.basic_pay} />
            {earnings.fixed_allowances.map((item) => (
              <Row key={`fixed-${item.fixed_allowance_id}`} label={item.name} detail="Fixed allowance" amount={item.amount} />
            ))}
            {earnings.dynamic_allowances.map((item) => (
              <Row key={`dyn-${item.dynamic_allowance_id}`} label={item.name} detail="Allowance" amount={item.amount} />
            ))}
            {earnings.overtime.map((item, index) => (
              <Row
                key={`ot-${item.overtime_id ?? index}`}
                label="Overtime"
                detail={`${formatNumber(item.hours)} h × Rs. ${formatAmount(item.hourly_rate)}/h × ${item.multiplier}`}
                amount={item.amount}
              />
            ))}
            {earnings.one_time_reimbursements.map((item) => (
              <Row key={`one-${item.reimbursement_id}`} label={item.description} detail="One-time reimbursement" amount={item.amount} />
            ))}
            {earnings.recurring_reimbursements.map((item) => (
              <Row key={`rec-${item.reimbursement_id}`} label={item.description} detail="Recurring reimbursement" amount={item.amount} />
            ))}
          </tbody>
          <tfoot>
            <Row label="Gross earnings" amount={payslip.gross_earnings} total />
          </tfoot>
        </table>

        <table className="table payslip-table">
          <thead>
            <tr>
              <th>Deductions</th>
              <th className="num">Rs.</th>
            </tr>
          </thead>
          <tbody>
            {deductions.ssf_employee && (
              <Row
                label="SSF (employee contribution)"
                detail={`${deductions.ssf_employee.rate_pct}% of basic pay`}
                amount={deductions.ssf_employee.amount}
              />
            )}
            <Row
              label="Income tax (TDS)"
              detail={`${formatAmount(tax.annual_tax)} annual tax ÷ 12`}
              amount={tax.amount}
            />
            <Row
              label="In-house security fund"
              detail={`${deductions.security_fund.rate_pct}% of basic pay`}
              amount={deductions.security_fund.amount}
            />
            {deductions.advances.map((item) => (
              <Row
                key={`adv-${item.advance_id}`}
                label="Advance recovery"
                detail={`Balance ${formatAmount(item.outstanding_before)} → ${formatAmount(item.outstanding_after)}`}
                amount={item.amount}
              />
            ))}
          </tbody>
          <tfoot>
            <Row label="Total deductions" amount={payslip.total_deductions} total />
          </tfoot>
        </table>
      </div>

      <div className="net-pay">
        <span>Net pay (bank transfer)</span>
        <strong>{formatMoney(payslip.net_pay)}</strong>
      </div>

      <details className="tax-details">
        <summary>How income tax was calculated</summary>
        <p className="muted">
          Taxable income = basic pay × 12 = Rs. {formatAmount(tax.annual_taxable_income)}. Slabs are applied
          progressively; the monthly deduction is the annual tax ÷ 12.
        </p>
        <table className="table compact">
          <thead>
            <tr>
              <th>Slab (annual income)</th>
              <th className="num">Rate</th>
              <th className="num">Taxable</th>
              <th className="num">Tax</th>
            </tr>
          </thead>
          <tbody>
            {tax.slabs.map((slab) => (
              <tr key={slab.slab_order}>
                <td>{slabRange(slab)}</td>
                <td className="num">{slab.rate_pct}%</td>
                <td className="num">{formatAmount(slab.taxable_amount)}</td>
                <td className="num">{formatAmount(slab.tax)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan={3}>Annual tax</td>
              <td className="num">{formatAmount(tax.annual_tax)}</td>
            </tr>
          </tfoot>
        </table>
      </details>

      {showEmployerCost && (
        <div className="employer-cost">
          <Badge tone="admin">Admin only</Badge>
          <span>
            Employer SSF contribution
            {payslip.ssf_employer_pct != null && ` (${payslip.ssf_employer_pct}% of basic)`}:{' '}
            <strong>{formatMoney(payslip.ssf_employer_amount)}</strong> — an employer cost, not part of this pay.
          </span>
        </div>
      )}
    </article>
  );
}
