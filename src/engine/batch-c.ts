// Batch C signal rules (docs/BATCH_C_RULES.md, adopted as C-208 to C-211). Pure: data in, orders out.
// Package 21, delivery accumulation (C-210): delivery % at least 1.5x its own prior 20-session average, close up at least 2% on the day, close above its 50-session average, top 500, normal series (EQ) on the signal day and across the average. Rank by the ratio. Entry next open; hold 20 sessions; stop 3 x ATR(20) capped at 15% (C-213, replacing C-159's 8% cap); at most 20 names; wide stop skipped and logged.
import { BOOK } from './stock-book.ts';
import { atrN, type Orders, type Name } from './first-wave.ts';
import { BA, orNull, byValue, type BCtx } from './batch-a.ts';
import type { Buy } from './stock-book.ts';

export const BC = { ratio: 1.5, rise: 0.02, avgWin: 20, minAvg: 15, maWin: 50, hold: 20, names: 20, stopCap: 0.15 };
/** C-213 (owner, 15 Nov 2026): this book's stop is 3 x ATR(20), capped at 15% (C-159's 8% cap skipped 94% of signals in the C-212 replay). Wider than 15% is skipped and logged. */
export const wideStop = (atr20: number, close: number): number | null => { if (!(atr20 > 0) || !(close > 0)) return null; const w = BOOK.atrMult * atr20 / close; return w <= BC.stopCap ? w : null; };
/** Per-name delivery history aligned to the session list: p = delivery % (NaN = missing), eq = 1 when the name was in the normal series that day. */
export interface Deliv { p: ArrayLike<number>; eq: ArrayLike<number> }
export type Tag = 'results' | 'deal' | 'expiry';
export interface DelivLogRow { date: string; sym: string; ratio: number; reaction: number; tags: Tag[]; taken: boolean; why: string }
export interface DelivEnv { deliv: Map<string, Deliv>; tags: (sym: string, t: number) => Tag[] }

/** Ratio of tonight's delivery % to the mean of the prior 20 sessions, or null when the name fails the normal-series or coverage conditions. */
export function deliveryRatio(d: Deliv, t: number): number | null {
  if (t < BC.avgWin || !(d.p[t] >= 0) || d.eq[t] !== 1) return null;
  let s = 0, k = 0;
  for (let i = t - BC.avgWin; i < t; i++) { const v = d.p[i]; if (!(v >= 0)) continue; if (d.eq[i] !== 1) return null; s += v; k++; }
  if (k < BC.minAvg) return null;
  const m = s / k; return m > 0 ? d.p[t] / m : null;
}

export function deliveryAccum(x: BCtx, env: DelivEnv, log?: DelivLogRow[]): Orders | null {
  const { t } = x, D = x.dates[t], sells: string[] = [], buys: Buy[] = [];
  for (const [sym, p] of Object.entries(x.st.pos)) { const i = x.dates.indexOf(p.entryDate); if (i >= 0 && t - i + 1 >= BC.hold) sells.push(sym); }
  const cand: Array<Name & { ratio: number; reaction: number }> = [];
  for (const n of x.el) {
    const d = env.deliv.get(n.sym), s = x.series.get(n.sym); if (!d || !s) continue;
    const c = s.c; if (!(c[t] > 0) || !(c[t - 1] > 0) || c[t] / c[t - 1] - 1 < BC.rise) continue;
    let m = 0, k = 0; for (let i = t - BC.maWin + 1; i <= t; i++) if (c[i] > 0) { m += c[i]; k++; }
    if (k < BC.maWin * 0.8 || !(c[t] > m / k)) continue;
    const r = deliveryRatio(d, t); if (r == null || r < BC.ratio) continue;
    cand.push({ ...n, ratio: r, reaction: c[t] / c[t - 1] - 1 });
  }
  cand.sort((a, b) => b.ratio - a.ratio || byValue(a, b));
  const room = BC.names - (x.held.size - sells.length);
  for (const n of cand) {
    const s = x.series.get(n.sym)!, base = { date: D, sym: n.sym, ratio: Math.round(n.ratio * 100) / 100, reaction: Math.round(n.reaction * 1e4) / 1e4, tags: env.tags(n.sym, t) };
    if (x.held.has(n.sym)) { log?.push({ ...base, taken: false, why: 'already held' }); continue; }
    const st = wideStop(atrN(s, t), s.c[t]);
    if (st === null) { log?.push({ ...base, taken: false, why: 'stop too wide' }); continue; }
    if (buys.length >= room) { log?.push({ ...base, taken: false, why: 'no slot' }); continue; }
    buys.push({ sym: n.sym, value: n.value, stop: st }); log?.push({ ...base, taken: true, why: 'bought next open' });
  }
  return orNull({ buys, sells });
}

/** Monthly derivatives expiry session: the last Thursday of the month (Tuesday from September 2025), or the session before it when that day was a holiday. Monthly only; weekly expiries are not tagged. */
export function expiryDays(dates: string[]): Set<string> {
  const out = new Set<string>(), set = new Set(dates), byMonth = new Map<string, string[]>();
  for (const d of dates) { const a = byMonth.get(d.slice(0, 7)) ?? []; a.push(d); byMonth.set(d.slice(0, 7), a); }
  for (const [m, a] of byMonth) {
    const [y, mo] = m.split('-').map(Number), dow = d0(y, mo) , want = m >= '2025-09' ? 2 : 4;
    void dow; const last = new Date(Date.UTC(y, mo, 0)); const back = (last.getUTCDay() - want + 7) % 7; last.setUTCDate(last.getUTCDate() - back);
    let iso = last.toISOString().slice(0, 10); while (!set.has(iso) && iso >= a[0]) { const q = new Date(iso + 'T00:00:00Z'); q.setUTCDate(q.getUTCDate() - 1); iso = q.toISOString().slice(0, 10); }
    if (set.has(iso) && iso.slice(0, 7) === m) out.add(iso);
  }
  return out;
}
const d0 = (y: number, mo: number): number => new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
void BA;

// ---- Package 20, bulk and block deals (C-211). Forward only. A buy row of at least Rs 10 crore in a top-500 name, kept by behaviour first (round trip known at entry, running list), keywords second; fund-type buyers tagged. Entry next open, hold 60 sessions, C-159 stop.
import type { Deal } from '../ingest/exchange-log.ts';
import { shortStop } from './stock-book.ts';
export const BD = { minValue: 1e8, hold: 60, names: 20, lookbackSessions: 5, keywords: ['SECURITIES', 'CAPITAL MARKETS', 'TRADING', 'BROKING', 'PROPRIETARY', 'ARBITRAGE', 'ALGO', 'QUANT'], funds: /MUTUAL FUND|\bMF\b|ASSET MANAGEMENT|INSURANCE|LIFE INSURANCE|PENSION|PROVIDENT|\bAMC\b|\bLIC\b/ };
export interface DealRow extends Deal { kind: 'bulk' | 'block' }
export interface DealLogRow { date: string; sym: string; client: string; kind: string; value: number; price: number; taken: boolean; why: string; buyer: 'fund' | 'other'; promoterTag: boolean; sameDaySells: number; gap: number | null }
const norm = (c: string): string => c.toUpperCase().replace(/\s+/g, ' ').trim();
/** Clients seen on both sides of one stock within 5 sessions of each other anywhere in the log up to `upTo` (the running list). */
export function roundTrippers(log: DealRow[], dates: string[], upTo: string): Set<string> {
  const pos = new Map(dates.map((d, i) => [d, i])), by = new Map<string, Array<{ i: number; side: string }>>(), out = new Set<string>();
  for (const r of log) { if (r.date > upTo || !pos.has(r.date)) continue; const k = norm(r.client) + '|' + r.symbol; const a = by.get(k) ?? []; a.push({ i: pos.get(r.date)!, side: r.side.toUpperCase() }); by.set(k, a); }
  for (const [k, a] of by) { for (const b of a) if (b.side === 'BUY') for (const s of a) if (s.side === 'SELL' && Math.abs(s.i - b.i) <= BD.lookbackSessions) out.add(k.split('|')[0]); }
  return out;
}
export interface DealEnv { log: DealRow[]; open: (sym: string, t: number) => number; counts?: { kept: number; roundTrip: number; keyword: number; promoter: number; small: number } }
export function dealBook(x: BCtx, env: DealEnv, rows: DealRow[], log?: DealLogRow[]): Orders | null {
  const { t } = x, D = x.dates[t], sells: string[] = [], buys: Buy[] = [], inTop = new Map(x.el.map((n) => [n.sym, n]));
  for (const [sym, p] of Object.entries(x.st.pos)) { const i = x.dates.indexOf(p.entryDate); if (i >= 0 && t - i + 1 >= BD.hold) sells.push(sym); }
  const trips = roundTrippers(env.log, x.dates, D), pos = new Map(x.dates.map((d, i) => [d, i])), c = env.counts ?? { kept: 0, roundTrip: 0, keyword: 0, promoter: 0, small: 0 };
  const sold = (sym: string, client: string, di: number): boolean => env.log.some((r) => r.symbol === sym && r.side.toUpperCase() === 'SELL' && norm(r.client) === norm(client) && pos.has(r.date) && pos.get(r.date)! <= di && pos.get(r.date)! >= di - BD.lookbackSessions);
  const agg = new Map<string, { sym: string; client: string; kind: string; value: number; units: number; price: number; date: string }>();
  for (const r of rows) { if (r.side.toUpperCase() !== 'BUY' || !inTop.has(r.symbol)) continue; const k = r.symbol + '|' + norm(r.client), a = agg.get(k); const v = r.units * r.price; if (a) { a.value += v; a.units += r.units; a.price = a.value / a.units; } else agg.set(k, { sym: r.symbol, client: r.client, kind: r.kind, value: v, units: r.units, price: r.price, date: r.date }); }
  const cands = [...agg.values()].filter((a) => { if (a.value >= BD.minValue) return true; c.small++; return false; }).sort((a, b) => b.value - a.value || (a.sym < b.sym ? -1 : 1));
  const room = BD.names - (x.held.size - sells.length), taken = new Set<string>();
  for (const a of cands) {
    const di = pos.get(a.date) ?? t, sameDaySells = rows.filter((r) => r.symbol === a.sym && r.side.toUpperCase() === 'SELL' && r.units * r.price >= BD.minValue).length;
    const kw = BD.keywords.some((w) => norm(a.client).includes(w)), buyer: 'fund' | 'other' = BD.funds.test(norm(a.client)) ? 'fund' : 'other';
    const base = { date: a.date, sym: a.sym, client: a.client, kind: a.kind, value: Math.round(a.value), price: Math.round(a.price * 100) / 100, buyer, promoterTag: kw && buyer === 'other', sameDaySells, gap: null as number | null };
    if (sold(a.sym, a.client, di) || trips.has(norm(a.client))) { c.roundTrip++; log?.push({ ...base, taken: false, why: 'round trip' }); continue; }
    if (kw) { c.keyword++; if (base.promoterTag) c.promoter++; log?.push({ ...base, taken: false, why: 'keyword (' + (buyer === 'fund' ? 'fund' : 'possible promoter entity') + ')' }); continue; }
    if (x.held.has(a.sym) || taken.has(a.sym)) { log?.push({ ...base, taken: false, why: 'already held' }); continue; }
    const s = x.series.get(a.sym), st = s ? shortStop(atrN(s, t), s.c[t]) : null;
    if (st === null) { log?.push({ ...base, taken: false, why: 'stop too wide' }); continue; }
    if (buys.length >= room) { log?.push({ ...base, taken: false, why: 'no slot' }); continue; }
    c.kept++; taken.add(a.sym); buys.push({ sym: a.sym, value: inTop.get(a.sym)!.value, stop: st }); log?.push({ ...base, taken: true, why: 'bought next open' });
  }
  return orNull({ buys, sells });
}

// ---- C-61 earnings run-up, as a paper book (owner request 15 Nov 2026). Signal exactly as the frozen C-61 config: ran up into results (above the frozen cut over the market) AND a reaction day at least +2% over the market; both are computed by scripts/earnings-forward.mjs and logged as events. The book takes each signal on the close of its entry session (the close after the reaction), fills at the next open, holds 20 sessions then sells at the next open, with the 25% long-hold stop instead of C-61's no stop, tier costs instead of C-61's flat 0.4%. Those three differences are why this book's numbers will not equal the C-61 test's.
export interface RunupEvent { s: string; d: string; entry: string; px: number; run: number; rea: number; signal: boolean }
export interface RunupLogRow { date: string; sym: string; resultsDate: string; run: number; rea: number; taken: boolean; why: string }
export const RUNUP = { hold: 20, names: 20 };
export function runupBook(x: BCtx, events: RunupEvent[], log?: RunupLogRow[]): Orders | null {
  const { t } = x, D = x.dates[t], sells: string[] = [], buys: Buy[] = [];
  for (const [sym, p] of Object.entries(x.st.pos)) { const i = x.dates.indexOf(p.entryDate); if (i >= 0 && t - i + 1 >= RUNUP.hold) sells.push(sym); }
  const room = RUNUP.names - (x.held.size - sells.length);
  const cands = events.filter((e) => e.signal && e.entry === D).sort((a, b) => b.run - a.run || (a.s < b.s ? -1 : 1));
  const value = (sym: string): number | null => { const s = x.series.get(sym); if (!s?.v) return null; const a: number[] = []; for (let i = t - 19; i <= t; i++) if (s.c[i] > 0 && s.v[i] > 0) a.push(s.c[i] * s.v[i]); if (a.length < 10) return null; a.sort((p, q) => p - q); return a[Math.floor(a.length / 2)]; };
  for (const e of cands) {
    const base = { date: D, sym: e.s, resultsDate: e.d, run: e.run, rea: e.rea }, v = value(e.s);
    if (x.held.has(e.s)) { log?.push({ ...base, taken: false, why: 'already held' }); continue; }
    if (v == null) { log?.push({ ...base, taken: false, why: 'no price history' }); continue; }
    if (buys.length >= room) { log?.push({ ...base, taken: false, why: 'no slot' }); continue; }
    buys.push({ sym: e.s, value: v, stop: BOOK.longStop }); log?.push({ ...base, taken: true, why: 'bought next open' });
  }
  return orNull({ buys, sells });
}

// ---- Package 15b, Minervini-exact trend template book (docs/MINERVINI_BOOK.md v3, adopted by the owner 15 Nov 2026). The eight published tests at their minimums, every passer held at equal weight as at most 100 slots of 1%, monthly review, exit at a review when any test fails, 25% long-hold stop. RS = the US scan's weighted four-quarter return (0.4, 0.2, 0.2, 0.2; quarter 63 sessions) ranked as a percentile across every stored stock meeting the price (Rs 20), history (260 sessions) and liquidity (Rs 5 crore median traded value) floors. Tests 6 and 7 use intraday lows and highs.
import { isMonthStart } from './first-wave.ts';
export const MV = { slots: 100, weight: 0.01, quarter: 63, rsW: [0.4, 0.2, 0.2, 0.2], rsMin: 70, rising: 21, lowPct: 0.30, highPct: 0.25, year: 252 };
const okn = (v: number): boolean => v > 0;
const smaAt = (c: ArrayLike<number>, t: number, n: number): number => { if (t - n + 1 < 0) return NaN; let s = 0; for (let i = t - n + 1; i <= t; i++) { if (!okn(c[i])) return NaN; s += c[i]; } return s / n; };
/** Weighted four-quarter return, or NaN when any of the five closes is missing. */
export function weightedRs(c: ArrayLike<number>, t: number): number {
  const p = [0, 1, 2, 3, 4].map((k) => c[t - k * MV.quarter]); if (t - 4 * MV.quarter < 0 || !p.every(okn)) return NaN;
  return MV.rsW[0] * (p[0] / p[1] - 1) + MV.rsW[1] * (p[1] / p[2] - 1) + MV.rsW[2] * (p[2] / p[3] - 1) + MV.rsW[3] * (p[3] / p[4] - 1);
}
export function percentiles(m: Map<string, number>): Map<string, number> {
  const v = [...m.values()].sort((a, b) => a - b), n = v.length, out = new Map<string, number>();
  for (const [k, x] of m) { let lo = 0, hi = n; while (lo < hi) { const mid = (lo + hi) >> 1; if (v[mid] < x) lo = mid + 1; else hi = mid; } out.set(k, n > 1 ? (100 * lo) / (n - 1) : 100); }
  return out;
}
/** Tests 1 to 7 on one name (test 8 is the rank, applied by the caller). Null when history is short. */
export function templateSeven(s: Ser, t: number, rising = MV.rising): boolean | null {
  const c = s.c, h = s.h ?? s.c, l = s.l ?? s.c; if (!okn(c[t])) return null;
  const s50 = smaAt(c, t, 50), s150 = smaAt(c, t, 150), s200 = smaAt(c, t, 200), s200b = smaAt(c, t - rising, 200); if (![s50, s150, s200, s200b].every(Number.isFinite)) return null;
  let hi = -Infinity, lo = Infinity; for (let i = t - MV.year + 1; i <= t; i++) { if (i < 0 || !okn(h[i]) || !okn(l[i])) return null; if (h[i] > hi) hi = h[i]; if (l[i] < lo) lo = l[i]; }
  const p = c[t]; return p > s150 && p > s200 && s150 > s200 && s200 > s200b && s50 > s150 && s50 > s200 && p > s50 && p >= lo * (1 + MV.lowPct) && p >= hi * (1 - MV.highPct);
}
export interface MvStats { month: string; ranked: number; passing: number }
/** x.el must be the wide eligible list (price, history and liquidity floors only), not the top 500. */
export interface MvOpts { rising?: number; rsMin?: number; gateOff?: boolean; buffer?: boolean }
export function minerviniPassers(x: BCtx, o: MvOpts = {}): Array<Name & { rs: number }> {
  const rs = new Map<string, number>(); for (const n of x.el) { const s = x.series.get(n.sym); if (!s) continue; const v = weightedRs(s.c, x.t); if (Number.isFinite(v)) rs.set(n.sym, v); }
  const pc = percentiles(rs), out: Array<Name & { rs: number }> = [];
  for (const n of x.el) { const r = pc.get(n.sym), s = x.series.get(n.sym); if (r == null || !s || r < (o.rsMin ?? MV.rsMin)) continue; if (templateSeven(s, x.t, o.rising ?? MV.rising) === true) out.push({ ...n, rs: r }); }
  return out;
}
export function minervini(x: BCtx, stats?: MvStats[], o: MvOpts = {}): Orders | null {
  if (!(isMonthStart(x.dates, x.t) || (!x.st.started && x.held.size === 0))) return null;
  if (o.gateOff) { stats?.push({ month: x.dates[x.t].slice(0, 7), ranked: x.el.length, passing: 0 }); return orNull({ buys: [], sells: [...x.held] }); }   // G: the market is below its 200-day average, so cash
  const pass = minerviniPassers(x, o), ok = new Map(pass.map((n) => [n.sym, n]));
  stats?.push({ month: x.dates[x.t].slice(0, 7), ranked: x.el.length, passing: pass.length });
  const fails = (x.st.mvFail ??= {}); let sells = [...x.held].filter((s) => !ok.has(s));
  if (o.buffer) { const next: Record<string, number> = {}; sells = sells.filter((s) => { if ((fails[s] ?? 0) >= 1) return true; next[s] = 1; return false; }); x.st.mvFail = next; }   // B: a failing name goes only after a second failed review in a row
  const keep = x.held.size - sells.length, room = MV.slots - keep;
  const fresh = pass.filter((n) => !x.held.has(n.sym)).sort((a, b) => b.value - a.value || (a.sym < b.sym ? -1 : 1)).slice(0, Math.max(0, room));
  return orNull({ buys: fresh.map((n) => ({ sym: n.sym, value: n.value, stop: BOOK.longStop })), sells });
}
