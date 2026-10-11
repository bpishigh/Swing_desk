// The 60-second pre-trade checklist. Implements Engine Rules "Entry mechanics and book rules" (checklist rules, daily cap,
// position cap, sector rank, risk caps) and "Setups and entry calculation". Ported from app v9 ntChecks.
// Pure: the caller gathers the book state (open positions, open risk, entries today, sector and industry counts).
import { SETUPS, type SetupId, type Light } from './setups.ts';
import type { NtResult } from './sizing.ts';
import { money } from './format.ts';

export type Tri = 'yes' | 'no' | '';
export type CheckState = 'pass' | 'fail' | 'warn' | 'na';
export interface CheckItem { s: CheckState; t: string }
export interface CheckLimits { name: Light; setups: SetupId[]; maxPos: number; cap: number }
export interface CheckSector { rank: number | null; persist: boolean; newLeader: boolean; above200: boolean | null }
export interface CheckInput {
  market: 'india' | 'us';
  setup: SetupId;
  limits: CheckLimits | null;
  capital: number;
  nt: NtResult;
  sector: string;                 // sector name chosen ('' if none)
  sectorStatus: CheckSector | null;
  industry: string;               // '' if none
  bottomUp: Tri; rs: Tri; above50: Tri; chartLevel: Tri; band: Tri; lowerCircuit: Tri;
  listedSessions?: number;        // IPO setups: sessions since listing
  resultsInWeekdays: number | null; // SESSIONS from today to the results date (use calendar.sessionsBetween; holidays excluded); null if no date entered. Name kept from v9.
  openCount: number;              // open new-trade positions
  openRiskRs: number;             // money at risk in open new trades
  entriesToday: number;           // entries filled or planned today
  sectorCount: number;            // positions already in this sector (legacy kept holdings count in India)
  industryCount: number;          // positions already in this industry
  /** C-30 (off unless the caller passes it): risk of planned, not yet filled orders. Undefined = v9 check (open risk + this trade only). */
  pendingRiskRs?: number;
}
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function ntChecks(i: CheckInput): CheckItem[] {
  const items: CheckItem[] = [];
  const L = i.limits, o = i.nt, us = i.market === 'us';
  const setup = SETUPS[i.setup] ?? SETUPS['1'];
  const m = (n: number, dp = 0) => money(i.market, n, dp);
  if (!L) items.push({ s: 'fail', t: "Save tonight's regime on the Tonight screen first." });
  else {
    const allowed = L.setups.includes(i.setup);
    const redPath = L.name !== 'red' || (i.rs === 'yes' && i.above50 === 'yes');
    items.push({ s: allowed && redPath ? 'pass' : 'fail', t: 'Regime ' + L.name + ': ' + (allowed ? 'setup allowed' : 'setup ' + i.setup + " isn't allowed in " + (L.name === 'red' ? 'Red' : 'Yellow')) + (L.name === 'red' ? (redPath ? '; Red path met (RS top 20%, above its own 50 SMA)' : '; Red pilots need an RS top-20% stock above its own 50 SMA') : '') });
    items.push({ s: i.openCount < L.maxPos ? 'pass' : 'fail', t: 'New-trade positions ' + i.openCount + ' of ' + L.maxPos });
    const capRs = (i.capital * L.cap) / 100;
    if (ok(o.oneR)) {
      if (ok(i.pendingRiskRs)) items.push({ s: i.openRiskRs + i.pendingRiskRs + o.oneR <= capRs + 0.5 ? 'pass' : 'fail', t: 'Open risk ' + m(i.openRiskRs) + ' + pending orders ' + m(i.pendingRiskRs) + ' + this trade ' + m(o.oneR) + ' vs cap ' + m(capRs) });
      else items.push({ s: i.openRiskRs + o.oneR <= capRs + 0.5 ? 'pass' : 'fail', t: 'Open risk ' + m(i.openRiskRs) + ' + this trade ' + m(o.oneR) + ' vs cap ' + m(capRs) });
    }
    items.push({ s: i.entriesToday < 2 ? 'pass' : 'fail', t: 'New entries planned or filled today: ' + i.entriesToday + ' of 2' });
  }
  const ss = i.sectorStatus;
  if (i.bottomUp === 'yes') items.push({ s: 'warn', t: 'Bottom-up industry leader (3+ stocks from one industry passed the scans): pilot size until it persists' });
  else if (!i.sector) items.push({ s: 'fail', t: "Pick the stock's sector (rank comes from your saved weekend ranking)" });
  else if (!ss) items.push({ s: 'fail', t: 'No saved ranking for this sector yet. Save a ranking on the Weekend screen' });
  else {
    const top = L && L.name === 'yellow' ? 2 : 4;
    const inTop = ok(ss.rank) && ss.rank <= top;
    items.push({ s: inTop ? 'pass' : 'fail', t: 'Sector rank ' + (ok(ss.rank) ? ss.rank : 'unranked') + ' (needs top ' + top + ')' });
    if (ss.above200 === false) items.push({ s: 'warn', t: 'Early sector: below its 200 SMA, so pilot size (0.25%) until it clears the 200' });
    else if (ss.above200 === true) items.push({ s: 'pass', t: 'Confirmed sector: above its 200 SMA' });
    items.push({ s: ss.persist ? 'pass' : ss.newLeader ? 'warn' : 'fail', t: ss.persist ? 'In the top 4 two weekends running: full size' : ss.newLeader ? 'New leader: pilot size (0.25%) until the second weekend' : 'Only one weekend in the top 4 and not a new leader: wait for next weekend' });
  }
  items.push({ s: i.sectorCount < 3 ? 'pass' : 'fail', t: 'Positions in this sector: ' + i.sectorCount + ' of 3' + (us ? '' : ' (kept legacy holdings count)') });
  if (i.industry) items.push({ s: i.industryCount < 2 ? 'pass' : 'fail', t: 'Positions in industry "' + i.industry + '": ' + i.industryCount + ' of 2' });
  items.push({ s: i.rs === 'yes' ? 'pass' : i.rs === 'no' ? 'fail' : 'na', t: us ? 'RS leader: RS line vs SPY rising or at a new high' : 'RS top 20% of the Nifty 500 on 3M or 6M' });
  if (ok(o.stopPct)) {
    items.push({ s: o.stopPct <= setup.maxStop ? 'pass' : 'fail', t: 'Stop ' + o.stopPct.toFixed(1) + '% below entry (limit ' + setup.maxStop + '% for ' + setup.short + ')' + (o.floored ? '; moved down to 1.5× ATR' : '') });
  }
  items.push({ s: i.chartLevel === 'yes' ? 'pass' : i.chartLevel === 'no' ? 'fail' : 'na', t: 'Stop sits at a chart level (' + setup.stopHint + ')' });
  const needR = us ? 3 : 2;
  if (ok(o.room)) items.push({ s: o.room >= needR ? 'pass' : 'fail', t: 'Room to nearest resistance ' + o.room.toFixed(1) + 'R (needs ' + needR + 'R' + (us ? ' in the US' : '') + ')' });
  else items.push({ s: 'na', t: 'Enter the nearest overhead resistance to check ' + needR + 'R room' });
  const rd = i.resultsInWeekdays;
  if (setup.resultsExempt && !us) items.push({ s: 'pass', t: 'Results: setup 3 trades after results' });
  else if (rd !== null) items.push({ s: rd > 10 ? 'pass' : 'fail', t: 'Results in ' + rd + ' trading days (needs more than 10)' });
  else items.push({ s: 'na', t: us ? 'Enter the next results date (earnings calendar)' : 'Enter the next results date (ET results calendar)' });
  if (!us) {
    items.push({ s: i.band === 'yes' ? 'fail' : i.band === 'no' ? 'pass' : 'na', t: 'Not in a 2%, 5% or 10% price band' });
    items.push({ s: i.lowerCircuit === 'yes' ? 'fail' : i.lowerCircuit === 'no' ? 'pass' : 'na', t: 'No lower circuit in the last 3 months' });
  }
  if (setup.ipo) { const ls = i.listedSessions; items.push({ s: ok(ls) ? (ls >= 30 ? 'pass' : 'fail') : 'na', t: 'IPO listed 30+ sessions ago' + (ok(ls) ? ' (' + ls + ')' : '') }); }
  if (i.setup === '4' || i.setup === '2') items.push({ s: i.above50 === 'no' ? 'fail' : i.above50 === 'yes' ? 'pass' : 'na', t: 'Closes above its 50 SMA' });
  items.push({ s: 'pass', t: 'First buy, not an add to a loser' });
  return items;
}
