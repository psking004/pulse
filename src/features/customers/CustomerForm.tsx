import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { INDIAN_STATES } from '@/lib/indianStates';
import { createCustomer, updateCustomer } from '@/services/customers';
import type { CustomerInput } from '@/services/customers';
import type { Customer } from '@/types/domain';

interface CustomerFormProps {
  initial?: Customer | null;
  onSaved: (customer: Customer) => void;
  onCancel: () => void;
}

interface FormValues {
  name: string;
  email: string;
  phone: string;
  billingAddress: string;
  gstin: string;
  stateCode: string;
  paymentTerms: string;
  notes: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_PATTERN = /^[0-9A-Z]{15}$/;
const INTEGER_PATTERN = /^\d+$/;

const inputClass =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const textareaClass =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function valuesFrom(customer: Customer | null | undefined): FormValues {
  const terms = customer?.payment_terms_days;
  return {
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    billingAddress: customer?.billing_address ?? '',
    gstin: customer?.gstin ?? '',
    stateCode: customer?.state_code ?? '',
    paymentTerms: terms == null ? '' : String(terms),
    notes: customer?.notes ?? '',
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function validate(values: FormValues): string | null {
  if (values.name.trim() === '') return 'Name is required.';
  const email = values.email.trim();
  if (email !== '' && !EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
  const gstin = values.gstin.trim().toUpperCase();
  if (gstin !== '' && !GSTIN_PATTERN.test(gstin)) {
    return 'GSTIN must be exactly 15 letters or digits.';
  }
  const terms = values.paymentTerms.trim();
  if (terms !== '' && !INTEGER_PATTERN.test(terms)) {
    return 'Payment terms must be a whole number of days, 0 or more.';
  }
  return null;
}

function buildPayload(values: FormValues, taxNumber: string | null): CustomerInput {
  const terms = values.paymentTerms.trim();
  return {
    name: values.name.trim(),
    email: optionalText(values.email),
    phone: optionalText(values.phone),
    billing_address: optionalText(values.billingAddress),
    // No form field for tax_number; keep whatever the record already holds.
    tax_number: taxNumber,
    gstin: optionalText(values.gstin.toUpperCase()),
    state_code: values.stateCode === '' ? null : values.stateCode,
    payment_terms_days: terms === '' ? null : Number(terms),
    notes: optionalText(values.notes),
  };
}

interface FieldProps {
  id: string;
  label: ReactNode;
  className?: string;
  children: ReactNode;
}

function Field({ id, label, className, children }: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

export function CustomerForm({ initial, onSaved, onCancel }: CustomerFormProps) {
  const idPrefix = useId();
  const [values, setValues] = useState<FormValues>(() => valuesFrom(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const validation = validate(values);
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setSaving(true);
    const payload = buildPayload(values, initial?.tax_number ?? null);
    try {
      const saved = initial ? await updateCustomer(initial.id, payload) : await createCustomer(payload);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Could not save the customer. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idPrefix}-name`} label={<>Name <span aria-hidden="true" className="text-destructive">*</span></>} className="sm:col-span-2">
            <input
              id={`${idPrefix}-name`}
              type="text"
              required
              value={values.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field id={`${idPrefix}-email`} label="Email">
            <input
              id={`${idPrefix}-email`}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => update('email', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field id={`${idPrefix}-phone`} label="Phone">
            <input
              id={`${idPrefix}-phone`}
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(e) => update('phone', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field id={`${idPrefix}-address`} label="Billing address" className="sm:col-span-2">
            <textarea
              id={`${idPrefix}-address`}
              rows={3}
              value={values.billingAddress}
              onChange={(e) => update('billingAddress', e.target.value)}
              className={textareaClass}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Billing and tax</h3>
          <p className="text-xs text-muted-foreground">
            GSTIN and state decide whether invoices to this customer use CGST and SGST (same state) or IGST (different state).
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${idPrefix}-gstin`} label="GSTIN">
            <input
              id={`${idPrefix}-gstin`}
              type="text"
              maxLength={15}
              autoCapitalize="characters"
              spellCheck={false}
              value={values.gstin}
              onChange={(e) => update('gstin', e.target.value.toUpperCase())}
              className={`${inputClass} font-mono uppercase`}
            />
          </Field>

          <Field id={`${idPrefix}-state`} label="State">
            <select
              id={`${idPrefix}-state`}
              value={values.stateCode}
              onChange={(e) => update('stateCode', e.target.value)}
              className={inputClass}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {`${state.name} (${state.code})`}
                </option>
              ))}
            </select>
          </Field>

          <Field id={`${idPrefix}-terms`} label="Payment terms (days)">
            <input
              id={`${idPrefix}-terms`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={values.paymentTerms}
              onChange={(e) => update('paymentTerms', e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field id={`${idPrefix}-notes`} label="Notes" className="sm:col-span-2">
            <textarea
              id={`${idPrefix}-notes`}
              rows={3}
              value={values.notes}
              onChange={(e) => update('notes', e.target.value)}
              className={textareaClass}
            />
          </Field>
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
