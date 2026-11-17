// India IPO base paper book (owner go, 18 Nov 2026: "yes" to a separate IPO base with its own auto-updating ticker list, data/india/ipo/list.json). Pure: data in, orders out.
// Universe: names on the IPO list, 30 to 250 sessions after listing, at least Rs 5 crore/day (20-session average of close x volume). Market light green or yellow (not red).
// Base (the desk's 1ipo geometry, src/ingest/us-scan-settings.ts): the 15 sessions before tonight at most 25% deep from their high to their low, the prior close within 5% of that high,
// prior close above the 50-session average (or the sessions available, at least 30). Signal tonight (the breakout session): the session's high is at least 0.5% above the base high, the close is at or above the
// base high, and volume is at least 2x its 50-session average. Buy at the next open; C-159 stop (tighter of 3 x ATR(20) and 8%); hold 60 sessions; at most 20 names at 5%; 20-session cooldown per name.
// A window with a one-day move over 40% is skipped (possible unadjusted bonus or split). No relative-strength or group gate: the list needs no industry.
import { shortStop, BOOK, type Buy, type BookState } from './stock-book.ts';
import { atrN, type Orders, type Ser } from './first-wave.ts';

export const IPOB = { names: 20, hold: 60, minSessions: 30, maxSessions: 250, base: 15, depth: 0.25, within: 0.05, trig: 0.005, volMult: 2, floor: 5e7, cooldown: 20, stopCap: BOOK.shortStopCap, atrMult: BOOK.atrMult, rs: false };   // atrMult, rs: replay candidates only; the live book keeps the defaults   // stopCap: the C-159 8% cap; a replay candidate may raise it (the live book does not)
const stopFor = (atr20: number, close: number): number | null => { if (IPOB.stopCap === BOOK.shortStopCap && IPOB.atrMult === BOOK.atrMult) return shortStop(atr20, close); if (!(atr20 > 0) || !(close > 0)) return null; const w = IPOB.atrMult * atr20 / close; return w <= IPOB.stopCap ? w : null; };
export interface IpoListRow { sym: string; listed: string }
export interface IpoCtx { series: Map<string, Ser>; t: number; dates: string[]; held: Set<string>; st: BookState; ipo: IpoListRow[]; light: string; bench63?: number | null }
export interface IpoLogRow { date: string; sym: string; sessions: number; volRatio: number | null; taken: boolean; why: string }

export function ipoBase(x: IpoCtx, wide?: Array<{ sym: string; width: number }>, log?: IpoLogRow[]): Orders | null {
  const { t } = x, D = x.dates[t], sells: string[] = [], buys: Buy[] = [];
  for (const [sym, p] of Object.entries(x.st.pos)) { const i = x.dates.indexOf(p.entryDate); if (i >= 0 && t - i + 1 >= IPOB.hold) sells.push(sym); }
  if (x.light === 'red') return sells.length ? { buys, sells } : null;
  const room = IPOB.names - (x.held.size - sells.length), cand: Array<{ sym: string; value: number; sessions: number; vr: number }> = [];
  for (const L of x.ipo) {
    const s = x.series.get(L.sym); if (!s || !s.h || !s.l || !s.v) continue;
    const li = x.dates.indexOf(L.listed); const k = li < 0 ? -1 : t - li; if (k < IPOB.minSessions || k > IPOB.maxSessions) continue;
    const c = s.c, h = s.h, l = s.l, v = s.v, n = IPOB.base;
    if (!(c[t] > 0 && c[t - 1] > 0 && h[t] > 0)) continue;
    let bh = 0, bl = Infinity, ok = true; for (let i = t - n; i <= t - 1; i++) { if (!(h[i] > 0 && l[i] > 0)) { ok = false; break; } bh = Math.max(bh, h[i]); bl = Math.min(bl, l[i]); } if (!ok) continue;
    const kk = Math.min(50, k), sma = (() => { let a = 0, m = 0; for (let i = t - kk; i <= t - 1; i++) if (c[i] > 0) { a += c[i]; m++; } return m ? a / m : NaN; })();
    if (!((bh - bl) / bh <= IPOB.depth && (bh - c[t - 1]) / bh <= IPOB.within && c[t - 1] > sma)) continue;
    if (IPOB.rs && x.bench63 != null && !(c[t - 1] / c[Math.max(0, t - 64)] - 1 > x.bench63)) continue;   // candidate gate: 63-session return above the comparator's
    if (!(h[t] >= bh * (1 + IPOB.trig) && c[t] >= bh)) continue;
    let av = 0, am = 0; for (let i = t - kk; i <= t - 1; i++) if (v[i] > 0) { av += v[i]; am++; } const vr = am ? v[t] / (av / am) : 0; if (!(vr >= IPOB.volMult)) continue;
    let tv = 0; for (let i = t - 19; i <= t; i++) tv += (c[i] > 0 ? c[i] : 0) * (v[i] > 0 ? v[i] : 0); tv /= 20; if (tv < IPOB.floor) continue;
    let split = false; for (let i = Math.max(li + 1, t - 49); i <= t; i++) if (c[i] > 0 && c[i - 1] > 0 && Math.abs(c[i] / c[i - 1] - 1) > 0.4) { split = true; break; } if (split) continue;
    cand.push({ sym: L.sym, value: tv, sessions: k, vr: Math.round(vr * 100) / 100 });
  }
  cand.sort((a, b) => b.vr - a.vr || (a.sym < b.sym ? -1 : 1));
  for (const n of cand) {
    const base = { date: D, sym: n.sym, sessions: n.sessions, volRatio: n.vr };
    if (x.held.has(n.sym)) { log?.push({ ...base, taken: false, why: 'already held' }); continue; }
    const last = x.st.closed.filter((cl) => cl.sym === n.sym).at(-1); if (last && last.exitDate && x.dates.indexOf(last.exitDate) >= t - IPOB.cooldown) { log?.push({ ...base, taken: false, why: 'cooldown' }); continue; }
    const s = x.series.get(n.sym)!, st = stopFor(atrN(s, t), s.c[t]);
    if (st === null) { wide?.push({ sym: n.sym, width: Math.round(3 * atrN(s, t) / s.c[t] * 1e4) / 1e4 }); log?.push({ ...base, taken: false, why: 'stop too wide' }); continue; }
    if (buys.length >= room) { log?.push({ ...base, taken: false, why: 'no slot' }); continue; }
    buys.push({ sym: n.sym, value: n.value, stop: st }); log?.push({ ...base, taken: true, why: 'bought next open' });
  }
  return buys.length || sells.length ? { buys, sells } : null;
}
