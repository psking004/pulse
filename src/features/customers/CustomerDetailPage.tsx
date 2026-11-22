import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { CustomerForm } from '@/features/customers/CustomerForm';
import { formatDate, todayISO } from '@/lib/dates';
import { INDIAN_STATES } from '@/lib/indianStates';
import { formatMoney } from '@/lib/money';
import { PAYMENT_STATE_LABEL, paymentStateFor } from '@/lib/invoiceStatus';
import { deleteCustomer, getCustomer } from '@/services/customers';
import { getProfile } from '@/services/profile';
import { listInvoices } from '@/services/invoices';
import type { Customer, InvoiceWithCustomer, PaymentState } from '@/types/domain';

const STATE_NAMES = new Map<string, string>(INDIAN_STATES.map((state) => [state.code, state.name] as const));

interface DetailData {
  customer: Customer;
  invoices: InvoiceWithCustomer[];
  currency: string;
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function stateName(code: string | null): string {
  if (!code) return '—';
  return STATE_NAMES.get(code) ?? '—';
}

function orDash(value: string | null): string {
  return value ?? '—';
}

function termsLabel(days: number | null): string {
  return days == null ? 'Default (from business profile)' : `${days} days`;
}

type InvoiceBadgeVariant = 'success' | 'destructive' | 'warning' | 'outline';

function invoiceBadgeVariant(state: PaymentState): InvoiceBadgeVariant {
  if (state === 'paid') return 'success';
  if (state === 'overdue') return 'destructive';
  if (state === 'partially_paid') return 'warning';
  return 'outline';
}

interface DetailRowProps {
  label: string;
  value: string;
  preLine?: boolean;
  breakAll?: boolean;
}

function DetailRow({ label, value, preLine = false, breakAll = false }: DetailRowProps) {
  const className = [preLine ? 'whitespace-pre-line' : '', breakAll ? 'break-all' : ''].filter(Boolean).join(' ');
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={className || undefined}>{value}</dd>
    </>
  );
}

export function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id ?? '';
  const navigate = useNavigate();

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setData(null);
      setLoadError('Customer not found.');
      setLoading(false);
      return;
    }

    let customerFailed = false;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      getCustomer(id).catch((err: unknown) => {
        customerFailed = true;
        throw err;
      }),
      listInvoices(),
      getProfile(),
    ])
      .then(([customer, invoices, profile]) => {
        if (cancelled) return;
        setData({
          customer,
          invoices: invoices.filter((invoice) => invoice.customer_id === id),
          currency: profile.currency,
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          customerFailed ? 'Customer not found.' : messageOf(err, 'Could not load this customer.'),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  function toggleEdit(): void {
    setStatus(null);
    setActionError(null);
    setEditing((open) => !open);
  }

  function handleSaved(): void {
    setEditing(false);
    setActionError(null);
    setStatus('Customer saved.');
    setReloadKey((key) => key + 1);
  }

  async function handleDelete(): Promise<void> {
    if (!data) return;
    if (!window.confirm(`Delete ${data.customer.name}? This cannot be undone.`)) return;
    setStatus(null);
    setActionError(null);
    setDeleting(true);
    try {
      await deleteCustomer(id);
      navigate('/customers', { replace: true });
    } catch (err) {
      setActionError(messageOf(err, 'Could not delete the customer.'));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading customer…
      </p>
    );
  }

  if (loadError || !data) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-sm text-destructive">
          {loadError ?? 'Customer not found.'}
        </p>
        <Link to="/customers" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to customers
        </Link>
      </div>
    );
  }

  const { customer, invoices, currency } = data;
  const today = todayISO();

  return (
    <>
      <Link to="/customers" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to customers
      </Link>

      <div className="mt-2">
        <PageHeader
          title={customer.name}
          description="Customer details and invoices."
          actions={
            <>
              <Button variant="outline" aria-expanded={editing} onClick={toggleEdit}>
                {editing ? 'Close' : 'Edit'}
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete customer'}
              </Button>
            </>
          }
        />
      </div>

      <dl className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">GSTIN</dt>
          <dd className="font-mono text-xs">{orDash(customer.gstin)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">State</dt>
          <dd>{stateName(customer.state_code)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">Terms</dt>
          <dd>{termsLabel(customer.payment_terms_days)}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="text-muted-foreground">Invoices</dt>
          <dd className="tabular-nums">{invoices.length}</dd>
        </div>
      </dl>

      {status ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {status}
        </p>
      ) : null}

      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {editing ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Edit customer</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerForm
              initial={customer}
              onSaved={handleSaved}
              onCancel={() => setEditing(false)}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <DetailRow label="Email" value={orDash(customer.email)} breakAll />
            <DetailRow label="Phone" value={orDash(customer.phone)} />
            <DetailRow label="GSTIN" value={orDash(customer.gstin)} />
            <DetailRow label="State" value={stateName(customer.state_code)} />
            <DetailRow label="Billing address" value={orDash(customer.billing_address)} preLine />
            <DetailRow label="Payment terms" value={termsLabel(customer.payment_terms_days)} />
            <DetailRow label="Notes" value={orDash(customer.notes)} preLine />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No invoices for this customer"
              description="Invoices you create for this customer will appear here."
            >
              <Button asChild>
                <Link to="/invoices/new">New invoice</Link>
              </Button>
            </EmptyState>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-xl border md:block">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Invoice</th>
                      <th scope="col" className="px-4 py-3 font-medium">Issued</th>
                      <th scope="col" className="px-4 py-3 font-medium">Due</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Total</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Balance</th>
                      <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((invoice) => {
                      const state = paymentStateFor(invoice, today);
                      return (
                        <tr key={invoice.id} className="border-b last:border-0">
                          <td className="px-4 py-3">
                            <Link to={`/invoices/${invoice.id}`} className="font-medium text-primary hover:underline">
                              {invoice.invoice_number}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{formatDate(invoice.issue_date)}</td>
                          <td className="px-4 py-3">{formatDate(invoice.due_date)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatMoney(invoice.total_amount, currency)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{formatMoney(invoice.balance_due, currency)}</td>
                          <td className="px-4 py-3">
                            <Badge variant={invoiceBadgeVariant(state)}>{PAYMENT_STATE_LABEL[state]}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 md:hidden">
                {invoices.map((invoice) => {
                  const state = paymentStateFor(invoice, today);
                  return (
                    <li key={invoice.id} className="space-y-2 rounded-xl border bg-card p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Link to={`/invoices/${invoice.id}`} className="font-medium text-primary hover:underline">
                          {invoice.invoice_number}
                        </Link>
                        <Badge variant={invoiceBadgeVariant(state)}>{PAYMENT_STATE_LABEL[state]}</Badge>
                      </div>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <dt className="text-muted-foreground">Issued</dt>
                        <dd>{formatDate(invoice.issue_date)}</dd>
                        <dt className="text-muted-foreground">Due</dt>
                        <dd>{formatDate(invoice.due_date)}</dd>
                        <dt className="text-muted-foreground">Total</dt>
                        <dd>{formatMoney(invoice.total_amount, currency)}</dd>
                        <dt className="text-muted-foreground">Balance</dt>
                        <dd>{formatMoney(invoice.balance_due, currency)}</dd>
                      </dl>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
