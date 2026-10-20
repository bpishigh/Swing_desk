// "How did this trade go?" For a holding that has been sold (fully or partly): the result against an index over the same days, how the entry looked,
// how far the price went against and for the holder, and what the stock did after the sale. Plain facts from stored daily closes, then a one-line read.
// Display only; the thresholds below shape the wording, not any trading rule. Pure: the caller supplies adjusted closes and index NAVs.
export interface Series { dates: string[]; px: (number | null)[] }
export interface ReviewIn {
  name: string; firstBuy: string; lastSell: string; status: 'Partly sold' | 'Closed'; days: number;
  invested: number; proceeds: number; realised: number;        // whole-history figures for this holding; realised is the tax replay's number for the units sold
  soldCost: number;                                            // cost of the units sold (proceeds minus realised)
  series: Series | null;                                       // split-adjusted daily closes (or NAVs); null when unreliable or missing
  bench: Record<string, number> | null;                        // index fund NAV by date, used as the index
  swing?: { stop: number; entry: number; rulesFollowed?: boolean; setup?: string };
  /** False when any sale has no cost basis from the tax replay: the result is then unknown. */
  gainKnown?: boolean;
  /** A fund: its NAV rows are not trading sessions, so the 20-session and 250-session figures are left out. */
  fund?: boolean;
}
export interface Numbers {
  result: number | null;            // realised gain over the cost of the units sold
  bench: number | null;             // index over the same days
  runUp20: number | null;           // change in the 20 sessions before the first buy
  belowHigh: number | null;         // first-buy close against the highest close of the year before (0 = at the high, negative = below)
  worstDip: number | null;          // lowest close while held against the first-buy close
  bestRun: number | null;           // highest close while held against the first-buy close
  after20: number | null;           // change in the 20 sessions after the last sale
  gaveBack: number | null;          // share of the best run given back by the last-sale close (0 to 1+)
}
export interface Review { grade: 'good' | 'mixed' | 'poor'; headline: string; good: string[]; bad: string[]; n: Numbers }

const pct = (x: number) => (x >= 0 ? '+' : '–') + Math.abs(x * 100).toFixed(1) + '%';
const upTo = (dates: string[], d: string): number => { let lo = 0, hi = dates.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= d) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
const navOn = (nav: Record<string, number>, d: string): number | null => { for (let i = 0; i < 8; i++) { const t = new Date(Date.parse(d) - i * 86400000).toISOString().slice(0, 10); if (nav[t] > 0) return nav[t]; } return null; };
const val = (s: Series, i: number): number | null => (i >= 0 && i < s.px.length && typeof s.px[i] === 'number' && (s.px[i] as number) > 0 ? (s.px[i] as number) : null);

export function reviewTrade(r: ReviewIn): Review {
  const n: Numbers = { result: r.gainKnown !== false && r.soldCost > 0 ? r.realised / r.soldCost : null, bench: null, runUp20: null, belowHigh: null, worstDip: null, bestRun: null, after20: null, gaveBack: null };
  if (r.bench) { const a = navOn(r.bench, r.firstBuy), b = navOn(r.bench, r.lastSell); if (a && b) n.bench = b / a - 1; }
  const s = r.series;
  if (s && s.dates.length) {
    const i0 = upTo(s.dates, r.firstBuy), i1 = upTo(s.dates, r.lastSell), p0 = val(s, i0);
    // only trust the series when it really covers the holding (the stored history starts in 2021)
    if (p0 && i0 >= 0 && s.dates[0] <= r.firstBuy && i1 >= i0) {
      const pb = val(s, i0 - 20); if (pb && i0 >= 20 && !r.fund) n.runUp20 = p0 / pb - 1;
      if (i0 >= 250 && !r.fund) { let hi = 0; for (let i = Math.max(0, i0 - 250); i < i0; i++) { const v = val(s, i); if (v && v > hi) hi = v; } if (hi > 0) n.belowHigh = p0 / hi - 1; }
      let lo = Infinity, top = -Infinity; for (let i = i0; i <= i1; i++) { const v = val(s, i); if (v) { lo = Math.min(lo, v); top = Math.max(top, v); } }
      if (lo < Infinity) { n.worstDip = lo / p0 - 1; n.bestRun = top / p0 - 1; const pe = val(s, i1); if (pe && n.bestRun > 0.02) n.gaveBack = (top - pe) / (top - p0); }
      const pe = val(s, i1), pa = val(s, i1 + 20); if (!r.fund && pe && pa && i1 + 20 < s.px.length) n.after20 = pa / pe - 1;
    }
  }
  const good: string[] = [], bad: string[] = [];
  const flat = n.result !== null && Math.abs(n.result) < 0.001;
  if (n.result === null) bad.push('The statements give no cost for the units sold, so the result cannot be worked out.');
  else {
    if (flat) good.push(`Roughly break-even on the units sold in ${r.days} days.`); else if (n.result > 0) good.push(`Made ${pct(n.result)} on the units sold, ${r.days} days from the first buy to the last sale.`); else bad.push(`Lost ${(Math.abs(n.result) * 100).toFixed(1)}% on the units sold, ${r.days} days from the first buy to the last sale.`);
    if (n.bench !== null) { const d = n.result - n.bench; if (d > 0.02) good.push(`Ahead of the Nifty 50 index fund between the first buy and the last sale (it made ${pct(n.bench)}).`); else if (d < -0.02) bad.push(`Behind the Nifty 50 index fund between the first buy and the last sale (it made ${pct(n.bench)}).`); else good.push(`About level with the Nifty 50 index fund (it made ${pct(n.bench)}).`); }
  }
  if (n.runUp20 !== null && n.runUp20 > 0.2) bad.push(`Bought after a ${pct(n.runUp20)} run in the 20 sessions before: a late entry.`);
  else if (n.runUp20 !== null && n.runUp20 < 0.1 && n.belowHigh !== null && n.belowHigh > -0.1) good.push('Entry was close to the recent high without a runaway move before it.');
  if (n.belowHigh !== null && n.belowHigh < -0.3) bad.push(`Bought ${(Math.abs(n.belowHigh) * 100).toFixed(0)}% below its year high: a falling stock.`);
  if (n.worstDip !== null && n.worstDip < -0.15) bad.push(`The close fell ${(Math.abs(n.worstDip) * 100).toFixed(0)}% below the buy-day close at its worst while you held.`);
  else if (n.worstDip !== null && n.worstDip > -0.05) good.push(n.worstDip > -0.001 ? 'No close fell below the buy-day close while you held.' : `No close fell more than ${(Math.abs(n.worstDip) * 100).toFixed(1)}% below the buy-day close.`);
  if (n.gaveBack !== null && n.gaveBack > 1) bad.push(`The stock peaked at ${pct(n.bestRun!)} above the buy-day close, then fell below it before you sold.`);
  else if (n.gaveBack !== null && n.gaveBack > 0.5) bad.push(`Gave back ${(n.gaveBack * 100).toFixed(0)}% of the best gain (peak ${pct(n.bestRun!)}) before selling.`);
  else if (n.gaveBack !== null && n.gaveBack <= 0.25 && (n.bestRun ?? 0) > 0.1) good.push(`Sold within ${(n.gaveBack * 100).toFixed(0)}% of the peak gain.`);
  if (n.after20 !== null && n.after20 > 0.15) bad.push(`The stock rose ${pct(n.after20)} in the 20 sessions after the sale: sold early.`);
  else if (n.after20 !== null && n.after20 < -0.1) good.push(`Sold before a ${pct(n.after20).replace('+', '')} fall in the next 20 sessions.`);
  if (r.swing && r.swing.entry > r.swing.stop && n.result !== null) {
    const oneR = (r.swing.entry - r.swing.stop) / r.swing.entry, inR = n.result / oneR;
    if (inR < -1.25) bad.push(`The loss was ${Math.abs(inR).toFixed(1)}R: past the planned stop.`); else if (inR < -0.7 && inR >= -1.25) good.push(`The loss stayed near 1R (${inR.toFixed(1)}R), as planned.`);
    if (r.swing.rulesFollowed === false) bad.push('You marked this trade as breaking the exit rules.'); else if (r.swing.rulesFollowed === true) good.push('You marked this trade as following the rules.');
  }
  const grade: Review['grade'] = n.result === null || flat ? 'mixed' : n.result < 0 ? 'poor' : n.bench !== null && n.result - n.bench < -0.02 ? 'mixed' : 'good';
  const headline = grade === 'good' ? 'Went well' : grade === 'poor' ? 'Did not go well' : 'Mixed';
  return { grade, headline, good, bad, n };
}

export interface Pattern { text: string }
/** Patterns across many reviewed trades. A pattern is stated only when each group has at least 5 trades. */
export function patterns(rs: { r: Review; days: number; result: number | null }[]): Pattern[] {
  const out: Pattern[] = [], avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const w = rs.filter((x) => (x.result ?? 0) > 0.001), l = rs.filter((x) => x.result !== null && x.result < -0.001);
  if (w.length >= 5 && l.length >= 5) { const dw = avg(w.map((x) => x.days)), dl = avg(l.map((x) => x.days)); out.push({ text: `Winners were held ${Math.round(dw)} days on average and losers ${Math.round(dl)} days${dl > dw * 1.3 ? ': losers are held longer than winners' : dw > dl * 1.3 ? ': winners are given more time than losers' : ''}.` }); }
  const late = rs.filter((x) => x.r.n.runUp20 !== null && x.r.n.runUp20 > 0.2), calm = rs.filter((x) => x.r.n.runUp20 !== null && x.r.n.runUp20 <= 0.2);
  if (late.length >= 5 && calm.length >= 5) out.push({ text: `Trades bought after a run of over 20% in 20 sessions averaged ${pct(avg(late.map((x) => x.result ?? 0)))} (${late.length} trades); the rest averaged ${pct(avg(calm.map((x) => x.result ?? 0)))} (${calm.length} trades).` });
  const gb = rs.filter((x) => x.r.n.gaveBack !== null && (x.r.n.bestRun ?? 0) > 0.1);
  if (gb.length >= 5) out.push({ text: `Among ${gb.length} trades that were up over 10% at some point, ${gb.filter((x) => x.r.n.gaveBack! > 0.5).length} gave back more than half of the peak gain before the sale.` });
  const ea = rs.filter((x) => x.r.n.after20 !== null);
  if (ea.length >= 5 && ea.some((x) => x.r.n.after20! > 0.15 || x.r.n.after20! < -0.1)) out.push({ text: `${ea.filter((x) => x.r.n.after20! > 0.15).length} of ${ea.length} sales were followed by a rise of over 15% in the next 20 sessions (sold early); ${ea.filter((x) => x.r.n.after20! < -0.1).length} were followed by a fall of over 10%.` });
  const bb = rs.filter((x) => x.r.n.bench !== null && x.result !== null);
  if (bb.length >= 5) out.push({ text: `${bb.filter((x) => x.result! > x.r.n.bench!).length} of ${bb.length} trades beat the Nifty 50 over their holding days.` });
  return out;
}
