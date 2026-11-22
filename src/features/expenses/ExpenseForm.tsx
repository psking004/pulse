import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { createExpense, updateExpense } from '@/services/expenses';
import type { ExpenseInput } from '@/services/expenses';
import type { Expense, ExpensePaymentMethod } from '@/types/domain';
import { isISODate, todayISO } from '@/lib/dates';
import { parseAmount, round2 } from '@/lib/money';

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const CATEGORY_LIST_ID = 'expense-form-category-options';
const CATEGORY_SUGGESTIONS = [
  'Rent',
  'Utilities',
  'Salaries',
  'Software',
  'Travel',
  'Marketing',
  'Supplies',
  'Professional fees',
  'Bank charges',
  'Taxes',
  'Other',
];

export const PAYMENT_METHOD_OPTIONS: { value: ExpensePaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
];

const GSTIN_RE = /^[0-9A-Z]{15}$/;

type EntryKind = 'expense' | 'bill';

interface ExpenseFormProps {
  initial?: Expense | null;
  onSaved: () => void;
  onCancel: () => void;
}

type BuildResult = { input: ExpenseInput } | { error: string };

export function ExpenseForm({ initial, onSaved, onCancel }: ExpenseFormProps) {
  const isEdit = Boolean(initial);

  const [supplier, setSupplier] = useState(initial?.supplier ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [gst, setGst] = useState(initial && initial.gst_amount > 0 ? String(initial.gst_amount) : '');
  const [expenseDate, setExpenseDate] = useState(initial?.expense_date ?? todayISO());
  const [kind, setKind] = useState<EntryKind>(initial?.is_bill ? 'bill' : 'expense');
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '');
  const [paid, setPaid] = useState(initial ? initial.paid_on !== null : true);
  const [paidOn, setPaidOn] = useState(initial?.paid_on ?? initial?.expense_date ?? todayISO());
  const [method, setMethod] = useState<ExpensePaymentMethod | ''>(initial?.payment_method ?? '');
  const [gstin, setGstin] = useState(initial?.vendor_gstin ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleKindChange(next: EntryKind) {
    setKind(next);
    // New entries default to paid for expenses and unpaid for bills.
    if (!isEdit) setPaid(next === 'expense');
  }

  function buildInput(): BuildResult {
    const supplierName = supplier.trim();
    if (supplierName === '') return { error: 'Enter the supplier name.' };

    const amountValue = parseAmount(amount);
    if (amountValue === null || amountValue <= 0) {
      return { error: 'Enter an amount greater than zero.' };
    }

    const gstText = gst.trim();
    const gstValue = gstText === '' ? 0 : parseAmount(gstText);
    if (gstValue === null) return { error: 'Enter a valid GST amount.' };
    if (gstValue > amountValue) return { error: 'GST cannot be more than the amount.' };

    if (!isISODate(expenseDate)) return { error: 'Enter a valid transaction date.' };

    const isBill = kind === 'bill';
    if (isBill && !isISODate(dueDate)) return { error: 'Enter a due date for this bill.' };

    if (paid && !isISODate(paidOn)) return { error: 'Enter a valid paid date.' };

    const gstinValue = gstin.trim().toUpperCase();
    if (gstinValue !== '' && !GSTIN_RE.test(gstinValue)) {
      return { error: 'Vendor GSTIN must be 15 characters using A-Z and 0-9.' };
    }

    return {
      input: {
        supplier: supplierName,
        description: description.trim() || null,
        category: category.trim() || null,
        expense_date: expenseDate,
        amount: round2(amountValue),
        gst_amount: round2(gstValue),
        due_date: isBill ? dueDate : null,
        paid_on: paid ? paidOn : null,
        is_bill: isBill,
        payment_method: method === '' ? null : method,
        vendor_gstin: gstinValue || null,
        notes: notes.trim() || null,
      },
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = buildInput();
    if ('error' in result) {
      setError(result.error);
      return;
    }

    setSaving(true);
    try {
      if (initial) {
        await updateExpense(initial.id, result.input);
      } else {
        await createExpense(result.input);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this entry. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const isBill = kind === 'bill';

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="expense-form-supplier" className="text-sm font-medium">
          Supplier *
        </label>
        <input
          id="expense-form-supplier"
          type="text"
          required
          className={INPUT_CLASS}
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-form-description" className="text-sm font-medium">
          Description
        </label>
        <input
          id="expense-form-description"
          type="text"
          className={INPUT_CLASS}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-form-category" className="text-sm font-medium">
          Category
        </label>
        <input
          id="expense-form-category"
          type="text"
          list={CATEGORY_LIST_ID}
          className={INPUT_CLASS}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        />
        <datalist id={CATEGORY_LIST_ID}>
          {CATEGORY_SUGGESTIONS.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-form-type" className="text-sm font-medium">
          Type
        </label>
        <select
          id="expense-form-type"
          className={INPUT_CLASS}
          value={kind}
          onChange={(e) => handleKindChange(e.target.value === 'bill' ? 'bill' : 'expense')}
        >
          <option value="expense">Expense</option>
          <option value="bill">Bill</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-form-amount" className="text-sm font-medium">
          Amount *
        </label>
        <input
          id="expense-form-amount"
          type="text"
          inputMode="decimal"
          className={INPUT_CLASS}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-form-gst" className="text-sm font-medium">
          GST included
        </label>
        <input
          id="expense-form-gst"
          type="text"
          inputMode="decimal"
          className={INPUT_CLASS}
          value={gst}
          onChange={(e) => setGst(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-form-date" className="text-sm font-medium">
          Transaction date *
        </label>
        <input
          id="expense-form-date"
          type="date"
          required
          className={INPUT_CLASS}
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
        />
      </div>

      {isBill ? (
        <div className="space-y-1.5">
          <label htmlFor="expense-form-due" className="text-sm font-medium">
            Due date *
          </label>
          <input
            id="expense-form-due"
            type="date"
            required
            className={INPUT_CLASS}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <div className="flex h-5 items-center gap-2">
          <input
            id="expense-form-paid"
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={paid}
            onChange={(e) => setPaid(e.target.checked)}
          />
          <label htmlFor="expense-form-paid" className="text-sm font-medium">
            Paid
          </label>
        </div>
        {paid ? (
          <input
            id="expense-form-paid-on"
            type="date"
            aria-label="Paid on"
            className={INPUT_CLASS}
            value={paidOn}
            onChange={(e) => setPaidOn(e.target.value)}
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-form-method" className="text-sm font-medium">
          Payment method
        </label>
        <select
          id="expense-form-method"
          className={INPUT_CLASS}
          value={method}
          onChange={(e) => {
            const found = PAYMENT_METHOD_OPTIONS.find((o) => o.value === e.target.value);
            setMethod(found ? found.value : '');
          }}
        >
          <option value="">Not recorded</option>
          {PAYMENT_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="expense-form-gstin" className="text-sm font-medium">
          Vendor GSTIN
        </label>
        <input
          id="expense-form-gstin"
          type="text"
          className={INPUT_CLASS}
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor="expense-form-notes" className="text-sm font-medium">
          Notes
        </label>
        <textarea
          id="expense-form-notes"
          rows={3}
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save expense'}
        </Button>
      </div>
    </form>
  );
}
