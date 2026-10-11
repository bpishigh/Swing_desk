// Money formatting and weekday counting used in checklist text. Behaviour identical to app v9 (inr/usd/weekdaysBetween).
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
export const inrFix = (n: number, dp = 0): string => ok(n) ? (n < 0 ? '–' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—';
export const usd = (n: number, dp = 0): string => ok(n) ? (n < 0 ? '–' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '—';
export const money = (market: 'india' | 'us', n: number, dp = 0): string => (market === 'us' ? usd(n, dp) : inrFix(n, dp));

const parseD = (s: string): Date => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
/** Weekdays after `a`, up to and including `b` (YYYY-MM-DD). Holidays are not known here (the market calendar file comes later). */
export function weekdaysBetween(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const d = parseD(a), e = parseD(b); let n = 0;
  if (e <= d) return 0;
  d.setDate(d.getDate() + 1);
  while (d <= e) { const w = d.getDay(); if (w !== 0 && w !== 6) n++; d.setDate(d.getDate() + 1); }
  return n;
}

export const px = (market: 'india' | 'us', n: number): string => ok(n)
  ? (market === 'us' ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  : '—';
export const rr = (n: number, dp = 2): string => ok(n) ? (n > 0 ? '+' : n < 0 ? '–' : '') + Math.abs(n).toFixed(dp) + 'R' : '—';
export const pct = (n: number, dp = 1): string => ok(n) ? (n < 0 ? '–' : '') + Math.abs(n).toFixed(dp) + '%' : '—';
export const daysBetween = (a: string, b: string): number => Math.round((parseD(b).getTime() - parseD(a).getTime()) / 864e5);
