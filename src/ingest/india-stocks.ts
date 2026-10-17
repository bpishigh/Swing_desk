// India whole-market stock store: parse NSE's daily all-stock file (sec_bhavdata_full), keep one compact file per session,
// and derive close, volume, SMAs and EMAs for every listed stock from the stored history. Pure functions, no I/O.
// No holdings or watch-list live here: the file covers the whole market, and the app filters to the trader's own symbols.
//   SMA 50 / 200 = mean of the last 50 / 200 adjusted closes dated before D (maAsOf = the last of those dates), omitted when fewer exist;
//   EMA 10 / 20  = engine emaSeeded over all adjusted closes through D (emaAsOf = D); emaWarm false until 4 x n closes exist;
//   adjusted closes: each corporate action the resolver accepted (src/ingest/corp-actions.ts: NSE's actions list, NSE circulars, a published
//   average, or a typed override) scales every earlier close by its price factor, so averages do not break at the event. A one-day move beyond
//   BREAK_PCT that no accepted action explains is a break; averages that straddle one are omitted. Raw files stay unadjusted.
//   (NSE's PREV_CLOSE is not used for splits or bonuses: it is not adjusted on the ex-date. `adjusted` lists only sessions where PREV_CLOSE
//   disagreed with our stored close for another reason, such as a data revision.)
import { emaSeeded } from '../engine/indicators.ts';
import { splitLine } from './india-index.ts';

export type Row = [series: string, prevClose: number | null, open: number | null, high: number | null, low: number | null, close: number, volume: number, delivPct: number | null];
export interface BhavDay { date: string; rows: Record<string, Row> }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const num = (s: string | undefined): number | null => {
  if (s === undefined) return null;
  const t = s.replace(/,/g, '').trim();
  if (t === '' || t === '-') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};
/** "09-Oct-2026" -> "2026-10-09"; null if it is not that shape. */
export function parseNseDate(s: string): string | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const mi = MONTHS.indexOf(m[2].toLowerCase());
  return mi < 0 ? null : `${m[3]}-${String(mi + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/**
 * Parse sec_bhavdata_full_DDMMYYYY.csv. Keeps series EQ and BE (EQ wins if a symbol appears in both). The date comes from DATE1 inside
 * the file; NSE has served the previous session's data under a holiday's file name, so the file name is never trusted.
 */
export function parseBhavcopy(text: string): BhavDay {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('bhavcopy has no data rows');
  const head = splitLine(lines[0]).map((h) => h.toUpperCase());
  const col = (n: string): number => { const i = head.indexOf(n); if (i < 0) throw new Error(`bhavcopy: no column ${n}`); return i; };
  const iSym = col('SYMBOL'), iSer = col('SERIES'), iDate = col('DATE1'), iPc = col('PREV_CLOSE'), iO = col('OPEN_PRICE'), iH = col('HIGH_PRICE'), iL = col('LOW_PRICE'), iC = col('CLOSE_PRICE'), iV = col('TTL_TRD_QNTY');
  const iD = head.indexOf('DELIV_PER');
  const dates = new Set<string>(); const rows: Record<string, Row> = {};
  for (const line of lines.slice(1)) {
    const f = splitLine(line);
    const series = f[iSer];
    if (series !== 'EQ' && series !== 'BE') continue;
    const date = parseNseDate(f[iDate] ?? ''); const close = num(f[iC]);
    if (!date || close === null || close <= 0) continue;
    dates.add(date);
    const sym = f[iSym];
    if (sym in rows && rows[sym][0] === 'EQ') continue;
    rows[sym] = [series, num(f[iPc]), num(f[iO]), num(f[iH]), num(f[iL]), close, num(f[iV]) ?? 0, iD >= 0 ? num(f[iD]) : null];
  }
  if (dates.size !== 1) throw new Error(`bhavcopy carries ${dates.size} dates (${[...dates].join(', ')}), expected one`);
  return { date: [...dates][0], rows };
}

const round2 = (x: number): number => Math.round(x * 100) / 100;

export interface StockStats {
  close: number; high: number | null; low: number | null; volume: number; prevClose: number | null; delivPct: number | null; series: string;
  sma50?: number; sma200?: number; maAsOf: string | null; ema10?: number; ema20?: number; emaAsOf: string; emaWarm: boolean;
  closes: number; adjusted: string[];
  /** Corporate actions this stock's averages were adjusted for (date, price factor, how it was established). */
  adjustedFor?: Array<{ date: string; factor: number; confidence: string; source: string }>;
  /** Sessions whose close moved more than BREAK_PCT from the stored close before it (split, bonus or a real shock). Averages whose window straddles one are omitted. */
  breaks: string[];
}

/** Daily price bands stop most stocks at 20%; a bigger move is treated as a possible corporate action. */
export const BREAK_PCT = 22;

/** Stats for every symbol traded on `date`, from stored sessions (ascending, the last being `date`). */
/**
 * `consecutive(a, b)` says whether b is the very next session after a. A price break across a missing session is not a corporate action,
 * so an adjustment is only made between consecutive sessions (default: always).
 */
export interface CorpAdjustments {
  /** Price factors from corporate actions: closes before `date` are multiplied by `factor` (0.5 for a 1:1 bonus). */
  factors?: Record<string, Array<{ date: string; factor: number }>>;
  /** Large one-day moves accepted as real (no corporate action): not treated as breaks. */
  accepted?: Record<string, string[]>;
}
export function computeStocks(days: BhavDay[], date: string, consecutive: (a: string, b: string) => boolean = () => true, opts: CorpAdjustments = {}): Record<string, StockStats> {
  if (!days.length || days[days.length - 1].date !== date) throw new Error(`stored sessions must end at ${date}`);
  const out: Record<string, StockStats> = {};
  // A PREV_CLOSE mismatch on a big share of stocks at once is a missed session in our store, never a corporate action.
  const marketWide = new Set<string>();
  for (let i = 1; i < days.length; i++) {
    let n = 0, m = 0;
    for (const [sym, r] of Object.entries(days[i].rows)) { const q = days[i - 1].rows[sym]; if (!q || !r[1]) continue; n++; if (Math.abs(r[1] - q[5]) / q[5] > 0.001) m++; }
    if (n >= 20 && m / n > 0.25) marketWide.add(days[i].date);
  }
  for (const sym of Object.keys(days[days.length - 1].rows)) {
    const dates: string[] = []; const raw: number[] = [];
    const factors: number[] = [];      // factors[i] applies to every close before index i
    let prevDay: BhavDay | null = null; const adjusted: string[] = [];
    for (const d of days) {
      const r = d.rows[sym];
      if (r) {
        const stored = prevDay?.rows[sym]?.[5];
        let f = 1;
        if (stored && prevDay && !marketWide.has(d.date) && consecutive(prevDay.date, d.date) && r[1] && Math.abs(r[1] - stored) / stored > 0.001) { f = r[1] / stored; adjusted.push(d.date); }
        for (const a of opts.factors?.[sym] ?? []) if (a.date === d.date) f *= a.factor;
        dates.push(d.date); raw.push(r[5]); factors.push(f);
      }
      prevDay = d;
    }
    // Back-adjust: close i is scaled by the product of the factors of all later events.
    const adj = raw.slice(); let cum = 1;
    for (let i = raw.length - 1; i >= 0; i--) { adj[i] = raw[i] * cum; cum *= factors[i]; }
    const n = adj.length, last = days[days.length - 1].rows[sym];
    const before = adj.slice(0, n - 1);   // dates before D
    // Breaks: index i where the adjusted close moved more than BREAK_PCT from the one before it (consecutive sessions only).
    const brkIdx: number[] = [];
    for (let i = 1; i < n; i++) {
      if (!consecutive(dates[i - 1], dates[i]) || marketWide.has(dates[i]) || (opts.accepted?.[sym] ?? []).includes(dates[i])) continue;
      if (Math.abs(adj[i] / adj[i - 1] - 1) * 100 > BREAK_PCT) brkIdx.push(i);
    }
    const lastBrk = brkIdx.length ? brkIdx[brkIdx.length - 1] : -1;
    // A window of k closes ending at index e (inclusive) starts at e-k+1; it is clean when the last break is at or before its start.
    const mean = (k: number): number | undefined => {
      if (before.length < k) return undefined;
      if (lastBrk > before.length - k) return undefined;
      return before.slice(-k).reduce((a, b) => a + b, 0) / k;
    };
    const s50 = mean(50), s200 = mean(200);
    const e10 = emaSeeded(adj, 10), e20 = emaSeeded(adj, 20);
    const sinceBrk = lastBrk < 0 ? n : n - lastBrk;   // closes since the last break
    const st: StockStats = {
      close: last[5], high: last[3], low: last[4], volume: last[6], prevClose: last[1], delivPct: last[7], series: last[0],
      maAsOf: n >= 2 ? dates[n - 2] : null, emaAsOf: date, emaWarm: sinceBrk >= 80, closes: n, adjusted, breaks: brkIdx.map((i) => dates[i]),
    };
    if (s50 !== undefined) st.sma50 = round2(s50);
    if (s200 !== undefined) st.sma200 = round2(s200);
    if (!Number.isNaN(e10)) st.ema10 = round2(e10);
    if (!Number.isNaN(e20)) st.ema20 = round2(e20);
    out[sym] = st;
  }
  return out;
}

export interface Break { symbol: string; date: string; index: number; prevDate: string; ratio: number }
/** Raw one-day moves beyond BREAK_PCT between consecutive stored sessions, for every symbol in the last stored session. */
export function detectBreaks(days: BhavDay[], consecutive: (a: string, b: string) => boolean = () => true, allSymbols = false): Break[] {
  const out: Break[] = [];
  const live = days[days.length - 1].rows;   // only stocks that trade in the last stored session
  const marketWide = new Set<string>();
  for (let i = 1; i < days.length; i++) {
    let n = 0, m = 0;
    for (const [sym, r] of Object.entries(days[i].rows)) { const q = days[i - 1].rows[sym]; if (!q || !r[1]) continue; n++; if (Math.abs(r[1] - q[5]) / q[5] > 0.001) m++; }
    if (n >= 20 && m / n > 0.25) marketWide.add(days[i].date);
  }
  for (let i = 1; i < days.length; i++) {
    if (marketWide.has(days[i].date) || !consecutive(days[i - 1].date, days[i].date)) continue;
    for (const [sym, r] of Object.entries(days[i].rows)) {
      if (!allSymbols && !(sym in live)) continue;   // live nightly job: only stocks still trading; history audits and backtests pass allSymbols so delisted names count
      const q = days[i - 1].rows[sym]; if (!q) continue;
      const ratio = r[5] / q[5];
      if (Math.abs(ratio - 1) * 100 > BREAK_PCT) out.push({ symbol: sym, date: days[i].date, index: i, prevDate: days[i - 1].date, ratio });
    }
  }
  return out;
}
