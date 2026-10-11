// Exit rules, evaluated each evening for an open trade. Implements Engine Rules "Exits, journal and review" (the nine rules,
// India and US differences). Ported from app v9 evaluate(). Pure: today's date, the regime-drop flag and market are inputs.
import { SETUPS, type SetupId } from './setups.ts';
import { firstEntry, rPerShare, held, type Trade } from './journal.ts';
import { px, daysBetween } from './format.ts';
import { WEEKDAYS, type Calendar } from './calendar.ts';

export interface OpenTrade extends Trade {
  setup?: SetupId; stop?: number; pivot?: number; maxClose?: number; added?: boolean; thirdSold?: boolean; extSold?: boolean;
  addShares?: number; gttPlaced?: boolean; resultsDate?: string;
}
export interface Evening {
  close?: number; ema21?: number; ema10?: number; prevLow?: number; wk10?: number; wkClose?: number;
  climax?: boolean; emaApprox?: boolean;
}
export type ActionClass = 'a-sell' | 'a-buy' | 'a-move' | 'a-info';
export interface Action { c: ActionClass; r: string; t: string }
export interface ExitResult { acts: Action[]; gainR: number; sessions: number; stop: number; newStop?: number; maxClose?: number }

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function evaluate(t: OpenTrade, ev: Evening, today: string, market: 'india' | 'us', regimeDropped: boolean, cal: Calendar = WEEKDAYS): ExitResult {
  const us = market === 'us';
  const P = (n: number) => px(market, n);
  const SELLNEXT = us ? ' shares with a sell order before the next US open.' : ' shares tomorrow with an AMO.';
  const STOPWORD = us ? 'stop order' : 'GTT';
  const acts: Action[] = [];
  const E = firstEntry(t), R = rPerShare(t), h = held(t);
  const { close, ema21, ema10, prevLow, wk10, wkClose } = ev;
  const sessions = cal.sessionsBetween(t.entryDate, today), days = daysBetween(t.entryDate as string, today);
  const stop = t.stop as number;
  const gainR = ok(close) && R > 0 ? (close - E) / R : NaN;
  if (!t.gttPlaced) acts.push({ c: 'a-move', r: 'Rule 1', t: us ? 'Place a sell stop order in INDmoney for ' + h + ' shares at ' + P(stop) + " (re-enter before each open if it doesn't carry over)." : 'Place a GTT sell for ' + h + ' shares at ' + P(stop) + ', no limit price.' });
  if (!ok(close)) { acts.push({ c: 'a-info', r: 'Tonight', t: "Enter today's close to run the exit rules." }); return { acts, gainR, sessions, stop }; }
  if (close <= stop) { acts.push({ c: 'a-sell', r: 'Rule 2', t: 'The close is at or below the stop ' + P(stop) + (us ? '. The stop order should have sold: record the exit.' : '. The GTT should have sold: record the exit.') }); return { acts, gainR, sessions, stop }; }
  const setup = t.setup ? SETUPS[t.setup] : undefined;
  if (setup?.breakout && sessions <= 3 && ok(t.pivot) && close < t.pivot) acts.push({ c: 'a-sell', r: 'Rule 3 · failed breakout', t: 'Closed back below the pivot ' + P(t.pivot) + ' within 3 sessions. Sell all ' + h + SELLNEXT });
  const maxClose = Math.max(t.maxClose || -Infinity, close);
  if (sessions >= 10 && maxClose < E + R) acts.push({ c: 'a-sell', r: 'Rule 4 · time stop', t: sessions + ' sessions without a close at +1R (' + P(E + R) + '). Sell all ' + h + ' shares.' });
  let newStop = stop;
  if (!t.added && !t.thirdSold && (t.addShares || 0) > 0 && gainR >= 1) {
    if (gainR >= 2) acts.push({ c: 'a-info', r: 'Add skipped', t: 'The first +1R close is already at +2R or higher: skip the add and take the third (rule 5).' });
    else { acts.push({ c: 'a-buy', r: 'Add 40%', t: 'Closed at +1R. Buy ' + t.addShares + (us ? ' shares with a limit buy at ' : ' shares tomorrow with an AMO limit at ') + P(close * 1.01) + ', then move the stop on all shares to ' + P(E) + '.' }); newStop = Math.max(newStop, E); }
  }
  if (!t.thirdSold && gainR >= 2) { const n = Math.floor(h / 3); acts.push({ c: 'a-sell', r: 'Rule 5 · +2R', t: 'Sell ' + n + ' shares (a third). Move the ' + STOPWORD + ' on the remaining ' + (h - n) + ' to breakeven ' + P(E) + '.' }); newStop = Math.max(newStop, E); }
  if (t.thirdSold) {
    if (days < 49 && !us) {
      if (ok(ema21) && close < ema21) acts.push({ c: 'a-sell', r: 'Rule 6 · trail', t: 'Closed below the 20 EMA (' + P(ema21) + (ev.emaApprox ? ', approximate: confirm on Dhan first' : '') + ') in weeks 1–7. Sell the remaining ' + h + SELLNEXT });
      else if (!ok(ema21)) acts.push({ c: 'a-info', r: 'Rule 6', t: 'Enter the 20 EMA to check the trail.' });
    } else {
      if (ok(wk10) && ok(wkClose) && wkClose < wk10) acts.push({ c: 'a-sell', r: 'Rule 6 · weekly trail', t: 'Weekly close ' + P(wkClose) + ' is below the 10-week average ' + P(wk10) + '. Sell the remaining ' + h + SELLNEXT });
      else if (!ok(wk10)) acts.push({ c: 'a-info', r: 'Rule 6', t: us ? 'US trail: enter the weekly close and 10-week average at the weekend.' : 'Week 8+: enter the weekly close and 10-week average at the weekend.' });
    }
    if (!t.extSold && ((ok(ema21) && close >= ema21 * 1.2) || ev.climax)) acts.push({ c: 'a-sell', r: 'Rule 7 · extended', t: 'Sell another third (' + Math.floor(h / 2) + ' shares) into the strength.' });
  }
  if (t.resultsDate) {
    const rd = cal.sessionsBetween(today, t.resultsDate);
    if (rd >= 0 && rd <= 2 && t.resultsDate >= today) {
      if (gainR < 2) acts.push({ c: 'a-sell', r: 'Rule 8 · results', t: 'Results in ' + rd + ' session(s) and the gain is below 2R. Exit all ' + h + ' shares.' });
      else { acts.push({ c: 'a-move', r: 'Rule 8 · results', t: 'Results in ' + rd + ' session(s); gain is 2R+. Hold with the stop at breakeven ' + P(E) + '.' }); newStop = Math.max(newStop, E); }
    }
  }
  if (regimeDropped && gainR < 1) {
    const cand = Math.max(ok(prevLow) ? prevLow : -Infinity, ok(ema10) ? ema10 : -Infinity);
    if (ok(cand) && cand > newStop) { acts.push({ c: 'a-move', r: 'Rule 9 · regime drop', t: 'Raise the stop to ' + P(cand) + " (higher of today's low and the 10 EMA)." }); newStop = cand; }
    else if (!ok(prevLow) && !ok(ema10)) acts.push({ c: 'a-info', r: 'Rule 9', t: "Regime dropped: enter today's low and the 10 EMA to tighten this stop." });
  }
  if (newStop > stop) acts.push({ c: 'a-move', r: us ? 'Stop order' : 'GTT tonight', t: 'Move the ' + STOPWORD + ' to ' + P(newStop) + " for the shares you'll hold." });
  if (!acts.some((a) => a.c === 'a-sell' || a.c === 'a-buy' || a.c === 'a-move')) acts.push({ c: 'a-info', r: 'Hold', t: 'No rule fires. The ' + STOPWORD + ' stays at ' + P(stop) + ' for ' + h + ' shares.' });
  return { acts, gainR, sessions, stop, newStop, maxClose };
}
