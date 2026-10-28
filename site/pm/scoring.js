// Scoring of logged verdicts, fixed BEFORE any verdict is judged (owner's "defaults", 27 Oct 2026). Version 2 (28 Oct 2026) only ADDS the Promote and Harvest rules, before either verdict had been judged; no Exit, Keep or Trim rule changed. Changing a number here is a new version, never an edit
// of how old verdicts are judged. One rule per verdict type; each is judged at 3, 6 and 12 months after the logged date, on closes adjusted for splits and bonuses.
export const SCORING_VERSION = 2, SCORING_REGISTERED = '2026-10-28', HORIZONS = [3, 6, 12]         ;
export const EXIT_TOLERANCE = 0.05;
export const RULES                         = {
  Exit: `Right if the stock is no more than ${EXIT_TOLERANCE * 100}% above its price on the day of the verdict at the follow-up date.`,
  Keep: 'Right if the stock returned at least as much as the Nifty 500 over the same period.',
  Trim: 'Right if the stock returned no more than the average of the names then marked Keep.',
  Harvest: 'Right if, judged one session after the verdict, the tax value logged at the time, less the sale charges both ways, less any rise in price between the sale and the buy-back (a fall adds to it), is above zero. Judged once, in the 3-month column. Tax value is the desk\'s estimate (loss that cancels gains this year, plus half of any part that only carries forward), not a filed return.',
  Promote: 'Right if the stock returned at least as much as the average of the names then marked Keep, over the same period. It tests whether the shortlist picks better stocks than the plain pass-the-exit-test names, not how the Swing trade itself ended.',
};
                                                                                                                                                                                                                                                                              
                                                                                                                                                                          

export const addMonths = (d        , m        )         => { const t = new Date(d + 'T00:00:00Z'); t.setUTCMonth(t.getUTCMonth() + m); return t.toISOString().slice(0, 10); };

/** `priceAt(symbol, date)`: adjusted close on or before the date (null when unknown). `benchAt(date)`: Nifty 500 stand-in on or before the date.
 *  `keepReturn(date, due)`: average return of the names marked Keep on `date`, over the same period (null when none). `lastDate`: the latest date prices exist for. */
export function scoreEntry(e          , horizon        , lastDate        , f                                                                                                                                                                                                                          )          {
  const due = addMonths(e.date, horizon), base = { horizon, due };
  if (e.verdict === 'Harvest') {
    if (horizon !== HORIZONS[0]) return { ...base, status: 'manual', note: 'Judged once, in the first column.' };
    if (!(e.value && e.value > 0) || typeof e.taxValue !== 'number' || typeof e.charges !== 'number') return { ...base, status: 'manual', note: 'Logged before the tax value was kept with the verdict, so it cannot be judged.' };
    const p0 = f.priceAt(e.symbol, e.date), p1 = f.nextClose ? f.nextClose(e.symbol, e.date) : null;
    if (!(p0 && p1)) return { ...base, status: 'pending', note: 'Judged one session after the verdict.' };
    const gap = ((p1 - p0) / p0) * e.value, net = e.taxValue - e.charges - gap;
    return { ...base, status: 'scored', right: net > 0, ret: (p1 - p0) / p0, note: `tax value ${Math.round(e.taxValue)} less charges ${Math.round(e.charges)} less price gap ${Math.round(gap)} = ${Math.round(net)}` };
  }
  if (due > lastDate) return { ...base, status: 'pending', note: `Due ${due}` };
  const p0 = f.priceAt(e.symbol, e.date), p1 = f.priceAt(e.symbol, due);
  if (!(p0 && p1)) return { ...base, status: 'nodata', note: 'No stored price for one of the two dates.' };
  const ret = p1 / p0 - 1;
  if (e.verdict === 'Exit') return { ...base, status: 'scored', ret, right: p1 <= p0 * (1 + EXIT_TOLERANCE), note: `${(ret * 100).toFixed(1)}% since the verdict` };
  if (e.verdict === 'Keep') { const b0 = f.benchAt(e.date), b1 = f.benchAt(due); if (!(b0 && b1)) return { ...base, status: 'nodata', note: 'No Nifty 500 stand-in for these dates.' }; const bench = b1 / b0 - 1; return { ...base, status: 'scored', ret, bench, right: ret >= bench, note: `${(ret * 100).toFixed(1)}% against ${(bench * 100).toFixed(1)}% for the Nifty 500` }; }
  if (e.verdict === 'Promote') { const k = f.keepReturn(e.date, due, e.symbol); if (k === null) return { ...base, status: 'nodata', note: 'No Keep names to compare with.' }; return { ...base, status: 'scored', ret, bench: k, right: ret >= k, note: `${(ret * 100).toFixed(1)}% against ${(k * 100).toFixed(1)}% for the Keep names` }; }
  if (e.verdict === 'Trim') { const k = f.keepReturn(e.date, due, e.symbol); if (k === null) return { ...base, status: 'nodata', note: 'No Keep names to compare with.' }; return { ...base, status: 'scored', ret, bench: k, right: ret <= k, note: `${(ret * 100).toFixed(1)}% against ${(k * 100).toFixed(1)}% for the Keep names` }; }
  return { ...base, status: 'nodata', note: 'No scoring rule for this verdict.' };
}
