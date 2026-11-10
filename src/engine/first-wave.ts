// First-wave signal rules (Engine Rules C-161, C-163, C-164, C-166). Pure: data in, orders out. Parameters are the registered ones, written once here.
// Universe is the sleeve's eligible list (C-160 shared terms): close >= Rs 20, 260 sessions, 20-session median traded value >= Rs 5 crore, top 200 by traded value.
import { BOOK, shortStop, type Buy } from './stock-book.ts';
export const FW = { uni: 200, names: 20, keep: 40, w12: 252, skip: 21, high: 252, donEntry: 55, donExit: 20, atrN: 20, tomEntryLeft: 4, tomExitSession: 3 };

export interface Name { sym: string; value: number }
export interface Ser { c: ArrayLike<number>; h?: ArrayLike<number>; l?: ArrayLike<number> }
export interface Ctx { el: Name[]; series: Map<string, Ser>; t: number; dates: string[]; held: Set<string> }
export interface Orders { buys: Buy[]; sells: string[] }
const ok = (x: number): boolean => x > 0;

/** 12-1 return: close 21 sessions ago over close 252 sessions ago, less one. null when either close is missing. */
export const ret121 = (c: ArrayLike<number>, t: number): number | null => (t - FW.w12 >= 0 && ok(c[t - FW.skip]) && ok(c[t - FW.w12]) ? c[t - FW.skip] / c[t - FW.w12] - 1 : null);
/** Close over the highest close of the last 252 sessions (1 = at the high). */
export function highProximity(c: ArrayLike<number>, t: number): number | null {
  if (t - FW.high + 1 < 0 || !ok(c[t])) return null;
  let m = 0; for (let i = t - FW.high + 1; i <= t; i++) if (c[i] > m) m = c[i];
  return m > 0 ? c[t] / m : null;
}
/** Simple mean true range over n sessions on the stored highs and lows. NaN when a bar is missing. */
export function atrN(s: Ser, t: number, n = FW.atrN): number {
  if (!s.h || !s.l || t - n < 0) return NaN; let sum = 0;
  for (let i = t - n + 1; i <= t; i++) { const h = s.h[i], l = s.l[i], p = s.c[i - 1]; if (!ok(h) || !ok(l) || !ok(p)) return NaN; sum += Math.max(h - l, Math.abs(h - p), Math.abs(l - p)); }
  return sum / n;
}
const uni = (x: Ctx): Name[] => x.el.slice(0, FW.uni);
const isoWeekday = (d: string): number => { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return w === 0 ? 7 : w; };
/** First session of a calendar month. */
export const isMonthStart = (dates: string[], t: number): boolean => t > 0 && dates[t].slice(0, 7) !== dates[t - 1].slice(0, 7);

/** Top-N with a keep buffer: held names stay while ranked within `keep`; the rest of the N places go to the best-ranked others. Returns the chosen set. */
export function rankSelect(ranked: string[], held: Set<string>, n = FW.names, keep = FW.keep): Set<string> {
  const rank = new Map(ranked.map((s, i) => [s, i + 1])), chosen = new Set<string>();
  for (const s of held) if ((rank.get(s) ?? Infinity) <= keep && chosen.size < n) chosen.add(s);
  for (const s of ranked) { if (chosen.size >= n) break; chosen.add(s); }
  return chosen;
}
function rebalance(ranked: Name[], x: Ctx, stop: (sym: string) => number | null | 'skip'): Orders {
  const chosen = rankSelect(ranked.map((r) => r.sym), x.held), buys: Buy[] = [], skipped: string[] = [];
  const val = new Map(ranked.map((r) => [r.sym, r.value]));
  for (const s of chosen) { if (x.held.has(s)) continue; const st = stop(s); if (st === 'skip' || st === null) { skipped.push(s); continue; } buys.push({ sym: s, value: val.get(s) ?? 0, stop: st }); }
  return { buys, sells: [...x.held].filter((s) => !chosen.has(s)) };
}
const longStop = (): number => BOOK.longStop;

/** C-161: hold the 20 names closest to their 252-session high; review on the first session of each month; held names stay while in the top 40. Long-hold stop. */
export function high52(x: Ctx): Orders | null {
  if (!isMonthStart(x.dates, x.t) && x.held.size > 0) return null;
  const rows = uni(x).map((n) => ({ ...n, s: highProximity(x.series.get(n.sym)?.c ?? [], x.t) })).filter((r): r is Name & { s: number } => r.s !== null);
  rows.sort((a, b) => b.s - a.s || (a.sym < b.sym ? -1 : 1));
  return rebalance(rows, x, longStop);
}
/** C-164: weekly 12-1. Review each Friday close (a week whose Friday is a holiday is skipped, not moved); top 20, keep to rank 40. Long-hold stop. */
export function weekly121(x: Ctx): Orders | null {
  if (isoWeekday(x.dates[x.t]) !== 5 && x.held.size > 0) return null;
  const rows = uni(x).map((n) => ({ ...n, s: ret121(x.series.get(n.sym)?.c ?? [], x.t) })).filter((r): r is Name & { s: number } => r.s !== null);
  rows.sort((a, b) => b.s - a.s || (a.sym < b.sym ? -1 : 1));
  return rebalance(rows, x, longStop);
}
/** C-163: buy a close above the highest close of the previous 55 sessions; sell a close below the lowest close of the previous 20. Over 20 signals: best 12-1 first.
 *  Short-hold stop; signals whose 3 x ATR is over 8% are skipped and listed in `skippedWide`. */
export function donchian(x: Ctx, skippedWide?: Array<{ sym: string; width: number }>): Orders | null {
  const { t } = x, sells: string[] = [], cand: Array<Name & { m: number }> = [];
  for (const s of x.held) { const c = x.series.get(s)?.c; if (!c || !(c[t] > 0) || t - FW.donExit < 0) continue; let lo = Infinity; for (let i = t - FW.donExit; i < t; i++) if (c[i] > 0 && c[i] < lo) lo = c[i]; if (c[t] < lo) sells.push(s); }
  for (const n of uni(x)) {
    if (x.held.has(n.sym)) continue; const c = x.series.get(n.sym)?.c; if (!c || !(c[t] > 0) || t - FW.donEntry < 0) continue;
    let hi = 0; for (let i = t - FW.donEntry; i < t; i++) if (c[i] > hi) hi = c[i];
    if (c[t] > hi) cand.push({ ...n, m: ret121(c, t) ?? -Infinity });
  }
  cand.sort((a, b) => b.m - a.m || (a.sym < b.sym ? -1 : 1));
  const room = FW.names - (x.held.size - sells.length), buys: Buy[] = [];
  for (const n of cand) {
    if (buys.length >= room) break; const s = x.series.get(n.sym)!, st = shortStop(atrN(s, t), s.c[t]);
    if (st === null) { skippedWide?.push({ sym: n.sym, width: r4(3 * atrN(s, t) / s.c[t]) }); continue; }
    buys.push({ sym: n.sym, value: n.value, stop: st });
  }
  return buys.length || sells.length ? { buys, sells } : null;
}
const r4 = (x: number): number => (x === x ? Math.round(x * 1e4) / 1e4 : NaN);
/** Sessions of the month of `date` after it (the calendar's `sessionsBetween` to the last calendar day of that month). */
export const sessionsLeftInMonth = (date: string, between: (a: string, b: string) => number): number => { const [y, m] = date.split('-').map(Number), last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); return between(date, last); };
/** C-166: buy the 20 most traded eligible names on the close of the 5th-to-last session of the month; sell everything on the close of the 3rd session of the next month. Short-hold stop. */
export function turnOfMonth(x: Ctx, left: number, skippedWide?: Array<{ sym: string; width: number }>): Orders | null {
  const { t } = x, m = x.dates[t].slice(0, 7), nth = x.dates.slice(0, t + 1).filter((d) => d.slice(0, 7) === m).length;
  if (x.held.size > 0 && nth === FW.tomExitSession) return { buys: [], sells: [...x.held] };
  if (left !== FW.tomEntryLeft || x.held.size > 0) return null;
  const buys: Buy[] = [];
  for (const n of uni(x)) {
    if (buys.length >= FW.names) break; const s = x.series.get(n.sym); if (!s || !(s.c[t] > 0)) continue;
    const st = shortStop(atrN(s, t), s.c[t]); if (st === null) { skippedWide?.push({ sym: n.sym, width: r4(3 * atrN(s, t) / s.c[t]) }); continue; }
    buys.push({ sym: n.sym, value: n.value, stop: st });
  }
  return { buys, sells: [] };
}
