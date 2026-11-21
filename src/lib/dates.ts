const DAY_MS = 86_400_000;
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Split 'YYYY-MM-DD' into numeric parts. */
function parts(iso: string): [number, number, number] {
  const [y = 0, m = 1, d = 1] = iso.split('-').map(Number);
  return [y, m, d];
}

/** UTC epoch milliseconds for the calendar date in an ISO string. */
function utcMs(iso: string): number {
  const [y, m, d] = parts(iso);
  return Date.UTC(y, m - 1, d);
}

/** Today's LOCAL date as 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** Local midnight for a 'YYYY-MM-DD' string (avoids the UTC parsing of new Date(string)). */
export function parseISODate(s: string): Date {
  const [y, m, d] = parts(s);
  return new Date(y, m - 1, d);
}

/** Whole days from `fromISO` to `toISO` (negative if `toISO` is earlier). */
export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((utcMs(toISO) - utcMs(fromISO)) / DAY_MS);
}

/** Add whole days to a 'YYYY-MM-DD' string using UTC arithmetic. */
export function addDays(iso: string, days: number): string {
  const d = new Date(utcMs(iso) + days * DAY_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

const DISPLAY_FORMAT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** Display a 'YYYY-MM-DD' string, e.g. '12 Mar 2025'. */
export function formatDate(iso: string): string {
  return DISPLAY_FORMAT.format(parseISODate(iso));
}

/** True for a well-formed 'YYYY-MM-DD' string that is a real calendar date. */
export function isISODate(s: string): boolean {
  if (!ISO_RE.test(s)) return false;
  const [y, m, d] = parts(s);
  const check = new Date(Date.UTC(y, m - 1, d));
  return (
    check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d
  );
}
