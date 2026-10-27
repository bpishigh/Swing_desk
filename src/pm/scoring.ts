// Scoring of logged verdicts, fixed BEFORE any verdict is judged (owner's "defaults", 27 Oct 2026). Changing a number here is a new version, never an edit
// of how old verdicts are judged. One rule per verdict type; each is judged at 3, 6 and 12 months after the logged date, on closes adjusted for splits and bonuses.
export const SCORING_VERSION = 1, SCORING_REGISTERED = '2026-10-27', HORIZONS = [3, 6, 12] as const;
export const EXIT_TOLERANCE = 0.05;
export const RULES: Record<string, string> = {
  Exit: `Right if the stock is no more than ${EXIT_TOLERANCE * 100}% above its price on the day of the verdict at the follow-up date.`,
  Keep: 'Right if the stock returned at least as much as the Nifty 500 over the same period.',
  Trim: 'Right if the stock returned no more than the average of the names then marked Keep.',
  Harvest: 'Not scored automatically: right if the tax it saved turned out to exceed the round-trip cost, which is known only when the loss is used in a return.',
  Promote: 'Not built yet.',
};
export interface LogEntry { date: string; symbol: string; verdict: string; close: number | null }
export interface Outcome { horizon: number; due: string; status: 'pending' | 'scored' | 'manual' | 'nodata'; right?: boolean; ret?: number; bench?: number; note: string }

export const addMonths = (d: string, m: number): string => { const t = new Date(d + 'T00:00:00Z'); t.setUTCMonth(t.getUTCMonth() + m); return t.toISOString().slice(0, 10); };

/** `priceAt(symbol, date)`: adjusted close on or before the date (null when unknown). `benchAt(date)`: Nifty 500 stand-in on or before the date.
 *  `keepReturn(date, due)`: average return of the names marked Keep on `date`, over the same period (null when none). `lastDate`: the latest date prices exist for. */
export function scoreEntry(e: LogEntry, horizon: number, lastDate: string, f: { priceAt: (s: string, d: string) => number | null; benchAt: (d: string) => number | null; keepReturn: (d: string, due: string, exclude: string) => number | null }): Outcome {
  const due = addMonths(e.date, horizon), base = { horizon, due };
  if (e.verdict === 'Harvest' || e.verdict === 'Promote') return { ...base, status: 'manual', note: RULES[e.verdict] };
  if (due > lastDate) return { ...base, status: 'pending', note: `Due ${due}` };
  const p0 = f.priceAt(e.symbol, e.date), p1 = f.priceAt(e.symbol, due);
  if (!(p0 && p1)) return { ...base, status: 'nodata', note: 'No stored price for one of the two dates.' };
  const ret = p1 / p0 - 1;
  if (e.verdict === 'Exit') return { ...base, status: 'scored', ret, right: p1 <= p0 * (1 + EXIT_TOLERANCE), note: `${(ret * 100).toFixed(1)}% since the verdict` };
  if (e.verdict === 'Keep') { const b0 = f.benchAt(e.date), b1 = f.benchAt(due); if (!(b0 && b1)) return { ...base, status: 'nodata', note: 'No Nifty 500 stand-in for these dates.' }; const bench = b1 / b0 - 1; return { ...base, status: 'scored', ret, bench, right: ret >= bench, note: `${(ret * 100).toFixed(1)}% against ${(bench * 100).toFixed(1)}% for the Nifty 500` }; }
  if (e.verdict === 'Trim') { const k = f.keepReturn(e.date, due, e.symbol); if (k === null) return { ...base, status: 'nodata', note: 'No Keep names to compare with.' }; return { ...base, status: 'scored', ret, bench: k, right: ret <= k, note: `${(ret * 100).toFixed(1)}% against ${(k * 100).toFixed(1)}% for the Keep names` }; }
  return { ...base, status: 'nodata', note: 'No scoring rule for this verdict.' };
}
