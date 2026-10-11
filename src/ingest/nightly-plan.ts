// Decides, at each half-hourly tick, whether the Repo Desk's India nightly jobs need to be started.
// Pure: the caller supplies the clock, the calendar, which day each data set has reached and which runs are in flight.

import type { Calendar } from '../engine/calendar.ts';

export const START_MIN_IST = 19 * 60;        // NSE's all-stock file is out well before this; do not start earlier
export const ALERT_MIN_IST = 22 * 60 + 30;   // not written by now: tell the user, once
export const MAX_ATTEMPTS = 20;              // per job per target day

export interface PlanInput {
  nowMs: number;
  cal: Calendar;
  feedDate: string;        // latest day in data/india/feed/latest.json
  stocksDate: string;      // latest day in data/india/stocks/latest.json
  inflight: { nightly: boolean; stocks: boolean };
  state: { target?: string; attempts?: { nightly: number; stocks: number }; alertedFor?: string };
}
export interface Plan {
  target: string;
  dispatch: Array<{ workflow: 'india-nightly.yml' | 'india-stocks.yml'; inputs: Record<string, string> }>;
  alert: string | null;
  state: { target: string; attempts: { nightly: number; stocks: number }; alertedFor?: string };
}

/** The session whose data should be ready by now: today from 19:00 IST on a session day, else the latest earlier session. */
export function targetSession(nowMs: number, cal: Calendar): { target: string; today: string; minutes: number } {
  const ist = new Date(nowMs + 5.5 * 3600e3);
  const today = ist.toISOString().slice(0, 10);
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  if (cal.isSession(today) && minutes >= START_MIN_IST) return { target: today, today, minutes };
  return { target: cal.prevSession(today), today, minutes };
}

export function planNightly(i: PlanInput): Plan {
  const { target, today, minutes } = targetSession(i.nowMs, i.cal);
  const fresh = i.state.target === target;
  const attempts = fresh ? { nightly: i.state.attempts?.nightly ?? 0, stocks: i.state.attempts?.stocks ?? 0 } : { nightly: 0, stocks: 0 };
  const dispatch: Plan['dispatch'] = [];
  if (i.feedDate < target && !i.inflight.nightly && attempts.nightly < MAX_ATTEMPTS) {
    dispatch.push({ workflow: 'india-nightly.yml', inputs: { date: target } });
    attempts.nightly++;
  }
  if (i.stocksDate < target && !i.inflight.stocks && attempts.stocks < MAX_ATTEMPTS) {
    // sessions missed since the stored day are filled in the same run
    const missed = Math.max(0, Math.min(10, i.cal.sessionsBetween(i.stocksDate, target) - 1));
    dispatch.push({ workflow: 'india-stocks.yml', inputs: { date: target, backfill: String(missed) } });
    attempts.stocks++;
  }
  const behind = i.feedDate < target || i.stocksDate < target;
  const alertedFor = fresh ? i.state.alertedFor : undefined;
  const late = target < today || minutes >= ALERT_MIN_IST;
  const stuck = attempts.nightly >= MAX_ATTEMPTS || attempts.stocks >= MAX_ATTEMPTS;
  let alert: string | null = null;
  if (behind && (late || stuck) && alertedFor !== target) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
    alert = `India data for ${target} is not written yet at ${hh} IST (index feed at ${i.feedDate}, stock store at ${i.stocksDate})${stuck ? '; retries used up' : ''}.`;
  }
  return { target, dispatch, alert, state: { target, attempts, ...(alert ? { alertedFor: target } : alertedFor ? { alertedFor } : {}) } };
}
