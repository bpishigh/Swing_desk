// India growth-combo paper book (owner go, 19 Nov 2026; rule GC-1, docs/replay/GROWTH-FACTORS-PREREG.md and addendum 4/5). Pure: data in, orders out.
// On the last session of each month, among liquid stocks (20-session average traded value at least Rs 2 crore, enough history), buy those that are in the cheapest fifth by price AND the top fifth by
// 6-month (126-session) return AND the top fifth by traded-value trend (20-session value over the average of sessions t-250 to t-125). Percentiles are taken inside the same liquid group on that night.
// Buy at the next open, 2% each, at most 50 names, highest 6-month return first. Exit only by a 35% trailing stop on closes (no time limit). No new buys when the market light is red (the house gate).
// A name with a one-day move over 40% in the last 126 sessions is skipped (possible unadjusted split or bonus). Not the research gate: that used the index against its 200-day average.
import { type Buy, type BookState } from './stock-book.ts';
import type { Orders, Ser } from './first-wave.ts';

export const GC = { names: 50, weight: 0.02, trail: 0.35, floor: 2e7, cheap: 0.2, top: 0.8, minHist: 260 };
export interface GcCtx { series: Map<string, Ser>; t: number; dates: string[]; held: Set<string>; st: BookState; light: string; monthEnd: boolean; eligible: (sym: string) => boolean; floor?: number }
export interface GcLogRow { date: string; sym: string; sessions: number; volRatio: number | null; taken: boolean; why: string }
export interface GcCounts { date: string; universe: number; cheap: number; mom: number; liq: number; all: number }

const tvAt = (c: ArrayLike<number>, v: ArrayLike<number>, a: number, b: number): number => { let x = 0, n = 0; for (let i = a; i <= b; i++) if (c[i] > 0 && v[i] >= 0) { x += c[i] * v[i]; n++; } return n >= (b - a + 1) * 0.7 ? x / n : NaN; };

export function growthCombo(x: GcCtx, log?: GcLogRow[], counts?: GcCounts[]): Orders | null {
  if (!x.monthEnd || x.t < GC.minHist) return null;
  const { t } = x, D = x.dates[t], buys: Buy[] = [];
  if (x.light === 'red') { log?.push({ date: D, sym: '(all)', sessions: 0, volRatio: null, taken: false, why: 'market light red' }); return null; }
  const U: Array<{ sym: string; price: number; mom: number; tvt: number; tv: number }> = [];
  for (const [sym, s] of x.series) {
    const c = s.c, v = s.v; if (!v || !(c[t] > 0) || !(c[t - 126] > 0) || !(c[t - 252] > 0) || !(c[t - 21] > 0) || !x.eligible(sym)) continue;
    const tv = tvAt(c, v, t - 19, t); if (!(tv >= (x.floor ?? GC.floor))) continue;
    let n200 = 0, nr = 0, bad = false; for (let k = t - 199; k <= t; k++) if (c[k] > 0) n200++;
    for (let k = t - 125; k <= t; k++) if (c[k] > 0 && c[k - 1] > 0) { nr++; if (Math.abs(c[k] / c[k - 1] - 1) > 0.4) bad = true; }
    if (n200 < 180 || nr < 100 || bad) continue;
    const old = tvAt(c, v, t - 250, t - 125);
    U.push({ sym, price: c[t], mom: c[t] / c[t - 126] - 1, tvt: tv / old, tv });
  }
  if (U.length < 150) { counts?.push({ date: D, universe: U.length, cheap: 0, mom: 0, liq: 0, all: 0 }); return null; }
  const pct = (key: 'price' | 'mom' | 'tvt'): Map<string, number> => { const a = U.filter((u) => Number.isFinite(u[key])).sort((p, q) => p[key] - q[key]), m = new Map<string, number>(); a.forEach((u, i) => m.set(u.sym, i / a.length)); return m; };
  const pp = pct('price'), pm = pct('mom'), pt = pct('tvt');
  const pass = U.filter((u) => (pp.get(u.sym) ?? 1) < GC.cheap && (pm.get(u.sym) ?? 0) >= GC.top && (pt.get(u.sym) ?? 0) >= GC.top).sort((a, b) => b.mom - a.mom || (a.sym < b.sym ? -1 : 1));
  counts?.push({ date: D, universe: U.length, cheap: U.filter((u) => (pp.get(u.sym) ?? 1) < GC.cheap).length, mom: U.filter((u) => (pm.get(u.sym) ?? 0) >= GC.top).length, liq: U.filter((u) => (pt.get(u.sym) ?? 0) >= GC.top).length, all: pass.length });
  const room = GC.names - x.held.size;
  for (const n of pass) {
    const base = { date: D, sym: n.sym, sessions: 0, volRatio: Math.round(n.mom * 1000) / 1000 };
    if (x.held.has(n.sym)) { log?.push({ ...base, taken: false, why: 'already held' }); continue; }
    if (buys.length >= room) { log?.push({ ...base, taken: false, why: 'no slot' }); continue; }
    buys.push({ sym: n.sym, value: n.tv, stop: GC.trail }); log?.push({ ...base, taken: true, why: 'bought next open' });
  }
  return buys.length ? { buys, sells: [] } : null;
}
