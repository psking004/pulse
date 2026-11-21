import type { InvoiceDetail, InvoiceStatus, InvoiceWithCustomer, SupplyType } from '@/types/domain';
import { currentUserId, requireClient, toServiceError } from '@/services/client';

/** Header fields written on create/update. Totals derived by the DB (amount_paid, balance_due) are never sent. */
export interface InvoiceHeaderInput {
  customer_id: string;
  invoice_number: string;
  status: InvoiceStatus;
  supply_type: SupplyType;
  issue_date: string;
  due_date: string;
  subtotal: number;
  discount_total: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  gst_amount: number;
  notes: string | null;
}

export interface InvoiceItemInput {
  position: number;
  description: string;
  hsn_sac: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  gst_applicable: boolean;
  gst_rate: number;
  discount_amount: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
}

/** All invoices with their customer summary, newest first. */
export async function listInvoices(): Promise<InvoiceWithCustomer[]> {
  const { data, error } = await requireClient()
    .from('invoices')
    .select('*, customer:customers(id,name,gstin,state_code)')
    .order('issue_date', { ascending: false })
    .order('invoice_number', { ascending: false });
  if (error) throw toServiceError(error);
  return (data ?? []) as InvoiceWithCustomer[];
}

/** One invoice with customer, line items (by position) and payments (newest first). */
export async function getInvoice(id: string): Promise<InvoiceDetail> {
  const { data, error } = await requireClient()
    .from('invoices')
    .select('*, customer:customers(*), items:invoice_items(*), payments(*)')
    .eq('id', id)
    .single();
  if (error) throw toServiceError(error);
  const detail = data as InvoiceDetail;
  return {
    ...detail,
    items: [...detail.items].sort((a, b) => a.position - b.position),
    payments: [...detail.payments].sort((a, b) => b.paid_on.localeCompare(a.paid_on)),
  };
}

/** Every invoice number in use, for next-number generation. */
export async function listInvoiceNumbers(): Promise<string[]> {
  const { data, error } = await requireClient().from('invoices').select('invoice_number');
  if (error) throw toServiceError(error);
  return ((data ?? []) as { invoice_number: string }[]).map((row) => row.invoice_number);
}

/** Insert header then items. If the items insert fails, the header is removed and the error rethrown. */
export async function createInvoice(header: InvoiceHeaderInput, items: InvoiceItemInput[]): Promise<string> {
  const uid = await currentUserId();
  const client = requireClient();

  const { data, error } = await client
    .from('invoices')
    .insert({ ...header, user_id: uid })
    .select('id')
    .single();
  if (error) throw toServiceError(error);
  const invoiceId = (data as { id: string }).id;

  if (items.length > 0) {
    const rows = items.map((item) => ({ ...item, user_id: uid, invoice_id: invoiceId }));
    const { error: itemsError } = await client.from('invoice_items').insert(rows);
    if (itemsError) {
      await client.from('invoices').delete().eq('id', invoiceId);
      throw toServiceError(itemsError);
    }
  }
  return invoiceId;
}

/** Update header, replace all line items. */
export async function updateInvoice(id: string, header: InvoiceHeaderInput, items: InvoiceItemInput[]): Promise<void> {
  const uid = await currentUserId();
  const client = requireClient();

  const { error } = await client.from('invoices').update(header).eq('id', id);
  if (error) throw toServiceError(error);

  const { error: deleteError } = await client.from('invoice_items').delete().eq('invoice_id', id);
  if (deleteError) throw toServiceError(deleteError);

  if (items.length > 0) {
    const rows = items.map((item) => ({ ...item, user_id: uid, invoice_id: id }));
    const { error: insertError } = await client.from('invoice_items').insert(rows);
    if (insertError) throw toServiceError(insertError);
  }
}

/** Delete an invoice. Payments block deletion via FK, and that error message is surfaced. */
export async function deleteInvoice(id: string): Promise<void> {
  const { error } = await requireClient().from('invoices').delete().eq('id', id);
  if (error) throw toServiceError(error);
}

/** Set an invoice's stored status (draft, sent or void). */
export async function setInvoiceStatus(id: string, status: InvoiceStatus): Promise<void> {
  const { error } = await requireClient().from('invoices').update({ status }).eq('id', id);
  if (error) throw toServiceError(error);
}

