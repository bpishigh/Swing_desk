// Batch C signal rules (docs/BATCH_C_RULES.md, adopted as C-208 to C-211). Pure: data in, orders out.
// Package 21, delivery accumulation (C-210): delivery % at least 1.5x its own prior 20-session average, close up at least 2% on the day, close above its 50-session average, top 500, normal series (EQ) on the signal day and across the average. Rank by the ratio. Entry next open; hold 20 sessions; C-159 short-hold stop; at most 20 names; wide stop skipped and logged.
import { shortStop } from './stock-book.ts';
import { atrN, type Orders, type Name } from './first-wave.ts';
import { BA, orNull, byValue, type BCtx } from './batch-a.ts';
import type { Buy } from './stock-book.ts';

export const BC = { ratio: 1.5, rise: 0.02, avgWin: 20, minAvg: 15, maWin: 50, hold: 20, names: 20 };
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
    const st = shortStop(atrN(s, t), s.c[t]);
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
