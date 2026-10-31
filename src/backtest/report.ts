// Standard backtest report (scope: backtester module; Engine Rules C-117). Output only: no rule reads it.
// Input is a list of traded picks, each with its NET return (after the cost tier) and the equal-weight market return over the same window, at each holding length.
// Output answers the questions every run must answer the same way: pick quality at 20, 60 and 120 sessions, bootstrap intervals, regime / group / year splits,
// the figure without the best group, how sharply a parameter's result peaks, and the caveats the run must carry (survivorship, adjustment, sweep size).
import { bootMean, mean } from './ind-base.ts';

export interface TradeRec {
  sym: string; entry: string;                                   // entry date (ISO); picks are read in date order for the block bootstrap
  group?: string; regime?: string;
  net: Record<number, number | null>;                           // net return after costs by holding length in sessions; null = not enough sessions after entry
  mkt: Record<number, number | null>;                           // equal-weight market return over the same window
}
export const HORIZONS = [20, 60, 120];

export interface HorizonStat { h: number; n: number; meanNet: number; medianNet: number; meanExcess: number; hit: number; ci: [number, number] }
const median = (a: number[]): number => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const byDate = (t: TradeRec[]): TradeRec[] => [...t].sort((a, b) => a.entry.localeCompare(b.entry) || a.sym.localeCompare(b.sym));
const has = (t: TradeRec, h: number): boolean => t.net[h] != null && t.mkt[h] != null;

/** Pick quality per holding length. `common` (default) keeps only picks that have every length, so the lengths compare on the same trades (as C-70 did). */
export function pickQuality(trades: TradeRec[], horizons = HORIZONS, common = true): HorizonStat[] {
  const use = byDate(common ? trades.filter((t) => horizons.every((h) => has(t, h))) : trades);
  return horizons.map((h) => {
    const t = use.filter((x) => has(x, h)), net = t.map((x) => x.net[h] as number), ex = t.map((x) => (x.net[h] as number) - (x.mkt[h] as number));
    return { h, n: t.length, meanNet: mean(net), medianNet: median(net), meanExcess: mean(ex), hit: t.length ? net.filter((v) => v > 0).length / t.length : NaN, ci: bootMean(ex) };
  });
}

/** Mean excess by a label (regime, group or entry year), with the count; labels with fewer than `minN` picks are listed but flagged thin. */
export function splitBy(trades: TradeRec[], key: 'regime' | 'group' | 'year', h: number, minN = 30): Array<{ label: string; n: number; meanExcess: number; thin: boolean }> {
  const m = new Map<string, number[]>();
  for (const t of byDate(trades.filter((x) => has(x, h)))) { const l = key === 'year' ? t.entry.slice(0, 4) : (t[key] ?? 'none'); (m.get(l) ?? m.set(l, []).get(l)!).push((t.net[h] as number) - (t.mkt[h] as number)); }
  return [...m].map(([label, v]) => ({ label, n: v.length, meanExcess: mean(v), thin: v.length < minN })).sort((a, b) => a.label.localeCompare(b.label));
}

/** The result without the single group that contributed the most total excess: does the edge survive losing its best group? */
export function exTopGroup(trades: TradeRec[], h: number): { dropped: string | null; n: number; meanExcess: number; ci: [number, number] } {
  const use = byDate(trades.filter((t) => has(t, h) && t.group)), tot = new Map<string, number>();
  for (const t of use) tot.set(t.group!, (tot.get(t.group!) ?? 0) + (t.net[h] as number) - (t.mkt[h] as number));
  if (!tot.size) return { dropped: null, n: 0, meanExcess: NaN, ci: [NaN, NaN] };
  const top = [...tot].sort((a, b) => b[1] - a[1])[0][0], rest = use.filter((t) => t.group !== top).map((t) => (t.net[h] as number) - (t.mkt[h] as number));
  return { dropped: top, n: rest.length, meanExcess: mean(rest), ci: bootMean(rest) };
}

/** How a parameter's result looks across the values tried. `spiky` = the best value is at least twice as good as BOTH neighbours (or its only neighbour): a peak, not a plateau. */
export function sensitivity(points: Array<{ value: number; metric: number }>): { bestValue: number | null; best: number; spiky: boolean; sweepSize: number } {
  const p = [...points].sort((a, b) => a.value - b.value).filter((x) => Number.isFinite(x.metric));
  if (!p.length) return { bestValue: null, best: NaN, spiky: false, sweepSize: points.length };
  let bi = 0; p.forEach((x, i) => { if (x.metric > p[bi].metric) bi = i; });
  const nb = [p[bi - 1], p[bi + 1]].filter(Boolean) as typeof p;
  const spiky = p[bi].metric > 0 && nb.length > 0 && nb.every((x) => x.metric < p[bi].metric / 2);
  return { bestValue: p[bi].value, best: p[bi].metric, spiky, sweepSize: points.length };
}

export interface Caveats { market: 'india' | 'us'; survivorBiased?: boolean; pricesAdjusted?: boolean; sweepSize?: number; window?: string }
/** The lines every report must carry. US history holds only symbols still trading (C-116), so US results are labelled survivor-biased upward. */
export function caveats(c: Caveats): string[] {
  const out: string[] = [];
  const sv = c.survivorBiased ?? c.market === 'us';
  if (sv) out.push('Survivor-biased upward: the price history holds only symbols that still trade (no delisted names), so returns are overstated by an amount not measured here (C-116).');
  else out.push('Delisted stocks are included as listed on each day; today\'s industry map is used for groups (disclosed look-ahead).');
  if (c.pricesAdjusted === false) out.push('Prices are NOT adjusted for splits and bonuses: do not read returns across such events.');
  if (c.sweepSize && c.sweepSize > 1) out.push(`A parameter was taken from a sweep of ${c.sweepSize} values; the best of several tries is optimistic.`);
  if (c.window) out.push(`Window: ${c.window}.`);
  return out;
}

const pc = (x: number, d = 1): string => (Number.isFinite(x) ? (x * 100).toFixed(d) + '%' : 'n/a');
/** The report as plain text for a result file. */
export function formatReport(title: string, trades: TradeRec[], cav: Caveats, ctx: { splitHorizon?: number; horizons?: number[] } = {}): string {
  const h = ctx.splitHorizon ?? 60, q = pickQuality(trades, ctx.horizons ?? HORIZONS), ex = exTopGroup(trades, h), L: string[] = [`# ${title}`, ''];
  L.push('## Pick quality (same picks at every length)', '| Sessions | Picks | Mean net | Median net | Mean excess | Hit rate | Excess 90% interval |', '|---|---|---|---|---|---|---|');
  for (const s of q) L.push(`| ${s.h || 'held to exit'} | ${s.n} | ${pc(s.meanNet)} | ${pc(s.medianNet)} | ${pc(s.meanExcess)} | ${pc(s.hit, 0)} | ${pc(s.ci[0])} to ${pc(s.ci[1])} |`);
  L.push('', `## Without the best group (${h} sessions)`, ex.dropped ? `Dropped ${ex.dropped}: ${ex.n} picks, mean excess ${pc(ex.meanExcess)}, interval ${pc(ex.ci[0])} to ${pc(ex.ci[1])}.` : 'No group labels, not computed.');
  for (const key of ['year', 'regime', 'group'] as const) {
    const s = splitBy(trades, key, h); if (!s.length || (key !== 'year' && s.every((x) => x.label === 'none'))) continue;
    L.push('', `## By ${key} (${h} sessions)`, ...s.map((x) => `- ${x.label}: ${x.n} picks, mean excess ${pc(x.meanExcess)}${x.thin ? ' (thin)' : ''}`));
  }
  L.push('', '## Caveats', ...caveats(cav).map((x) => `- ${x}`));
  return L.join('\n');
}
