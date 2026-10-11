// Book-level numbers: open risk, whole-book count, today's limits (with the three risk adjustments) and the regime-drop flag.
// Implements Engine Rules "Entry mechanics and book rules" (risk adjustments: proven Green 1%, India VIX above 20 halves, risk halving).
// Ported from app v9 (openRiskRs, bookCount, currentLimits, regimeDroppedToday, trackerDropped, previousRegime).
// Pure: the caller supplies trades, legacy docs, the chosen regime and the journal state.
import { held, avgCost, halvingState, type Trade } from './journal.ts';
import { regimeFrom, type TrackerRow, type RegimeOptions } from './regime.ts';
import type { Proposals, Params } from './settings.ts';
import { LIMITS, type Light, type LightLimits, type Market } from './setups.ts';
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export interface BookTrade extends Trade { stop?: number }

/** Money at risk now on open new trades: held shares x (average cost - current stop), never negative per trade. */
export function openRiskRs(open: BookTrade[]): number {
  return open.reduce((s, t) => {
    const h = held(t), c = avgCost(t), st = t.stop;
    return s + (h > 0 && ok(c) && ok(st) ? h * Math.max(0, c - st) : 0);
  }, 0);
}

/** India: open trades + kept legacy + unchecked legacy (10-stock target). US: open trades only. */
export function bookCount(market: Market, openN: number, legacyKeptN: number, legacyUncheckedN: number): number {
  return market === 'us' ? openN : openN + legacyKeptN + legacyUncheckedN;
}

export interface LimitsRegime { date?: string; vix?: number; result: Light }
export interface TodayLimits extends LightLimits { name: Light; why: string[]; date: string; stale: boolean }

/** Pick the regime the desk uses: the tracker result if complete, else the saved regime for today, else the latest saved. */
export function pickRegime(rows: TrackerRow[], saved: Record<string, { result: Light; vix?: number }>, today: string, opts: RegimeOptions = {}): LimitsRegime | null {
  const tracker = rows.length ? regimeFrom(rows, opts) : null;
  if (tracker && !tracker.incomplete) { const last = rows[rows.length - 1]; return { date: last.date, vix: last.vix, result: tracker.name }; }
  if (saved[today]) return { date: today, ...saved[today] };
  const ks = Object.keys(saved).sort();
  return ks.length ? { date: ks[ks.length - 1], ...saved[ks[ks.length - 1]] } : null;
}

export interface LimitsInput {
  market: Market; today: string; regime: LimitsRegime | null;
  /** Table to use; default is the current rules table. Replays against v9 pass the old v9 table. */
  table?: Record<Market, Record<Light, LightLimits>>;
  /** Proposed changes (C-33, C-34); all off unless given. */
  proposals?: Pick<Proposals, 'usOpenRiskByLight' | 'usVixHalving'>;
  params?: Pick<Params, 'usOpenRiskCap' | 'usVixThreshold'>;
  /** Journal Test passed (fresh-money pass). */
  freshPass: boolean;
  /** halvingState() result */
  halving: ReturnType<typeof halvingState>;
}
export function currentLimits(i: LimitsInput): TodayLimits | null {
  const lr = i.regime; if (!lr || !lr.result) return null;
  const name = lr.result; const us = i.market === 'us';
  const L = { ...(i.table ?? LIMITS)[i.market][name] };
  if (us && i.proposals?.usOpenRiskByLight && i.params) L.cap = i.params.usOpenRiskCap[name]; // C-33
  let risk = L.risk; const why: string[] = [];
  if (!us && name === 'green' && i.freshPass) { risk = 1; why.push('Proven: Green uses 1%.'); }
  const vix = lr.vix;
  if (!us && ok(vix) && vix > 20) { risk /= 2; why.push(`VIX ${vix} above 20 halves risk.`); }
  if (us && i.proposals?.usVixHalving && i.params && ok(vix) && vix > i.params.usVixThreshold) { risk /= 2; why.push(`US VIX ${vix} above ${i.params.usVixThreshold} halves risk.`); } // C-34
  const hs = i.halving;
  if (hs.halved) { risk /= 2; why.push(hs.streakHalved ? 'Three losses in a row halve risk until two winners close.' : `Equity is ${hs.dd.toFixed(1)}% below peak, halving risk.`); }
  return { ...L, name, risk, why, date: lr.date || i.today, stale: (lr.date || i.today) !== i.today };
}

const LV: Record<Light, number> = { red: 0, yellow: 1, green: 2 };
/** Tracker based: did the regime fall between the previous row and the latest? */
export function trackerDropped(rows: TrackerRow[], opts: RegimeOptions = {}): boolean {
  if (rows.length < 2) return false;
  const a = regimeFrom(rows, opts), b = regimeFrom(rows.slice(0, -1), opts);
  return !!(a && b && !a.incomplete && !b.incomplete && a.lv < b.lv);
}
/** With tracker rows use the tracker; otherwise compare today's saved regime with the last earlier one. */
export function regimeDroppedToday(rows: TrackerRow[], saved: Record<string, { result: Light }>, today: string, opts: RegimeOptions = {}): boolean {
  if (rows.length) return trackerDropped(rows, opts);
  const cur = saved[today]; if (!cur) return false;
  const ks = Object.keys(saved).sort().filter((k) => k < today);
  if (!ks.length) return false;
  return LV[cur.result] < LV[saved[ks[ks.length - 1]].result];
}
