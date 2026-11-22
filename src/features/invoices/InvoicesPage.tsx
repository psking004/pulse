import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDate, todayISO } from '@/lib/dates';
import { daysOverdue, PAYMENT_STATE_LABEL, paymentStateFor } from '@/lib/invoiceStatus';
import { formatMoney } from '@/lib/money';
import { listCustomers } from '@/services/customers';
import { listInvoices } from '@/services/invoices';
import { getProfile } from '@/services/profile';
import type { InvoiceWithCustomer, PaymentState, Profile } from '@/types/domain';

type StatusFilter = 'all' | PaymentState;

type BadgeTone = 'success' | 'destructive' | 'warning' | 'outline' | 'secondary';

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'void', label: 'Void' },
];

/** States shown in the summary strip, in display order. */
const SUMMARY_STATES: ReadonlyArray<PaymentState> = ['overdue', 'unpaid', 'partially_paid', 'paid', 'draft'];

function isStatusFilter(value: string): value is StatusFilter {
  return STATUS_OPTIONS.some((option) => option.value === value);
}

const INPUT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

interface PageData {
  invoices: InvoiceWithCustomer[];
  customerCount: number;
  profile: Profile;
}

interface Row {
  invoice: InvoiceWithCustomer;
  state: PaymentState;
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/** Badge tone for a payment state, using the shared badge variants. */
function stateBadgeTone(state: PaymentState): BadgeTone {
  switch (state) {
    case 'paid':
      return 'success';
    case 'overdue':
      return 'destructive';
    case 'partially_paid':
      return 'warning';
    case 'void':
      return 'secondary';
    case 'unpaid':
    case 'draft':
      return 'outline';
  }
}

interface DueDateProps {
  dueDate: string;
  state: PaymentState;
  today: string;
}

function DueDate({ dueDate, state, today }: DueDateProps) {
  return (
    <>
      <span>{formatDate(dueDate)}</span>
      {state === 'overdue' ? (
        <span className="block text-xs text-destructive">{daysOverdue(dueDate, today)} days overdue</span>
      ) : null}
    </>
  );
}

function StateBadge({ state }: { state: PaymentState }) {
  return <Badge variant={stateBadgeTone(state)}>{PAYMENT_STATE_LABEL[state]}</Badge>;
}

export function InvoicesPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    let cancelled = false;
    Promise.all([listInvoices(), listCustomers(), getProfile()])
      .then(([invoices, customers, profile]) => {
        if (!cancelled) setData({ invoices, customerCount: customers.length, profile });
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(messageOf(err, 'Could not load invoices.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry(): void {
    setLoading(true);
    setLoadError(null);
    setAttempt((n) => n + 1);
  }

  function clearFilters(): void {
    setQuery('');
    setStatusFilter('all');
  }

  const header = (
    <PageHeader
      title="Invoices"
      description="Tax invoices you have issued, with payment status."
      actions={
        <Button asChild>
          <Link to="/invoices/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            New invoice
          </Link>
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-muted-foreground">
          Loading invoices…
        </p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        {header}
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
          <Button variant="outline" onClick={retry}>
            Retry
          </Button>
        </div>
      </>
    );
  }

  if (!data) return <>{header}</>;

  const { invoices, customerCount, profile } = data;
  const currency = profile.currency;
  const today = todayISO();

  if (invoices.length === 0) {
    const noCustomers = customerCount === 0;
    return (
      <>
        {header}
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description={
            noCustomers
              ? 'Add a customer first, then create an invoice.'
              : 'Create your first invoice to start tracking receivables.'
          }
        >
          <Button asChild>
            {noCustomers ? (
              <Link to="/customers">Go to customers</Link>
            ) : (
              <Link to="/invoices/new">New invoice</Link>
            )}
          </Button>
        </EmptyState>
      </>
    );
  }

  const rows: Row[] = invoices.map((invoice) => ({ invoice, state: paymentStateFor(invoice, today) }));
  const countOf = (state: PaymentState): number => rows.filter((row) => row.state === state).length;
  const q = query.trim().toLowerCase();
  const visible = rows.filter(({ invoice, state }) => {
    if (statusFilter !== 'all' && state !== statusFilter) return false;
    if (q === '') return true;
    return (
      invoice.invoice_number.toLowerCase().includes(q) ||
      (invoice.customer?.name ?? '').toLowerCase().includes(q)
    );
  });
  const filtersActive = q !== '' || statusFilter !== 'all';

  return (
    <>
      {header}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <label htmlFor="invoice-search" className="sr-only">
            Search invoices
          </label>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="invoice-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by invoice number or customer"
            className={`${INPUT_CLASS} w-full pl-9`}
          />
        </div>
        <label htmlFor="invoice-status" className="sr-only">
          Status
        </label>
        <select
          id="invoice-status"
          value={statusFilter}
          onChange={(e) => {
            const next = e.target.value;
            if (isStatusFilter(next)) setStatusFilter(next);
          }}
          className={`${INPUT_CLASS} w-full sm:w-48`}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Invoice counts by status">
        {SUMMARY_STATES.map((state) => (
          <div key={state} className="rounded-lg border bg-card px-3 py-2">
            <dt className="text-xs text-muted-foreground">{PAYMENT_STATE_LABEL[state]}</dt>
            <dd
              className={`text-lg font-semibold tabular-nums ${state === 'overdue' ? 'text-destructive' : ''}`}
            >
              {countOf(state)}
            </dd>
          </div>
        ))}
      </dl>

      {filtersActive ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Showing {visible.length} of {invoices.length} invoices
        </p>
      ) : null}

      {visible.length === 0 ? (
        <div className="space-y-3">
          <p role="status" className="text-sm text-muted-foreground">
            No invoices match your search or filter.
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto rounded-xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-3 font-medium">Issue date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Due date</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Balance</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ invoice, state }) => (
                  <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link to={`/invoices/${invoice.id}`} className="font-medium text-primary hover:underline">
                        {invoice.invoice_number}
                      </Link>
                      <span className="block text-muted-foreground">{invoice.customer?.name ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">{formatDate(invoice.issue_date)}</td>
                    <td className="px-4 py-3">
                      <DueDate dueDate={invoice.due_date} state={state} today={today} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(invoice.total_amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatMoney(invoice.balance_due, currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StateBadge state={state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {visible.map(({ invoice, state }) => (
              <li key={invoice.id} className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/invoices/${invoice.id}`} className="font-medium text-primary hover:underline">
                      {invoice.invoice_number}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">{invoice.customer?.name ?? '—'}</p>
                  </div>
                  <StateBadge state={state} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Due date</dt>
                  <dd className="text-right">
                    <DueDate dueDate={invoice.due_date} state={state} today={today} />
                  </dd>
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="text-right tabular-nums">{formatMoney(invoice.total_amount, currency)}</dd>
                  <dt className="text-muted-foreground">Balance</dt>
                  <dd className="text-right font-medium tabular-nums">{formatMoney(invoice.balance_due, currency)}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
