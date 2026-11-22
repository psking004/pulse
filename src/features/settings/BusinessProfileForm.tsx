import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { isISODate } from '@/lib/dates';
import { INDIAN_STATES } from '@/lib/indianStates';
import { updateProfile } from '@/services/profile';
import type { Profile } from '@/types/domain';

type ProfilePatch = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;

export interface BusinessProfileFormProps {
  profile: Profile;
  onSaved: (p: Profile) => void;
}

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const TEXTAREA_CLASS =
  'min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_RE = /^[0-9A-Z]{15}$/;
const CURRENCY_RE = /^[A-Z]{3}$/;
const WHOLE_NUMBER_RE = /^\d+$/;

interface FormValues {
  businessName: string;
  businessType: string;
  contactName: string;
  address: string;
  email: string;
  phone: string;
  gstin: string;
  stateCode: string;
  abn: string;
  gstRegistered: boolean;
  gstRate: string;
  startingCashBalance: string;
  startingCashDate: string;
  currency: string;
  paymentTermsDays: string;
}

type BuildResult = { ok: true; patch: ProfilePatch } | { ok: false; message: string };

function initialValues(p: Profile): FormValues {
  return {
    businessName: p.business_name,
    businessType: p.business_type ?? '',
    contactName: p.contact_name ?? '',
    address: p.address ?? '',
    email: p.email ?? '',
    phone: p.phone ?? '',
    gstin: p.gstin ?? '',
    stateCode: p.state_code ?? '',
    abn: p.abn ?? '',
    gstRegistered: p.gst_registered,
    gstRate: String(p.gst_rate),
    startingCashBalance: String(p.starting_cash_balance),
    startingCashDate: p.starting_cash_date,
    currency: p.currency,
    paymentTermsDays: String(p.default_payment_terms_days),
  };
}

function emptyToNull(s: string): string | null {
  const trimmed = s.trim();
  return trimmed === '' ? null : trimmed;
}

function buildPatch(v: FormValues): BuildResult {
  const businessName = v.businessName.trim();
  if (businessName === '') {
    return { ok: false, message: 'Business name is required.' };
  }

  const email = v.email.trim();
  if (email !== '' && !EMAIL_RE.test(email)) {
    return { ok: false, message: 'Enter a valid email address.' };
  }

  const gstin = v.gstin.trim().toUpperCase();
  if (gstin !== '' && !GSTIN_RE.test(gstin)) {
    return { ok: false, message: 'GSTIN must be exactly 15 letters or digits.' };
  }

  const rate = Number(v.gstRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return { ok: false, message: 'Choose a valid default GST rate.' };
  }

  const currency = v.currency.trim().toUpperCase();
  if (!CURRENCY_RE.test(currency)) {
    return { ok: false, message: 'Currency must be a 3-letter code, e.g. INR.' };
  }

  const cashText = v.startingCashBalance.trim().replace(/,/g, '');
  const cash = cashText === '' ? NaN : Number(cashText);
  if (!Number.isFinite(cash)) {
    return { ok: false, message: 'Starting cash balance must be a number, e.g. 25000 or -1500.' };
  }

  if (!isISODate(v.startingCashDate)) {
    return { ok: false, message: 'Enter a valid starting cash date.' };
  }

  const terms = v.paymentTermsDays.trim();
  if (!WHOLE_NUMBER_RE.test(terms)) {
    return { ok: false, message: 'Default payment terms must be a whole number of days (0 or more).' };
  }

  return {
    ok: true,
    patch: {
      business_name: businessName,
      business_type: emptyToNull(v.businessType),
      contact_name: emptyToNull(v.contactName),
      email: emptyToNull(email),
      phone: emptyToNull(v.phone),
      address: emptyToNull(v.address),
      abn: emptyToNull(v.abn),
      gstin: emptyToNull(gstin),
      state_code: emptyToNull(v.stateCode),
      gst_registered: v.gstRegistered,
      gst_rate: rate,
      currency,
      starting_cash_balance: cash,
      starting_cash_date: v.startingCashDate,
      default_payment_terms_days: Number(terms),
    },
  };
}

function Field({
  id,
  label,
  required = false,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? <span aria-hidden="true" className="text-destructive"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

export function BusinessProfileForm({ profile, onSaved }: BusinessProfileFormProps) {
  const [values, setValues] = useState<FormValues>(() => initialValues(profile));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const result = buildPatch(values);
    if (!result.ok) {
      setError(result.message);
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfile(result.patch);
      setSaved(true);
      onSaved(updated);
    } catch {
      setError('Could not save your business profile. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const rateOptions = GST_RATE_OPTIONS.some((r) => String(r) === values.gstRate)
    ? GST_RATE_OPTIONS
    : [...GST_RATE_OPTIONS, Number(values.gstRate)];

  const showTaxWarning = values.stateCode === '' || values.gstin.trim() === '';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Business details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="bp-business-name" label="Business name" required>
            <input
              id="bp-business-name"
              type="text"
              className={INPUT_CLASS}
              value={values.businessName}
              onChange={(e) => setField('businessName', e.target.value)}
              aria-required="true"
            />
          </Field>
          <Field id="bp-business-type" label="Business type (optional)">
            <input
              id="bp-business-type"
              type="text"
              className={INPUT_CLASS}
              value={values.businessType}
              onChange={(e) => setField('businessType', e.target.value)}
            />
          </Field>
          <Field id="bp-contact-name" label="Contact name">
            <input
              id="bp-contact-name"
              type="text"
              className={INPUT_CLASS}
              value={values.contactName}
              onChange={(e) => setField('contactName', e.target.value)}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field id="bp-address" label="Address">
              <textarea
                id="bp-address"
                rows={3}
                className={TEXTAREA_CLASS}
                value={values.address}
                onChange={(e) => setField('address', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="bp-email" label="Email">
            <input
              id="bp-email"
              type="email"
              className={INPUT_CLASS}
              value={values.email}
              onChange={(e) => setField('email', e.target.value)}
            />
          </Field>
          <Field id="bp-phone" label="Phone">
            <input
              id="bp-phone"
              type="tel"
              className={INPUT_CLASS}
              value={values.phone}
              onChange={(e) => setField('phone', e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Tax</h3>
        {showTaxWarning ? (
          <p role="status" className="text-sm text-muted-foreground">
            Add your GSTIN and state so invoices use the correct CGST/SGST or IGST split.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="bp-gstin" label="GSTIN">
            <input
              id="bp-gstin"
              type="text"
              maxLength={15}
              className={INPUT_CLASS}
              value={values.gstin}
              onChange={(e) => setField('gstin', e.target.value.toUpperCase())}
            />
          </Field>
          <Field id="bp-state" label="State">
            <select
              id="bp-state"
              className={INPUT_CLASS}
              value={values.stateCode}
              onChange={(e) => setField('stateCode', e.target.value)}
            >
              <option value="">Select state</option>
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {`${s.name} (${s.code})`}
                </option>
              ))}
            </select>
          </Field>
          <Field id="bp-abn" label="Other tax number (optional)">
            <input
              id="bp-abn"
              type="text"
              className={INPUT_CLASS}
              value={values.abn}
              onChange={(e) => setField('abn', e.target.value)}
            />
          </Field>
          <Field id="bp-gst-rate" label="Default GST rate">
            <select
              id="bp-gst-rate"
              className={INPUT_CLASS}
              value={values.gstRate}
              onChange={(e) => setField('gstRate', e.target.value)}
            >
              {rateOptions.map((r) => (
                <option key={r} value={String(r)}>
                  {`${r}%`}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="bp-gst-registered"
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary"
              checked={values.gstRegistered}
              onChange={(e) => setField('gstRegistered', e.target.checked)}
            />
            <label htmlFor="bp-gst-registered" className="text-sm font-medium">
              GST registered
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Cash and invoicing</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Field id="bp-cash-balance" label="Starting cash balance" required>
              <input
                id="bp-cash-balance"
                type="text"
                inputMode="decimal"
                className={INPUT_CLASS}
                value={values.startingCashBalance}
                onChange={(e) => setField('startingCashBalance', e.target.value)}
                aria-describedby="bp-cash-help"
                aria-required="true"
              />
            </Field>
            <p id="bp-cash-help" className="text-xs text-muted-foreground">
              Your cash balance on the starting date. Used for the current cash and forecast.
            </p>
          </div>
          <Field id="bp-cash-date" label="Starting cash date" required>
            <input
              id="bp-cash-date"
              type="date"
              className={INPUT_CLASS}
              value={values.startingCashDate}
              onChange={(e) => setField('startingCashDate', e.target.value)}
              aria-required="true"
            />
          </Field>
          <Field id="bp-currency" label="Currency">
            <input
              id="bp-currency"
              type="text"
              maxLength={3}
              className={INPUT_CLASS}
              value={values.currency}
              onChange={(e) => setField('currency', e.target.value.toUpperCase())}
            />
          </Field>
          <Field id="bp-payment-terms" label="Default payment terms (days)">
            <input
              id="bp-payment-terms"
              type="number"
              min={0}
              step={1}
              className={INPUT_CLASS}
              value={values.paymentTermsDays}
              onChange={(e) => setField('paymentTermsDays', e.target.value)}
            />
          </Field>
        </div>
      </section>

      {saved ? (
        <p role="status" className="text-sm text-muted-foreground">
          Business profile saved.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save business profile'}
        </Button>
      </div>
    </form>
  );
}
