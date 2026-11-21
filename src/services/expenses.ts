import type { Expense, ExpensePaymentMethod } from '@/types/domain';
import { currentUserId, requireClient, toServiceError } from '@/services/client';

export interface ExpenseInput {
  supplier: string;
  description: string | null;
  category: string | null;
  expense_date: string;
  amount: number;
  gst_amount: number;
  due_date: string | null;
  paid_on: string | null;
  is_bill: boolean;
  payment_method: ExpensePaymentMethod | null;
  vendor_gstin: string | null;
  notes: string | null;
}

/** All expenses and bills, newest first. */
export async function listExpenses(): Promise<Expense[]> {
  const { data, error } = await requireClient()
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false });
  if (error) throw toServiceError(error);
  return (data ?? []) as Expense[];
}

export async function createExpense(input: ExpenseInput): Promise<void> {
  const uid = await currentUserId();
  const { error } = await requireClient().from('expenses').insert({ ...input, user_id: uid });
  if (error) throw toServiceError(error);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<void> {
  const { error } = await requireClient().from('expenses').update(input).eq('id', id);
  if (error) throw toServiceError(error);
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await requireClient().from('expenses').delete().eq('id', id);
  if (error) throw toServiceError(error);
}

/** Record payment of a bill: sets paid_on and the payment method. */
export async function markExpensePaid(
  id: string,
  paidOn: string,
  method: ExpensePaymentMethod | null,
): Promise<void> {
  const { error } = await requireClient()
    .from('expenses')
    .update({ paid_on: paidOn, payment_method: method })
    .eq('id', id);
  if (error) throw toServiceError(error);
}
