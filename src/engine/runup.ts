// US run-up before results paper book (docs/BATCH_C_US_PROPOSALS.md U-3; owner go 17 Nov 2026 on the proposed rules). Pure: data in, orders out.
// Event: the first 8-K Item 2.02 release of a quarter for a top-500 name. Reaction session: released before 16:00 ET -> that session; after 16:00 ET -> the next session.
// Signal on the reaction session's close: run-up (20 sessions to the close before the reaction session) minus SPY at least RUN.cut, and reaction (previous close to reaction close) minus SPY at least RUN.react.
// RUN.cut is the two-thirds point of the 9,686 US results events counted on 17 Nov 2026 (data/us/count-8k.json), frozen before any book return was read. Buy at the next open; hold 20 sessions;
// C-159 stop (tighter of 3 x ATR(20) and 8%); at most 20 names at 5%. Not tuned, not re-run on the same data.
import { shortStop, type Buy, type BookState } from './stock-book.ts';
import { atrN, type Name, type Orders, type Ser } from './first-wave.ts';

export const RUN = { cut: 0.0323, react: 0.02, hold: 20, names: 20, lookback: 20, quarterGapDays: 45 };
export interface EightKEvent { sym: string; filed: string; etDate: string; etMin: number }
export interface RunCtx { el: Name[]; series: Map<string, Ser>; t: number; dates: string[]; held: Set<string>; st: BookState; events: EightKEvent[]; allFiled: (sym: string) => string[]; bench: (date: string) => number | null }
export interface RunLogRow { date: string; sym: string; runUp: number | null; reaction: number | null; taken: boolean; why: string }

/** The session an event reacts on: index into dates, or -1. */
export function reactionIndex(dates: string[], e: EightKEvent): number {
  for (let i = 0; i < dates.length; i++) { if (e.etMin >= 960 ? dates[i] > e.etDate : dates[i] >= e.etDate) return i; }
  return -1;
}
export function runUp(x: RunCtx, wide?: Array<{ sym: string; width: number }>, log?: RunLogRow[]): Orders | null {
  const { t } = x, D = x.dates[t], sells: string[] = [], buys: Buy[] = [], inTop = new Map(x.el.map((n) => [n.sym, n]));
  for (const [sym, p] of Object.entries(x.st.pos)) { const i = x.dates.indexOf(p.entryDate); if (i >= 0 && t - i + 1 >= RUN.hold) sells.push(sym); }
  const room = RUN.names - (x.held.size - sells.length), b0 = x.bench(x.dates[t - 1]), b1 = x.bench(D), bL = t - 1 - RUN.lookback >= 0 ? x.bench(x.dates[t - 1 - RUN.lookback]) : null;
  const cand: Array<{ sym: string; run: number; rea: number }> = [];
  for (const e of x.events) {
    if (!inTop.has(e.sym) || reactionIndex(x.dates, e) !== t) continue;
    const prior = x.allFiled(e.sym).filter((f) => f < e.filed && (Date.parse(e.filed) - Date.parse(f)) / 864e5 < RUN.quarterGapDays);
    if (prior.length) { log?.push({ date: D, sym: e.sym, runUp: null, reaction: null, taken: false, why: 'second release in the quarter' }); continue; }
    const s = x.series.get(e.sym); if (!s || !(b0 && b1 && bL) || t < RUN.lookback + 2) continue;
    const c = s.c, run = c[t - 1] / c[t - 1 - RUN.lookback] - 1 - (b0 / bL - 1), rea = c[t] / c[t - 1] - 1 - (b1 / b0 - 1);
    if (!(c[t] > 0 && c[t - 1] > 0 && c[t - 1 - RUN.lookback] > 0)) continue;
    const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
    if (run < RUN.cut || rea < RUN.react) { log?.push({ date: D, sym: e.sym, runUp: r4(run), reaction: r4(rea), taken: false, why: run < RUN.cut ? 'run-up below the cut' : 'reaction below 2%' }); continue; }
    cand.push({ sym: e.sym, run: r4(run), rea: r4(rea) });
  }
  cand.sort((a, b) => b.rea - a.rea || (a.sym < b.sym ? -1 : 1));
  for (const n of cand) {
    const base = { date: D, sym: n.sym, runUp: n.run, reaction: n.rea };
    if (x.held.has(n.sym)) { log?.push({ ...base, taken: false, why: 'already held' }); continue; }
    const s = x.series.get(n.sym)!, st = shortStop(atrN(s, t), s.c[t]);
    if (st === null) { wide?.push({ sym: n.sym, width: Math.round(3 * atrN(s, t) / s.c[t] * 1e4) / 1e4 }); log?.push({ ...base, taken: false, why: 'stop too wide' }); continue; }
    if (buys.length >= room) { log?.push({ ...base, taken: false, why: 'no slot' }); continue; }
    buys.push({ sym: n.sym, value: inTop.get(n.sym)!.value, stop: st }); log?.push({ ...base, taken: true, why: 'bought next open' });
  }
  return buys.length || sells.length ? { buys, sells } : null;
}
