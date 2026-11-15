// Minervini-style base and buy point (package 36b, docs/MINERVINI_SEPA.md v3). Pure functions, no orders yet: used by the count-only run first.
// Published (owner's source sheet, both books): 2 to 6 contractions, each about half the last; base 3 to 65 weeks; depth mostly 10% to 35%, some 40%, 60%+ excluded; avoid a base deeper than 2 to 3 times the market's own decline; forms after a 30% to 50% advance; volume below its 50-day average on the last contraction; final contractions in the worked examples run 2% to 8%; flat base 10% to 15% deep and 4 to 7 weeks long needs no contractions; buy as price trades above the pivot's high.
// Desk figures (not published, labelled so): swing filter 2%, each contraction at most 75% of the one before, base depth at most 40%, depth at most 3 times the market's decline (floor 5%), pivot at most 5% above on the signal day, breakout volume at least 150% of the 50-session average.
import type { Ser, Orders, Name } from './first-wave.ts';
import { weightedRs, percentiles, templateSeven, MV } from './batch-c.ts';
import type { BookState } from './stock-book.ts';
export const SEPA = { minBase: 15, maxBase: 325, swing: 0.02, shrink: 0.75, maxDepth: 0.40, mktMult: 3, mktFloor: 0.05, finalMax: 0.08, flatMin: 20, flatMax: 35, flatDepth: 0.15, maxAbove: 0.05, volMult: 1.5, priorAdv: 0.30, minContr: 2, maxContr: 6, avgWin: 50 };
const pos = (v: number): boolean => v > 0;
const avg = (a: ArrayLike<number>, from: number, to: number): number => { let s = 0, k = 0; for (let i = from; i <= to; i++) if (pos(a[i])) { s += a[i]; k++; } return k ? s / k : NaN; };
export interface Base { kind: 'contraction' | 'flat'; pivot: number; depth: number; length: number; contractions: number[]; finalDepth: number | null }
/** Zigzag the highs and lows from the base high at index ih up to t-1; return completed contractions as [highIdx, lowIdx, depth]. */
export function contractions(h: ArrayLike<number>, l: ArrayLike<number>, ih: number, t: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = []; let hi = ih, lo = ih + 1, mode: 'down' | 'up' = 'down', th = ih;
  for (let i = ih + 1; i < t; i++) {
    if (mode === 'down') { if (l[i] < l[lo] || lo <= hi) lo = i; if (h[i] >= l[lo] * (1 + SEPA.swing) && i > lo) { out.push([hi, lo, (h[hi] - l[lo]) / h[hi]]); mode = 'up'; th = i; } }
    else { if (h[i] > h[th]) th = i; if (l[i] <= h[th] * (1 - SEPA.swing)) { hi = th; lo = i; mode = 'down'; } }
  }
  return out;
}
/** A valid base ending before session t whose pivot the close at t has just crossed, or null. idx = index closes aligned to the series, for the depth-against-market test. */
export function baseAt(s: Ser, t: number, idx?: ArrayLike<number>): Base | null {
  const c = s.c; if (!pos(c[t]) || t < SEPA.maxBase + 20) return null;
  return contractionBase(s, t, idx) ?? flatBase(s, t);
}
function flatBase(s: Ser, t: number): Base | null {
  const c = s.c, h = s.h ?? s.c, l = s.l ?? s.c;
  // flat base: 20 to 35 sessions, depth within 15%, closing above the window's high for the first time
  for (let n = SEPA.flatMin; n <= SEPA.flatMax; n++) {
    let hi = -Infinity, lo = Infinity; for (let i = t - n; i < t; i++) { if (!pos(h[i]) || !pos(l[i])) { hi = NaN; break; } if (h[i] > hi) hi = h[i]; if (l[i] < lo) lo = l[i]; }
    if (!Number.isFinite(hi)) continue; const d = (hi - lo) / hi; let ihi = t - n; for (let i = t - n; i < t; i++) if (h[i] >= hi) { ihi = i; break; }
    if (ihi > t - 5) continue;   // sideways, not a run-up: the range high was set at least 5 sessions ago
    if (d <= SEPA.flatDepth && c[t] > hi && c[t] <= hi * (1 + SEPA.maxAbove) && priorAdvance(c, t - n)) return { kind: 'flat', pivot: hi, depth: d, length: n, contractions: [], finalDepth: null };
  }
  return null;
}
function contractionBase(s: Ser, t: number, idx?: ArrayLike<number>): Base | null {
  const c = s.c, h = s.h ?? s.c, l = s.l ?? s.c;
  // contraction base: highest high in the last 325 sessions that is at least 15 sessions old
  let ih = -1, best = -Infinity; for (let i = Math.max(0, t - SEPA.maxBase); i <= t - SEPA.minBase; i++) if (h[i] > best) { best = h[i]; ih = i; }
  if (ih < 0) return null; const cs = contractions(h, l, ih, t); if (cs.length < SEPA.minContr || cs.length > SEPA.maxContr) return null;
  for (let k = 1; k < cs.length; k++) if (!(cs[k][2] <= cs[k - 1][2] * SEPA.shrink)) return null;
  const last = cs[cs.length - 1], pivot = h[last[0]], fin = last[2]; if (fin > SEPA.finalMax) return null;
  let lo = Infinity; for (let i = ih; i < t; i++) if (pos(l[i]) && l[i] < lo) lo = l[i]; const depth = (h[ih] - lo) / h[ih]; if (depth > SEPA.maxDepth) return null;
  for (let i = last[1] + 1; i < t; i++) if (h[i] > pivot) return null;   // an earlier session already traded above the pivot: not the first breakout
  if (!(c[t] > pivot && c[t] <= pivot * (1 + SEPA.maxAbove)) || !priorAdvance(c, ih)) return null;
  if (idx) { let ih0 = idx[ih], mn = Infinity, pk = ih0; for (let i = ih; i < t; i++) { if (idx[i] > pk) pk = idx[i]; if (idx[i] < mn) mn = idx[i]; } const md = pk > 0 ? (pk - mn) / pk : 0; if (depth > SEPA.mktMult * Math.max(md, SEPA.mktFloor)) return null; }
  return { kind: 'contraction', pivot, depth, length: t - ih, contractions: cs.map((x) => x[2]), finalDepth: fin };
}
/** Up at least 30% from the lowest close of the prior 252 sessions to the close at the base start. */
export function priorAdvance(c: ArrayLike<number>, i0: number): boolean { let lo = Infinity; for (let i = Math.max(0, i0 - 252); i <= i0; i++) if (pos(c[i]) && c[i] < lo) lo = c[i]; return pos(c[i0]) && c[i0] >= lo * (1 + SEPA.priorAdv); }
/** Breakout volume: today's volume at least 150% of the prior 50-session average. */
export const breakoutVolume = (v: ArrayLike<number>, t: number): boolean => { const a = avg(v, t - SEPA.avgWin, t - 1); return pos(v[t]) && a > 0 && v[t] >= SEPA.volMult * a; };
/** Volume on the last contraction below the 50-session average (published); averaged over the contraction's sessions. */
export const volumeDriedUp = (v: ArrayLike<number>, from: number, to: number, t: number): boolean => { const a = avg(v, t - SEPA.avgWin, t - 1), r = avg(v, from, to); return a > 0 && r < a; };

// ---- Flat-base book (package 36b, owner "go" 15 Nov 2026; docs/MINERVINI_SEPA.md v3, flat-base setups only) ----
export const SF = { slots: 6, risk: 0.0125, posCap: 0.25, eMin: 0.25, lowPct: 0.25, dryWin: 10, cooldown: 35 };
export interface FlatSetup { pivot: number; low: number; depth: number; length: number; wideDepth: number | null; wideLength: number | null }
/** A flat base the close at t has just broken out of: 20 to 35 sessions, depth at most 15%, range high set at least 5 sessions ago, prior advance 30%, first close above the high (yesterday's was not), at most 5% above. */
export function flatSetup(s: Ser, t: number): FlatSetup | null {
  const c = s.c, h = s.h ?? s.c, l = s.l ?? s.c; if (!pos(c[t]) || !pos(c[t - 1]) || t < SEPA.maxBase + 20) return null;
  for (let n = SEPA.flatMin; n <= SEPA.flatMax; n++) {
    let hi = -Infinity, lo = Infinity, bad = false; for (let i = t - n; i < t; i++) { if (!pos(h[i]) || !pos(l[i])) { bad = true; break; } if (h[i] > hi) hi = h[i]; if (l[i] < lo) lo = l[i]; }
    if (bad) continue; let ihi = t - n; for (let i = t - n; i < t; i++) if (h[i] >= hi) { ihi = i; break; }
    const d = (hi - lo) / hi; if (ihi > t - 5 || d > SEPA.flatDepth || !(c[t] > hi) || c[t] > hi * (1 + SEPA.maxAbove) || c[t - 1] > hi || !priorAdvance(c, t - n)) continue;
    let wi = -1, wb = -Infinity; for (let i = Math.max(0, t - SEPA.maxBase); i <= t - SEPA.minBase; i++) if (h[i] > wb) { wb = h[i]; wi = i; }
    let wl = Infinity; if (wi >= 0) for (let i = wi; i < t; i++) if (pos(l[i]) && l[i] < wl) wl = l[i];
    return { pivot: hi, low: lo, depth: d, length: n, wideDepth: wi >= 0 ? (wb - wl) / wb : null, wideLength: wi >= 0 ? t - wi : null };
  }
  return null;
}
/** Volume in the 10 sessions before the signal averaged below the 50-session average (published); breakout day at least 150% of it (desk figure). */
export const flatVolume = (v: ArrayLike<number>, t: number): { dry: boolean; vol: boolean } => { const a = avg(v, t - SEPA.avgWin, t - 1), r = avg(v, t - SF.dryWin, t - 1); return { dry: a > 0 && r < a, vol: a > 0 && pos(v[t]) && v[t] >= SEPA.volMult * a }; };
/** Latest three quarters' profit growth year on year, or null when any is missing (a missing figure is not a fail; it is logged as none). */
export const earningsFig = (view: { quarters: Array<{ yoy: { pat: number | null } | null }> }): number[] | null => { const q = view.quarters.slice(0, 3); if (q.length < 3) return null; const g = q.map((x) => x.yoy?.pat); return g.every((v) => v != null && Number.isFinite(v)) ? (g as number[]) : null; };
export const earningsPass = (g: number[] | null, floor = SF.eMin): boolean => !!g && g[0] >= floor && g[1] > 0 && g[2] > 0;
/** Tonight's one-day fall is the largest since the stock's lowest close of the prior 252 sessions (stage 2 start proxy; desk definition of his "largest one-day fall since stage 2 began"). */
export function bigFallSince52Low(c: ArrayLike<number>, t: number): boolean {
  if (!pos(c[t]) || !pos(c[t - 1])) return false; const r = c[t] / c[t - 1] - 1; if (!(r < 0)) return false;
  let lo = Infinity, il = t; for (let i = Math.max(1, t - 252); i < t; i++) if (pos(c[i]) && c[i] < lo) { lo = c[i]; il = i; }
  let worst = 0; for (let i = il + 1; i < t; i++) if (pos(c[i]) && pos(c[i - 1])) { const x = c[i] / c[i - 1] - 1; if (x < worst) worst = x; }
  return r < worst;
}
export const sma50At = (c: ArrayLike<number>, t: number): number => avg(c, t - 49, t);
export interface SepaLogRow { date: string; sym: string; rs: number; pivot: number; depth: number; length: number; wideDepth: number | null; wideLength: number | null; dry: boolean; vol: boolean; fig: number[] | null; earnings: boolean | null; taken: boolean; why: string }
export interface SepaEnv { fig: (sym: string) => number[] | null; log?: SepaLogRow[] }
/** x.el is the wide eligible list. Orders: buys only (exits are the engine's). Per-rule results for every name that reaches the base stage go to the log; funnel counts go to st.sepaCounts. */
export function sepaFlat(x: { el: Name[]; series: Map<string, Ser>; t: number; dates: string[]; held: Set<string>; st: BookState }, env: SepaEnv): Orders | null {
  const D = x.dates[x.t], rsRaw = new Map<string, number>(); for (const n of x.el) { const s = x.series.get(n.sym); if (!s) continue; const v = weightedRs(s.c, x.t); if (Number.isFinite(v)) rsRaw.set(n.sym, v); }
  const pc = percentiles(rsRaw), cnt = { tpl: 0, flat: 0, dry: 0, vol: 0, fig: 0, e25: 0, bought: 0, slotsFull: 0 }, cand: Array<{ n: Name; rs: number; fs: FlatSetup; row: SepaLogRow }> = [];
  const last = (x.st.sepaLast ??= {});
  for (const n of x.el) {
    const r = pc.get(n.sym), s = x.series.get(n.sym); if (r == null || !s || !s.h || !s.l || r < MV.rsMin || templateSeven(s, x.t, MV.rising, SF.lowPct) !== true) continue; cnt.tpl++;
    const fs = flatSetup(s, x.t); if (!fs) continue; cnt.flat++; const vv = s.v ? flatVolume(s.v, x.t) : { dry: false, vol: false }; if (vv.dry) cnt.dry++; if (vv.vol) cnt.vol++;
    const row: SepaLogRow = { date: D, sym: n.sym, rs: Math.round(r * 10) / 10, pivot: fs.pivot, depth: Math.round(fs.depth * 1e4) / 1e4, length: fs.length, wideDepth: fs.wideDepth == null ? null : Math.round(fs.wideDepth * 1e4) / 1e4, wideLength: fs.wideLength, dry: vv.dry, vol: vv.vol, fig: null, earnings: null, taken: false, why: '' };
    env.log?.push(row);
    if (!(vv.dry && vv.vol)) { row.why = !vv.dry ? 'volume did not dry up' : 'breakout volume under 150%'; continue; }
    if (x.held.has(n.sym)) { row.why = 'held'; continue; } if (last[n.sym] != null && x.t - last[n.sym] < SF.cooldown) { row.why = 'repeat of a recent signal'; continue; }
    const g = env.fig(n.sym); row.fig = g ? g.map((v) => Math.round(v * 1e3) / 1e3) : null; if (g) cnt.fig++;
    if (!g) { row.why = 'no earnings figure'; continue; } row.earnings = earningsPass(g); if (!row.earnings) { row.why = 'earnings below the floor'; continue; } cnt.e25++;
    cand.push({ n, rs: r, fs, row });
  }
  cand.sort((a, b) => b.rs - a.rs || (a.n.sym < b.n.sym ? -1 : 1)); const room = Math.max(0, SF.slots - x.held.size), buys = [];
  for (const [i, c] of cand.entries()) { if (i >= room) { c.row.why = 'slots full'; cnt.slotsFull++; continue; } c.row.taken = true; c.row.why = 'bought next open'; last[c.n.sym] = x.t; cnt.bought++; buys.push({ sym: c.n.sym, value: c.n.value, stop: (c.fs.pivot - c.fs.low) / c.fs.pivot, stopPx: c.fs.low }); }
  (x.st.sepaCounts ??= {})[D] = cnt;
  return buys.length ? { buys, sells: [] } : null;
}
