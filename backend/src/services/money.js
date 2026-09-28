// Round to 2 decimals (epsilon avoids float issues like 1.005 -> 1.00)
export function round2(value) {
  return (Math.sign(value) * Math.round(Math.abs(value) * 100 + 1e-6)) / 100;
}

/** Sum of `amount` across items, rounded to paisa. */
export function sumAmounts(items) {
  return round2(items.reduce((total, item) => total + item.amount, 0));
}
