/** Round to 2 decimal places (half-up, with EPSILON guard against float drift). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Convert rupees to integer paise. */
export function toPaise(n: number): number {
  return Math.round(n * 100);
}

/** Convert integer paise to rupees. */
export function fromPaise(p: number): number {
  return p / 100;
}

/** Format an amount for display, e.g. ₹1,234.50. Falls back if the currency code is invalid. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Parse user-entered amount text. Returns null for empty, non-numeric or negative input. */
export function parseAmount(input: string): number | null {
  const cleaned = input.trim().replace(/,/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}
