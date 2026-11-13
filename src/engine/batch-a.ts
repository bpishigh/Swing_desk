// Batch A signal rules (claude/batch-a-fundamentals-rules-draft.md, working ids A1 to A6; C-numbers are assigned when the owner adopts them). Pure: data in, orders out.
// Universe: the top 500 by 20-session median traded value (decision D1). Figures come from the A0 table (fundamentals-asof.ts). Missing is missing: a name without the figures a rule needs is not ranked.
// Ranking books review on the first session of each month (D9); a held name stays while still in the top 40 / still passing; after a stop-out the slot stays in cash until a later review (D10).
import { BOOK, shortStop, type Buy, type BookState } from './stock-book.ts';
import { atrN, highProximity, isMonthStart, rankSelect, FW, type Name, type Orders, type Ser } from './first-wave.ts';
import type { Features } from './fundamentals-asof.ts';

export const BA = { names: 20, keep: 40, industryCap: 5, minIndustry: 5, sue: 2.0, peadHold: 60, fallenDrawdown: 0.5, fallenWindow: 1260, fallenGrowth: 0.15, fallenHigh: 0.75, fallenCover: 3, compMargin: 0.10, compCover: 4, grahamPE: 15 };
export interface BCtx { el: Name[]; series: Map<string, Ser>; t: number; dates: string[]; held: Set<string>; fund: Record<string, Features>; st: BookState; group?: (sym: string) => string | null }
export interface SignalLogRow { date: string; sym: string; sue: number | null; epsChange: number | null; reaction: number | null; volRatio: number | null; taken: boolean; why: string }
const pct = (xs: number[], x: number): number => { let lo = 0, eq = 0; for (const v of xs) { if (v < x) lo++; else if (v === x) eq++; } return xs.length > 1 ? (lo + 0.5 * Math.max(0, eq - 1)) / (xs.length - 1) : 0.5; };
const byValue = (a: { sym: string }, b: { sym: string }): number => (a.sym < b.sym ? -1 : 1);

/** A ranking book reviews on the first session of a month, and once at the very start (a book that has never filled). Otherwise nothing is decided. */
export const reviewNow = (x: BCtx): boolean => isMonthStart(x.dates, x.t) || (!x.st.started && x.held.size === 0);

/** Pick up to 20 from a ranked list with the keep rule: held names stay while within `keep`, the rest go to the best-ranked others. Returns buys (new names) and sells (held names left out). */
function rebalance(ranked: Name[], x: BCtx): Orders {
  const chosen = rankSelect(ranked.map((r) => r.sym), x.held, BA.names, BA.keep), val = new Map(ranked.map((r) => [r.sym, r.value])), buys: Buy[] = [];
  for (const s of chosen) if (!x.held.has(s)) buys.push({ sym: s, value: val.get(s) ?? 0, stop: BOOK.longStop });
  return { buys, sells: [...x.held].filter((s) => !chosen.has(s)) };
}
/** Screen books: held names stay while they still pass; free places go to the best-ranked passers. */
function screenSelect(passers: Name[], x: BCtx): Orders {
  const pass = new Set(passers.map((p) => p.sym)), keep = [...x.held].filter((s) => pass.has(s)), chosen = new Set(keep.slice(0, BA.names)), buys: Buy[] = [];
  for (const p of passers) { if (chosen.size >= BA.names) break; if (!chosen.has(p.sym)) { chosen.add(p.sym); buys.push({ sym: p.sym, value: p.value, stop: BOOK.longStop }); } }
  return { buys, sells: [...x.held].filter((s) => !chosen.has(s)) };
}
const orNull = (o: Orders): Orders | null => (o.buys.length || o.sells.length ? o : null);

/** A2 Value-lite: cheapest earnings yield, at most 5 names per industry. Ranking list = positive yield, high to low, walking down and skipping names whose industry already has 5. */
export function valueRanked(x: BCtx): Array<Name & { s: number }> {
  const rows = x.el.map((n) => ({ ...n, s: x.fund[n.sym]?.earningsYield ?? null })).filter((r): r is Name & { s: number } => r.s != null && r.s > 0 && x.fund[r.sym]?.ttm.pat != null && (x.fund[r.sym].ttm.pat as number) > 0);
  rows.sort((a, b) => b.s - a.s || byValue(a, b));
  const used = new Map<string, number>(), out: Array<Name & { s: number }> = [];
  for (const r of rows) { const g = x.group?.(r.sym) ?? `~${r.sym}`; const n = used.get(g) ?? 0; if (n >= BA.industryCap) continue; used.set(g, n + 1); out.push(r); }
  return out;
}
export function valueLite(x: BCtx): Orders | null { if (!reviewNow(x)) return null; return orNull(rebalance(valueRanked(x), x)); }

/** A3 Quality-lite: percentile ranks of operating EBIT margin (within industry when the industry has 5 or more scored names), stability (low spread of quarterly margin over 12 quarters, at least 10), interest cover, 3-year revenue CAGR. A name needs all four. */
export function qualityRanked(x: BCtx): Array<Name & { s: number; parts: number[] }> {
  const rows: Array<Name & { margin: number; stab: number; cover: number; cagr: number }> = [];
  for (const n of x.el) {
    const f = x.fund[n.sym]; if (!f || f.financial) continue;
    const q = f.quarterlyEbitMargin.filter((v): v is number => v != null); if (q.length < 10 || f.quarterlyEbitMargin.length < 12) continue;
    const m = q.reduce((a, b) => a + b, 0) / q.length, sd = Math.sqrt(q.reduce((a, b) => a + (b - m) ** 2, 0) / q.length);
    if (f.margin.operatingEbit == null || f.interestCover == null || f.growth.revenueCagr3 == null) continue;
    rows.push({ ...n, margin: f.margin.operatingEbit, stab: sd, cover: f.interestCover, cagr: f.growth.revenueCagr3 });
  }
  const byInd = new Map<string, typeof rows>(); for (const r of rows) { const g = x.group?.(r.sym) ?? null; if (g) { const a = byInd.get(g) ?? []; a.push(r); byInd.set(g, a); } }
  const all = (k: 'margin' | 'stab' | 'cover' | 'cagr') => rows.map((r) => r[k]);
  const out = rows.map((r) => {
    const g = x.group?.(r.sym) ?? null, peers = g ? byInd.get(g) : undefined, mset = peers && peers.length >= BA.minIndustry ? peers.map((p) => p.margin) : all('margin');
    const parts = [pct(mset, r.margin), 1 - pct(all('stab'), r.stab), pct(all('cover'), r.cover), pct(all('cagr'), r.cagr)];
    return { sym: r.sym, value: r.value, s: parts.reduce((a, b) => a + b, 0) / 4, parts };
  });
  out.sort((a, b) => b.s - a.s || byValue(a, b)); return out;
}
export function qualityLite(x: BCtx): Orders | null { if (!reviewNow(x)) return null; return orNull(rebalance(qualityRanked(x), x)); }

/** Largest peak-to-trough fall of the closes in the last n sessions; null without a full window. */
export function maxDrawdown(c: ArrayLike<number>, t: number, n = BA.fallenWindow): number | null {
  if (t - n + 1 < 0 || !(c[t - n + 1] > 0)) return null;
  let peak = 0, worst = 0; for (let i = t - n + 1; i <= t; i++) { const v = c[i]; if (!(v > 0)) continue; if (v > peak) peak = v; const d = 1 - v / peak; if (d > worst) worst = d; }
  return worst;
}
/** A5 Fallen and rebuilding: fell at least 50% inside 1,260 sessions, now profitable (TTM profit positive), TTM revenue growth above 15%, close at least 75% of the 252-session high, interest cover at least 3, non-financial. Ranked by revenue growth. */
export function fallenPassers(x: BCtx): Array<Name & { s: number }> {
  const out: Array<Name & { s: number }> = [];
  for (const n of x.el) {
    const f = x.fund[n.sym], c = x.series.get(n.sym)?.c; if (!f || !c || f.financial) continue;
    if (!(f.ttm.pat != null && f.ttm.pat > 0) || !(f.growth.revenue != null && f.growth.revenue > BA.fallenGrowth) || !(f.interestCover != null && f.interestCover >= BA.fallenCover)) continue;
    const dd = maxDrawdown(c, x.t), hp = highProximity(c, x.t); if (dd == null || dd < BA.fallenDrawdown || hp == null || hp < BA.fallenHigh) continue;
    out.push({ ...n, s: f.growth.revenue });
  }
  out.sort((a, b) => b.s - a.s || byValue(a, b)); return out;
}
export function fallen(x: BCtx): Orders | null { if (!reviewNow(x)) return null; return orNull(screenSelect(fallenPassers(x), x)); }

/** A6 Consistent compounder, lite: in each of the last 4 fiscal years operating EBIT margin at least 10%, revenue above the year before, profit positive; TTM interest cover at least 4; non-financial. Ranked by 3-year revenue CAGR. Needs 5 fiscal years of figures. */
export function compounderPassers(x: BCtx): Array<Name & { s: number }> {
  const out: Array<Name & { s: number }> = [];
  for (const n of x.el) {
    const f = x.fund[n.sym]; if (!f || f.financial || f.interestCover == null || f.interestCover < BA.compCover || f.growth.revenueCagr3 == null) continue;
    const fy = f.fiscalYears; if (fy.length < 5) continue; let ok = true;
    for (let i = 0; i < 4 && ok; i++) { const a = fy[i], b = fy[i + 1]; ok = a.revenue != null && b.revenue != null && a.revenue > b.revenue && a.revenue > 0 && a.operatingEbit != null && a.operatingEbit / a.revenue >= BA.compMargin && a.pat != null && a.pat > 0; }
    if (ok) out.push({ ...n, s: f.growth.revenueCagr3 });
  }
  out.sort((a, b) => b.s - a.s || byValue(a, b)); return out;
}
export function compounder(x: BCtx): Orders | null { if (!reviewNow(x)) return null; return orNull(screenSelect(compounderPassers(x), x)); }

/** A1 Post-earnings drift: a filing broadcast since the last session (after the previous session's date, up to tonight) with SUE of at least 2.0 and positive TTM profit signals tonight; entry at the next open. Hold 60 sessions then sell. Short-hold stop; wider than 8% is skipped and listed. Log: every candidate with SUE, results-day move, volume ratio and what happened to it. */
export function pead(x: BCtx, wide?: Array<{ sym: string; width: number }>, log?: SignalLogRow[]): Orders | null {
  const { t } = x, D = x.dates[t], prev = x.dates[t - 1] ?? '', sells: string[] = [], buys: Buy[] = [];
  for (const [sym, p] of Object.entries(x.st.pos)) { const i = x.dates.indexOf(p.entryDate); if (i >= 0 && t - i + 1 >= BA.peadHold) sells.push(sym); }
  const cand: Array<Name & { sue: number; eps: number }> = [];
  for (const n of x.el) {
    const f = x.fund[n.sym]; if (!f || f.asOf == null) continue; const day = f.asOf.slice(0, 10);
    if (!(day > prev && day <= D) || f.sue.value == null || f.sue.value < BA.sue || !(f.ttm.pat != null && f.ttm.pat > 0)) continue;
    cand.push({ ...n, sue: f.sue.value, eps: f.sue.epsChange ?? 0 });
  }
  cand.sort((a, b) => b.sue - a.sue || byValue(a, b));
  const room = BA.names - (x.held.size - sells.length);
  const stats = (sym: string): { reaction: number | null; volRatio: number | null } => { const s = x.series.get(sym); if (!s) return { reaction: null, volRatio: null }; const c = s.c, v = s.v; let vr: number | null = null;
    if (v && v[t] > 0) { let m = 0, k = 0; for (let i = t - 20; i < t; i++) if (v[i] > 0) { m += v[i]; k++; } vr = k >= 15 ? Math.round(v[t] / (m / k) * 100) / 100 : null; }
    return { reaction: c[t] > 0 && c[t - 1] > 0 ? Math.round((c[t] / c[t - 1] - 1) * 1e4) / 1e4 : null, volRatio: vr }; };
  for (const n of cand) {
    const s = x.series.get(n.sym); const st = x.held.has(n.sym) ? null : s ? shortStop(atrN(s, t), s.c[t]) : null; const base = { date: D, sym: n.sym, sue: Math.round(n.sue * 100) / 100, epsChange: n.eps, ...stats(n.sym) };
    if (x.held.has(n.sym)) { log?.push({ ...base, taken: false, why: 'already held' }); continue; }
    if (st === null) { if (s) wide?.push({ sym: n.sym, width: Math.round(3 * atrN(s, t) / s.c[t] * 1e4) / 1e4 }); log?.push({ ...base, taken: false, why: 'stop too wide' }); continue; }
    if (buys.length >= room) { log?.push({ ...base, taken: false, why: 'no slot' }); continue; }
    buys.push({ sym: n.sym, value: n.value, stop: st }); log?.push({ ...base, taken: true, why: 'bought next open' });
  }
  return orNull({ buys, sells });
}

/** A4 Graham-lite list (information only): TTM P/E at most 15, profit positive in every stored fiscal year (at most 8), non-financial. */
export function grahamList(x: BCtx): Array<{ sym: string; pe: number }> {
  const out: Array<{ sym: string; pe: number }> = [];
  for (const n of x.el) { const f = x.fund[n.sym]; if (!f || f.financial || f.earningsYield == null || f.earningsYield <= 0) continue; const pe = 1 / f.earningsYield; if (pe > BA.grahamPE) continue; if (!f.fiscalYears.length || !f.fiscalYears.every((y) => y.pat != null && y.pat > 0)) continue; out.push({ sym: n.sym, pe: Math.round(pe * 100) / 100 }); }
  return out.sort((a, b) => a.pe - b.pe);
}
void FW;
