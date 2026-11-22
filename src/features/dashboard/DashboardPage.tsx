import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildForecastInput } from '@/features/forecast/forecastInput';
import { addDays, formatDate, todayISO } from '@/lib/dates';
import { buildForecast } from '@/lib/forecast';
import type { ForecastResult } from '@/lib/forecast';
import { daysOverdue } from '@/lib/invoiceStatus';
import { formatMoney, round2 } from '@/lib/money';
import { listExpenses } from '@/services/expenses';
import { listInvoices } from '@/services/invoices';
import { listPayments, type PaymentWithInvoice } from '@/services/payments';
import { getProfile } from '@/services/profile';
import type { Expense, InvoiceWithCustomer, Profile } from '@/types/domain';

const TEAL = '#0f766e';
const SLATE = '#64748b';
const AMBER = '#b45309';

interface MonthBucket {
  label: string;
  amount: number;
}

interface AgingBucket {
  label: string;
  amount: number;
  overdue: boolean;
}

interface Summary {
  profile: Profile;
  receivables: InvoiceWithCustomer[];
  receivablesTotal: number;
  overdueTotal: number;
  overdueCount: number;
  overdueMaxDays: number;
  collectedTotal: number;
  collectedThisMonth: number;
  unpaidBillsTotal: number;
  unpaidBillsCount: number;
  overdueBillsCount: number;
  billsDueWithin7Count: number;
  billsDue30Total: number;
  billsDue30Count: number;
  forecast: ForecastResult;
  monthly: MonthBucket[];
  aging: AgingBucket[];
  today: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: Summary };

/** Sum of amounts, rounded to 2 decimal places. */
function total(amounts: number[]): number {
  return round2(amounts.reduce((sum, n) => sum + n, 0));
}

/** "1 invoice" / "2 invoices". */
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function computeSummary(
  invoices: InvoiceWithCustomer[],
  payments: PaymentWithInvoice[],
  expenses: Expense[],
  profile: Profile,
  today: string,
): Summary {
  // Receivables: sent invoices with a balance, earliest due date first.
  const receivables = invoices
    .filter((inv) => inv.status === 'sent' && inv.balance_due > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const overdueRows = receivables.filter((inv) => inv.due_date < today);
  const overdueMaxDays = overdueRows.reduce(
    (max, inv) => Math.max(max, daysOverdue(inv.due_date, today)),
    0,
  );

  // Collections.
  const monthPrefix = today.slice(0, 7);
  const collectedTotal = total(payments.map((p) => p.amount));
  const collectedThisMonth = total(
    payments.filter((p) => p.paid_on.startsWith(monthPrefix)).map((p) => p.amount),
  );

  // Unpaid bills.
  const bills = expenses.filter((e) => e.is_bill === true && e.paid_on === null);
  const in7 = addDays(today, 7);
  const in30 = addDays(today, 30);
  const dueBetween = (b: Expense, end: string): boolean =>
    b.due_date !== null && b.due_date >= today && b.due_date <= end;
  const bills30 = bills.filter((b) => dueBetween(b, in30));

  // Forecast engine (shared input builder).
  const forecast = buildForecast(buildForecastInput(profile, invoices, payments, expenses, today));

  // Last six calendar months of collections, oldest first.
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const monthFormat = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
  const monthly: MonthBucket[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    monthly.push({
      label: monthFormat.format(d),
      amount: total(payments.filter((p) => p.paid_on.startsWith(key)).map((p) => p.amount)),
    });
  }

  // Receivables by age (days past due; 0 means not yet due).
  const amountBetween = (lo: number, hi: number): number =>
    total(
      receivables
        .filter((inv) => {
          const days = daysOverdue(inv.due_date, today);
          return days >= lo && days <= hi;
        })
        .map((inv) => inv.balance_due),
    );
  const aging: AgingBucket[] = [
    { label: 'Not yet due', amount: amountBetween(0, 0), overdue: false },
    { label: '1–30 days overdue', amount: amountBetween(1, 30), overdue: true },
    { label: '31–60 days overdue', amount: amountBetween(31, 60), overdue: true },
    { label: '61+ days overdue', amount: amountBetween(61, Number.POSITIVE_INFINITY), overdue: true },
  ];

  return {
    profile,
    receivables,
    receivablesTotal: total(receivables.map((inv) => inv.balance_due)),
    overdueTotal: total(overdueRows.map((inv) => inv.balance_due)),
    overdueCount: overdueRows.length,
    overdueMaxDays,
    collectedTotal,
    collectedThisMonth,
    unpaidBillsTotal: total(bills.map((b) => b.amount)),
    unpaidBillsCount: bills.length,
    overdueBillsCount: bills.filter((b) => b.due_date !== null && b.due_date < today).length,
    billsDueWithin7Count: bills.filter((b) => dueBetween(b, in7)).length,
    billsDue30Total: total(bills30.map((b) => b.amount)),
    billsDue30Count: bills30.length,
    forecast,
    monthly,
    aging,
    today,
  };
}

interface MetricCardProps {
  label: string;
  value: string;
  subtext?: string;
  alert?: boolean;
}

function MetricCard({ label, value, subtext, alert = false }: MetricCardProps) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={alert ? 'mt-1 text-2xl font-semibold tabular-nums text-destructive' : 'mt-1 text-2xl font-semibold tabular-nums'}>
        {value}
      </p>
      {subtext ? <p className="mt-1 text-xs text-muted-foreground">{subtext}</p> : null}
    </Card>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

function Section({ title, children, className }: SectionProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DashboardContent({ summary }: { summary: Summary }) {
  const { profile, receivables, forecast, monthly, aging, today } = summary;
  const money = (n: number) => formatMoney(n, profile.currency);

  const alerts: { text: string; to: string }[] = [];
  if (summary.overdueCount > 0) {
    alerts.push({
      text: `${plural(summary.overdueCount, 'invoice')} overdue, total ${money(summary.overdueTotal)}`,
      to: '/invoices',
    });
  }
  if (summary.overdueBillsCount > 0) {
    alerts.push({ text: `${plural(summary.overdueBillsCount, 'bill')} overdue`, to: '/expenses' });
  }
  if (summary.billsDueWithin7Count > 0) {
    alerts.push({
      text: `${plural(summary.billsDueWithin7Count, 'bill')} due within 7 days`,
      to: '/expenses',
    });
  }
  if (forecast.horizon90.min_balance < 0) {
    alerts.push({ text: 'Projected balance drops below zero within 90 days', to: '/forecast' });
  }
  if (!profile.gstin?.trim() || !profile.state_code?.trim()) {
    alerts.push({ text: 'Add your GSTIN and state in Settings', to: '/settings' });
  }

  const monthlyHasValue = monthly.some((m) => m.amount > 0);
  const agingHasValue = aging.some((b) => b.amount > 0);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Outstanding receivables" value={money(summary.receivablesTotal)} />
        <MetricCard
          label="Overdue receivables"
          value={money(summary.overdueTotal)}
          alert={summary.overdueCount > 0}
          subtext={
            summary.overdueCount > 0
              ? `${plural(summary.overdueCount, 'invoice')}, up to ${summary.overdueMaxDays} days overdue`
              : 'None overdue'
          }
        />
        <MetricCard
          label="Collected"
          value={money(summary.collectedTotal)}
          subtext={`this month: ${money(summary.collectedThisMonth)}`}
        />
        <MetricCard
          label="Outstanding invoices"
          value={String(receivables.length)}
          subtext="sent, with a balance"
        />
        <MetricCard
          label="Unpaid bills"
          value={money(summary.unpaidBillsTotal)}
          subtext={`${plural(summary.unpaidBillsCount, 'bill')}, ${summary.overdueBillsCount} overdue`}
        />
        <MetricCard
          label="Bills due in 30 days"
          value={money(summary.billsDue30Total)}
          subtext={plural(summary.billsDue30Count, 'bill')}
        />
        <MetricCard
          label={`Starting cash (as of ${formatDate(profile.starting_cash_date)})`}
          value={money(profile.starting_cash_balance)}
        />
        <MetricCard
          label="Current cash (from recorded payments and paid expenses)"
          value={money(forecast.current_cash)}
        />
        <MetricCard
          label="Projected in 30 days (estimate)"
          value={money(forecast.horizon30.end_balance)}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Section title="Alerts">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts. Everything is up to date.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {alerts.map((alert) => (
                <li key={alert.text}>
                  <Link to={alert.to} className="underline-offset-4 hover:underline">
                    {alert.text}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Cashflow">
          <p className="text-sm text-muted-foreground">
            Based on the forecast engine. See the{' '}
            <Link to="/forecast" className="underline underline-offset-4">
              Forecast page
            </Link>{' '}
            for 30 and 90-day detail.
          </p>
          <p className="mt-3 text-sm">
            Lowest projected balance within 90 days (estimate):{' '}
            <span className="font-semibold tabular-nums">{money(forecast.horizon90.min_balance)}</span>
          </p>
        </Section>
      </div>

      <div className="mt-6">
        <Section title="Receivables">
          {receivables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding invoices.</p>
          ) : (
            <>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Customer</th>
                      <th className="py-2 pr-4 font-medium">Invoice</th>
                      <th className="py-2 pr-4 font-medium">Due date</th>
                      <th className="py-2 pr-4 text-right font-medium">Outstanding</th>
                      <th className="py-2 text-right font-medium">Overdue days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivables.map((inv) => {
                      const days = daysOverdue(inv.due_date, today);
                      return (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="py-2 pr-4">{inv.customer?.name ?? '—'}</td>
                          <td className="py-2 pr-4">
                            <Link to={`/invoices/${inv.id}`} className="underline underline-offset-4">
                              {inv.invoice_number}
                            </Link>
                          </td>
                          <td className="py-2 pr-4">{formatDate(inv.due_date)}</td>
                          <td className="py-2 pr-4 text-right tabular-nums">{money(inv.balance_due)}</td>
                          <td
                            className={
                              days > 0
                                ? 'py-2 text-right tabular-nums text-destructive'
                                : 'py-2 text-right tabular-nums'
                            }
                          >
                            {days > 0 ? days : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="space-y-3 sm:hidden">
                {receivables.map((inv) => {
                  const days = daysOverdue(inv.due_date, today);
                  return (
                    <li key={inv.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{inv.customer?.name ?? '—'}</p>
                          <Link to={`/invoices/${inv.id}`} className="underline underline-offset-4">
                            {inv.invoice_number}
                          </Link>
                        </div>
                        <p className="font-semibold tabular-nums">{money(inv.balance_due)}</p>
                      </div>
                      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                        <span>Due {formatDate(inv.due_date)}</span>
                        <span className={days > 0 ? 'text-destructive' : undefined}>
                          {days > 0 ? `${days} days overdue` : 'Not overdue'}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Section title="Collected by month">
          {monthlyHasValue ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthly}>
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} width={72} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Bar dataKey="amount" name="Collected" fill={TEAL} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No payments recorded in the last six months.</p>
          )}
        </Section>

        <Section title="Receivables by age">
          {agingHasValue ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={aging}>
                <XAxis dataKey="label" fontSize={12} />
                <YAxis fontSize={12} width={72} />
                <Tooltip formatter={(value) => money(Number(value))} />
                <Bar dataKey="amount" name="Outstanding">
                  {aging.map((bucket) => (
                    <Cell key={bucket.label} fill={bucket.overdue ? AMBER : SLATE} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">No outstanding receivables to age.</p>
          )}
        </Section>
      </div>
    </>
  );
}

export function DashboardPage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listInvoices(), listPayments(), listExpenses(), getProfile()])
      .then(([invoices, payments, expenses, profile]) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          summary: computeSummary(invoices, payments, expenses, profile, todayISO()),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Could not load dashboard data.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function reload() {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Receivables, bills and cash position from your recorded data."
      />

      {state.status === 'loading' ? (
        <p role="status" className="text-sm text-muted-foreground">
          Loading dashboard…
        </p>
      ) : state.status === 'error' ? (
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
          <Button variant="outline" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : (
        <DashboardContent summary={state.summary} />
      )}
    </>
  );
}
