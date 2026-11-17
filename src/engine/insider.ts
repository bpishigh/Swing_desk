// US insider buying (Form 4) paper book (docs/BATCH_C_US_PROPOSALS.md U-2; owner: "yes need paper book for insider buying", 17 Nov 2026). Pure: data in, orders out.
// Signal: an open-market purchase (code P, non-derivative) by an officer or director, one insider's lines in a filing added up, at least $250,000, form 4 (amendments excluded), in a top-500 name.
// The filing's acceptance time decides the signal day (after the 16:00 ET close counts for the next session); the book buys at the next open. Hold 60 sessions; C-159 stop (the tighter of 3 x ATR(20) and 8%);
// at most 20 names at 5%; a name already held is not bought again. Logged, not gated: the buyer's role (chief executive or finance chief), lag from trade to filing, distinct insiders buying in the last 30 days.
import { shortStop, type Buy, type BookState } from './stock-book.ts';
import { atrN, type Name, type Orders, type Ser } from './first-wave.ts';

export const INS = { names: 20, hold: 60, floor: 250000 };
export interface InsiderEvent { sym: string; accn: string; signalDate: string; filed: string; value: number; ceoCfo: boolean; lagDays: number | null; distinct30: number }
export interface InsiderCtx { el: Name[]; series: Map<string, Ser>; t: number; dates: string[]; held: Set<string>; st: BookState; events: InsiderEvent[] }
export interface InsiderLogRow { date: string; sym: string; value: number; ceoCfo: boolean; lagDays: number | null; distinct30: number; taken: boolean; why: string }

export function insiderBuy(x: InsiderCtx, wide?: Array<{ sym: string; width: number }>, log?: InsiderLogRow[]): Orders | null {
  const { t } = x, D = x.dates[t], sells: string[] = [], buys: Buy[] = [], inTop = new Map(x.el.map((n) => [n.sym, n]));
  for (const [sym, p] of Object.entries(x.st.pos)) { const i = x.dates.indexOf(p.entryDate); if (i >= 0 && t - i + 1 >= INS.hold) sells.push(sym); }
  const room = INS.names - (x.held.size - sells.length), seen = new Set<string>();
  const cand = x.events.filter((e) => e.signalDate === D && e.value >= INS.floor && inTop.has(e.sym)).sort((a, b) => b.value - a.value || (a.sym < b.sym ? -1 : 1));
  for (const e of cand) {
    const base = { date: D, sym: e.sym, value: Math.round(e.value), ceoCfo: e.ceoCfo, lagDays: e.lagDays, distinct30: e.distinct30 };
    if (seen.has(e.sym)) continue; seen.add(e.sym);
    if (x.held.has(e.sym)) { log?.push({ ...base, taken: false, why: 'already held' }); continue; }
    const s = x.series.get(e.sym), st = s ? shortStop(atrN(s, t), s.c[t]) : null;
    if (st === null) { if (s) wide?.push({ sym: e.sym, width: Math.round(3 * atrN(s, t) / s.c[t] * 1e4) / 1e4 }); log?.push({ ...base, taken: false, why: 'stop too wide' }); continue; }
    if (buys.length >= room) { log?.push({ ...base, taken: false, why: 'no slot' }); continue; }
    buys.push({ sym: e.sym, value: inTop.get(e.sym)!.value, stop: st }); log?.push({ ...base, taken: true, why: 'bought next open' });
  }
  return buys.length || sells.length ? { buys, sells } : null;
}
