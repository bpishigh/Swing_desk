// Backtester: runs one desk trade through the LIVE exit function evaluate() (src/engine/exits.ts), night by night on a stored series. C-68.
// Why: the earlier replays (C-64, C-65) used a hand-written port of the exits that differs from the live function (20 EMA trail from session 1,
// no rule 8, 35-session switch, ...). Here the rules are not re-implemented: each evening the trade is described to evaluate() exactly as the
// journal would describe it, and its actions are carried out.
//
// Conventions (fixed, disclosed):
//  - Full position of 100 units bought at the trigger; no 40% add (addShares = 0), so R is measured on the full position.
//  - A sell action on an evening is carried out at the NEXT session's close (the desk sells next morning with an AMO; the earlier replays used the
//    next close too, so the numbers stay comparable). A stop is a GTT: if a session's low is at or below the stop in force, the whole remainder
//    is sold at the stop price (no gap-through modelling).
//  - A stop moved by an evening's actions applies from the next session. Stops only move up (evaluate() never lowers one).
//  - The 20 EMA is a 20-period exponential average (2/21). The 10 EMA is 2/11. The weekly values use the last session of each week.
//  - Rule 9 (regime drop) is not applied (the replays fix the light to green); rule 8 uses the results date given, if any.
import { evaluate, type OpenTrade, type Evening } from '../engine/exits.ts';
import { makeCalendar, type Calendar } from '../engine/calendar.ts';
import type { SetupId } from '../engine/setups.ts';

export interface DeskSimInput {
  dates: string[];                 // session dates, ascending
  c: ArrayLike<number>; h: ArrayLike<number>; l: ArrayLike<number>;   // adjusted close, high, low on the same axis (NaN or <= 0 = no bar)
  e: number;                       // index of the session the trade is filled
  trigger: number; stop: number;
  setup: SetupId; pivot?: number;  // pivot = the basis a breakout must hold in its first 3 sessions
  resultsDate?: string;            // next results date known at entry (rule 8)
  maxHold?: number;                // sessions after entry before the position is closed at the close (default 60)
  weekEnd?: boolean[];             // true on the last session of each week (computed from dates when omitted)
  cal: Calendar;
  rules?: { rule8?: boolean };     // rule 8 on by default
  entryAtClose?: boolean;          // the position is bought at the close of session e (not intraday): that session's low is not tested against the stop
}
export interface DeskSimResult { R: number; held: number; reason: string; exitIdx: number; sold: Array<{ i: number; shares: number; price: number; why: string }> }

const wkKey = (d: string): number => { const t = new Date(d + 'T00:00:00Z'); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day + 3); const y = t.getUTCFullYear(); const j = new Date(Date.UTC(y, 0, 4)); return y * 100 + 1 + Math.floor((t.getTime() - j.getTime()) / 864e5 / 7); };
export const weekEnds = (dates: string[]): boolean[] => dates.map((d, i) => i === dates.length - 1 || wkKey(dates[i + 1]) !== wkKey(d));
const UNITS = 100;

/** A calendar made from the stored session dates (holidays are simply absent). A date outside the stored range falls back to weekdays. */
export function dateCalendar(dates: string[]): Calendar {
  const idx = new Map(dates.map((d, i) => [d, i])), wd = makeCalendar();
  return {
    isSession: (d) => idx.has(d) || (!idx.has(d) && d > dates[dates.length - 1] && wd.isSession(d)),
    sessionsBetween: (a, b) => { if (!a || !b || b <= a) return 0; const ia = idx.get(a), ib = idx.get(b); return ia !== undefined && ib !== undefined ? ib - ia : wd.sessionsBetween(a, b); },
    addSessions: (d, n) => { const i = idx.get(d); return i !== undefined && dates[i + n] ? dates[i + n] : wd.addSessions(d, n); },
    prevSession: (d) => { const i = idx.get(d); return i !== undefined && i > 0 ? dates[i - 1] : wd.prevSession(d); },
  };
}

export function deskSim(x: DeskSimInput): DeskSimResult | null {
  const { dates, c, h, l, e, trigger: E, setup, cal } = x;
  const T = dates.length, maxHold = x.maxHold ?? 60, we = x.weekEnds ?? weekEnds(dates);
  const Rk = E - x.stop; if (!(Rk > 0) || e < 0 || e >= T) return null;
  const ema = (span: number): Float64Array => { const a = new Float64Array(T).fill(NaN), k = 2 / (span + 1); let v = NaN; for (let i = Math.max(0, e - 60); i < T; i++) { if (!(c[i] > 0)) continue; v = v !== v ? c[i] : v + k * (c[i] - v); a[i] = v; } return a; };
  const ema20 = ema(20), ema10 = ema(10);
  const sold: DeskSimResult['sold'] = [];
  let stop = x.stop, left = UNITS, maxClose = -Infinity, thirdSold = false, extSold = false, pending: { shares: number; why: string; flag?: 'third' | 'ext' } | null = null, pendingStop = stop;
  let reason = 'end', exitIdx = e;
  const sell = (i: number, shares: number, price: number, why: string) => { shares = Math.min(shares, left); if (shares <= 0) return; sold.push({ i, shares, price, why }); left -= shares; };
  for (let i = e; i < T && i <= e + maxHold; i++) {
    if (!(c[i] > 0)) continue;
    if (i > e) stop = Math.max(stop, pendingStop);                           // an evening's stop move is in force from the next session
    if (pending && i > e) {                                                  // last evening's sell, carried out at this close
      const p = pending; pending = null; sell(i, p.shares, c[i], p.why);
      if (p.flag === 'third') thirdSold = true; if (p.flag === 'ext') extSold = true;
      exitIdx = i; if (left <= 0) { reason = p.why; break; }
    }
    if (!(x.entryAtClose && i === e) && l[i] <= stop) { sell(i, left, stop, stop >= E ? 'stop-at-entry' : 'stop'); reason = stop >= E ? 'stop-at-entry' : 'stop'; exitIdx = i; break; }
    // evening: describe the trade to the live function
    const wk: number[] = []; for (let j = i; j >= 0 && wk.length < 10; j--) if (we[j] && c[j] > 0) wk.push(c[j]);
    const ev: Evening = { close: c[i], ema21: ema20[i], ema10: ema10[i], prevLow: l[i], wk10: wk.length === 10 ? wk.reduce((a, b) => a + b, 0) / 10 : undefined, wkClose: we[i] ? c[i] : undefined };
    const trade: OpenTrade = {
      entryDate: dates[e], stop0: x.stop, trigger: E, fullShares: UNITS, lots: [{ date: dates[e], shares: UNITS, price: E }],
      sells: sold.map((s) => ({ shares: s.shares, price: s.price })), setup, stop, pivot: x.pivot, maxClose: maxClose === -Infinity ? undefined : maxClose,
      thirdSold, extSold, addShares: 0, gttPlaced: true, ...(x.rules?.rule8 === false ? {} : { resultsDate: x.resultsDate }),
    };
    const out = evaluate(trade, ev, dates[i], 'india', false, cal);
    if (Number.isFinite(out.maxClose)) maxClose = out.maxClose as number;
    const sells = out.acts.filter((a) => a.c === 'a-sell' && !a.r.startsWith('Rule 2'));
    const all = sells.find((a) => /^Rule (3|4|6|8)/.test(a.r));
    if (all) pending = { shares: left, why: all.r };
    else {
      const t5 = sells.find((a) => a.r.startsWith('Rule 5')), t7 = sells.find((a) => a.r.startsWith('Rule 7'));
      if (t5) pending = { shares: Math.floor(left / 3), why: 'Rule 5', flag: 'third' };
      else if (t7) pending = { shares: Math.floor(left / 2), why: 'Rule 7', flag: 'ext' };
    }
    pendingStop = Math.max(pendingStop, out.newStop ?? stop);
    exitIdx = i;
  }
  if (left > 0) {                                                            // 60-session cap or end of data: the rest goes at the last close
    let last = -1; for (let i = Math.min(T - 1, e + maxHold); i >= e; i--) if (c[i] > 0) { last = i; break; }
    if (last < 0) return null;
    sell(last, left, c[last], 'cap'); if (reason === 'end') reason = last >= e + maxHold ? 'cap-60' : 'end-of-data'; exitIdx = last;
  }
  const pnl = sold.reduce((a, s) => a + s.shares * (s.price - E), 0);
  return { R: pnl / (UNITS * Rk), held: exitIdx - e + 1, reason, exitIdx, sold };
}
