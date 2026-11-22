import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { ExpenseForm, PAYMENT_METHOD_OPTIONS } from '@/features/expenses/ExpenseForm';
import { deleteExpense, listExpenses, markExpensePaid } from '@/services/expenses';
import { getProfile } from '@/services/profile';
import type { Expense, ExpensePaymentMethod } from '@/types/domain';
import { addDays, daysBetween, formatDate, isISODate, todayISO } from '@/lib/dates';
import { formatMoney, round2 } from '@/lib/money';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'unpaid_bills' | 'overdue' | 'paid' | 'unpaid' | 'expenses' | 'bills';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'unpaid_bills', label: 'Unpaid bills' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'expenses', label: 'Expenses only' },
  { value: 'bills', label: 'Bills only' },
];

type ExpenseStatus = 'Paid' | 'Unpaid' | 'Overdue' | 'Due soon';

const QUICK_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unpaid_bills', label: 'Unpaid bills' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'bills', label: 'Bills' },
];

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const COLUMN_COUNT = 9;

function isUnpaidBill(e: Expense): boolean {
  return e.is_bill && e.paid_on === null;
}

function isOverdue(e: Expense, today: string): boolean {
  return isUnpaidBill(e) && e.due_date !== null && e.due_date < today;
}

function isDueSoon(e: Expense, today: string): boolean {
  return (
    isUnpaidBill(e) &&
    e.due_date !== null &&
    e.due_date >= today &&
    daysBetween(today, e.due_date) <= 7
  );
}

function statusOf(e: Expense, today: string): ExpenseStatus {
  if (e.paid_on !== null) return 'Paid';
  if (!e.is_bill) return 'Unpaid';
  if (isOverdue(e, today)) return 'Overdue';
  if (isDueSoon(e, today)) return 'Due soon';
  return 'Unpaid';
}

function sumAmounts(rows: Expense[]): number {
  return round2(rows.reduce((total, e) => total + e.amount, 0));
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function toStatusFilter(value: string): StatusFilter {
  return STATUS_OPTIONS.find((o) => o.value === value)?.value ?? 'all';
}

function toPaymentMethod(value: string): ExpensePaymentMethod | '' {
  const found = PAYMENT_METHOD_OPTIONS.find((o) => o.value === value);
  return found ? found.value : '';
}

function StatusBadge({ status }: { status: ExpenseStatus }) {
  const variant =
    status === 'Paid' ? 'success' : status === 'Overdue' ? 'destructive' : status === 'Due soon' ? 'warning' : 'outline';
  return <Badge variant={variant}>{status}</Badge>;
}

function rowAccent(status: ExpenseStatus): string {
  if (status === 'Overdue') return 'border-l-4 border-l-red-500';
  if (status === 'Due soon') return 'border-l-4 border-l-amber-500';
  return '';
}

interface SummaryCardProps {
  label: string;
  value: string;
  detail: string;
  alert?: boolean;
}

function SummaryCard({ label, value, detail, alert = false }: SummaryCardProps) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', alert && 'text-destructive')}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </Card>
  );
}

interface ExpenseActionsProps {
  expense: Expense;
  busy: boolean;
  onMarkPaid: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ExpenseActions({ expense, busy, onMarkPaid, onEdit, onDelete }: ExpenseActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {isUnpaidBill(expense) ? (
        <Button variant="ghost" size="sm" disabled={busy} onClick={onMarkPaid}>
          Mark paid
        </Button>
      ) : null}
      <Button
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={onEdit}
        aria-label={`Edit ${expense.supplier}`}
      >
        Edit
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive"
        disabled={busy}
        onClick={onDelete}
        aria-label={`Delete ${expense.supplier}`}
      >
        Delete
      </Button>
    </div>
  );
}

interface PayFormProps {
  idPrefix: string;
  busy: boolean;
  paidOn: string;
  method: ExpensePaymentMethod | '';
  onPaidOnChange: (value: string) => void;
  onMethodChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

function PayForm({
  idPrefix,
  busy,
  paidOn,
  method,
  onPaidOnChange,
  onMethodChange,
  onConfirm,
  onCancel,
}: PayFormProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm();
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-3 rounded-md bg-muted/50 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
    >
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-paid-on`} className="text-sm font-medium">
          Paid on
        </label>
        <input
          id={`${idPrefix}-paid-on`}
          type="date"
          className={INPUT_CLASS}
          value={paidOn}
          onChange={(e) => onPaidOnChange(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-method`} className="text-sm font-medium">
          Payment method
        </label>
        <select
          id={`${idPrefix}-method`}
          className={INPUT_CLASS}
          value={method}
          onChange={(e) => onMethodChange(e.target.value)}
        >
          <option value="">Not recorded</option>
          {PAYMENT_METHOD_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Marking…' : 'Confirm paid'}
        </Button>
      </div>
    </form>
  );
}

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [payingId, setPayingId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(todayISO());
  const [payMethod, setPayMethod] = useState<ExpensePaymentMethod | ''>('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([listExpenses(), getProfile()])
      .then(([rows, profile]) => {
        if (cancelled) return;
        setExpenses(rows);
        setCurrency(profile.currency);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err, 'Could not load expenses.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  function reload() {
    setReloadKey((k) => k + 1);
  }

  const summary = useMemo(() => {
    const today = todayISO();
    const month = today.slice(0, 7);
    const unpaidBills = expenses.filter(isUnpaidBill);
    return {
      unpaidBills,
      overdue: unpaidBills.filter((e) => isOverdue(e, today)),
      dueSoon: unpaidBills.filter((e) => isDueSoon(e, today)),
      thisMonth: expenses.filter((e) => e.expense_date.startsWith(month)),
    };
  }, [expenses]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(expenses.map((e) => e.category).filter((c): c is string => c !== null && c !== '')),
      ).sort(),
    [expenses],
  );

  const filtered = useMemo(() => {
    const today = todayISO();
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (
        q &&
        ![e.supplier, e.description, e.category, e.notes, e.vendor_gstin].some((v) =>
          v?.toLowerCase().includes(q),
        )
      ) {
        return false;
      }
      if (statusFilter === 'unpaid_bills' && !isUnpaidBill(e)) return false;
      if (statusFilter === 'overdue' && !isOverdue(e, today)) return false;
      if (statusFilter === 'paid' && e.paid_on === null) return false;
      if (statusFilter === 'unpaid' && e.paid_on !== null) return false;
      if (statusFilter === 'expenses' && e.is_bill) return false;
      if (statusFilter === 'bills' && !e.is_bill) return false;
      if (categoryFilter && e.category !== categoryFilter) return false;
      if (fromDate && e.expense_date < fromDate) return false;
      if (toDate && e.expense_date > toDate) return false;
      return true;
    });
  }, [expenses, search, statusFilter, categoryFilter, fromDate, toDate]);

  const hasFilters =
    search !== '' || statusFilter !== 'all' || categoryFilter !== '' || fromDate !== '' || toDate !== '';

  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('');
    setFromDate('');
    setToDate('');
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
    setNotice(null);
    setActionError(null);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setFormOpen(true);
    setNotice(null);
    setActionError(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function handleSaved() {
    closeForm();
    setActionError(null);
    setNotice('Saved.');
    reload();
  }

  function openMarkPaid(expense: Expense) {
    setPayingId(expense.id);
    setPayDate(todayISO());
    setPayMethod('');
    setNotice(null);
    setActionError(null);
  }

  async function confirmMarkPaid(expense: Expense) {
    if (!isISODate(payDate)) {
      setActionError('Enter a valid paid date.');
      return;
    }
    setBusyId(expense.id);
    setNotice(null);
    setActionError(null);
    try {
      await markExpensePaid(expense.id, payDate, payMethod === '' ? null : payMethod);
      setPayingId(null);
      setNotice('Marked as paid.');
      reload();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not mark this bill as paid.'));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete(expense: Expense) {
    const amountText = formatMoney(expense.amount, currency);
    if (!window.confirm(`Delete ${expense.supplier} for ${amountText}? This cannot be undone.`)) {
      return;
    }
    setBusyId(expense.id);
    setNotice(null);
    setActionError(null);
    try {
      await deleteExpense(expense.id);
      if (editing?.id === expense.id) closeForm();
      if (payingId === expense.id) setPayingId(null);
      setNotice('Deleted.');
      reload();
    } catch (err) {
      setActionError(errorMessage(err, 'Could not delete this entry.'));
    } finally {
      setBusyId(null);
    }
  }

  const today = todayISO();
  const fmt = (n: number) => formatMoney(n, currency);

  function renderPayForm(expense: Expense, idPrefix: string) {
    return (
      <PayForm
        idPrefix={idPrefix}
        busy={busyId === expense.id}
        paidOn={payDate}
        method={payMethod}
        onPaidOnChange={setPayDate}
        onMethodChange={(value) => setPayMethod(toPaymentMethod(value))}
        onConfirm={() => void confirmMarkPaid(expense)}
        onCancel={() => setPayingId(null)}
      />
    );
  }

  function renderContent() {
    if (loading) {
      return <p role="status">Loading expenses…</p>;
    }
    if (loadError) {
      return (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
          <Button variant="outline" onClick={reload}>
            Retry
          </Button>
        </div>
      );
    }
    if (expenses.length === 0) {
      return (
        <EmptyState
          icon={Receipt}
          title="No expenses or bills yet"
          description="Record an expense or add a bill with a due date to track upcoming payments."
        >
          <Button onClick={openNew}>Add expense or bill</Button>
        </EmptyState>
      );
    }

    return (
      <>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Unpaid bills"
            value={fmt(sumAmounts(summary.unpaidBills))}
            detail={`${plural(summary.unpaidBills.length, 'bill')} awaiting payment`}
          />
          <SummaryCard
            label="Overdue bills"
            value={fmt(sumAmounts(summary.overdue))}
            detail={`${plural(summary.overdue.length, 'bill')} past due`}
            alert={summary.overdue.length > 0}
          />
          <SummaryCard
            label="Due in next 7 days"
            value={fmt(sumAmounts(summary.dueSoon))}
            detail={`${plural(summary.dueSoon.length, 'bill')} due by ${formatDate(
              addDays(todayISO(), 7),
            )}`}
          />
          <SummaryCard
            label="Spent this month"
            value={fmt(sumAmounts(summary.thisMonth))}
            detail={`${plural(summary.thisMonth.length, 'entry')} this month`}
          />
        </div>

        <div
          role="group"
          aria-label="Quick filters"
          className="mb-4 inline-flex max-w-full flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
        >
          {QUICK_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <input
            type="search"
            aria-label="Search expenses"
            placeholder="Search supplier, description, category…"
            className={cn(INPUT_CLASS, 'sm:w-64')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filter by status"
            className={cn(INPUT_CLASS, 'sm:w-44')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(toStatusFilter(e.target.value))}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by category"
            className={cn(INPUT_CLASS, 'sm:w-44')}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="From date"
            className={cn(INPUT_CLASS, 'sm:w-40')}
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <input
            type="date"
            aria-label="To date"
            className={cn(INPUT_CLASS, 'sm:w-40')}
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>

        {hasFilters ? (
          <p className="mb-3 text-sm text-muted-foreground">
            Showing {filtered.length} of {expenses.length}
          </p>
        ) : null}

        {filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No expenses match these filters.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">GST</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <Fragment key={e.id}>
                      <tr className="border-t">
                        <td className={cn('px-4 py-3', rowAccent(statusOf(e, today)))}>
                          <div className="font-medium">{e.supplier}</div>
                          {e.description ? (
                            <div className="text-xs text-muted-foreground">{e.description}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{e.category ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{e.is_bill ? 'Bill' : 'Expense'}</Badge>
                        </td>
                        <td className="px-4 py-3">{formatDate(e.expense_date)}</td>
                        <td className="px-4 py-3">{e.due_date ? formatDate(e.due_date) : '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{fmt(e.amount)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {e.gst_amount > 0 ? fmt(e.gst_amount) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={statusOf(e, today)} />
                        </td>
                        <td className="px-4 py-3">
                          <ExpenseActions
                            expense={e}
                            busy={busyId === e.id}
                            onMarkPaid={() => openMarkPaid(e)}
                            onEdit={() => openEdit(e)}
                            onDelete={() => void confirmDelete(e)}
                          />
                        </td>
                      </tr>
                      {payingId === e.id ? (
                        <tr className="border-t">
                          <td colSpan={COLUMN_COUNT} className="p-3">
                            {renderPayForm(e, `expense-pay-${e.id}-table`)}
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {filtered.map((e) => (
                <div key={e.id} className={cn('rounded-xl border bg-card p-4', rowAccent(statusOf(e, today)))}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{e.supplier}</div>
                      {e.description ? (
                        <div className="text-xs text-muted-foreground">{e.description}</div>
                      ) : null}
                    </div>
                    <StatusBadge status={statusOf(e, today)} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Type</dt>
                    <dd>
                      <Badge variant="outline">{e.is_bill ? 'Bill' : 'Expense'}</Badge>
                    </dd>
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>{e.category ?? '—'}</dd>
                    <dt className="text-muted-foreground">Date</dt>
                    <dd>{formatDate(e.expense_date)}</dd>
                    <dt className="text-muted-foreground">Due</dt>
                    <dd>{e.due_date ? formatDate(e.due_date) : '—'}</dd>
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="tabular-nums">{fmt(e.amount)}</dd>
                    <dt className="text-muted-foreground">GST</dt>
                    <dd className="tabular-nums">{e.gst_amount > 0 ? fmt(e.gst_amount) : '—'}</dd>
                  </dl>
                  <div className="mt-3 border-t pt-3">
                    <ExpenseActions
                      expense={e}
                      busy={busyId === e.id}
                      onMarkPaid={() => openMarkPaid(e)}
                      onEdit={() => openEdit(e)}
                      onDelete={() => void confirmDelete(e)}
                    />
                  </div>
                  {payingId === e.id ? (
                    <div className="mt-3">{renderPayForm(e, `expense-pay-${e.id}-card`)}</div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Expenses & bills"
        description="Record what you spend and track bills until they are paid."
        actions={<Button onClick={openNew}>Add expense or bill</Button>}
      />

      {notice ? (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {formOpen ? (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{editing ? 'Edit expense or bill' : 'New expense or bill'}</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseForm
              key={editing?.id ?? 'new'}
              initial={editing}
              onSaved={handleSaved}
              onCancel={closeForm}
            />
          </CardContent>
        </Card>
      ) : null}

      {renderContent()}
    </>
  );
}
