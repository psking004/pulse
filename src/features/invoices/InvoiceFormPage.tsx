import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/PageHeader';
import { addDays, isISODate, todayISO } from '@/lib/dates';
import { formatMoney, parseAmount } from '@/lib/money';
import {
  calculateInvoice,
  GST_RATE_OPTIONS,
  isSupplyTypeAmbiguous,
  nextInvoiceNumber,
  supplyTypeFor,
  type LineInput,
} from '@/lib/gst';
import { listCustomers } from '@/services/customers';
import { getProfile } from '@/services/profile';
import {
  createInvoice,
  getInvoice,
  listInvoiceNumbers,
  updateInvoice,
  type InvoiceHeaderInput,
  type InvoiceItemInput,
} from '@/services/invoices';
import type { Customer, InvoiceDetail, InvoiceStatus, Profile, SupplyType } from '@/types/domain';

type EditableStatus = Exclude<InvoiceStatus, 'void'>;

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const TEXTAREA_CLASS =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const LABEL_CLASS = 'mb-1 block text-sm font-medium';
const DEFAULT_GST_RATE = '18';

/** Form row. All numeric values are kept as text until save/totals parse them. */
interface LineRow {
  key: number;
  description: string;
  hsn: string;
  quantity: string;
  rate: string;
  discount: string;
  gstApplicable: boolean;
  gstRate: string;
}

interface FormState {
  customerId: string;
  invoiceNumber: string;
  status: EditableStatus;
  issueDate: string;
  dueDate: string;
  supplyType: SupplyType;
  notes: string;
  lines: LineRow[];
}

interface LoadedData {
  profile: Profile;
  customers: Customer[];
  numbers: string[];
  invoice: InvoiceDetail | null;
}

type BuildResult =
  | { ok: true; header: InvoiceHeaderInput; items: InvoiceItemInput[] }
  | { ok: false; message: string };

let lineKeySeq = 0;

function nextLineKey(): number {
  lineKeySeq += 1;
  return lineKeySeq;
}

function newLine(): LineRow {
  return {
    key: nextLineKey(),
    description: '',
    hsn: '',
    quantity: '1',
    rate: '',
    discount: '0',
    gstApplicable: true,
    gstRate: DEFAULT_GST_RATE,
  };
}

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function termsDaysFor(customer: Customer, profile: Profile): number {
  return customer.payment_terms_days ?? profile.default_payment_terms_days;
}

/** Parse one row for calculation. Returns null when the row is not yet valid. */
function parseRow(row: LineRow): LineInput | null {
  const quantity = parseAmount(row.quantity);
  const rate = parseAmount(row.rate);
  const discount = row.discount.trim() === '' ? 0 : parseAmount(row.discount);
  if (quantity === null || quantity <= 0) return null;
  if (rate === null) return null;
  if (discount === null || discount > 100) return null;
  return {
    quantity,
    unit_price: rate,
    discount_percent: discount,
    gst_applicable: row.gstApplicable,
    gst_rate: Number(row.gstRate),
  };
}

/** Totals over the rows that currently parse; invalid rows are left out until fixed. */
function computeTotals(lines: LineRow[], supplyType: SupplyType) {
  const inputs: LineInput[] = [];
  for (const row of lines) {
    const input = parseRow(row);
    if (input) inputs.push(input);
  }
  return calculateInvoice(inputs, supplyType).totals;
}

function newForm(profile: Profile, numbers: string[]): FormState {
  const issueDate = todayISO();
  return {
    customerId: '',
    invoiceNumber: nextInvoiceNumber(numbers),
    status: 'draft',
    issueDate,
    dueDate: addDays(issueDate, profile.default_payment_terms_days),
    supplyType: supplyTypeFor(profile.state_code, null),
    notes: '',
    lines: [newLine()],
  };
}

function formFromInvoice(invoice: InvoiceDetail): FormState {
  const lines: LineRow[] = [...invoice.items]
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      key: nextLineKey(),
      description: item.description,
      hsn: item.hsn_sac ?? '',
      quantity: String(item.quantity),
      rate: String(item.unit_price),
      discount: String(item.discount_percent),
      gstApplicable: item.gst_applicable,
      gstRate: String(item.gst_rate),
    }));
  return {
    customerId: invoice.customer_id,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status === 'sent' ? 'sent' : 'draft',
    issueDate: invoice.issue_date,
    dueDate: invoice.due_date,
    supplyType: invoice.supply_type,
    notes: invoice.notes ?? '',
    lines: lines.length > 0 ? lines : [newLine()],
  };
}

/** Validate the form and build the header and item payloads. */
function buildPayload(form: FormState, data: LoadedData): BuildResult {
  const fail = (message: string): BuildResult => ({ ok: false, message });

  if (!form.customerId) return fail('Choose a customer.');

  const invoiceNumber = form.invoiceNumber.trim();
  if (invoiceNumber === '') return fail('Enter an invoice number.');
  const ownNumber = data.invoice?.invoice_number;
  if (data.numbers.some((n) => n === invoiceNumber && n !== ownNumber)) {
    return fail(`Invoice number ${invoiceNumber} is already in use. Choose another.`);
  }

  if (!isISODate(form.issueDate)) return fail('Enter a valid issue date.');
  if (!isISODate(form.dueDate)) return fail('Enter a valid due date.');
  if (form.dueDate < form.issueDate) return fail('Due date cannot be before the issue date.');

  const inputs: LineInput[] = [];
  for (let i = 0; i < form.lines.length; i += 1) {
    const row = form.lines[i];
    const input = row ? parseRow(row) : null;
    if (!row || !input || row.description.trim() === '') {
      return fail(
        `Check line ${i + 1}: description is required, quantity must be above 0, rate 0 or more, and discount 0 to 100.`,
      );
    }
    inputs.push(input);
  }

  const { lines: results, totals } = calculateInvoice(inputs, form.supplyType);

  const items: InvoiceItemInput[] = [];
  for (let i = 0; i < form.lines.length; i += 1) {
    const row = form.lines[i];
    const input = inputs[i];
    const result = results[i];
    if (!row || !input || !result) return fail(`Line ${i + 1} could not be calculated.`);
    items.push({
      position: i,
      description: row.description.trim(),
      hsn_sac: row.hsn.trim() || null,
      quantity: input.quantity,
      unit_price: input.unit_price,
      discount_percent: input.discount_percent,
      gst_applicable: input.gst_applicable,
      gst_rate: input.gst_rate,
      discount_amount: result.discount_amount,
      taxable_value: result.taxable_value,
      cgst_amount: result.cgst_amount,
      sgst_amount: result.sgst_amount,
      igst_amount: result.igst_amount,
      line_total: result.line_total,
    });
  }

  const header: InvoiceHeaderInput = {
    customer_id: form.customerId,
    invoice_number: invoiceNumber,
    status: form.status,
    supply_type: form.supplyType,
    issue_date: form.issueDate,
    due_date: form.dueDate,
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    cgst_amount: totals.cgst_amount,
    sgst_amount: totals.sgst_amount,
    igst_amount: totals.igst_amount,
    gst_amount: totals.gst_amount,
    notes: form.notes.trim() || null,
  };
  return { ok: true, header, items };
}

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const editingId = id ?? '';
  const isEdit = editingId !== '';

  const [data, setData] = useState<LoadedData | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const invoicePromise: Promise<InvoiceDetail | null> = editingId ? getInvoice(editingId) : Promise.resolve(null);
    Promise.all([getProfile(), listCustomers(), listInvoiceNumbers(), invoicePromise])
      .then(([profile, rows, numbers, invoice]) => {
        if (cancelled) return;
        // Keep the invoice's own customer selectable even if it is not in the list.
        const extra = invoice?.customer ?? null;
        const customers = extra && !rows.some((c) => c.id === extra.id) ? [extra, ...rows] : rows;
        setData({ profile, customers, numbers, invoice });
        setForm(invoice ? formFromInvoice(invoice) : newForm(profile, numbers));
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(messageOf(err, 'Could not load the invoice form.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingId]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function updateLine(key: number, patch: Partial<LineRow>): void {
    setForm((prev) =>
      prev ? { ...prev, lines: prev.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) } : prev,
    );
  }

  function addLine(): void {
    const row = newLine();
    setForm((prev) => (prev ? { ...prev, lines: [...prev.lines, row] } : prev));
  }

  function removeLine(key: number): void {
    setForm((prev) =>
      prev !== null && prev.lines.length > 1
        ? { ...prev, lines: prev.lines.filter((l) => l.key !== key) }
        : prev,
    );
  }

  function handleCustomerChange(customerId: string): void {
    if (!data) return;
    const { profile } = data;
    const customer = data.customers.find((c) => c.id === customerId) ?? null;
    setForm((prev) => {
      if (!prev) return prev;
      if (isEdit || !customer) return { ...prev, customerId };
      const dueDate = isISODate(prev.issueDate)
        ? addDays(prev.issueDate, termsDaysFor(customer, profile))
        : prev.dueDate;
      return {
        ...prev,
        customerId,
        dueDate,
        supplyType: supplyTypeFor(profile.state_code, customer.state_code),
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!data || !form || saving) return;
    const result = buildPayload(form, data);
    if (!result.ok) {
      setSaveError(result.message);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      let savedId = editingId;
      if (isEdit) {
        await updateInvoice(editingId, result.header, result.items);
      } else {
        savedId = await createInvoice(result.header, result.items);
      }
      navigate(`/invoices/${savedId}`, { state: { saved: true } });
    } catch (err) {
      setSaveError(messageOf(err, 'Could not save the invoice.'));
      setSaving(false);
    }
  }

  const header = (
    <>
      <Link to="/invoices" className="mb-2 inline-block text-sm text-primary hover:underline">
        ← Back to invoices
      </Link>
      <PageHeader title={isEdit ? 'Edit invoice' : 'New invoice'} />
    </>
  );

  if (loading) {
    return (
      <>
        {header}
        <p role="status" className="text-sm text-muted-foreground">
          Loading…
        </p>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        {header}
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      </>
    );
  }

  if (!data || !form) return <>{header}</>;

  if (data.invoice?.status === 'void') {
    return (
      <>
        {header}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Void invoices cannot be edited.</p>
          <Link to="/invoices" className="text-sm text-primary hover:underline">
            Back to invoices
          </Link>
        </div>
      </>
    );
  }

  if (data.customers.length === 0) {
    return (
      <>
        {header}
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Add a customer before creating an invoice.</p>
          <Link to="/customers" className="text-sm text-primary hover:underline">
            Go to customers
          </Link>
        </div>
      </>
    );
  }

  const { profile } = data;
  const selectedCustomer = data.customers.find((c) => c.id === form.customerId) ?? null;
  const detected: SupplyType | null = selectedCustomer
    ? supplyTypeFor(profile.state_code, selectedCustomer.state_code)
    : null;
  const totals = computeTotals(form.lines, form.supplyType);
  const money = (value: number): string => formatMoney(value, profile.currency);
  const cancelTo = isEdit ? `/invoices/${editingId}` : '/invoices';
  const numericInputClass = `${INPUT_CLASS} text-right tabular-nums`;

  return (
    <>
      {header}
      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6 pb-24 lg:pb-0">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="min-w-0 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer and dates</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="invoice-customer" className={LABEL_CLASS}>
                    Customer
                  </label>
                  <select
                    id="invoice-customer"
                    required
                    className={INPUT_CLASS}
                    value={form.customerId}
                    onChange={(e) => handleCustomerChange(e.target.value)}
                  >
                    <option value="">Select a customer</option>
                    {data.customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="invoice-number" className={LABEL_CLASS}>
                    Invoice number
                  </label>
                  <input
                    id="invoice-number"
                    type="text"
                    required
                    className={INPUT_CLASS}
                    value={form.invoiceNumber}
                    onChange={(e) => setField('invoiceNumber', e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="invoice-status" className={LABEL_CLASS}>
                    Status
                  </label>
                  <select
                    id="invoice-status"
                    className={INPUT_CLASS}
                    value={form.status}
                    onChange={(e) => setField('status', e.target.value === 'sent' ? 'sent' : 'draft')}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4 md:col-span-2">
                  <div>
                    <label htmlFor="invoice-issue-date" className={LABEL_CLASS}>
                      Issue date
                    </label>
                    <input
                      id="invoice-issue-date"
                      type="date"
                      required
                      className={INPUT_CLASS}
                      value={form.issueDate}
                      onChange={(e) => setField('issueDate', e.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="invoice-due-date" className={LABEL_CLASS}>
                      Due date
                    </label>
                    <input
                      id="invoice-due-date"
                      type="date"
                      required
                      className={INPUT_CLASS}
                      value={form.dueDate}
                      onChange={(e) => setField('dueDate', e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <p className="text-sm">
                    {detected === null
                      ? 'Select a customer to detect the supply type.'
                      : detected === 'intra'
                        ? 'CGST + SGST (within state)'
                        : 'IGST (inter-state)'}
                  </p>
                  {!profile.state_code ? (
                    <p className="text-sm text-muted-foreground">
                      Your business state code is not set. Add it in Settings so the supply type can be detected.
                    </p>
                  ) : null}
                  {selectedCustomer && isSupplyTypeAmbiguous(profile.state_code, selectedCustomer.state_code) ? (
                    <p role="status" className="text-sm text-muted-foreground">
                      A state code is missing on the business profile or the customer, so the supply type defaults to
                      IGST. Check it before saving.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-end gap-3">
                    <div aria-hidden="true" className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs">
                      <span
                        className={`rounded px-2.5 py-1 ${form.supplyType === 'intra' ? 'border bg-card font-medium' : 'text-muted-foreground'}`}
                      >
                        CGST + SGST
                      </span>
                      <span
                        className={`rounded px-2.5 py-1 ${form.supplyType === 'inter' ? 'border bg-card font-medium' : 'text-muted-foreground'}`}
                      >
                        IGST
                      </span>
                    </div>
                    <div className="w-full max-w-sm">
                      <label htmlFor="invoice-supply-type" className={LABEL_CLASS}>
                        Supply type
                      </label>
                      <select
                        id="invoice-supply-type"
                        className={INPUT_CLASS}
                        value={form.supplyType}
                        onChange={(e) => setField('supplyType', e.target.value === 'inter' ? 'inter' : 'intra')}
                      >
                        <option value="intra">Intra-state (CGST + SGST)</option>
                        <option value="inter">Inter-state (IGST)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Line items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  aria-hidden="true"
                  className="hidden text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-12 md:gap-3"
                >
                  <span className="md:col-span-3">Description</span>
                  <span className="md:col-span-2">HSN/SAC</span>
                  <span className="text-right md:col-span-1">Qty</span>
                  <span className="text-right md:col-span-1">Rate</span>
                  <span className="text-right md:col-span-1">Disc %</span>
                  <span className="md:col-span-2">GST</span>
                  <span className="md:col-span-1">GST rate</span>
                  <span className="md:col-span-1" />
                </div>
                {form.lines.map((row, index) => {
                  const n = index + 1;
                  const p = `invoice-line-${row.key}`;
                  return (
                    <div
                      key={row.key}
                      className="space-y-3 rounded-lg border bg-card p-3 md:grid md:grid-cols-12 md:items-end md:gap-3 md:space-y-0 md:border-0 md:bg-transparent md:p-0"
                    >
                      <div className="md:col-span-3">
                        <label htmlFor={`${p}-description`} className={`${LABEL_CLASS} md:sr-only`}>
                          Description
                        </label>
                        <input
                          id={`${p}-description`}
                          type="text"
                          required
                          className={INPUT_CLASS}
                          value={row.description}
                          onChange={(e) => updateLine(row.key, { description: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor={`${p}-hsn`} className={`${LABEL_CLASS} md:sr-only`}>
                          HSN/SAC
                        </label>
                        <input
                          id={`${p}-hsn`}
                          type="text"
                          className={INPUT_CLASS}
                          value={row.hsn}
                          onChange={(e) => updateLine(row.key, { hsn: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label htmlFor={`${p}-quantity`} className={`${LABEL_CLASS} md:sr-only`}>
                          Quantity
                        </label>
                        <input
                          id={`${p}-quantity`}
                          type="text"
                          inputMode="decimal"
                          className={numericInputClass}
                          value={row.quantity}
                          onChange={(e) => updateLine(row.key, { quantity: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label htmlFor={`${p}-rate`} className={`${LABEL_CLASS} md:sr-only`}>
                          Rate
                        </label>
                        <input
                          id={`${p}-rate`}
                          type="text"
                          inputMode="decimal"
                          className={numericInputClass}
                          value={row.rate}
                          onChange={(e) => updateLine(row.key, { rate: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-1">
                        <label htmlFor={`${p}-discount`} className={`${LABEL_CLASS} md:sr-only`}>
                          Discount %
                        </label>
                        <input
                          id={`${p}-discount`}
                          type="text"
                          inputMode="decimal"
                          className={numericInputClass}
                          value={row.discount}
                          onChange={(e) => updateLine(row.key, { discount: e.target.value })}
                        />
                      </div>
                      <div className="flex h-9 items-center gap-2 md:col-span-2">
                        <input
                          id={`${p}-gst-applicable`}
                          type="checkbox"
                          className="h-4 w-4"
                          checked={row.gstApplicable}
                          onChange={(e) => updateLine(row.key, { gstApplicable: e.target.checked })}
                        />
                        <label htmlFor={`${p}-gst-applicable`} className="text-sm">
                          GST applicable
                        </label>
                      </div>
                      <div className="md:col-span-1">
                        <label htmlFor={`${p}-gst-rate`} className={`${LABEL_CLASS} md:sr-only`}>
                          GST rate
                        </label>
                        <select
                          id={`${p}-gst-rate`}
                          className={INPUT_CLASS}
                          disabled={!row.gstApplicable}
                          value={row.gstRate}
                          onChange={(e) => updateLine(row.key, { gstRate: e.target.value })}
                        >
                          {GST_RATE_OPTIONS.map((rate) => (
                            <option key={rate} value={String(rate)}>
                              {rate}%
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex md:col-span-1 md:justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={form.lines.length <= 1}
                          aria-label={`Remove line ${n}`}
                          onClick={() => removeLine(row.key)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button type="button" variant="outline" onClick={addLine}>
                  Add line item
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0 lg:sticky lg:top-6">
            <Card>
              <CardHeader>
                <CardTitle>Totals and notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Subtotal (after discount)</dt>
                  <dd className="text-right tabular-nums">{money(totals.subtotal)}</dd>
                  <dt className="text-muted-foreground">Discount</dt>
                  <dd className="text-right tabular-nums">{money(totals.discount_total)}</dd>
                  {form.supplyType === 'intra' ? (
                    <>
                      <dt className="text-muted-foreground">CGST</dt>
                      <dd className="text-right tabular-nums">{money(totals.cgst_amount)}</dd>
                      <dt className="text-muted-foreground">SGST</dt>
                      <dd className="text-right tabular-nums">{money(totals.sgst_amount)}</dd>
                    </>
                  ) : (
                    <>
                      <dt className="text-muted-foreground">IGST</dt>
                      <dd className="text-right tabular-nums">{money(totals.igst_amount)}</dd>
                    </>
                  )}
                  <div className="col-span-2 mt-1 grid grid-cols-2 gap-x-4 border-t pt-3 text-base">
                    <dt className="font-semibold">Total</dt>
                    <dd className="text-right font-semibold tabular-nums">{money(totals.total_amount)}</dd>
                  </div>
                </dl>

                <div>
                  <label htmlFor="invoice-notes" className={LABEL_CLASS}>
                    Notes
                  </label>
                  <textarea
                    id="invoice-notes"
                    rows={4}
                    className={TEXTAREA_CLASS}
                    value={form.notes}
                    onChange={(e) => setField('notes', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {saveError ? (
          <p role="alert" className="text-sm text-destructive">
            {saveError}
          </p>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-end gap-2 border-t bg-card p-3 lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:p-0">
          <Button type="button" variant="outline" onClick={() => navigate(cancelTo)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save invoice'}
          </Button>
        </div>
      </form>
    </>
  );
}

