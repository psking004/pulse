import type { InvoiceStatus, PaymentState } from '@/types/domain';
import { daysBetween } from '@/lib/dates';
import { round2 } from '@/lib/money';

/** Derive the display payment state. Order of checks matters: void, draft, paid, overdue, partial, unpaid. */
export function paymentStateFor(
  invoice: {
    status: InvoiceStatus;
    total_amount: number;
    amount_paid: number;
    balance_due: number;
    due_date: string;
  },
  today: string,
): PaymentState {
  if (invoice.status === 'void') return 'void';
  if (invoice.status === 'draft') return 'draft';
  if (invoice.balance_due <= 0.005) return 'paid';
  if (invoice.due_date < today) return 'overdue';
  if (invoice.amount_paid > 0) return 'partially_paid';
  return 'unpaid';
}

/** Whole days past the due date; 0 when not yet due. */
export function daysOverdue(due_date: string, today: string): number {
  return Math.max(0, daysBetween(due_date, today));
}

export const PAYMENT_STATE_LABEL: Record<PaymentState, string> = {
  draft: 'Draft',
  unpaid: 'Unpaid',
  partially_paid: 'Partially paid',
  paid: 'Paid',
  overdue: 'Overdue',
  void: 'Void',
};

export function paymentStateBadgeVariant(state: PaymentState): 'default' | 'secondary' | 'outline' {
  if (state === 'overdue') return 'default';
  if (state === 'paid') return 'secondary';
  return 'outline';
}

/** Outstanding balance, rounded to 2 decimal places. */
export function computeBalance(total: number, amountPaid: number): number {
  return round2(total - amountPaid);
}
