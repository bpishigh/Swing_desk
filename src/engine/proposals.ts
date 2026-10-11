// Proposed rules (Engine Rules change log C-29, C-30, C-31, C-32). None is a rule until tested and logged Adopted; each is gated by
// a switch in settings.ts that is OFF. These are pure functions: the caller supplies data and decides whether to use the result.
// C-33 and C-34 live in book.ts (currentLimits) because they change limits; OQ-8 is in setups.ts (LIMITS).
import { firstEntry, rPerShare, tradePnl, type Trade } from './journal.ts';
import type { Params } from './settings.ts';
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

// ---------- C-30: pending orders in open risk ----------
export interface PlannedTrade { status?: string; fullShares?: number; trigger?: number; stop0?: number; oneR?: number }
/**
 * Risk of orders placed but not yet filled: full planned size x (trigger - stop). Falls back to the stored 1R when a
 * field is missing. Feed the result to ntChecks as `pendingRiskRs`; the check then reads open + pending + this trade vs cap.
 */
export function pendingRiskRs(planned: PlannedTrade[]): number {
  return planned.filter((t) => t.status === undefined || t.status === 'planned').reduce((s, t) => {
    const r = ok(t.fullShares) && ok(t.trigger) && ok(t.stop0) ? t.fullShares * Math.max(0, t.trigger - t.stop0) : ok(t.oneR) ? t.oneR : 0;
    return s + r;
  }, 0);
}

// ---------- C-29: correlation control ----------
export interface Bar { date: string; close: number }
/** Close-to-close returns keyed by date; a return needs the previous row in the same series. Series are oldest first. */
function returnsByDate(s: Bar[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 1; i < s.length; i++) if (ok(s[i].close) && ok(s[i - 1].close) && s[i - 1].close !== 0) m.set(s[i].date, s[i].close / s[i - 1].close - 1);
  return m;
}
export function pearson(a: number[], b: number[]): number {
  const n = a.length; if (n < 3 || b.length !== n) return NaN;
  const ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}
/**
 * Correlation of daily returns over the last `window` common dates. NaN when fewer than 80% of the window overlaps
 * (not enough stored closes to say anything; callers must treat NaN as "unknown", never as "uncorrelated").
 */
export function seriesCorrelation(a: Bar[], b: Bar[], window: number): number {
  const ra = returnsByDate(a), rb = returnsByDate(b);
  const dates = [...ra.keys()].filter((d) => rb.has(d)).sort().slice(-window);
  if (dates.length < Math.ceil(window * 0.8)) return NaN;
  return pearson(dates.map((d) => ra.get(d)!), dates.map((d) => rb.get(d)!));
}
export interface CorrGroup { sectors: string[]; risk: number; share: number }
export interface CorrGuard { groups: CorrGroup[]; breach: boolean; worst: CorrGroup | null; unknown: string[]; totalRisk: number }
/**
 * At most `maxGroupShare` of open risk in one group of sectors whose returns correlate above `sectorThreshold`.
 * `riskBySector` must already include the trade being checked. Only sectors holding risk are linked. A group needs 2 or more
 * sectors to count: one sector alone is the job of the 3-per-sector rule. Pairs with too little history are listed in `unknown`
 * and are not linked.
 */
export function correlationGuard(riskBySector: Record<string, number>, closes: Record<string, Bar[]>, p: Params['correlation']): CorrGuard {
  const names = Object.keys(riskBySector).filter((k) => riskBySector[k] > 0);
  const total = names.reduce((s, k) => s + riskBySector[k], 0);
  const parent = new Map(names.map((n) => [n, n]));
  const find = (x: string): string => { let r = x; while (parent.get(r) !== r) r = parent.get(r)!; return r; };
  const unknown = new Set<string>();
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const a = closes[names[i]], b = closes[names[j]];
    const c = a && b ? seriesCorrelation(a, b, p.sectorWindow) : NaN;
    if (!ok(c)) { unknown.add(names[i]); unknown.add(names[j]); continue; }
    if (c > p.sectorThreshold) parent.set(find(names[i]), find(names[j]));
  }
  const by = new Map<string, string[]>();
  for (const n of names) { const r = find(n); by.set(r, [...(by.get(r) ?? []), n]); }
  const groups: CorrGroup[] = [...by.values()].filter((g) => g.length >= 2).map((g) => {
    const risk = g.reduce((s, k) => s + riskBySector[k], 0);
    return { sectors: g.sort(), risk, share: total > 0 ? risk / total : 0 };
  }).sort((a, b) => b.share - a.share);
  const worst = groups[0] ?? null;
  return { groups, breach: !!worst && worst.share > p.maxGroupShare, worst, unknown: [...unknown].sort(), totalRisk: total };
}
/** Challenger: flag open positions whose 60-day return correlation with the new stock is above the threshold. */
export function stockCorrelationFlags(candidate: Bar[], open: { sym: string; closes: Bar[] }[], p: Params['correlation']): { sym: string; corr: number }[] {
  return open.map((o) => ({ sym: o.sym, corr: seriesCorrelation(candidate, o.closes, p.stockWindow) })).filter((x) => ok(x.corr) && x.corr > p.stockThreshold);
}

// ---------- C-31: second Journal Test tier ----------
export interface Tier2 { tests: { k: string; pass: boolean; val: string }[]; n: number; costsRecorded: number; pass: boolean; profitFactor: number; expectancyR: number; maxDD: number }
/**
 * After-cost test for 100 closed trades: expectancy after costs above 0, profit factor and drawdown limit from settings.
 * `closed` is sorted by exit date, oldest first. Costs come from Trade.costs (unrecorded counts as 0; see costsRecorded).
 */
export function journalTier2(closed: Trade[], startCapital: number, p: Params['tier2']): Tier2 {
  let eq = startCapital, peak = eq, maxDD = 0, gw = 0, gl = 0, sumR = 0, nR = 0, costsRecorded = 0;
  for (const t of closed) {
    if (ok(t.costs)) costsRecorded++;
    const pnl = tradePnl(t) - (t.costs ?? 0);
    if (pnl > 0) gw += pnl; else gl += -pnl;
    eq += pnl; peak = Math.max(peak, eq); maxDD = Math.max(maxDD, ((peak - eq) / peak) * 100);
    const oneR = rPerShare(t) * (t.fullShares || 1);
    if (oneR > 0) { sumR += pnl / oneR; nR++; }
  }
  const n = closed.length;
  const profitFactor = gl > 0 ? gw / gl : gw > 0 ? Infinity : NaN;
  const expectancyR = nR ? sumR / nR : NaN;
  const tests = [
    { k: 'Closed trades', pass: n >= p.minTrades, val: `${n} of ${p.minTrades}` },
    { k: 'Expectancy after costs', pass: ok(expectancyR) && expectancyR > 0, val: ok(expectancyR) ? expectancyR.toFixed(2) + 'R' : '—' },
    { k: 'Profit factor', pass: profitFactor >= p.minProfitFactor, val: Number.isFinite(profitFactor) ? profitFactor.toFixed(2) : profitFactor === Infinity ? 'no losses' : '—' },
    { k: 'Drawdown from peak', pass: n > 0 && maxDD < p.maxDrawdownPct, val: maxDD.toFixed(1) + '%' },
  ];
  return { tests, n, costsRecorded, pass: tests.every((t) => t.pass), profitFactor, expectancyR, maxDD };
}

// ---------- C-32: intraday MAE and MFE ----------
export interface DayBar { date: string; high: number; low: number; close?: number }
export interface Excursions { maeR: number; mfeR: number; bars: number }
/**
 * Worst and best point of a trade in R, from daily lows and highs: (lowest low - first entry) / R and (highest high - first entry) / R.
 * Bars run from the session AFTER the entry date to the exit date (or the last bar if still open); the entry-day bar is left out
 * because the time of the fill inside that day is not known, so its low may come before the fill. NaN if R is not positive or there are no bars.
 */
export function excursions(t: Trade, bars: DayBar[]): Excursions {
  const R = rPerShare(t), E = firstEntry(t);
  const use = bars.filter((b) => (!t.entryDate || b.date > t.entryDate) && (!t.exitDate || b.date <= t.exitDate) && ok(b.high) && ok(b.low));
  if (!(R > 0) || !use.length) return { maeR: NaN, mfeR: NaN, bars: use.length };
  return { maeR: (Math.min(...use.map((b) => b.low)) - E) / R, mfeR: (Math.max(...use.map((b) => b.high)) - E) / R, bars: use.length };
}
/** The v9 basis for comparison: evening closes. */
export function closeExcursions(t: Trade, minClose?: number, maxClose?: number): Excursions {
  const R = rPerShare(t), E = firstEntry(t);
  return { maeR: ok(minClose) && R > 0 ? (minClose - E) / R : NaN, mfeR: ok(maxClose) && R > 0 ? (maxClose - E) / R : NaN, bars: 0 };
}
