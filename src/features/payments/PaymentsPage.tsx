import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { PAYMENT_METHOD_OPTIONS, PaymentForm, paymentMethodLabel } from '@/features/payments/PaymentForm';
import { formatDate, todayISO } from '@/lib/dates';
import { formatMoney, round2 } from '@/lib/money';
import { listInvoices } from '@/services/invoices';
import { deletePayment, listPayments, type PaymentWithInvoice } from '@/services/payments';
import { getProfile } from '@/services/profile';
import type { InvoiceWithCustomer, PaymentMethod, Profile } from '@/types/domain';

interface PageData {
  payments: PaymentWithInvoice[];
  invoices: InvoiceWithCustomer[];
  profile: Profile;
}

type MethodFilter = 'all' | PaymentMethod;

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

interface SummaryCardProps {
  label: string;
  value: string;
}

function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <Card className="p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Card>
  );
}

function InvoiceCell({ payment }: { payment: PaymentWithInvoice }): ReactNode {
  if (!payment.invoice_id || !payment.invoice) {
    return <span className="text-muted-foreground">Unallocated</span>;
  }
  return (
    <Link to={`/invoices/${payment.invoice_id}`} className="text-primary hover:underline">
      {payment.invoice.invoice_number}
    </Link>
  );
}

export function PaymentsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PaymentWithInvoice | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<MethodFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPayments(), listInvoices(), getProfile()])
      .then(([payments, invoices, profile]) => {
        if (!cancelled) {
          setData({ payments, invoices, profile });
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(messageOf(err, 'Could not load payments.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function reload(): void {
    setAttempt((n) => n + 1);
  }

  function retry(): void {
    setLoading(true);
    setLoadError(null);
    reload();
  }

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Payments" description="Money received against invoices." />
        <p role="status" className="text-sm text-muted-foreground">
          Loading payments…
        </p>
      </>
    );
  }

  if (loadError || !data) {
    return (
      <>
        <PageHeader title="Payments" description="Money received against invoices." />
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <span>{loadError ?? 'Could not load payments.'}</span>
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      </>
    );
  }

  const { payments, invoices, profile } = data;
  const currency = profile.currency;

  function openNew(): void {
    setEditing(null);
    setActionError(null);
    setMessage(null);
    setShowForm(true);
  }

  function openEdit(payment: PaymentWithInvoice): void {
    setEditing(payment);
    setActionError(null);
    setMessage(null);
    setShowForm(true);
  }

  function closeForm(): void {
    setShowForm(false);
    setEditing(null);
  }

  function handleSaved(): void {
    closeForm();
    setMessage('Payment saved.');
    reload();
  }

  async function removePayment(payment: PaymentWithInvoice): Promise<void> {
    const amount = formatMoney(payment.amount, currency);
    if (!window.confirm(`Delete this payment of ${amount}? The invoice balance will be recalculated.`)) return;
    setActionError(null);
    setMessage(null);
    try {
      await deletePayment(payment.id);
      setMessage('Payment deleted.');
      reload();
    } catch (err: unknown) {
      setActionError(messageOf(err, 'Could not delete the payment.'));
    }
  }

  // Options for a new payment: sent invoices that still have a balance.
  const invoiceOptions = invoices
    .filter((invoice) => invoice.status === 'sent' && invoice.balance_due > 0)
    .map((invoice) => ({
      id: invoice.id,
      label: `${invoice.invoice_number} · ${invoice.customer?.name ?? 'Customer'} · balance ${formatMoney(invoice.balance_due, currency)}`,
      balance_due: invoice.balance_due,
    }));

  // Editing a payment linked to an invoice: the invoice is fixed and its limit includes this payment.
  const editingLinked = editing?.invoice_id ? editing : null;
  const linkedInvoice = editingLinked
    ? invoices.find((invoice) => invoice.id === editingLinked.invoice_id)
    : undefined;
  const formBalanceDue =
    editingLinked && linkedInvoice ? round2(linkedInvoice.balance_due + editingLinked.amount) : undefined;

  const totalReceived = round2(payments.reduce((sum, payment) => sum + payment.amount, 0));
  const monthPrefix = todayISO().slice(0, 7);
  const receivedThisMonth = round2(
    payments
      .filter((payment) => payment.paid_on.startsWith(monthPrefix))
      .reduce((sum, payment) => sum + payment.amount, 0),
  );

  const query = search.trim().toLowerCase();
  const filtered = payments.filter((payment) => {
    if (fromDate && payment.paid_on < fromDate) return false;
    if (toDate && payment.paid_on > toDate) return false;
    if (methodFilter !== 'all' && payment.method !== methodFilter) return false;
    if (query) {
      const haystack = [
        payment.invoice?.invoice_number,
        payment.invoice?.customer?.name,
        payment.reference,
        payment.notes,
      ]
        .filter((part): part is string => Boolean(part))
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const isFiltered = query !== '' || methodFilter !== 'all' || fromDate !== '' || toDate !== '';

  const emptyDescription =
    invoices.length === 0
      ? 'Create an invoice first, then record payments against it.'
      : 'Record a payment against an invoice to update its balance.';

  return (
    <>
      <PageHeader
        title="Payments"
        description="Money received against invoices."
        actions={
          <Button onClick={() => (showForm ? closeForm() : openNew())}>Record payment</Button>
        }
      />
      <p className="-mt-4 mb-6 text-sm text-muted-foreground">
        Recorded payments update each invoice's balance automatically.
      </p>

      {message ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {showForm ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editing ? 'Edit payment' : 'Record payment'}</CardTitle>
          </CardHeader>
          <CardContent>
            <PaymentForm
              key={editing?.id ?? 'new'}
              invoiceId={editing ? editing.invoice_id : null}
              invoiceOptions={editingLinked ? undefined : invoiceOptions}
              balanceDue={formBalanceDue}
              currency={currency}
              existing={editing}
              onSaved={handleSaved}
              onCancel={closeForm}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total received" value={formatMoney(totalReceived, currency)} />
        <SummaryCard label="Received this month" value={formatMoney(receivedThisMonth, currency)} />
        <SummaryCard label="Payments recorded" value={String(payments.length)} />
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payments yet" description={emptyDescription}>
          {invoices.length === 0 ? (
            <Button asChild>
              <Link to="/invoices/new">Create an invoice</Link>
            </Button>
          ) : null}
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end">
            <input
              type="search"
              aria-label="Search payments"
              placeholder="Search invoice, customer, reference…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:max-w-xs"
            />
            <select
              aria-label="Filter by method"
              value={methodFilter}
              onChange={(event) => {
                const match = PAYMENT_METHOD_OPTIONS.find((option) => option.value === event.target.value);
                setMethodFilter(match ? match.value : 'all');
              }}
              className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All methods</option>
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <label htmlFor="payments-from" className="text-sm text-muted-foreground">
                From
              </label>
              <input
                id="payments-from"
                type="date"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <label htmlFor="payments-to" className="text-sm text-muted-foreground">
                To
              </label>
              <input
                id="payments-to"
                type="date"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            {isFiltered ? (
              <p className="text-sm text-muted-foreground lg:ml-auto">
                Showing {filtered.length} of {payments.length} payments
              </p>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments match these filters.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-xl border md:block">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Date</th>
                      <th scope="col" className="px-3 py-2 font-medium">Invoice</th>
                      <th scope="col" className="px-3 py-2 font-medium">Customer</th>
                      <th scope="col" className="px-3 py-2 font-medium">Method</th>
                      <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((payment) => {
                      const amountText = formatMoney(payment.amount, currency);
                      const dateText = formatDate(payment.paid_on);
                      return (
                        <tr key={payment.id} className="border-b last:border-0">
                          <td className="px-3 py-2">{dateText}</td>
                          <td className="px-3 py-2">
                            <InvoiceCell payment={payment} />
                          </td>
                          <td className="px-3 py-2">{payment.invoice?.customer?.name ?? '—'}</td>
                          <td className="px-3 py-2">{paymentMethodLabel(payment.method)}</td>
                          <td className="px-3 py-2">{payment.reference ?? '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{amountText}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Edit payment of ${amountText} on ${dateText}`}
                                onClick={() => openEdit(payment)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => removePayment(payment)}
                              >
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {filtered.map((payment) => {
                  const amountText = formatMoney(payment.amount, currency);
                  const dateText = formatDate(payment.paid_on);
                  return (
                    <li key={payment.id} className="space-y-2 rounded-xl border bg-card p-4 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span>{dateText}</span>
                        <span className="font-medium tabular-nums">{amountText}</span>
                      </div>
                      <div className="text-muted-foreground">
                        Invoice: <InvoiceCell payment={payment} />
                      </div>
                      <div className="text-muted-foreground">
                        Customer: {payment.invoice?.customer?.name ?? '—'}
                      </div>
                      <div className="text-muted-foreground">
                        Method: {paymentMethodLabel(payment.method)}
                      </div>
                      <div className="text-muted-foreground">Reference: {payment.reference ?? '—'}</div>
                      <div className="flex items-center justify-end gap-1 pt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit payment of ${amountText} on ${dateText}`}
                          onClick={() => openEdit(payment)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => removePayment(payment)}
                        >
                          Delete
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
