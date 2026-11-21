import type { SupplyType } from '@/types/domain';
import { fromPaise, toPaise } from '@/lib/money';

export interface LineInput {
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_applicable: boolean;
  gst_rate: number;
}

export interface LineResult {
  line_subtotal: number;
  discount_amount: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
}

export interface InvoiceTotals {
  subtotal: number;
  discount_total: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_amount: number;
  total_amount: number;
}

/** Standard GST slabs offered in the UI. */
export const GST_RATE_OPTIONS: readonly number[] = [0, 5, 12, 18, 28];

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isBlank(s: string | null): boolean {
  return s === null || s.trim() === '';
}

/**
 * Calculate one invoice line in integer paise (quantity held in thousandths).
 *
 * Rounding rule: every derived amount is rounded half-up (Math.round) to whole paise
 * within the line. Nothing is carried between lines. Tax on intra-state supply is split
 * into CGST = floor(tax / 2) and SGST = the remainder, so SGST absorbs any odd paisa.
 */
export function calculateLine(line: LineInput, supplyType: SupplyType): LineResult {
  const qtyMilli = Math.round(line.quantity * 1000);
  const pricePaise = Math.round(line.unit_price * 100);
  const grossPaise = Math.round((qtyMilli * pricePaise) / 1000);

  const discountPct = clamp(line.discount_percent, 0, 100);
  const discountPaise = Math.round((grossPaise * discountPct) / 100);
  const taxablePaise = grossPaise - discountPaise;

  const taxPaise = line.gst_applicable ? Math.round((taxablePaise * line.gst_rate) / 100) : 0;

  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  if (supplyType === 'intra') {
    cgstPaise = Math.floor(taxPaise / 2);
    sgstPaise = taxPaise - cgstPaise;
  } else {
    igstPaise = taxPaise;
  }

  const totalPaise = taxablePaise + cgstPaise + sgstPaise + igstPaise;

  return {
    line_subtotal: fromPaise(grossPaise),
    discount_amount: fromPaise(discountPaise),
    taxable_value: fromPaise(taxablePaise),
    cgst_amount: fromPaise(cgstPaise),
    sgst_amount: fromPaise(sgstPaise),
    igst_amount: fromPaise(igstPaise),
    line_total: fromPaise(totalPaise),
  };
}

/** Calculate every line, then invoice totals as integer-paise sums of the line results. */
export function calculateInvoice(
  lines: LineInput[],
  supplyType: SupplyType,
): { lines: LineResult[]; totals: InvoiceTotals } {
  const results = lines.map((line) => calculateLine(line, supplyType));

  let subtotalPaise = 0;
  let discountPaise = 0;
  let cgstPaise = 0;
  let sgstPaise = 0;
  let igstPaise = 0;
  for (const r of results) {
    subtotalPaise += toPaise(r.taxable_value);
    discountPaise += toPaise(r.discount_amount);
    cgstPaise += toPaise(r.cgst_amount);
    sgstPaise += toPaise(r.sgst_amount);
    igstPaise += toPaise(r.igst_amount);
  }
  const gstPaise = cgstPaise + sgstPaise + igstPaise;

  return {
    lines: results,
    totals: {
      subtotal: fromPaise(subtotalPaise),
      discount_total: fromPaise(discountPaise),
      cgst_amount: fromPaise(cgstPaise),
      sgst_amount: fromPaise(sgstPaise),
      igst_amount: fromPaise(igstPaise),
      gst_amount: fromPaise(gstPaise),
      total_amount: fromPaise(subtotalPaise + gstPaise),
    },
  };
}

/** Intra-state only when both state codes are present and equal; otherwise inter-state. */
export function supplyTypeFor(sellerStateCode: string | null, buyerStateCode: string | null): SupplyType {
  if (isBlank(sellerStateCode) || isBlank(buyerStateCode)) return 'inter';
  return sellerStateCode === buyerStateCode ? 'intra' : 'inter';
}

/** True when the supply type cannot be determined because a state code is missing. */
export function isSupplyTypeAmbiguous(seller: string | null, buyer: string | null): boolean {
  return isBlank(seller) || isBlank(buyer);
}

/** Next invoice number: prefix + (highest existing integer suffix + 1), zero-padded to 4 digits. */
export function nextInvoiceNumber(existing: string[], prefix = 'INV-'): string {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}(\\d+)$`);
  let max = 0;
  for (const num of existing) {
    const match = re.exec(num);
    if (match?.[1] !== undefined) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return prefix + String(max + 1).padStart(4, '0');
}
