// Regime traffic light. Implements Engine Rules "Regime traffic light" (exact definitions section).
// Ported from app v9 (trackRows/analyze/regimeFrom). `{ v9: true }` reproduces v9 exactly for the replay tests; the default follows
// the rules text where v9 did not (see RegimeOptions and docs/review-notes/2026-10-03-review-fixes.md).
import { WEEKDAYS, type Calendar } from './calendar.ts';

export type Level = 0 | 1 | 2; // 0 red, 1 yellow, 2 green
export const LEVEL_NAME = ['red', 'yellow', 'green'] as const;

export interface BenchmarkDay { close?: number; sma50?: number; sma200?: number }
export interface TrackerRow {
  date: string; // YYYY-MM-DD
  close?: number; high?: number; low?: number; volume?: number;
  sma50?: number; sma200?: number;
  b?: BenchmarkDay; // second benchmark (India: Nifty 500, US: QQQ)
  breadth?: number; vix?: number; skip?: boolean;
}

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const chgPct = (r?: TrackerRow, p?: TrackerRow): number =>
  ok(r?.close) && ok(p?.close) && p!.close ? ((r!.close - p!.close) / p!.close) * 100 : NaN;

/** Trend level of one benchmark: above both averages with the 50 rising = green; below both = red; else yellow. */
export function smaLevel(c?: number, s50?: number, s200?: number, rising?: boolean | null): Level | null {
  if (!ok(c) || !ok(s50) || !ok(s200)) return null;
  const a = c > s50, b = c > s200;
  if (a && b) return rising === true ? 2 : 1; // unknown rising counts as not rising until a second night of data
  if (!a && !b) return 0;
  return 1;
}

export interface DistDay { date: string; idx: number; close: number; chg: number }
export type FtdStatus = 'none' | 'active' | 'confirmed' | 'failed';
export interface Ftd { date: string; rallyLow: number; lowDate: string; day1: string; failDate?: string; why?: string }
/**
 * Options. `v9: true` reproduces app v9 exactly (used only by the replay tests): distribution volume compared with the previous row
 * even when that row is a skip day, follow-through low taken over the whole stored series, and all counts in rows. The default
 * follows the rules text: skip days are not used as the volume baseline, follow-through is only looked for inside a correction
 * (armed by an 8% fall from the 60-session high or by trend Red, C-35), and counts are sessions on `cal` (weekends and exchange holidays excluded).
 */
export interface RegimeOptions { v9?: boolean; cal?: Calendar; correction?: CorrectionParams }
/**
 * C-35 (hybrid, owner decision 3 Oct 2026). The correction tracker is ARMED when the benchmark closes `dropPct` or more below its highest
 * close of the last `windowSessions` sessions, or the trend test reads Red, whichever comes first; it is DISARMED when the benchmark
 * closes above the 60-session high it was armed under. At arming the low is the lowest low since the 60-session closing high, and day 1 and
 * the day count are replayed from that low (a follow-through on the arming day is valid; the rally-low test is never above the true low);
 * a new low after arming replaces the seeded one and restarts the count. `dropPct: 0` means trend Red alone.
 * UNTESTED STARTING VALUES (8 is O'Neil's intermediate-correction threshold); phase 6 backtest decides 8% versus trend Red alone.
 */
export interface CorrectionParams { dropPct: number; windowSessions: number }
export const DEFAULT_CORRECTION: CorrectionParams = { dropPct: 8, windowSessions: 60 };

export interface Analysis {
  dist: DistDay[]; active: DistDay[]; expiredEarly: DistDay[];
  ftd: Ftd | null; status: FtdStatus; ftdIdx: number; since: number | null;
}

/** Distribution days and follow-through state over the tracker rows (oldest first). */
export function analyze(rows: TrackerRow[], opts: RegimeOptions = {}): Analysis {
  const v9 = !!opts.v9, cal = opts.cal ?? WEEKDAYS;
  const n = rows.length, last = n - 1;
  /** Row whose volume a session is compared with: the previous row (v9) or the previous non-skip row (rules: skip days are excluded). */
  const volBase = (i: number): TrackerRow | undefined => {
    if (v9) return rows[i - 1];
    for (let k = i - 1; k >= 0; k--) if (!rows[k].skip) return rows[k];
    return rows[i - 1];
  };
  /** Sessions from row i to row j (v9: row count). */
  const gap = (i: number, j: number): number => (v9 ? j - i : cal.sessionsBetween(rows[i].date, rows[j].date));
  const dist: DistDay[] = [];
  rows.forEach((r, i) => {
    const p = rows[i - 1];
    if (!p || r.skip) return;
    const c = chgPct(r, p), vb = volBase(i);
    if (ok(c) && c <= -0.2 && ok(r.volume) && vb && ok(vb.volume) && r.volume > vb.volume)
      dist.push({ date: r.date, idx: i, close: r.close as number, chg: c });
  });
  const inWindow = (d: DistDay) => gap(d.idx, last) < 25;
  const lifted = (d: DistDay) => rows.slice(d.idx + 1).some((x) => ok(x.close) && x.close >= d.close * 1.05);
  const active = dist.filter((d) => inWindow(d) && !lifted(d));
  const expiredEarly = dist.filter((d) => inWindow(d) && lifted(d));

  let low: TrackerRow | null = null, day1: TrackerRow | null = null, cnt = 0;
  let ftd: Ftd | null = null, status: FtdStatus = 'none', ftdIdx = -1;
  const corr = opts.correction ?? DEFAULT_CORRECTION;
  let armed = false, refHigh = 0; // rules mode: correction tracker armed (C-35)
  const clear = () => { low = null; day1 = null; cnt = 0; ftd = null; status = 'none'; ftdIdx = -1; };
  /** Highest close of the last `windowSessions` sessions up to row i, and the (latest) row that made it. */
  const high60 = (i: number): { h: number; k: number } => {
    let h = -Infinity, hk = i;
    for (let k = i; k >= 0; k--) {
      if (cal.sessionsBetween(rows[k].date, rows[i].date) >= corr.windowSessions) break;
      if (ok(rows[k].close) && (rows[k].close as number) > h) { h = rows[k].close as number; hk = k; }
    }
    return { h, k: hk };
  };
  /** Follow-through tracker for one row (the low, day 1 and day count are replayed from the seeded low when the tracker arms). */
  const step = (i: number): void => {
    const r = rows[i], p = rows[i - 1];
    if (ftd && (status === 'active' || status === 'confirmed')) {
      if ((r.close as number) < ftd.rallyLow) {
        status = 'failed';
        ftd = { ...ftd, failDate: r.date, why: 'index closed below the rally low' };
        low = r; day1 = null; cnt = 0; return;
      }
      if (status === 'active') {
        if ((r.breadth as number) > 50) status = 'confirmed';
        else if (gap(ftdIdx, i) >= 10) { status = 'failed'; ftd = { ...ftd, failDate: r.date, why: "breadth didn't reach 50% within 10 sessions" }; }
      }
      if (status === 'active' || status === 'confirmed') return;
    }
    if (!low || (r.low as number) < (low.low as number)) { low = r; day1 = null; cnt = 0; return; }
    if (!day1) { if (p && (r.close as number) > (p.high as number)) { day1 = r; cnt = 1; } return; }
    cnt = v9 ? cnt + 1 : cal.sessionsBetween(day1.date, r.date) + 1;
    const c = chgPct(r, p), vb = volBase(i);
    if (cnt >= 4 && !r.skip && ok(c) && c >= 1.25 && vb && (r.volume as number) > (vb.volume as number)) {
      ftd = { date: r.date, rallyLow: low.low as number, lowDate: low.date, day1: day1.date };
      ftdIdx = i;
      status = (r.breadth as number) > 50 ? 'confirmed' : 'active';
    }
  };
  for (let i = 0; i < n; i++) {
    const r = rows[i];
    if (v9) { step(i); continue; }
    if (!ok(r.close)) continue;
    const { h, k } = high60(i);
    if (!armed) {
      const redTrend = smaLevel(r.close, r.sma50, r.sma200, null) === 0; // unknown averages: only the drop test can arm
      const dropped = corr.dropPct > 0 && r.close <= h * (1 - corr.dropPct / 100);
      if (redTrend || dropped) {
        armed = true; refHigh = h; clear();
        // Seed: the correction low is the lowest low since the 60-session closing high, and day 1 / the day count are replayed from it.
        let lk = k;
        for (let j = k; j <= i; j++) if (ok(rows[j].low) && (rows[j].low as number) < (rows[lk].low as number)) lk = j;
        for (let j = lk; j <= i; j++) step(j);
        continue;
      }
    } else if (r.close > refHigh) { armed = false; clear(); continue; }
    if (armed) step(i);
  }
  return { dist, active, expiredEarly, ftd, status, ftdIdx, since: ftdIdx >= 0 ? gap(ftdIdx, last) : null };
}

export interface RegimeResult {
  incomplete?: false; lv: Level; name: (typeof LEVEL_NAME)[number]; notes: string[];
  sma: Level; la: Level; lb: Level | null; risingA: boolean | null; risingB: boolean | null;
  breadth: number; breadthDate?: string; analysis: Analysis; carriedFrom: string | null;
}
export interface RegimeIncomplete { incomplete: true; row: TrackerRow }

/** Regime for the latest row, using all rows up to and including it (oldest first). */
export function regimeFrom(rows: TrackerRow[], opts: RegimeOptions = {}): RegimeResult | RegimeIncomplete | null {
  if (!rows.length) return null;
  let r = rows[rows.length - 1];
  const prev = rows.slice(0, -1).reverse();
  let carried: string | null = null;
  if (!(ok(r.sma50) && ok(r.sma200))) {
    // tonight's averages not published yet: use the newest of the last 5 earlier rows that has both
    const src = prev.slice(0, 5).find((x) => ok(x.sma50) && ok(x.sma200));
    if (src) { r = { ...r, sma50: src.sma50, sma200: src.sma200 }; carried = src.date; }
  }
  const pa = prev.find((x) => ok(x.sma50));
  const pb = prev.find((x) => x.b && ok(x.b.sma50));
  const risingA = pa ? (r.sma50 as number) > (pa.sma50 as number) : null;
  const risingB = pb && r.b ? (r.b.sma50 as number) > (pb.b!.sma50 as number) : null;
  const la = smaLevel(r.close, r.sma50, r.sma200, risingA);
  const lb = r.b ? smaLevel(r.b.close, r.b.sma50, r.b.sma200, risingB) : null;
  if (la == null) return { incomplete: true, row: r };
  const sma = (lb == null ? la : Math.min(la, lb)) as Level;
  const A = analyze(rows, opts);
  const notes: string[] = [];
  let lv: Level = sma;
  if (sma === 0 && (A.status === 'active' || A.status === 'confirmed')) { lv = 1; notes.push('follow-through lifts Red to Yellow'); }
  if (A.active.length >= 5 && lv > 1) { lv = 1; notes.push(`${A.active.length} distribution days cap at Yellow`); }
  const brRow = rows.slice(-3).reverse().find((x) => ok(x.breadth));
  const br = brRow ? (brRow.breadth as number) : NaN;
  if (ok(br) && br < 40 && lv > 1) { lv = 1; notes.push(`breadth ${br}% below 40 caps at Yellow`); }
  return { lv, name: LEVEL_NAME[lv], notes, sma, la, lb, risingA, risingB, breadth: br, breadthDate: brRow?.date, analysis: A, carriedFrom: carried };
}

/** India VIX above 20 halves risk per trade (India only). */
export const vixHalvesRisk = (vix?: number): boolean => ok(vix) && vix > 20;
