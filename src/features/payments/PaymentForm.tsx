import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { isISODate, todayISO } from '@/lib/dates';
import { formatMoney, parseAmount, round2 } from '@/lib/money';
import { createPayment, updatePayment, type PaymentInput } from '@/services/payments';
import type { Payment, PaymentMethod } from '@/types/domain';

export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

/** Display label for a stored payment method; '—' when none is recorded. */
export function paymentMethodLabel(method: PaymentMethod | null): string {
  if (method === null) return '—';
  return PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? method;
}

export interface PaymentInvoiceOption {
  id: string;
  label: string;
  balance_due: number;
}

export interface PaymentFormProps {
  invoiceId: string | null;
  invoiceOptions?: PaymentInvoiceOption[];
  balanceDue?: number;
  currency: string;
  existing?: Payment | null;
  onSaved: () => void;
  onCancel?: () => void;
}

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const LABEL_CLASS = 'text-sm font-medium';

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHOD_OPTIONS.some((option) => option.value === value);
}

export function PaymentForm({
  invoiceId,
  invoiceOptions,
  balanceDue,
  currency,
  existing = null,
  onSaved,
  onCancel,
}: PaymentFormProps) {
  const uid = useId();
  const showInvoiceSelect = invoiceId === null && invoiceOptions !== undefined;

  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [paidOn, setPaidOn] = useState(existing ? existing.paid_on : todayISO());
  const [method, setMethod] = useState<PaymentMethod>(existing?.method ?? 'bank_transfer');
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The limit comes from the fixed balance when given, otherwise from the chosen invoice option.
  const selectedOption = invoiceOptions?.find((option) => option.id === selectedInvoiceId);
  const limit = balanceDue ?? (showInvoiceSelect ? selectedOption?.balance_due : undefined);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    const linkedInvoiceId = invoiceId ?? (showInvoiceSelect && selectedInvoiceId !== '' ? selectedInvoiceId : null);
    if (showInvoiceSelect && linkedInvoiceId === null) {
      setError('Select an invoice.');
      return;
    }

    const parsed = parseAmount(amount);
    if (parsed === null) {
      setError('Enter a valid amount.');
      return;
    }
    if (parsed <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (limit !== undefined && parsed > limit + 0.005) {
      setError(`Amount is more than the balance due of ${formatMoney(limit, currency)}.`);
      return;
    }
    if (!isISODate(paidOn)) {
      setError('Enter a valid date received.');
      return;
    }

    const input: PaymentInput = {
      invoice_id: linkedInvoiceId,
      amount: round2(parsed),
      paid_on: paidOn,
      method,
      reference: reference.trim() === '' ? null : reference.trim(),
      notes: notes.trim() === '' ? null : notes.trim(),
    };

    setSaving(true);
    try {
      if (existing) {
        await updatePayment(existing.id, input);
      } else {
        await createPayment(input);
      }
      onSaved();
    } catch (err: unknown) {
      setError(messageOf(err, 'Could not save the payment.'));
    } finally {
      setSaving(false);
    }
  }

  const invoiceSelectId = `${uid}-invoice`;
  const amountId = `${uid}-amount`;
  const dateId = `${uid}-date`;
  const methodId = `${uid}-method`;
  const referenceId = `${uid}-reference`;
  const notesId = `${uid}-notes`;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {showInvoiceSelect ? (
        <div className="space-y-1.5">
          <label htmlFor={invoiceSelectId} className={LABEL_CLASS}>
            Invoice *
          </label>
          <select
            id={invoiceSelectId}
            className={INPUT_CLASS}
            value={selectedInvoiceId}
            onChange={(event) => setSelectedInvoiceId(event.target.value)}
            required
          >
            <option value="">Select invoice</option>
            {(invoiceOptions ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={amountId} className={LABEL_CLASS}>
            Amount *
          </label>
          <input
            id={amountId}
            type="text"
            inputMode="decimal"
            className={INPUT_CLASS}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={dateId} className={LABEL_CLASS}>
            Date received *
          </label>
          <input
            id={dateId}
            type="date"
            className={INPUT_CLASS}
            value={paidOn}
            onChange={(event) => setPaidOn(event.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor={methodId} className={LABEL_CLASS}>
            Method
          </label>
          <select
            id={methodId}
            className={INPUT_CLASS}
            value={method}
            onChange={(event) => {
              const next = event.target.value;
              if (isPaymentMethod(next)) setMethod(next);
            }}
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={referenceId} className={LABEL_CLASS}>
            Reference
          </label>
          <input
            id={referenceId}
            type="text"
            className={INPUT_CLASS}
            value={reference}
            onChange={(event) => setReference(event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor={notesId} className={LABEL_CLASS}>
          Notes
        </label>
        <textarea
          id={notesId}
          rows={2}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : existing ? 'Save changes' : 'Record payment'}
        </Button>
      </div>
    </form>
  );
}
