// US end-of-day data for the Repo Desk: SPY, QQQ and the 14 sector ETFs. Pure functions, no I/O.
//   Source: Tiingo daily prices. `close` is the price as traded that day (not restated for later splits); `splitFactor` is the
//   split ratio on its ex-date (2 for a 2-for-1), published by Tiingo, so splits need no guessing.
//   Averages are computed here from split-adjusted closes. Dividends are NOT adjusted (as on a TradingView chart and in the Claude Desk).
//   SMA 50 / 200 = mean of the last 50 / 200 closes up to and including the day (omitted when fewer exist; a window that crosses a break is omitted).
//   r1m / r3m   = close against the last stored close on or before the same calendar day 1 / 3 months earlier.
import { sma, returnOver } from '../engine/indicators.ts';

export type Bar = [date: string, open: number, high: number, low: number, close: number, volume: number, split: number, div: number];

export const SECTORS: Array<[ticker: string, key: string]> = [
  ['XLK', 'Technology (XLK)'], ['XLF', 'Financials (XLF)'], ['XLE', 'Energy (XLE)'], ['XLV', 'Health Care (XLV)'],
  ['XLI', 'Industrials (XLI)'], ['XLY', 'Consumer Discretionary (XLY)'], ['XLP', 'Consumer Staples (XLP)'], ['XLU', 'Utilities (XLU)'],
  ['XLB', 'Materials (XLB)'], ['XLRE', 'Real Estate (XLRE)'], ['XLC', 'Communication (XLC)'], ['SMH', 'Semiconductors (SMH)'],
  ['IGV', 'Software (IGV)'], ['ITA', 'Aerospace & Defense (ITA)'],
];
export const US_TICKERS = ['SPY', 'QQQ', ...SECTORS.map(([t]) => t)];
export const BREAK_PCT = 22;   // same rule as India: a one-day move beyond this in the split-adjusted close is a break

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/** Tiingo /daily/<t>/prices rows -> bars, oldest first. Rows that fail validation are dropped and counted. */
export function parseTiingo(rows: unknown): { bars: Bar[]; dropped: number } {
  if (!Array.isArray(rows)) throw new Error('Tiingo reply is not a list');
  const bars: Bar[] = []; let dropped = 0;
  for (const r of rows as Array<Record<string, unknown>>) {
    const date = typeof r.date === 'string' ? r.date.slice(0, 10) : '';
    const o = num(r.open), h = num(r.high), l = num(r.low), c = num(r.close), v = num(r.volume);
    const sp = num(r.splitFactor) ?? 1, dv = num(r.divCash) ?? 0;
    if (!/^\d{4}-\d\d-\d\d$/.test(date) || o === null || h === null || l === null || c === null || v === null || c <= 0 || h < l || sp <= 0) { dropped++; continue; }
    bars.push([date, o, h, l, c, v, sp, dv]);
  }
  bars.sort((a, b) => a[0].localeCompare(b[0]));
  return { bars, dropped };
}

/** Nasdaq's public historical-quotes reply (api.nasdaq.com/api/quote/<T>/historical) -> bars, oldest first. Prices there are already split-adjusted,
 *  so split is 1 and there is no dividend column. Used only as the backup when Tiingo is unavailable. */
export function parseNasdaq(json: unknown): { bars: Bar[]; dropped: number } {
  const rows = (json as { data?: { tradesTable?: { rows?: unknown } } })?.data?.tradesTable?.rows;
  if (!Array.isArray(rows)) throw new Error('Nasdaq reply has no rows');
  const money = (x: unknown) => Number(String(x ?? '').replace(/[$,]/g, ''));
  const bars: Bar[] = []; let dropped = 0;
  for (const r of rows as Array<Record<string, unknown>>) {
    const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(String(r.date ?? ''));
    const o = money(r.open), h = money(r.high), l = money(r.low), c = money(r.close), v = money(r.volume);
    if (!m || ![o, h, l, c, v].every(Number.isFinite) || c <= 0 || h < l) { dropped++; continue; }
    bars.push([`${m[3]}-${m[1]}-${m[2]}`, o, h, l, c, v, 1, 0]);
  }
  bars.sort((a, b) => a[0].localeCompare(b[0]));
  return { bars, dropped };
}

/** Merge fresh bars into stored ones by date. A stored date is never overwritten: a different close or split is reported as a conflict. */
export function mergeBars(stored: Bar[], fresh: Bar[]): { bars: Bar[]; added: number; conflicts: string[] } {
  const by = new Map(stored.map((b) => [b[0], b]));
  const conflicts: string[] = []; let added = 0;
  for (const f of fresh) {
    const s = by.get(f[0]);
    if (!s) { by.set(f[0], f); added++; continue; }
    if (Math.abs(f[4] / s[4] - 1) > 0.0005 || f[6] !== s[6]) conflicts.push(`${f[0]}: stored close ${s[4]} split ${s[6]}, fresh close ${f[4]} split ${f[6]}`);
  }
  return { bars: [...by.values()].sort((a, b) => a[0].localeCompare(b[0])), added, conflicts };
}

export interface Series { dates: string[]; open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }

/** Split-adjusted series through `date`: each price is divided, and each volume multiplied, by the product of the split factors AFTER it. */
export function adjustedThrough(bars: Bar[], date: string): Series {
  const use = bars.filter((b) => b[0] <= date);
  const n = use.length;
  const s: Series = { dates: use.map((b) => b[0]), open: new Array(n), high: new Array(n), low: new Array(n), close: new Array(n), volume: new Array(n) };
  let cum = 1;
  for (let i = n - 1; i >= 0; i--) {
    const b = use[i];
    s.open[i] = b[1] / cum; s.high[i] = b[2] / cum; s.low[i] = b[3] / cum; s.close[i] = b[4] / cum; s.volume[i] = b[5] * cum;
    cum *= b[6];
  }
  return s;
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

export interface UsStats { date: string; close: number; high: number; low: number; volume: number; sma50?: number; sma200?: number; r1m?: number; r3m?: number; breaks: string[] }

/** Stats as of `date` (must be a stored date). `volume` is in millions of shares, as the app stores it. */
export function usStats(bars: Bar[], date: string): UsStats | null {
  const s = adjustedThrough(bars, date);
  const n = s.dates.length;
  if (!n || s.dates[n - 1] !== date) return null;
  const breaks: string[] = [];
  for (let i = 1; i < n; i++) if (Math.abs(s.close[i] / s.close[i - 1] - 1) * 100 > BREAK_PCT) breaks.push(s.dates[i]);
  const lastBrk = breaks.length ? s.dates.indexOf(breaks[breaks.length - 1]) : -1;
  const clean = (k: number): boolean => n >= k && lastBrk <= n - k;      // the window of k closes must not start before the last break
  const closesByDate: Record<string, number> = {};
  s.dates.forEach((d, i) => { closesByDate[d] = s.close[i]; });
  const out: UsStats = { date, close: round2(s.close[n - 1]), high: round2(s.high[n - 1]), low: round2(s.low[n - 1]), volume: round2(s.volume[n - 1] / 1e6), breaks };
  if (clean(50)) out.sma50 = round2(sma(s.close, 50));
  if (clean(200)) out.sma200 = round2(sma(s.close, 200));
  const r1 = returnOver(closesByDate, date, 1), r3 = returnOver(closesByDate, date, 3);
  if (!Number.isNaN(r1)) out.r1m = r1;
  if (!Number.isNaN(r3)) out.r3m = r3;
  return out;
}

// ---- second sources -------------------------------------------------------------------------------------------------

const MON: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

/** StockAnalysis history table -> {date: close}. Rows: Date, Open, High, Low, Close, Adj. Close, Change, Volume. */
export function parseStockAnalysis(html: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim());
    const m = /^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/.exec(cells[0] || '');
    if (!m || !MON[m[1]] || cells.length < 6) continue;
    const close = Number((cells[4] || '').replace(/,/g, ''));
    if (Number.isFinite(close) && close > 0) out[`${m[3]}-${MON[m[1]]}-${m[2].padStart(2, '0')}`] = close;
  }
  return out;
}

/** Cboe VIX_History.csv (DATE MM/DD/YYYY, OPEN, HIGH, LOW, CLOSE) -> {date: close}. */
export function parseCboeVix(csv: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of csv.split(/\r?\n/).slice(1)) {
    const p = line.split(',');
    const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(p[0] || '');
    const c = Number(p[4]);
    if (m && Number.isFinite(c) && c > 0) out[`${m[3]}-${m[1]}-${m[2]}`] = c;
  }
  return out;
}

/** True when two closes agree within `tol` (default 0.1%). */
export const agree = (a: number, b: number, tol = 0.001): boolean => Math.abs(a / b - 1) <= tol;
