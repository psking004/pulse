import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from '@/components/shared/EmptyState';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildForecastInput } from '@/features/forecast/forecastInput';
import { buildForecast } from '@/lib/forecast';
import { addDays, formatDate, parseISODate, todayISO } from '@/lib/dates';
import { formatMoney, round2 } from '@/lib/money';
import { cn } from '@/lib/utils';
import { getProfile } from '@/services/profile';
import { listInvoices } from '@/services/invoices';
import { listPayments, type PaymentWithInvoice } from '@/services/payments';
import { listExpenses } from '@/services/expenses';
import type { Expense, InvoiceWithCustomer, Profile } from '@/types/domain';

const DELAY_DAYS = 15;
const AXIS_DATE = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const AXIS_TICK = { fontSize: 12, className: 'fill-muted-foreground' };

interface ForecastData {
  profile: Profile;
  invoices: InvoiceWithCustomer[];
  payments: PaymentWithInvoice[];
  expenses: Expense[];
  today: string;
}

/** Signed money text for changes: "+₹1,000.00", "−₹1,000.00" or "₹0.00". */
function formatSigned(amount: number, currency: string): string {
  if (amount > 0) return `+${formatMoney(amount, currency)}`;
  if (amount < 0) return `−${formatMoney(-amount, currency)}`;
  return formatMoney(0, currency);
}

interface SummaryCardProps {
  title: string;
  value: string;
  note?: string;
  badge: 'ACTUAL' | 'ESTIMATE';
}

function SummaryCard({ title, value, note, badge }: SummaryCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <Badge variant="outline">{badge}</Badge>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}
    </Card>
  );
}

export function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [horizon, setHorizon] = useState<30 | 90>(30);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([getProfile(), listInvoices(), listPayments(), listExpenses()])
      .then(([profile, invoices, payments, expenses]) => {
        if (cancelled) return;
        setData({ profile, invoices, payments, expenses, today: todayISO() });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Could not load the forecast.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const model = useMemo(() => {
    if (!data) return null;
    const { profile, invoices, payments, expenses, today } = data;
    const baseInput = buildForecastInput(profile, invoices, payments, expenses, today);
    const base = buildForecast(baseInput);
    const sim = selectedId
      ? buildForecast(buildForecastInput(profile, invoices, payments, expenses, today, selectedId, DELAY_DAYS))
      : null;
    return { baseInput, base, sim };
  }, [data, selectedId]);

  const header = (
    <PageHeader
      title="Cashflow forecast"
      description="Estimated cash position from your starting balance, recorded payments, expected collections and unpaid bills. Estimates, not bank balances."
    />
  );

  if (!data || !model) {
    return (
      <>
        {header}
        {loadError ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-red-700">
              {loadError}
            </p>
            <Button variant="outline" onClick={() => setAttempt((a) => a + 1)}>
              Retry
            </Button>
          </div>
        ) : loading ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading forecast…
          </p>
        ) : null}
      </>
    );
  }

  const { profile, invoices, payments, expenses, today } = data;
  const { baseInput, base, sim } = model;
  const currency = profile.currency;
  const summary = horizon === 30 ? base.horizon30 : base.horizon90;
  const horizonEnd = addDays(today, horizon);
  const timeline = base.events.filter((ev) => ev.date <= horizonEnd);
  const isEmpty = baseInput.invoices.length === 0 && baseInput.bills.length === 0;
  const showStartingCashNote =
    profile.starting_cash_balance === 0 && payments.length === 0 && expenses.length === 0;

  const points = base.base_series.slice(0, horizon + 1);
  const simPoints = sim?.simulated_series?.slice(0, horizon + 1) ?? null;
  const chartData = points.map((p, i) => ({
    label: AXIS_DATE.format(parseISODate(p.date)),
    base: p.balance,
    simulated: simPoints?.[i]?.balance ?? null,
  }));
  const chartHasNegative = chartData.some(
    (d) => d.base < 0 || (d.simulated !== null && d.simulated < 0),
  );

  const delayable = invoices.filter((inv) => inv.status === 'sent' && inv.balance_due > 0);
  const delayed = selectedId ? (delayable.find((inv) => inv.id === selectedId) ?? null) : null;
  const shifted = delayed ? addDays(delayed.due_date, DELAY_DAYS) : null;
  const newExpected = shifted !== null ? (shifted > today ? shifted : today) : null;
  const impact30 = sim?.simulation_impact_30 ?? 0;
  const impact90 = sim?.simulation_impact_90 ?? 0;
  const simRows = sim
    ? [
        {
          label: 'Projected in 30 days',
          base: base.horizon30.end_balance,
          delayed: sim.horizon30.end_balance,
          change: impact30,
        },
        {
          label: 'Projected in 90 days',
          base: base.horizon90.end_balance,
          delayed: sim.horizon90.end_balance,
          change: impact90,
        },
        {
          label: 'Lowest balance (90 days)',
          base: base.horizon90.min_balance,
          delayed: sim.horizon90.min_balance,
          change: round2(sim.horizon90.min_balance - base.horizon90.min_balance),
        },
      ]
    : [];

  return (
    <>
      {header}

      {showStartingCashNote ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Set your starting cash balance in Settings for an accurate forecast.
        </p>
      ) : null}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>How this forecast works</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="space-y-1">
              <dt className="font-medium">Current cash</dt>
              <dd className="text-muted-foreground">
                Your starting balance on the starting date, plus payments received since then, minus paid expenses,
                gives current cash.
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium">Expected collections</dt>
              <dd className="text-muted-foreground">
                Each unpaid invoice (status sent) is expected on its due date, or today if it is already overdue
                (assumed collected today).
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium">Unpaid bills</dt>
              <dd className="text-muted-foreground">Unpaid bills are paid on their due date, or today if they are overdue.</dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium">Unpaid expenses</dt>
              <dd className="text-muted-foreground">Unpaid non-bill expenses are not forecast.</dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium">Delay simulation</dt>
              <dd className="text-muted-foreground">
                The 15-day simulation moves one selected invoice&apos;s expected date later by 15 days without changing
                any record.
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="font-medium">Not modelled</dt>
              <dd className="text-muted-foreground">No GST timing or bank fees are modelled.</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {isEmpty ? (
        <EmptyState
          icon={TrendingUp}
          title="No projections yet"
          description="No projections yet. Create invoices or add bills to see the forecast."
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/invoices/new">New invoice</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/expenses">Add a bill</Link>
            </Button>
          </div>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Current cash"
              badge="ACTUAL"
              value={formatMoney(base.current_cash, currency)}
              note="from recorded payments and paid expenses"
            />
            <SummaryCard
              title="Projected in 30 days"
              badge="ESTIMATE"
              value={formatMoney(base.horizon30.end_balance, currency)}
            />
            <SummaryCard
              title="Projected in 90 days"
              badge="ESTIMATE"
              value={formatMoney(base.horizon90.end_balance, currency)}
            />
            <SummaryCard
              title="Lowest projected balance (90 days)"
              badge="ESTIMATE"
              value={formatMoney(base.horizon90.min_balance, currency)}
            />
          </div>

          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div role="group" aria-label="Forecast horizon" className="inline-flex gap-1 rounded-lg border bg-muted/40 p-1">
                {([30, 90] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={horizon === days}
                    onClick={() => setHorizon(days)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      horizon === days ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {`${days} days`}
                  </button>
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Inflows</dt>
                  <dd className="font-medium">{formatMoney(summary.inflows, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Outflows</dt>
                  <dd className="font-medium">{formatMoney(summary.outflows, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">End balance</dt>
                  <dd className="font-medium">{formatMoney(summary.end_balance, currency)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Lowest balance</dt>
                  <dd className="font-medium">{formatMoney(summary.min_balance, currency)}</dd>
                </div>
              </dl>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projected daily balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block h-0.5 w-6 bg-[#0f766e]" />
                  Base projection
                </span>
                {sim ? (
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="inline-block w-6 border-t-2 border-dashed border-slate-500" />
                    With 15-day delay
                  </span>
                ) : null}
              </div>
              {chartData.length === 0 ? (
                <p className="text-sm text-muted-foreground">No series to show.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3e8ef" />
                    <XAxis dataKey="label" minTickGap={24} tick={AXIS_TICK} />
                    <YAxis
                      tick={AXIS_TICK}
                      width={90}
                      tickFormatter={(v: number) => v.toLocaleString('en-IN')}
                    />
                    <Tooltip formatter={(value) => formatMoney(Number(value), currency)} />
                    {chartHasNegative ? <ReferenceLine y={0} stroke="#94a3b8" /> : null}
                    <Line
                      type="monotone"
                      dataKey="base"
                      name="Base forecast"
                      stroke="#0f766e"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    {simPoints ? (
                      <Line
                        type="monotone"
                        dataKey="simulated"
                        name="With 15-day delay"
                        stroke="#64748b"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={false}
                        isAnimationActive={false}
                      />
                    ) : null}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Expected cash movements</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No expected cash movements in this window.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Date</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Description</th>
                      <th className="py-2 pr-4 text-right font-medium">Amount</th>
                      <th className="py-2 font-medium">Assumed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((ev) => (
                      <tr key={`${ev.kind}-${ev.source_id}-${ev.date}`} className="border-b last:border-0">
                        <td className="py-2 pr-4 whitespace-nowrap">{formatDate(ev.date)}</td>
                        <td className="py-2 pr-4">{ev.kind === 'inflow' ? 'Collection' : 'Bill'}</td>
                        <td className="py-2 pr-4">{ev.label}</td>
                        <td className="py-2 pr-4 text-right whitespace-nowrap tabular-nums">
                          {ev.kind === 'inflow' ? '+' : '−'}
                          {formatMoney(ev.amount, currency)}
                        </td>
                        <td className="py-2">
                          {ev.is_overdue_assumed ? <Badge variant="secondary">Overdue, assumed today</Badge> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>15-day payment delay simulation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick an invoice to see how a 15-day late payment changes your projections. Nothing is saved.
              </p>
              <div className="max-w-xl space-y-1.5">
                <label htmlFor="delay-invoice" className="text-sm font-medium">
                  Invoice to delay
                </label>
                <select
                  id="delay-invoice"
                  className="h-9 w-full rounded-md border bg-card px-3 text-sm"
                  value={selectedId ?? ''}
                  onChange={(e) => setSelectedId(e.target.value === '' ? null : e.target.value)}
                >
                  <option value="">No simulation</option>
                  {delayable.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {`${inv.invoice_number} · ${inv.customer?.name ?? 'Customer'} · ${formatMoney(inv.balance_due, currency)}`}
                    </option>
                  ))}
                </select>
              </div>

              {sim && delayed && newExpected !== null ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Selected: {delayed.invoice_number} · {delayed.customer?.name ?? 'Customer'} · balance{' '}
                    {formatMoney(delayed.balance_due, currency)} · due {formatDate(delayed.due_date)}
                  </p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="py-2 pr-4 font-medium">Measure</th>
                          <th className="py-2 pr-4 text-right font-medium">Base</th>
                          <th className="py-2 pr-4 text-right font-medium">With 15-day delay</th>
                          <th className="py-2 text-right font-medium">Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simRows.map((row) => (
                          <tr key={row.label} className="border-b last:border-0">
                            <td className="py-2 pr-4">{row.label}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(row.base, currency)}</td>
                            <td className="py-2 pr-4 text-right tabular-nums">{formatMoney(row.delayed, currency)}</td>
                            <td className="py-2 text-right tabular-nums">{formatSigned(row.change, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm">
                    New expected date for {delayed.invoice_number}: {formatDate(newExpected)}.
                  </p>
                  {impact30 === 0 && newExpected <= addDays(today, 30) ? (
                    <p className="text-sm text-muted-foreground">
                      The delayed payment still lands inside the 30-day window, so the 30-day balance does not change.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
