// Decides, at each half-hourly tick, whether the Repo Desk's US daily job and weekly stock screen need to be started.
// Pure: the caller supplies the clock, the US calendar, the dates each data set has reached and which runs are in flight.

import type { Calendar } from '../engine/calendar.ts';

export const US_START_MIN_ET = 17 * 60 + 30;   // same threshold the daily job itself uses for "today's close"
export const US_ALERT_MIN_ET = 22 * 60 + 30;
export const US_BREADTH_START_MIN_ET = 20 * 60 + 45;   // Nasdaq's daily history carries the close from about 21:10 to 21:40 ET; trying from 17:40 burned all eight attempts a night (about 28 Actions minutes)
export const US_SCAN_START_MIN_ET = 21 * 60 + 45;   // the official scan and paper book (us-hist-nightly) need Nasdaq's close, there from about 21:10 to 21:40 ET
export const US_SCAN_ALERT_MIN_ET = 23 * 60 + 30;
export const US_MAX_ATTEMPTS = 8;              // Tiingo's free tier allows about 50 requests an hour; a daily run uses 16
export const SCREEN_START_MIN_IST = 8 * 60 + 30; // Saturday morning India time, as the Claude Desk's weekly task ran
export const SCREEN_ALERT_MIN_IST = 12 * 60;

export interface UsPlanInput {
  nowMs: number;
  cal: Calendar;            // US calendar
  feedDate: string;         // latest day in data/us/feed/latest.json
  screenDate: string;       // feed day the latest screen was run against
  breadthDate: string;      // latest day in data/us/breadth.json
  scanDate?: string;        // latest day in data/us/scan/latest.json (the official scan); omit to leave the scan job to its own schedule
  inflight: { daily: boolean; screen: boolean; breadth: boolean; scan?: boolean };
  state: UsPlanState;
}
export interface UsPlanState {
  daily?: { target: string; attempts: number; alertedFor?: string };
  screen?: { target: string; attempts: number; alertedFor?: string };
  breadth?: { target: string; attempts: number; alertedFor?: string };
  scan?: { target: string; attempts: number; alertedFor?: string };
}
export interface UsPlan {
  dispatch: Array<{ workflow: 'us-nightly.yml' | 'us-screen.yml' | 'us-breadth.yml' | 'us-hist-nightly.yml'; inputs: Record<string, string> }>;
  alerts: string[];
  state: UsPlanState;
}

export function etParts(nowMs: number): { date: string; minutes: number } {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const istParts = (nowMs: number) => {
  const d = new Date(nowMs + 5.5 * 3600e3);
  return { date: d.toISOString().slice(0, 10), minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() };
};
const hhmm = (m: number) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

/** The US session whose close should be stored by now. */
export function usTarget(nowMs: number, cal: Calendar): { target: string; minutes: number; today: string } {
  const et = etParts(nowMs);
  const target = cal.isSession(et.date) && et.minutes >= US_START_MIN_ET ? et.date : cal.prevSession(et.date);
  return { target, minutes: et.minutes, today: et.date };
}

export function planUs(i: UsPlanInput): UsPlan {
  const dispatch: UsPlan['dispatch'] = [];
  const alerts: string[] = [];
  const state: UsPlanState = {};

  // daily feed
  const { target, minutes, today } = usTarget(i.nowMs, i.cal);
  const d0 = i.state.daily;
  const dFresh = d0?.target === target;
  let dAtt = dFresh ? d0!.attempts : 0;
  let dAlerted = dFresh ? d0!.alertedFor : undefined;
  if (i.feedDate < target && !i.inflight.daily && dAtt < US_MAX_ATTEMPTS) { dispatch.push({ workflow: 'us-nightly.yml', inputs: { date: target, backfill: String(Math.max(0, Math.min(10, i.cal.sessionsBetween(i.feedDate, target) - 1))) } }); dAtt++; }
  const dLate = target < today || minutes >= US_ALERT_MIN_ET;
  if (i.feedDate < target && (dLate || dAtt >= US_MAX_ATTEMPTS) && dAlerted !== target) {
    alerts.push(`US data for ${target} is not written yet at ${hhmm(minutes)} ET (feed at ${i.feedDate})${dAtt >= US_MAX_ATTEMPTS ? '; retries used up' : ''}.`);
    dAlerted = target;
  }
  // breadth (S&P 500 above its 50-day average) for the same close; independent of the Tiingo feed
  const b0 = i.state.breadth;
  const bFresh = b0?.target === target;
  let bAtt = bFresh ? b0!.attempts : 0;
  let bAlerted = bFresh ? b0!.alertedFor : undefined;
  const bReady = target < today || minutes >= US_BREADTH_START_MIN_ET;
  if (i.breadthDate < target && bReady && !i.inflight.breadth && bAtt < US_MAX_ATTEMPTS) { dispatch.push({ workflow: 'us-breadth.yml', inputs: { date: target } }); bAtt++; }
  if (i.breadthDate < target && (dLate || bAtt >= US_MAX_ATTEMPTS) && bAlerted !== target) {
    alerts.push(`US breadth for ${target} is not written yet at ${hhmm(minutes)} ET (latest ${i.breadthDate})${bAtt >= US_MAX_ATTEMPTS ? '; retries used up' : ''}.`);
    bAlerted = target;
  }
  // official scan and paper book: same close, from Nasdaq's history once it is there
  if (i.scanDate !== undefined) {
    const c0 = i.state.scan, cFresh = c0?.target === target;
    let cAtt = cFresh ? c0!.attempts : 0, cAlerted = cFresh ? c0!.alertedFor : undefined;
    const cReady = target < today || minutes >= US_SCAN_START_MIN_ET;
    if (i.scanDate < target && cReady && !i.inflight.scan && cAtt < US_MAX_ATTEMPTS) { dispatch.push({ workflow: 'us-hist-nightly.yml', inputs: {} }); cAtt++; }
    const cLate = target < today || minutes >= US_SCAN_ALERT_MIN_ET;
    if (i.scanDate < target && (cLate || cAtt >= US_MAX_ATTEMPTS) && cAlerted !== target) {
      alerts.push(`US scan for ${target} is not written yet at ${hhmm(minutes)} ET (latest ${i.scanDate})${cAtt >= US_MAX_ATTEMPTS ? '; retries used up' : ''}.`);
      cAlerted = target;
    }
    state.scan = { target, attempts: cAtt, ...(cAlerted ? { alertedFor: cAlerted } : {}) };
  }
  state.breadth = { target, attempts: bAtt, ...(bAlerted ? { alertedFor: bAlerted } : {}) };
  state.daily = { target, attempts: dAtt, ...(dAlerted ? { alertedFor: dAlerted } : {}) };

  // weekly screen: Saturday or Sunday India time, against the last US session
  const ist = istParts(i.nowMs);
  const lastUs = usTarget(i.nowMs, i.cal).target;
  const weekend = ist.dow === 6 || ist.dow === 0;
  const s0 = i.state.screen;
  const sFresh = s0?.target === lastUs;
  let sAtt = sFresh ? s0!.attempts : 0;
  let sAlerted = sFresh ? s0!.alertedFor : undefined;
  const dueDay = ist.dow === 0 || (ist.dow === 6 && ist.minutes >= SCREEN_START_MIN_IST);
  const due = weekend && dueDay && i.screenDate < lastUs;
  if (due && i.feedDate >= lastUs && !i.inflight.screen && sAtt < US_MAX_ATTEMPTS) { sAtt++; dispatch.push({ workflow: 'us-screen.yml', inputs: {} }); }
  const sLate = ist.dow === 0 || (ist.dow === 6 && ist.minutes >= SCREEN_ALERT_MIN_IST);
  if (due && (sLate || sAtt >= US_MAX_ATTEMPTS) && sAlerted !== lastUs) {
    alerts.push(`The weekly US screen for ${lastUs} is not done yet at ${hhmm(ist.minutes)} IST (screen at ${i.screenDate}, feed at ${i.feedDate})${sAtt >= US_MAX_ATTEMPTS ? '; retries used up' : ''}.`);
    sAlerted = lastUs;
  }
  state.screen = { target: lastUs, attempts: sAtt, ...(sAlerted ? { alertedFor: sAlerted } : {}) };
  return { dispatch, alerts, state };
}
