// First-wave signal rules (Engine Rules C-161, C-163, C-164, C-166). Pure: data in, orders out. Parameters are the registered ones, written once here.
// Universe is the sleeve's eligible list (C-160 shared terms): close >= Rs 20, 260 sessions, 20-session median traded value >= Rs 5 crore, top 200 by traded value.
import { BOOK, shortStop, type Buy } from './stock-book.ts';
export const FW = { uni: 200, names: 20, keep: 40, w12: 252, skip: 21, high: 252, donEntry: 55, donExit: 20, atrN: 20, tomEntryLeft: 4, tomExitSession: 3 };

export interface Name { sym: string; value: number }
export interface Ser { c: ArrayLike<number>; h?: ArrayLike<number>; l?: ArrayLike<number>; v?: ArrayLike<number> }
export interface Ctx { el: Name[]; series: Map<string, Ser>; t: number; dates: string[]; held: Set<string>; group?: (sym: string) => string | null }
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

// ---- Tonight's list for each book (display only: what the rule would hold, enter or leave on tonight's close) ----
export interface WatchRow { rank?: number; sym: string; score?: number | null; status: string; [k: string]: unknown }
const r3 = (x: number | null): number | null => (x === null || x !== x ? null : Math.round(x * 1000) / 1000);
/** Ranked books (C-161, C-164): the top 40 by the rule's score plus any held name outside it. status: Held, In buffer (held, rank 21 to 40), Would leave (held, beyond 40), Would enter (not held, top 20). */
export function watchRanked(x: Ctx, kind: 'high52' | 'weekly121'): WatchRow[] {
  const f = (c: ArrayLike<number>): number | null => (kind === 'high52' ? highProximity(c, x.t) : ret121(c, x.t));
  const rows = uni(x).map((n) => ({ sym: n.sym, s: f(x.series.get(n.sym)?.c ?? []) })).filter((r): r is { sym: string; s: number } => r.s !== null);
  rows.sort((a, b) => b.s - a.s || (a.sym < b.sym ? -1 : 1));
  const st = (sym: string, rank: number | null): string => (x.held.has(sym) ? (rank !== null && rank <= FW.names ? 'Held' : rank !== null && rank <= FW.keep ? 'In buffer' : 'Would leave') : rank !== null && rank <= FW.names ? 'Would enter' : '');
  const out: WatchRow[] = rows.slice(0, FW.keep).map((r, i) => ({ rank: i + 1, sym: r.sym, score: r3(r.s), status: st(r.sym, i + 1) }));
  for (const s of x.held) if (!out.some((r) => r.sym === s)) { const i = rows.findIndex((r) => r.sym === s); out.push({ rank: i < 0 ? undefined : i + 1, sym: s, score: i < 0 ? null : r3(rows[i].s), status: st(s, i < 0 ? null : i + 1) }); }
  return out;
}
/** Donchian book (C-163): held names with their exit level, names closing above their 55-session high tonight, and names within 2% of it. */
export function watchDonchian(x: Ctx): WatchRow[] {
  const { t } = x, out: WatchRow[] = [];
  for (const n of uni(x)) {
    const s = x.series.get(n.sym); const c = s?.c; if (!c || !(c[t] > 0) || t - FW.donEntry < 0) continue;
    let hi = 0, lo = Infinity; for (let i = t - FW.donEntry; i < t; i++) if (c[i] > hi) hi = c[i]; for (let i = t - FW.donExit; i < t; i++) if (c[i] > 0 && c[i] < lo) lo = c[i];
    const held = x.held.has(n.sym), dist = c[t] / hi - 1, w = s ? 3 * atrN(s, t) / c[t] : NaN;
    const status = held ? (c[t] < lo ? 'Exit tonight' : 'Held') : c[t] > hi ? (w > BOOK.shortStopCap ? 'Breakout, stop too wide' : 'Breakout') : dist >= -0.02 ? 'Near high' : '';
    if (status) out.push({ sym: n.sym, status, close: r3(c[t]), high55: r3(hi), low20: r3(lo), toHigh: r3(dist), stopWidth: r3(w), score: r3(ret121(c, t)) });
  }
  const order: Record<string, number> = { 'Exit tonight': 0, Breakout: 1, 'Breakout, stop too wide': 2, Held: 3, 'Near high': 4 };
  return out.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || (Number(b.score ?? -9) - Number(a.score ?? -9))).slice(0, 60);
}
/** Turn-of-month book (C-166): the 20 names it would buy at the next entry, with each stop width; a name whose 3 x ATR is over 8% is marked and passed over. */
export function watchTom(x: Ctx): WatchRow[] {
  const out: WatchRow[] = []; let n = 0;
  for (const m of uni(x)) {
    if (n >= FW.names + 10) break; const s = x.series.get(m.sym); if (!s || !(s.c[x.t] > 0)) continue; const w = 3 * atrN(s, x.t) / s.c[x.t];
    const wide = !(w <= BOOK.shortStopCap); out.push({ sym: m.sym, status: wide ? 'Stop too wide' : x.held.has(m.sym) ? 'Held' : 'Would buy', stopWidth: r3(w), value: Math.round(m.value) }); if (!wide) n++;
  }
  return out;
}

// ---- C-160 industry momentum and C-172 pullback (added 12 Nov 2026) ----
export const IND = { topGroups: 4, perGroup: 5, stayGroups: 6, stayRank: 8, minNames: 5 };
export interface GroupRow { group: string; score: number; n: number; names: Array<{ sym: string; r: number; value: number }> }
const median = (a: number[]): number => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
/** Industry table: each group with at least 5 eligible names that have a 12-1 figure, scored by the median 12-1 return; names ranked inside the group by their own figure. Strongest group first. */
export function industryTable(x: Ctx): GroupRow[] {
  if (!x.group) return []; const by = new Map<string, Array<{ sym: string; r: number; value: number }>>();
  for (const n of uni(x)) { const g = x.group(n.sym), r = ret121(x.series.get(n.sym)?.c ?? [], x.t); if (!g || r === null) continue; (by.get(g) ?? by.set(g, []).get(g)!).push({ sym: n.sym, r, value: n.value }); }
  const rows: GroupRow[] = [];
  for (const [group, names] of by) { if (names.length < IND.minNames) continue; names.sort((a, b) => b.r - a.r || (a.sym < b.sym ? -1 : 1)); rows.push({ group, score: median(names.map((q) => q.r)), n: names.length, names }); }
  return rows.sort((a, b) => b.score - a.score || (a.group < b.group ? -1 : 1));
}
/** C-160: the 5 strongest names of each of the top 4 industries (20 names, 5% each), reviewed on the first session of each month. A held name stays while its industry is in the top 6 and it is in the top 8 of that industry; stays come first, the top picks fill the rest. Long-hold stop. */
export function industryMomentum(x: Ctx): Orders | null {
  if (!isMonthStart(x.dates, x.t) && x.held.size > 0) return null;
  const tab = industryTable(x), chosen = pickIndustry(tab, x.held);
  const buys: Buy[] = []; const val = new Map(tab.flatMap((g) => g.names.map((q) => [q.sym, q.value] as const)));
  for (const s of chosen) if (!x.held.has(s)) buys.push({ sym: s, value: val.get(s) ?? 0, stop: longStop() });
  return { buys, sells: [...x.held].filter((s) => !chosen.has(s)) };
}
export function pickIndustry(tab: GroupRow[], held: Set<string>): Set<string> {
  const stay: string[] = [], core: string[] = [];
  tab.forEach((g, gi) => g.names.forEach((q, ni) => { if (held.has(q.sym) && gi < IND.stayGroups && ni < IND.stayRank) stay.push(q.sym); if (gi < IND.topGroups && ni < IND.perGroup) core.push(q.sym); }));
  const chosen = new Set<string>(); for (const s of stay) if (chosen.size < FW.names) chosen.add(s); for (const s of core) if (chosen.size < FW.names) chosen.add(s);
  return chosen;
}
export function watchIndustry(x: Ctx): WatchRow[] {
  const tab = industryTable(x), chosen = pickIndustry(tab, x.held), out: WatchRow[] = []; let rank = 0;
  tab.forEach((g, gi) => g.names.forEach((q, ni) => { if (!(chosen.has(q.sym) || x.held.has(q.sym) || (gi < IND.topGroups && ni < IND.perGroup))) return; rank++;
    const status = x.held.has(q.sym) ? (chosen.has(q.sym) ? 'Held' : 'Would leave') : chosen.has(q.sym) ? 'Would enter' : '';
    out.push({ rank, sym: q.sym, score: r3(q.r), status, group: g.group, groupRank: gi + 1 }); }));
  for (const s of x.held) if (!out.some((r) => r.sym === s)) out.push({ sym: s, score: null, status: 'Would leave' });
  return out.slice(0, 60);
}

/** C-172 pullback. Dip day j: a run of 3 to 5 consecutive lower closes ending on j, or a close at or within 1% above the 20-session mean. Signal: the first up close after a dip day (c[t] > c[t-1], t-1 a dip day), on a name in the top momentum fifth (selected by the caller) that passes the template (caller). */
export function dipDay(c: ArrayLike<number>, j: number): 'run' | 'average' | null {
  if (j < 21 || !ok(c[j])) return null;
  let run = 0; for (let k = j; k > j - 6 && k > 0 && ok(c[k]) && ok(c[k - 1]) && c[k] < c[k - 1]; k--) run++;
  if (run >= 3 && run <= 5) return 'run';
  let s = 0; for (let i = j - 19; i <= j; i++) { if (!ok(c[i])) return null; s += c[i]; }
  return c[j] <= 1.01 * (s / 20) ? 'average' : null;
}
/** Volume ratio (tonight over the 20-session mean) and tightness (10-session range of closes over tonight's close), logged on every signal. */
export function pullbackLog(s: Ser, t: number): { volRatio: number | null; tight: number | null } {
  let vr: number | null = null; if (s.v && t >= 20 && s.v[t] >= 0) { let m = 0; for (let i = t - 20; i < t; i++) m += s.v[i]; vr = m > 0 ? r4(s.v[t] / (m / 20)) : null; }
  let lo = Infinity, hi = 0; for (let i = t - 9; i <= t; i++) { if (!ok(s.c[i])) return { volRatio: vr, tight: null }; lo = Math.min(lo, s.c[i]); hi = Math.max(hi, s.c[i]); }
  return { volRatio: vr, tight: r4((hi - lo) / s.c[t]) };
}
export interface PullCtx extends Ctx { quintile: Set<string>; template: Set<string>; order: string[] }   // quintile: top fifth by the C-129 score tonight; template: names passing C-135; order: the C-129 rank order, best first
export function pullback(x: PullCtx, skippedWide?: Array<{ sym: string; width: number }>, log?: Array<Record<string, unknown>>): Orders | null {
  const { t } = x, sells: string[] = [];
  if (isMonthStart(x.dates, t)) for (const s of x.held) if (!x.quintile.has(s)) sells.push(s);   // exit: leaving the top momentum fifth at a monthly review
  const room = FW.names - (x.held.size - sells.length), buys: Buy[] = [], val = new Map(x.el.map((n) => [n.sym, n.value]));
  for (const sym of x.order) {
    if (buys.length >= room) break; if (x.held.has(sym) || !x.quintile.has(sym) || !x.template.has(sym)) continue;
    const s = x.series.get(sym); if (!s || !(s.c[t] > s.c[t - 1]) || !dipDay(s.c, t - 1)) continue;
    log?.push({ date: x.dates[t], sym, dip: dipDay(s.c, t - 1), ...pullbackLog(s, t) });
    const st = shortStop(atrN(s, t), s.c[t]); if (st === null) { skippedWide?.push({ sym, width: r4(3 * atrN(s, t) / s.c[t]) }); continue; }
    buys.push({ sym, value: val.get(sym) ?? 0, stop: st });
  }
  return buys.length || sells.length ? { buys, sells } : null;
}
export function watchPullback(x: PullCtx): WatchRow[] {
  const { t } = x, out: WatchRow[] = [];
  for (const sym of x.order) {
    if (!x.quintile.has(sym) || !x.template.has(sym)) { if (x.held.has(sym)) out.push({ sym, status: 'Held, left the fifth or template', stopWidth: null, value: 0 }); continue; }
    const s = x.series.get(sym); if (!s || !(s.c[t] > 0)) continue; const w = 3 * atrN(s, t) / s.c[t], dip = dipDay(s.c, t - 1), up = s.c[t] > s.c[t - 1], dipNow = dipDay(s.c, t);
    const status = x.held.has(sym) ? 'Held' : dip && up ? (w <= BOOK.shortStopCap ? 'Would buy' : 'Stop too wide') : dipNow ? 'In a dip' : '';
    if (status) out.push({ sym, status, stopWidth: r3(w), value: Math.round(x.el.find((n) => n.sym === sym)?.value ?? 0) });
  }
  const order: Record<string, number> = { 'Would buy': 0, 'Stop too wide': 1, Held: 2, 'In a dip': 3 }; return out.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)).slice(0, 60);
}
