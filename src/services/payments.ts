import type { Payment, PaymentMethod } from '@/types/domain';
import { currentUserId, requireClient, toServiceError } from '@/services/client';

export type PaymentWithInvoice = Payment & {
  invoice: { id: string; invoice_number: string; customer: { name: string } | null } | null;
};

export interface PaymentInput {
  invoice_id: string | null;
  amount: number;
  paid_on: string;
  method: PaymentMethod | null;
  reference: string | null;
  notes: string | null;
}

/** All payments, newest first, with the linked invoice. */
export async function listPayments(): Promise<PaymentWithInvoice[]> {
  const { data, error } = await requireClient()
    .from('payments')
    .select('*, invoice:invoices(id, invoice_number, customer:customers(name))')
    .order('paid_on', { ascending: false });
  if (error) throw toServiceError(error);
  return (data ?? []) as PaymentWithInvoice[];
}

/** amount_paid on the invoice is maintained by a DB trigger, so it is never written here. */
export async function createPayment(input: PaymentInput): Promise<void> {
  const uid = await currentUserId();
  const { error } = await requireClient().from('payments').insert({ ...input, user_id: uid });
  if (error) throw toServiceError(error);
}

export async function updatePayment(id: string, input: PaymentInput): Promise<void> {
  const { error } = await requireClient().from('payments').update(input).eq('id', id);
  if (error) throw toServiceError(error);
}

export async function deletePayment(id: string): Promise<void> {
  const { error } = await requireClient().from('payments').delete().eq('id', id);
  if (error) throw toServiceError(error);
}
