// Domain types mirroring the database columns exactly (snake_case).
// PostgREST returns numeric as number, dates as 'YYYY-MM-DD', timestamps as strings.

/** Stored invoice status. */
export type InvoiceStatus = 'draft' | 'sent' | 'void';

/** Derived payment state (see lib/invoiceStatus.ts). */
export type PaymentState = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'void';

export type SupplyType = 'intra' | 'inter';

export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'cheque' | 'other';

export type ExpensePaymentMethod = PaymentMethod | 'upi';

export interface Profile {
  id: string;
  business_name: string;
  business_type: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  abn: string | null;
  gstin: string | null;
  state_code: string | null;
  gst_registered: boolean;
  gst_rate: number;
  currency: string;
  starting_cash_balance: number;
  starting_cash_date: string;
  default_payment_terms_days: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  tax_number: string | null;
  gstin: string | null;
  state_code: string | null;
  payment_terms_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
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
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  user_id: string;
  invoice_id: string;
  position: number;
  description: string;
  hsn_sac: string | null;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  gst_applicable: boolean;
  gst_rate: number;
  taxable_value: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  line_total: number;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  invoice_id: string | null;
  amount: number;
  paid_on: string;
  method: PaymentMethod | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  user_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithCustomer extends Invoice {
  customer: Pick<Customer, 'id' | 'name' | 'gstin' | 'state_code'> | null;
}

export interface InvoiceDetail extends Invoice {
  customer: Customer | null;
  items: InvoiceItem[];
  payments: Payment[];
}
