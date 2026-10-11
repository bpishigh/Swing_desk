// Pure indicator maths. No I/O. Definitions follow Engine Rules (setups and entry calculation, stock selection).

/** Simple moving average of the last n values; NaN if fewer than n. */
export function sma(values: number[], n: number): number {
  if (values.length < n) return NaN;
  let s = 0;
  for (let i = values.length - n; i < values.length; i++) s += values[i];
  return s / n;
}

/** EMA seeded with the mean of the first n values, then rolled with k = 2/(n+1). NaN if fewer than n values. */
export function emaSeeded(values: number[], n: number): number {
  if (values.length < n) return NaN;
  let e = 0;
  for (let i = 0; i < n; i++) e += values[i];
  e /= n;
  const k = 2 / (n + 1);
  for (let i = n; i < values.length; i++) e += k * (values[i] - e);
  return e;
}

/** One EMA step. */
export function emaStep(prev: number, close: number, n: number): number {
  return prev + (2 / (n + 1)) * (close - prev);
}

/** ATR as the simple mean of the last n true ranges (needs n+1 bars). NaN otherwise. */
export function atr(high: number[], low: number[], close: number[], n = 14): number {
  const len = close.length;
  if (high.length !== len || low.length !== len || len < n + 1) return NaN;
  let s = 0;
  for (let i = len - n; i < len; i++) {
    s += Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]));
  }
  return s / n;
}

/** Calendar date one/three months before `date` (YYYY-MM-DD), clamped to the month's last day. */
export function monthsBefore(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 - months, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}

/**
 * Return in percent over `months` calendar months: close on `date` against the close on the last stored
 * trading day on or before the same calendar day `months` earlier. NaN if no such stored close exists
 * (history too short) or `date` has no close.
 */
export function returnOver(closes: Record<string, number>, date: string, months: number): number {
  const c = closes[date];
  if (typeof c !== 'number') return NaN;
  const target = monthsBefore(date, months);
  const dates = Object.keys(closes).sort();
  if (dates[0] > target) return NaN;
  let base: number | undefined;
  for (const d of dates) { if (d <= target) base = closes[d]; else break; }
  return base === undefined ? NaN : Math.round((c / base - 1) * 10000) / 100;
}
