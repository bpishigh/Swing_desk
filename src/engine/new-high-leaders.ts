// India new-high leader paper books (owner go, 19 Nov 2026; rules HL-1 M3 and HL-2 M4, from HUNT-1 in docs/replay/HUNT-1-PREREG.md). Pure: data in, orders out.
// Daily, on the close: a name signals when it closes at its highest close of the last 252 sessions, the market is in an uptrend (Nifty 500 above its 200-session mean), and
//   M3: its 126-session return is in the top tenth of the liquid group that night (20-session average traded value at least Rs 2 crore);
//   M4: it closes above its own 200-session mean and its 20-session average daily move is under 60% of its 100-session average (a quiet stock breaking out).
// Buy at the next open, 2% each, at most 50 names, highest 126-session return first. A name is not bought again within 126 sessions of its last signal. Exit only by a 35% trailing stop on closes.
// A name with a one-day move over 40% in the last 126 sessions is skipped (possible unadjusted split or bonus), which the research did not do. Paper only.
import { type Buy, type BookState } from './stock-book.ts';
import type { Orders, Ser } from './first-wave.ts';

export const HL = { names: 50, weight: 0.02, trail: 0.35, floor: 2e7, top: 0.9, gap: 126, minHist: 260, quiet: 0.6 };
export interface HlCtx { series: Map<string, Ser>; t: number; dates: string[]; held: Set<string>; st: BookState; up: boolean; rule: 'M3' | 'M4'; eligible: (sym: string) => boolean; floor?: number }
export interface HlLogRow { date: string; sym: string; ret126: number; taken: boolean; why: string }

const tvAt = (c: ArrayLike<number>, v: ArrayLike<number>, a: number, b: number): number => { let x = 0, n = 0; for (let i = a; i <= b; i++) if (c[i] > 0 && v[i] >= 0) { x += c[i] * v[i]; n++; } return n >= (b - a + 1) * 0.7 ? x / n : NaN; };
const avgMove = (c: ArrayLike<number>, a: number, b: number): number => { let s = 0, n = 0; for (let k = a; k <= b; k++) if (c[k] > 0 && c[k - 1] > 0) { s += Math.abs(c[k] / c[k - 1] - 1); n++; } return n >= (b - a + 1) * 0.8 ? s / n : NaN; };

export function newHighLeaders(x: HlCtx, log?: HlLogRow[]): Orders | null {
  const { t } = x; if (t < HL.minHist) return null;
  const D = x.dates[t]; if (!x.up) return null;
  const U: Array<{ sym: string; ret: number; tv: number; high: boolean; own: boolean }> = [];
  for (const [sym, s] of x.series) {
    const c = s.c, v = s.v; if (!v || !(c[t] > 0) || !(c[t - 126] > 0) || !x.eligible(sym)) continue;
    const tv = tvAt(c, v, t - 19, t); if (!(tv >= (x.floor ?? HL.floor))) continue;
    let bad = false, hi = 0; for (let k = t - 125; k <= t; k++) if (c[k] > 0 && c[k - 1] > 0 && Math.abs(c[k] / c[k - 1] - 1) > 0.4) { bad = true; break; }
    if (bad) continue; for (let k = t - 251; k < t; k++) if (c[k] > hi) hi = c[k];
    U.push({ sym, ret: c[t] / c[t - 126] - 1, tv, high: c[t] >= hi && hi > 0, own: false });
  }
  if (U.length < 100) return null;
  const rets = U.map((u) => u.ret).sort((a, b) => a - b), cut = rets[Math.floor(rets.length * HL.top)];
  const last = new Map<string, number>(); for (const r of (x.st as { signalLog?: Array<{ date: string; sym: string }> }).signalLog ?? []) last.set(r.sym, Math.max(last.get(r.sym) ?? -1, x.dates.indexOf(r.date)));
  const pass = U.filter((u) => {
    if (!u.high) return false; const c = x.series.get(u.sym)!.c;
    if (x.rule === 'M3') return u.ret >= cut;
    let s200 = 0, n200 = 0; for (let k = t - 199; k <= t; k++) if (c[k] > 0) { s200 += c[k]; n200++; }
    if (n200 < 180 || !(c[t] > s200 / n200)) return false;
    const a20 = avgMove(c, t - 19, t), a100 = avgMove(c, t - 99, t); return a20 < HL.quiet * a100;
  }).sort((a, b) => b.ret - a.ret || (a.sym < b.sym ? -1 : 1));
  const buys: Buy[] = [], room = HL.names - x.held.size;
  for (const n of pass) {
    const base = { date: D, sym: n.sym, ret126: Math.round(n.ret * 1000) / 1000 };
    if (x.held.has(n.sym)) { log?.push({ ...base, taken: false, why: 'already held' }); continue; }
    if (t - (last.get(n.sym) ?? -1e9) < HL.gap) { log?.push({ ...base, taken: false, why: 'signalled in the last 126 sessions' }); continue; }
    if (buys.length >= room) { log?.push({ ...base, taken: false, why: 'no slot' }); continue; }
    buys.push({ sym: n.sym, value: n.tv, stop: HL.trail }); log?.push({ ...base, taken: true, why: 'bought next open' });
  }
  return buys.length ? { buys, sells: [] } : null;
}
