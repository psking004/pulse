-- PULSE schema v2: Indian GST fields (GSTIN, state code, CGST/SGST/IGST split),
-- invoice item discounts and taxable values, and expense payment method / vendor GSTIN.
-- Additive only: no existing column is dropped or renamed. Apply manually in the
-- Supabase SQL Editor after 20250101000000_pulse_schema.sql. Money in numeric(14,2).

-- =============================================================================
-- A. profiles
-- =============================================================================

alter table public.profiles
  add column if not exists gstin text
    constraint profiles_gstin_check check (gstin is null or gstin ~ '^[0-9A-Z]{15}$');

alter table public.profiles
  add column if not exists state_code char(2)
    constraint profiles_state_code_check check (state_code is null or state_code ~ '^[0-9]{2}$');

alter table public.profiles
  alter column currency set default 'INR';

-- =============================================================================
-- B. customers
-- =============================================================================

alter table public.customers
  add column if not exists gstin text
    constraint customers_gstin_check check (gstin is null or gstin ~ '^[0-9A-Z]{15}$');

alter table public.customers
  add column if not exists state_code char(2)
    constraint customers_state_code_check check (state_code is null or state_code ~ '^[0-9]{2}$');

-- =============================================================================
-- C. invoices
-- =============================================================================

alter table public.invoices
  add column if not exists supply_type text not null default 'intra'
    constraint invoices_supply_type_check check (supply_type in ('intra', 'inter'));

alter table public.invoices
  add column if not exists discount_total numeric(14,2) not null default 0
    constraint invoices_discount_total_check check (discount_total >= 0);

alter table public.invoices
  add column if not exists cgst_amount numeric(14,2) not null default 0
    constraint invoices_cgst_amount_check check (cgst_amount >= 0);

alter table public.invoices
  add column if not exists sgst_amount numeric(14,2) not null default 0
    constraint invoices_sgst_amount_check check (sgst_amount >= 0);

alter table public.invoices
  add column if not exists igst_amount numeric(14,2) not null default 0
    constraint invoices_igst_amount_check check (igst_amount >= 0);

alter table public.invoices
  add column if not exists sent_at timestamptz;

alter table public.invoices
  drop constraint if exists invoices_gst_split_check;

alter table public.invoices
  add constraint invoices_gst_split_check
  check (gst_amount = cgst_amount + sgst_amount + igst_amount) not valid;

alter table public.invoices
  drop constraint if exists invoices_supply_split_check;

alter table public.invoices
  add constraint invoices_supply_split_check
  check (supply_type = 'intra' or (cgst_amount = 0 and sgst_amount = 0)) not valid;

-- =============================================================================
-- D. invoice_items
-- =============================================================================

alter table public.invoice_items
  add column if not exists gst_rate numeric(5,2) not null default 18
    constraint invoice_items_gst_rate_check check (gst_rate >= 0 and gst_rate <= 100);

alter table public.invoice_items
  add column if not exists hsn_sac text;

alter table public.invoice_items
  add column if not exists discount_percent numeric(5,2) not null default 0
    constraint invoice_items_discount_percent_check check (discount_percent >= 0 and discount_percent <= 100);

alter table public.invoice_items
  add column if not exists discount_amount numeric(14,2) not null default 0
    constraint invoice_items_discount_amount_check check (discount_amount >= 0);

alter table public.invoice_items
  add column if not exists taxable_value numeric(14,2) not null default 0
    constraint invoice_items_taxable_value_check check (taxable_value >= 0);

alter table public.invoice_items
  add column if not exists cgst_amount numeric(14,2) not null default 0
    constraint invoice_items_cgst_amount_check check (cgst_amount >= 0);

alter table public.invoice_items
  add column if not exists sgst_amount numeric(14,2) not null default 0
    constraint invoice_items_sgst_amount_check check (sgst_amount >= 0);

alter table public.invoice_items
  add column if not exists igst_amount numeric(14,2) not null default 0
    constraint invoice_items_igst_amount_check check (igst_amount >= 0);

alter table public.invoice_items
  add column if not exists line_total numeric(14,2) not null default 0
    constraint invoice_items_line_total_nonneg_check check (line_total >= 0);

alter table public.invoice_items
  drop constraint if exists invoice_items_line_total_check;

alter table public.invoice_items
  add constraint invoice_items_line_total_check
  check (line_total = taxable_value + cgst_amount + sgst_amount + igst_amount);

-- =============================================================================
-- E. expenses
-- =============================================================================

alter table public.expenses
  add column if not exists payment_method text
    constraint expenses_payment_method_check check (
      payment_method is null or payment_method in ('bank_transfer', 'cash', 'card', 'cheque', 'upi', 'other'));

alter table public.expenses
  add column if not exists vendor_gstin text
    constraint expenses_vendor_gstin_check check (vendor_gstin is null or vendor_gstin ~ '^[0-9A-Z]{15}$');

-- =============================================================================
-- F. indexes
-- =============================================================================

create index if not exists expenses_user_paid_on_idx on public.expenses (user_id, paid_on);

-- =============================================================================
-- G. RLS and grants: no changes. v1 policies and grants cover the new columns.
-- =============================================================================

-- =============================================================================
-- H. column comments
-- =============================================================================

comment on column public.profiles.gstin          is 'Seller GST Identification Number (15 characters), null if not GST registered.';
comment on column public.profiles.state_code     is 'Two-digit Indian GST state code of the seller, e.g. 07 Delhi.';
comment on column public.customers.gstin         is 'Buyer GST Identification Number (15 characters), null for unregistered buyers.';
comment on column public.customers.state_code    is 'Two-digit Indian GST state code of the buyer, e.g. 27 Maharashtra.';
comment on column public.invoices.supply_type    is 'intra = same state (CGST + SGST); inter = different states (IGST).';
comment on column public.invoices.cgst_amount    is 'Total central GST on the invoice; zero for inter-state supplies.';
comment on column public.invoice_items.discount_amount is 'Discount in currency for this line, computed by the app before tax.';
comment on column public.invoice_items.line_total is 'Taxable value plus all GST components for this line.';
