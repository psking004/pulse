import type { InvoiceStatus } from '@/types/domain';
import { addDays } from '@/lib/dates';
import { fromPaise, round2, toPaise } from '@/lib/money';

export interface ForecastInvoice {
  id: string;
  customer_name: string;
  invoice_number: string;
  balance_due: number;
  due_date: string;
  status: InvoiceStatus;
}

/** Unpaid bills only (is_bill true, paid_on null). */
export interface ForecastBill {
  id: string;
  supplier: string;
  amount: number;
  due_date: string;
}

export interface ForecastPayment {
  amount: number;
  paid_on: string;
}

export interface ForecastExpense {
  amount: number;
  paid_on: string;
}

export interface ForecastInput {
  today: string;
  starting_cash_balance: number;
  starting_cash_date: string;
  payments: ForecastPayment[];
  paid_expenses: ForecastExpense[];
  invoices: ForecastInvoice[];
  bills: ForecastBill[];
  delay_invoice_id?: string | null;
  delay_days?: number;
}

export interface ForecastEvent {
  date: string;
  kind: 'inflow' | 'outflow';
  label: string;
  amount: number;
  source_id: string;
  is_overdue_assumed: boolean;
}

export interface CashPoint {
  date: string;
  balance: number;
}

export interface HorizonSummary {
  end_balance: number;
  inflows: number;
  outflows: number;
  min_balance: number;
}

export interface ForecastResult {
  current_cash: number;
  events: ForecastEvent[];
  base_series: CashPoint[];
  simulated_series: CashPoint[] | null;
  horizon30: HorizonSummary;
  horizon90: HorizonSummary;
  simulated_horizon30: HorizonSummary | null;
  simulated_horizon90: HorizonSummary | null;
  simulation_impact_30: number | null;
  simulation_impact_90: number | null;
}

const SERIES_DAYS = 90;
const DEFAULT_DELAY_DAYS = 15;

/** The later of two 'YYYY-MM-DD' strings. */
function laterOf(a: string, b: string): string {
  return a > b ? a : b;
}

function compareEvents(a: ForecastEvent, b: ForecastEvent): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind === b.kind) return 0;
  return a.kind === 'inflow' ? -1 : 1;
}

/** Daily balance from today through today + SERIES_DAYS, inclusive (91 points). */
function buildSeries(startPaise: number, events: ForecastEvent[], today: string): CashPoint[] {
  const points: CashPoint[] = [];
  for (let i = 0; i <= SERIES_DAYS; i++) {
    const date = addDays(today, i);
    let balancePaise = startPaise;
    for (const ev of events) {
      if (ev.date > date) continue;
      balancePaise += ev.kind === 'inflow' ? toPaise(ev.amount) : -toPaise(ev.amount);
    }
    points.push({ date, balance: fromPaise(balancePaise) });
  }
  return points;
}

/** Totals and lowest balance for the window of `days` starting today. */
function summarise(
  series: CashPoint[],
  events: ForecastEvent[],
  startPaise: number,
  today: string,
  days: number,
): HorizonSummary {
  const endDate = addDays(today, days);
  let inflowPaise = 0;
  let outflowPaise = 0;
  for (const ev of events) {
    if (ev.date > endDate) continue;
    if (ev.kind === 'inflow') inflowPaise += toPaise(ev.amount);
    else outflowPaise += toPaise(ev.amount);
  }
  const balances = series.filter((p) => p.date <= endDate).map((p) => toPaise(p.balance));
  return {
    end_balance: round2(fromPaise(startPaise + inflowPaise - outflowPaise)),
    inflows: round2(fromPaise(inflowPaise)),
    outflows: round2(fromPaise(outflowPaise)),
    min_balance: round2(fromPaise(Math.min(...balances))),
  };
}

/**
 * Cash forecast engine (pure).
 *
 * Assumptions:
 * - Overdue invoices are assumed collected today.
 * - Unpaid non-bill expenses are NOT forecast.
 * - This is an estimate, not a bank statement.
 */
export function buildForecast(input: ForecastInput): ForecastResult {
  const { today } = input;
  const delayDays = input.delay_days ?? DEFAULT_DELAY_DAYS;

  // Current cash in integer paise; only movements dated within [starting_cash_date, today].
  const inCashWindow = (d: string): boolean => d >= input.starting_cash_date && d <= today;
  let cashPaise = toPaise(input.starting_cash_balance);
  for (const p of input.payments) {
    if (inCashWindow(p.paid_on)) cashPaise += toPaise(p.amount);
  }
  for (const e of input.paid_expenses) {
    if (inCashWindow(e.paid_on)) cashPaise -= toPaise(e.amount);
  }

  // Base events. Only 'sent' invoices with a balance are expected inflows.
  const events: ForecastEvent[] = [];
  for (const inv of input.invoices) {
    if (inv.status !== 'sent' || inv.balance_due <= 0) continue;
    events.push({
      date: laterOf(inv.due_date, today),
      kind: 'inflow',
      label: `${inv.customer_name} · ${inv.invoice_number}`,
      amount: round2(inv.balance_due),
      source_id: inv.id,
      is_overdue_assumed: inv.due_date < today,
    });
  }
  for (const bill of input.bills) {
    if (bill.amount <= 0) continue;
    events.push({
      date: laterOf(bill.due_date, today),
      kind: 'outflow',
      label: bill.supplier,
      amount: round2(bill.amount),
      source_id: bill.id,
      is_overdue_assumed: bill.due_date < today,
    });
  }
  events.sort(compareEvents);

  // Simulation: one invoice is paid delay_days after its due date (never before today).
  let simulatedEvents: ForecastEvent[] | null = null;
  const delayId = input.delay_invoice_id;
  if (delayId && delayDays > 0) {
    const delayed = input.invoices.find((i) => i.id === delayId);
    simulatedEvents = events
      .map((ev) => {
        if (!delayed || ev.kind !== 'inflow' || ev.source_id !== delayId) return ev;
        return { ...ev, date: laterOf(addDays(delayed.due_date, delayDays), today) };
      })
      .sort(compareEvents);
  }

  const base_series = buildSeries(cashPaise, events, today);
  const horizon30 = summarise(base_series, events, cashPaise, today, 30);
  const horizon90 = summarise(base_series, events, cashPaise, today, 90);

  let simulated_series: CashPoint[] | null = null;
  let simulated_horizon30: HorizonSummary | null = null;
  let simulated_horizon90: HorizonSummary | null = null;
  let simulation_impact_30: number | null = null;
  let simulation_impact_90: number | null = null;
  if (simulatedEvents) {
    simulated_series = buildSeries(cashPaise, simulatedEvents, today);
    const sim30 = summarise(simulated_series, simulatedEvents, cashPaise, today, 30);
    const sim90 = summarise(simulated_series, simulatedEvents, cashPaise, today, 90);
    simulated_horizon30 = sim30;
    simulated_horizon90 = sim90;
    simulation_impact_30 = round2(fromPaise(toPaise(sim30.end_balance) - toPaise(horizon30.end_balance)));
    simulation_impact_90 = round2(fromPaise(toPaise(sim90.end_balance) - toPaise(horizon90.end_balance)));
  }

  return {
    current_cash: round2(fromPaise(cashPaise)),
    events,
    base_series,
    simulated_series,
    horizon30,
    horizon90,
    simulated_horizon30,
    simulated_horizon90,
    simulation_impact_30,
    simulation_impact_90,
  };
}
