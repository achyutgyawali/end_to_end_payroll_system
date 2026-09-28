import { PayrollInputError } from './errors.js';
import { round2 } from './money.js';

// Returns a list of problems with the slabs (empty if valid)
export function validateTaxSlabs(slabs) {
  if (!Array.isArray(slabs) || slabs.length === 0) return ['At least one tax slab is required'];
  const errors = [];
  let previousBound = 0;
  slabs.forEach((slab, index) => {
    const label = `Slab ${index + 1}`;
    const isLast = index === slabs.length - 1;
    if (!Number.isFinite(slab.rate_pct) || slab.rate_pct < 0 || slab.rate_pct > 100) {
      errors.push(`${label}: rate_pct must be between 0 and 100`);
    }
    if (slab.upper_bound == null) {
      if (!isLast) errors.push(`${label}: only the last slab may be open-ended`);
    } else if (!Number.isFinite(slab.upper_bound) || slab.upper_bound <= previousBound) {
      errors.push(`${label}: upper_bound must be greater than ${previousBound}`);
    } else {
      previousBound = slab.upper_bound;
      if (isLast) errors.push(`${label}: the last slab must be open-ended (upper_bound null)`);
    }
  });
  return errors;
}

// Progressive tax on annual income
export function calculateAnnualTax(annualTaxableIncome, taxSlabs) {
  const slabs = [...taxSlabs].sort((a, b) => a.slab_order - b.slab_order);
  let lowerBound = 0;
  let annualTax = 0;
  const breakdown = [];

  for (const slab of slabs) {
    if (annualTaxableIncome <= lowerBound) break;
    const upperBound = slab.upper_bound ?? Infinity;
    const taxableAmount = Math.min(annualTaxableIncome, upperBound) - lowerBound;
    const tax = (taxableAmount * slab.rate_pct) / 100;
    annualTax += tax;
    breakdown.push({
      slab_order: slab.slab_order,
      lower_bound: lowerBound,
      upper_bound: slab.upper_bound,
      rate_pct: slab.rate_pct,
      taxable_amount: round2(taxableAmount),
      tax: round2(tax),
    });
    lowerBound = upperBound;
  }

  if (annualTaxableIncome > lowerBound) {
    throw new PayrollInputError('Tax slabs do not cover the full taxable income (the last slab must be open-ended)');
  }
  return { annual_tax: round2(annualTax), slabs: breakdown };
}
