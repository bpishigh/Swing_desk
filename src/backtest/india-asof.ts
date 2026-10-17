// As-of data view for India (backtester, step 2). One implementation: it feeds the same buildHistories the US scan uses.
// Corporate-action factors are resolved once over the whole history (resolveBreaks, all symbols, delisted included), then each night sees only what was known:
//   - a factor dated on or before the PREVIOUS session is applied (the resolver looks one session ahead to confirm a break, so the break night itself is never trusted);
//   - a break dated tonight is not applied and is treated like an unresolved break: the symbol's history before it is dropped, so it re-qualifies after a fresh window;
//   - an unresolved break (no action, or no price ratio such as a demerger) drops the history before it, from that night on.
// Raw files stay unadjusted. check-india-asof.mjs proves the one-pass result equals a re-run on data truncated at each tested night.
import { resolveBreaks, type Action, type Overrides } from '../ingest/corp-actions.ts';
import { buildHistories, type Day, type Hist, type SplitRow } from '../ingest/us-scan.ts';
import type { BhavDay } from '../ingest/india-stocks.ts';

export interface Resolution { splits: SplitRow[]; dropped: Array<{ symbol: string; date: string; why: string }>; counts: { resolved: number; real: number; unresolved: number } }

/** NSE rows (EQ and BE) -> the scan's day shape: [ticker, close, high, low, volume]. */
export function toDays(bhav: BhavDay[]): Day[] {
  return bhav.map((d) => ({ date: d.date, rows: Object.entries(d.rows).filter(([, r]) => r[5] > 0 && r[3] !== null && r[4] !== null).map(([s, r]) => [s, r[5], r[3] as number, r[4] as number, r[6]] as [string, number, number, number, number]) }));
}

export function resolveHistory(bhav: BhavDay[], actions: Action[], overrides: Overrides, marketReturn: (d: string) => number | null = () => null): Resolution {
  const res = resolveBreaks(bhav, actions, overrides, () => true, marketReturn, true);
  // factor f scales closes before the date (0.5 for a 1:1 bonus); buildHistories multiplies by from/to, so from = f, to = 1
  const splits: SplitRow[] = res.resolved.map((r) => [r.symbol, r.date, r.factor, 1]);
  return { splits, dropped: res.unresolved.map((u) => ({ symbol: u.symbol, date: u.date, why: u.reason })), counts: { resolved: res.resolved.length, real: res.real.length, unresolved: res.unresolved.length } };
}

/** The history a backtest may use on night t (index into bhav/days). Entries on `days` at index > t are never read. */
export function asOfHistories(days: Day[], t: number, r: Resolution, allowed: Set<string>): Hist {
  const dates = days.slice(0, t + 1).map((d) => d.date), prev = dates[t - 1] ?? '';
  const hist = buildHistories(days.slice(0, t + 1), r.splits.filter((s) => s[1] <= prev), allowed);
  const cut = new Map<string, number>();       // symbol -> last index to blank
  const mark = (sym: string, date: string) => { const i = dates.indexOf(date); if (i > 0) cut.set(sym, Math.max(cut.get(sym) ?? -1, i - 1)); };
  for (const d of r.dropped) if (d.date <= dates[t]) mark(d.symbol, d.date);
  for (const s of r.splits) if (s[1] === dates[t]) mark(s[0], s[1]);
  for (const [sym, last] of cut) { const s = hist.series.get(sym); if (!s) continue; for (let i = 0; i <= last; i++) { s.c[i] = s.h[i] = s.l[i] = s.v[i] = NaN; } }
  return hist;
}
