import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDate, todayISO } from '@/lib/dates';
import { daysOverdue, PAYMENT_STATE_LABEL, paymentStateBadgeVariant, paymentStateFor } from '@/lib/invoiceStatus';
import { formatMoney } from '@/lib/money';
import { listCustomers } from '@/services/customers';
import { listInvoices } from '@/services/invoices';
import { getProfile } from '@/services/profile';
import type { InvoiceWithCustomer, PaymentState, Profile } from '@/types/domain';

type StatusFilter = 'all' | PaymentState;

const STATUS_OPTIONS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'void', label: 'Void' },
];

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
  return <Badge variant={paymentStateBadgeVariant(state)}>{PAYMENT_STATE_LABEL[state]}</Badge>;
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

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="invoice-search" className="sr-only">
          Search invoices
        </label>
        <input
          id="invoice-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by invoice number or customer"
          className={`${INPUT_CLASS} w-full sm:max-w-xs`}
        />
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
          <div className="hidden overflow-x-auto rounded-xl border md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Issue date</th>
                  <th scope="col" className="px-4 py-3 font-medium">Due date</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Balance</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ invoice, state }) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <Link to={`/invoices/${invoice.id}`} className="font-medium text-primary hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{invoice.customer?.name ?? '—'}</td>
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
              <li key={invoice.id} className="space-y-2 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/invoices/${invoice.id}`} className="font-medium text-primary hover:underline">
                    {invoice.invoice_number}
                  </Link>
                  <StateBadge state={state} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Customer</dt>
                  <dd>{invoice.customer?.name ?? '—'}</dd>
                  <dt className="text-muted-foreground">Due date</dt>
                  <dd>
                    <DueDate dueDate={invoice.due_date} state={state} today={today} />
                  </dd>
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="tabular-nums">{formatMoney(invoice.total_amount, currency)}</dd>
                  <dt className="text-muted-foreground">Balance</dt>
                  <dd className="tabular-nums">{formatMoney(invoice.balance_due, currency)}</dd>
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
