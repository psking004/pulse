-- PULSE schema v1. Apply via Supabase SQL editor or `supabase db push`. Money in numeric(14,2). Assumes AUD default.

-- =============================================================================
-- 0. Shared helper functions
-- =============================================================================

create or replace function public.pulse_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =============================================================================
-- 1. profiles
-- =============================================================================

create table public.profiles (
  id                          uuid primary key references auth.users(id) on delete cascade,
  business_name               text not null default '',
  business_type               text,
  contact_name                text,
  email                       text,
  phone                       text,
  address                     text,
  abn                         text,                       -- tax registration number, free text
  gst_registered              boolean not null default false,
  gst_rate                    numeric(5,2) not null default 10.00
                                check (gst_rate >= 0 and gst_rate <= 100),
  currency                    char(3) not null default 'AUD'
                                check (currency ~ '^[A-Z]{3}$'),
  starting_cash_balance       numeric(14,2) not null default 0,
  starting_cash_date          date not null default current_date,
  default_payment_terms_days  int not null default 14
                                check (default_payment_terms_days >= 0),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.pulse_set_updated_at();

-- =============================================================================
-- 2. customers
-- =============================================================================

create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null check (length(trim(name)) > 0),
  email               text,
  phone               text,
  billing_address     text,
  tax_number          text,
  payment_terms_days  int check (payment_terms_days is null or payment_terms_days >= 0),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, user_id)
);

create index customers_user_id_name_idx on public.customers (user_id, name);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.pulse_set_updated_at();

-- =============================================================================
-- 3. invoices
-- =============================================================================

create table public.invoices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  customer_id     uuid not null,
  invoice_number  text not null,
  status          text not null default 'draft'
                    check (status in ('draft', 'sent', 'void')),  -- payment state is derived from amounts, not status
  issue_date      date not null default current_date,
  due_date        date not null,
  subtotal        numeric(14,2) not null default 0 check (subtotal >= 0),
  gst_amount      numeric(14,2) not null default 0 check (gst_amount >= 0),
  total_amount    numeric(14,2) generated always as (subtotal + gst_amount) stored,
  amount_paid     numeric(14,2) not null default 0 check (amount_paid >= 0),
  balance_due     numeric(14,2) generated always as (subtotal + gst_amount - amount_paid) stored,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint invoices_customer_fk
    foreign key (customer_id, user_id) references public.customers (id, user_id) on delete restrict,
  constraint invoices_due_after_issue check (due_date >= issue_date),
  constraint invoices_paid_within_total check (amount_paid <= subtotal + gst_amount),
  constraint invoices_user_number_unique unique (user_id, invoice_number),
  constraint invoices_id_user_unique unique (id, user_id)
);

create index invoices_user_id_status_idx on public.invoices (user_id, status);
create index invoices_user_id_due_date_idx on public.invoices (user_id, due_date);
create index invoices_customer_id_idx on public.invoices (customer_id);

create or replace function public.pulse_force_invoice_paid_zero()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.amount_paid := 0;
  return new;
end;
$$;

create trigger invoices_force_paid_zero
  before insert on public.invoices
  for each row execute function public.pulse_force_invoice_paid_zero();

create or replace function public.pulse_guard_invoice_paid()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.amount_paid is distinct from old.amount_paid
     and coalesce(current_setting('pulse.allow_paid_update', true), '') <> 'on' then
    raise exception 'invoices.amount_paid is maintained by payments and cannot be set directly';
  end if;
  return new;
end;
$$;

create trigger invoices_guard_paid
  before update on public.invoices
  for each row execute function public.pulse_guard_invoice_paid();

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.pulse_set_updated_at();

-- =============================================================================
-- 4. invoice_items
-- =============================================================================

create table public.invoice_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  invoice_id      uuid not null,
  position        int not null default 0,
  description     text not null check (length(trim(description)) > 0),
  quantity        numeric(12,3) not null check (quantity > 0),
  unit_price      numeric(14,2) not null check (unit_price >= 0),
  line_subtotal   numeric(14,2) generated always as (round(quantity * unit_price, 2)) stored,
  gst_applicable  boolean not null default true,
  created_at      timestamptz not null default now(),
  constraint invoice_items_invoice_fk
    foreign key (invoice_id, user_id) references public.invoices (id, user_id) on delete cascade
);

create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);
create index invoice_items_user_id_idx on public.invoice_items (user_id);

-- =============================================================================
-- 5. payments
-- =============================================================================

create table public.payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- NULL invoice_id = unallocated receipt. The composite FK is not enforced when
  -- invoice_id is NULL (MATCH SIMPLE default), which is intended.
  invoice_id  uuid,
  amount      numeric(14,2) not null check (amount > 0),
  paid_on     date not null default current_date,
  method      text check (method is null or method in ('bank_transfer', 'cash', 'card', 'cheque', 'other')),
  reference   text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint payments_invoice_fk
    foreign key (invoice_id, user_id) references public.invoices (id, user_id) on delete restrict
);

create index payments_user_id_paid_on_idx on public.payments (user_id, paid_on);
create index payments_invoice_id_idx on public.payments (invoice_id);

create or replace function public.pulse_sync_invoice_paid()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected_ids uuid[] := '{}';
begin
  if tg_op in ('UPDATE', 'DELETE') and old.invoice_id is not null then
    affected_ids := array_append(affected_ids, old.invoice_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.invoice_id is not null then
    affected_ids := array_append(affected_ids, new.invoice_id);
  end if;

  if array_length(affected_ids, 1) is null then
    return null;
  end if;

  perform set_config('pulse.allow_paid_update', 'on', true);

  update public.invoices i
     set amount_paid = coalesce(
           (select sum(p.amount) from public.payments p where p.invoice_id = i.id),
           0)
   where i.id = any (affected_ids);

  perform set_config('pulse.allow_paid_update', 'off', true);

  return null;
end;
$$;

create trigger payments_sync_invoice_paid
  after insert or update or delete on public.payments
  for each row execute function public.pulse_sync_invoice_paid();

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.pulse_set_updated_at();

-- =============================================================================
-- 6. expenses
-- =============================================================================

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  supplier     text not null check (length(trim(supplier)) > 0),
  description  text,
  category     text,
  expense_date date not null default current_date,
  amount       numeric(14,2) not null check (amount >= 0),
  gst_amount   numeric(14,2) not null default 0 check (gst_amount >= 0 and gst_amount <= amount),
  due_date     date,
  paid_on      date,
  is_bill      boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint expenses_bill_has_due_date check (not is_bill or due_date is not null)
);

create index expenses_user_id_expense_date_idx on public.expenses (user_id, expense_date);
create index expenses_unpaid_bills_idx on public.expenses (user_id, due_date)
  where is_bill and paid_on is null;

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.pulse_set_updated_at();

-- =============================================================================
-- 7. Auth hook: create a profile for each new user
-- =============================================================================

create or replace function public.pulse_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.pulse_handle_new_user() from public, anon, authenticated;

create trigger pulse_on_auth_user_created
  after insert on auth.users
  for each row execute function public.pulse_handle_new_user();

-- =============================================================================
-- 8. Row Level Security and grants
-- =============================================================================

alter table public.profiles      enable row level security;
alter table public.profiles      force row level security;
alter table public.customers     enable row level security;
alter table public.customers     force row level security;
alter table public.invoices      enable row level security;
alter table public.invoices      force row level security;
alter table public.invoice_items enable row level security;
alter table public.invoice_items force row level security;
alter table public.payments      enable row level security;
alter table public.payments      force row level security;
alter table public.expenses      enable row level security;
alter table public.expenses      force row level security;

revoke all on all tables in schema public from anon;

grant select, insert, update, delete on
  public.profiles, public.customers, public.invoices,
  public.invoice_items, public.payments, public.expenses
  to authenticated;

-- profiles: a user can read and update only their own row. Rows are created by
-- pulse_handle_new_user() and removed by cascade from auth.users, so there is no
-- insert or delete policy.
create policy profiles_select on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy profiles_update on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- customers
create policy customers_select on public.customers
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy customers_insert on public.customers
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy customers_update on public.customers
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy customers_delete on public.customers
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- invoices
create policy invoices_select on public.invoices
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy invoices_update on public.invoices
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy invoices_delete on public.invoices
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- invoice_items
create policy invoice_items_select on public.invoice_items
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy invoice_items_insert on public.invoice_items
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy invoice_items_update on public.invoice_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy invoice_items_delete on public.invoice_items
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- payments
create policy payments_select on public.payments
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy payments_insert on public.payments
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy payments_update on public.payments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy payments_delete on public.payments
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- expenses
create policy expenses_select on public.expenses
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy expenses_update on public.expenses
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy expenses_delete on public.expenses
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- =============================================================================
-- 9. Table comments
-- =============================================================================

comment on table public.profiles      is 'One row per user holding business details, GST settings and starting cash balance.';
comment on table public.customers     is 'Customers a user invoices, scoped to that user.';
comment on table public.invoices      is 'Sales invoices with GST, derived balance due and amount paid maintained from payments.';
comment on table public.invoice_items is 'Line items belonging to an invoice.';
comment on table public.payments      is 'Money received, optionally allocated to an invoice; NULL invoice_id means unallocated.';
comment on table public.expenses      is 'Money spent, including unpaid bills with due dates.';
