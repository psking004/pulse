import type { ForecastInput } from '@/lib/forecast';
import type { Expense, InvoiceWithCustomer, Profile } from '@/types/domain';

const DEFAULT_DELAY_DAYS = 15;

/**
 * Map loaded records onto the pure forecast engine input.
 * No cash arithmetic happens here; buildForecast owns all of that.
 */
export function buildForecastInput(
  profile: Profile,
  invoices: InvoiceWithCustomer[],
  payments: { amount: number; paid_on: string }[],
  expenses: Expense[],
  today: string,
  delayInvoiceId?: string | null,
  delayDays?: number,
): ForecastInput {
  const paidExpenses: { amount: number; paid_on: string }[] = [];
  const bills: { id: string; supplier: string; amount: number; due_date: string }[] = [];
  for (const e of expenses) {
    if (e.paid_on !== null) {
      paidExpenses.push({ amount: e.amount, paid_on: e.paid_on });
    } else if (e.is_bill === true) {
      bills.push({ id: e.id, supplier: e.supplier, amount: e.amount, due_date: e.due_date ?? today });
    }
  }

  const expectedInvoices = invoices
    .filter((inv) => inv.status === 'sent' && inv.balance_due > 0)
    .map((inv) => ({
      id: inv.id,
      customer_name: inv.customer?.name ?? 'Customer',
      invoice_number: inv.invoice_number,
      balance_due: inv.balance_due,
      due_date: inv.due_date,
      status: inv.status,
    }));

  const input: ForecastInput = {
    today,
    starting_cash_balance: profile.starting_cash_balance,
    starting_cash_date: profile.starting_cash_date,
    payments: payments.map((p) => ({ amount: p.amount, paid_on: p.paid_on })),
    paid_expenses: paidExpenses,
    invoices: expectedInvoices,
    bills,
    delay_invoice_id: delayInvoiceId ?? null,
  };
  if (delayDays !== undefined) {
    input.delay_days = delayDays;
  } else if (delayInvoiceId) {
    input.delay_days = DEFAULT_DELAY_DAYS;
  }
  return input;
}
