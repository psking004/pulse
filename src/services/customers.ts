import type { Customer } from '@/types/domain';
import { currentUserId, requireClient, toServiceError } from '@/services/client';

export type CustomerInput = Pick<
  Customer,
  'name' | 'email' | 'phone' | 'billing_address' | 'tax_number' | 'gstin' | 'state_code' | 'payment_terms_days' | 'notes'
>;

/** All customers of the signed-in user, ordered by name. */
export async function listCustomers(): Promise<Customer[]> {
  const { data, error } = await requireClient().from('customers').select('*').order('name', { ascending: true });
  if (error) throw toServiceError(error);
  return (data ?? []) as Customer[];
}

export async function getCustomer(id: string): Promise<Customer> {
  const { data, error } = await requireClient().from('customers').select('*').eq('id', id).single();
  if (error) throw toServiceError(error);
  return data as Customer;
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const uid = await currentUserId();
  const { data, error } = await requireClient()
    .from('customers')
    .insert({ ...input, user_id: uid })
    .select()
    .single();
  if (error) throw toServiceError(error);
  return data as Customer;
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  const { data, error } = await requireClient()
    .from('customers')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  if (error) throw toServiceError(error);
  return data as Customer;
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await requireClient().from('customers').delete().eq('id', id);
  if (error) throw toServiceError(error);
}
