import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { PaymentForm, paymentMethodLabel } from '@/features/payments/PaymentForm';
import { ReminderPanel } from '@/features/invoices/ReminderPanel';
import { formatDate, todayISO } from '@/lib/dates';
import { daysOverdue, PAYMENT_STATE_LABEL, paymentStateFor } from '@/lib/invoiceStatus';
import { formatMoney } from '@/lib/money';
import { deleteInvoice, getInvoice, setInvoiceStatus } from '@/services/invoices';
import { getProfile } from '@/services/profile';
import type { InvoiceDetail, PaymentState, Profile } from '@/types/domain';

interface PageData {
  invoice: InvoiceDetail;
  profile: Profile;
}

type BadgeTone = 'success' | 'destructive' | 'warning' | 'outline' | 'secondary';

const NUMERIC_CELL = 'px-3 py-2 text-right tabular-nums';

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

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function supplyLabel(supplyType: InvoiceDetail['supply_type']): string {
  return supplyType === 'intra' ? 'CGST + SGST (within state)' : 'IGST (inter-state)';
}

interface PanelProps {
  title: string;
  children: ReactNode;
}

function Panel({ title, children }: PanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface DetailRowProps {
  label: string;
  children: ReactNode;
}

function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

interface TotalRowProps {
  label: string;
  value: string;
  strong?: boolean;
}

function TotalRow({ label, value, strong = false }: TotalRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt className={strong ? 'font-semibold' : 'text-muted-foreground'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  );
}

export function InvoiceDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const saved = (location.state as { saved?: boolean } | null)?.saved === true;

  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getInvoice(id), getProfile()])
      .then(([invoice, profile]) => {
        if (!cancelled) {
          setData({ invoice, profile });
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(messageOf(err, 'Could not load this invoice.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  function reload(): void {
    setAttempt((n) => n + 1);
  }

  async function changeStatus(status: 'sent' | 'void', successMessage: string, failMessage: string): Promise<void> {
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await setInvoiceStatus(id, status);
      setActionMessage(successMessage);
      reload();
    } catch (err: unknown) {
      setActionError(messageOf(err, failMessage));
    } finally {
      setBusy(false);
    }
  }

  async function markAsSent(): Promise<void> {
    await changeStatus('sent', 'Invoice marked as sent.', 'Could not mark the invoice as sent.');
  }

  async function voidInvoice(): Promise<void> {
    const number = data?.invoice.invoice_number ?? '';
    if (!window.confirm(`Void invoice ${number}? Voided invoices cannot be edited and will not appear as receivables.`)) {
      return;
    }
    await changeStatus('void', 'Invoice voided.', 'Could not void the invoice.');
  }

  async function removeInvoice(): Promise<void> {
    const number = data?.invoice.invoice_number ?? '';
    if (!window.confirm(`Delete invoice ${number}? This cannot be undone.`)) return;
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await deleteInvoice(id);
      navigate('/invoices', { replace: true });
    } catch (err: unknown) {
      setActionError(messageOf(err, 'Could not delete the invoice.'));
      setBusy(false);
    }
  }

  const backLink = (
    <Link to="/invoices" className="text-sm text-primary hover:underline">
      ← Back to invoices
    </Link>
  );

  if (loading && !data) {
    return (
      <>
        {backLink}
        <p role="status" className="mt-4 text-sm text-muted-foreground">
          Loading invoice…
        </p>
      </>
    );
  }

  if (loadError || !data) {
    return (
      <>
        {backLink}
        <p role="alert" className="mt-4 text-sm text-destructive">
          {loadError ?? 'Invoice not found.'}
        </p>
      </>
    );
  }

  const { invoice, profile } = data;
  const currency = profile.currency;
  const today = todayISO();
  const state = paymentStateFor(invoice, today);
  const isIntra = invoice.supply_type === 'intra';
  const isVoid = invoice.status === 'void';

  const actions = (
    <>
      {!isVoid ? (
        <Button asChild>
          <Link to={`/invoices/${invoice.id}/edit`}>Edit</Link>
        </Button>
      ) : null}
      <Button asChild variant="outline">
        <Link to={`/invoices/${invoice.id}/print`}>Print / preview</Link>
      </Button>
      {invoice.status === 'draft' ? (
        <Button variant="outline" onClick={markAsSent} disabled={busy}>
          Mark as sent
        </Button>
      ) : null}
      {!isVoid ? (
        <Button variant="outline" onClick={voidInvoice} disabled={busy}>
          Void invoice
        </Button>
      ) : null}
      <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
      <Button variant="outline" className="text-destructive" onClick={removeInvoice} disabled={busy}>
        Delete invoice
      </Button>
    </>
  );

  return (
    <>
      <div className="mb-4">{backLink}</div>

      {saved ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          Invoice saved.
        </p>
      ) : null}
      {actionMessage ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {actionMessage}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      <PageHeader
        title={invoice.invoice_number}
        description={`Issued to ${invoice.customer?.name ?? 'Unknown customer'}`}
        actions={actions}
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Badge variant={stateBadgeTone(state)}>{PAYMENT_STATE_LABEL[state]}</Badge>
        {state === 'overdue' ? (
          <span className="text-sm text-destructive">{daysOverdue(invoice.due_date, today)} days overdue</span>
        ) : null}
      </div>

      <Card className="mb-6">
        <CardContent className="grid gap-6 p-6 sm:grid-cols-3">
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Total</p>
            <p className="text-lg font-medium tabular-nums">{formatMoney(invoice.total_amount, currency)}</p>
          </div>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">Paid</p>
            <p className="text-lg font-medium tabular-nums">{formatMoney(invoice.amount_paid, currency)}</p>
          </div>
          <div className="space-y-1 sm:text-right">
            <p className="text-sm text-muted-foreground">Balance due</p>
            <p className="text-3xl font-semibold tabular-nums">{formatMoney(invoice.balance_due, currency)}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Panel title="Details">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <DetailRow label="Customer">
                <span className="block">{invoice.customer?.name ?? 'Unknown customer'}</span>
                {invoice.customer?.email ? (
                  <span className="block text-muted-foreground">{invoice.customer.email}</span>
                ) : null}
              </DetailRow>
              <DetailRow label="Issue date">{formatDate(invoice.issue_date)}</DetailRow>
              <DetailRow label="Due date">{formatDate(invoice.due_date)}</DetailRow>
              <DetailRow label="Supply type">{supplyLabel(invoice.supply_type)}</DetailRow>
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-muted-foreground">Notes</dt>
                <dd className="whitespace-pre-line">{invoice.notes ? invoice.notes : '—'}</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Line items">
            {invoice.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No line items.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead className="border-b text-left text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">#</th>
                      <th scope="col" className="px-3 py-2 font-medium">Description</th>
                      <th scope="col" className="px-3 py-2 font-medium">HSN/SAC</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Qty</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Rate</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Disc %</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Taxable</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">CGST</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">SGST</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">IGST</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2 tabular-nums">{item.position}</td>
                        <td className="px-3 py-2">{item.description}</td>
                        <td className="px-3 py-2">{item.hsn_sac ?? '—'}</td>
                        <td className={NUMERIC_CELL}>{item.quantity}</td>
                        <td className={NUMERIC_CELL}>{formatMoney(item.unit_price, currency)}</td>
                        <td className={NUMERIC_CELL}>{item.discount_percent}</td>
                        <td className={NUMERIC_CELL}>{formatMoney(item.taxable_value, currency)}</td>
                        <td className={NUMERIC_CELL}>{formatMoney(item.cgst_amount, currency)}</td>
                        <td className={NUMERIC_CELL}>{formatMoney(item.sgst_amount, currency)}</td>
                        <td className={NUMERIC_CELL}>{formatMoney(item.igst_amount, currency)}</td>
                        <td className={NUMERIC_CELL}>{formatMoney(item.line_total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Totals">
            <dl className="divide-y text-sm">
              <TotalRow label="Subtotal" value={formatMoney(invoice.subtotal, currency)} />
              <TotalRow label="Discount" value={formatMoney(invoice.discount_total, currency)} />
              {isIntra ? <TotalRow label="CGST" value={formatMoney(invoice.cgst_amount, currency)} /> : null}
              {isIntra ? <TotalRow label="SGST" value={formatMoney(invoice.sgst_amount, currency)} /> : null}
              {!isIntra ? <TotalRow label="IGST" value={formatMoney(invoice.igst_amount, currency)} /> : null}
              <TotalRow label="Total" value={formatMoney(invoice.total_amount, currency)} />
              <TotalRow label="Amount paid" value={formatMoney(invoice.amount_paid, currency)} />
              <TotalRow label="Balance due" value={formatMoney(invoice.balance_due, currency)} strong />
            </dl>
          </Panel>

          {invoice.status === 'sent' && invoice.balance_due > 0 ? (
            <ReminderPanel
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoice_number}
              customerName={invoice.customer?.name ?? 'the customer'}
              currency={profile.currency}
            />
          ) : null}

          <Panel title="Payments">
            {invoice.amount_paid > 0 && invoice.balance_due > 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">
                {`Partially paid: ${formatMoney(invoice.amount_paid, currency)} of ${formatMoney(invoice.total_amount, currency)} received.`}
              </p>
            ) : null}
            {invoice.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No payments recorded for this invoice.</p>
            ) : (
              <ul className="divide-y text-sm">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="grid gap-1 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <span>{formatDate(payment.paid_on)}</span>
                      <span className="tabular-nums">{formatMoney(payment.amount, currency)}</span>
                    </div>
                    <div className="text-muted-foreground">
                      Method: {paymentMethodLabel(payment.method)}
                    </div>
                    <div className="text-muted-foreground">Reference: {payment.reference ?? '—'}</div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {invoice.status === 'sent' && invoice.balance_due > 0 ? (
            <Panel title="Record payment">
              <PaymentForm
                invoiceId={invoice.id}
                balanceDue={invoice.balance_due}
                currency={currency}
                onSaved={reload}
              />
            </Panel>
          ) : null}
        </div>
      </div>

    </>
  );
}
