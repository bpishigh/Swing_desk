// Context for a direct stock, shown beside its verdict and never part of it (review advice, 15 Oct 2026: context first, no rule change).
// Built from public data at site-build time: adjusted closes (src/pm/verdict.ts adjustSeries), the daily bhavcopy files (traded value, delivery %), the Nifty 500 index closes.
// Pure: the caller supplies the data. Anything that cannot be computed is null, never guessed.
import { adjustSeries, sma, stockVerdict, type CorpActionRow, type DemergerRec, type PriceHistory } from './verdict.ts';
import { stateOf, type ExitState } from './state.ts';

export const RS_SESSIONS = 63;          // about three months, the window the desk already uses for relative strength
export const LIQ_SESSIONS = 20;         // traded value and delivery averaged over this many sessions
export const ENTRY_FLOOR_CR = 10;       // Engine Rules, India stock scan: traded value over ₹10 crore a day (entry floor; shown for comparison, not applied to exits)

export interface BhavDay { date: string; rows: Record<string, (string | number | null)[]> }   // row: [series, prevClose, open, high, low, close, volume, delivPct]
export interface StockContext {
  asOf: string; close: number;
  vs50: number | null;          // % above (+) or below (-) the 50 SMA
  vs200: number | null;         // % above or below the 200 SMA
  ret63: number | null;         // % return over 63 sessions
  rs: number | null;            // percentile (0 to 100) of ret63 among all stored stocks
  vsIndex: number | null;       // ret63 minus the Nifty 500 index's 63-session return, in points
  advCr: number | null;         // average daily traded value, ₹ crore, last 20 sessions
  deliv: number | null;         // average delivery %, last 20 sessions
  delivPrev: number | null;     // the 20 sessions before that
  upDown: number | null;        // volume on up days divided by volume on down days, last 20 sessions (above 1: more volume on the way up)
  state: ExitState | null;      // the verdict's state, keyed to the track record
  series: string | null;        // NSE series on the last day; anything but EQ is a restricted segment (trade for trade or surveillance)
}
export interface ContextFile { asOf: string; indexRet63: number | null; stocks: Record<string, StockContext> }

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r2 = (x: number | null) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

export function computeContext(hist: PriceHistory, feed: CorpActionRow[], bhav: BhavDay[], idx: { dates: string[]; closes: number[] } | null, only?: Set<string>, demergers: DemergerRec[] = []): ContextFile {
  const n = hist.dates.length, asOf = hist.dates[n - 1];
  const bySym = new Map<string, CorpActionRow[]>(); for (const r of feed) (bySym.get(r.symbol) ?? bySym.set(r.symbol, []).get(r.symbol)!).push(r);
  let indexRet63: number | null = null;
  if (idx && idx.closes.length > RS_SESSIONS) { const a = idx.closes[idx.closes.length - 1], b = idx.closes[idx.closes.length - 1 - RS_SESSIONS]; indexRet63 = r2((a / b - 1) * 100); }
  const out: Record<string, StockContext> = {}, rets: [string, number][] = [];
  const days = bhav.slice(-2 * LIQ_SESSIONS), recent = days.slice(-LIQ_SESSIONS), before = days.slice(0, Math.max(0, days.length - LIQ_SESSIONS));
  for (const sym of Object.keys(hist.px)) {
    if (only && !only.has(sym)) continue;
    const raw = hist.px[sym]; if (raw[n - 1] === null || raw[n - 1] === undefined) continue;
    const closes = adjustSeries(hist.dates, raw, bySym.get(sym) ?? [], hist.dates[0], demergers).series, c = closes[n - 1] as number;
    const s50 = sma(closes, 50), s200 = sma(closes, 200), p = closes[n - 1 - RS_SESSIONS];
    const ret = p === null || p === undefined || !(p > 0) ? null : (c / p - 1) * 100;
    const tv = recent.map((d) => { const r = d.rows[sym]; return r && typeof r[5] === 'number' && typeof r[6] === 'number' ? (r[5] * r[6]) / 1e7 : null; }).filter((x): x is number => x !== null);
    const dl = (ds: BhavDay[]) => ds.map((d) => d.rows[sym]?.[7]).filter((x): x is number => typeof x === 'number');
    let up = 0, down = 0; for (const d of recent) { const r = d.rows[sym]; if (r && typeof r[1] === 'number' && typeof r[5] === 'number' && typeof r[6] === 'number') { if (r[5] > r[1]) up += r[6]; else if (r[5] < r[1]) down += r[6]; } }
    const last = recent.length ? recent[recent.length - 1].rows[sym] : undefined;
    out[sym] = {
      asOf, close: c, vs50: s50 ? r2((c / s50 - 1) * 100) : null, vs200: s200 ? r2((c / s200 - 1) * 100) : null, ret63: r2(ret), rs: null,
      vsIndex: ret === null || indexRet63 === null ? null : r2(ret - indexRet63),
      advCr: tv.length >= LIQ_SESSIONS / 2 ? r2(avg(tv)) : null, deliv: dl(recent).length >= LIQ_SESSIONS / 2 ? r2(avg(dl(recent))) : null, delivPrev: dl(before).length >= LIQ_SESSIONS / 2 ? r2(avg(dl(before))) : null,
      upDown: recent.length >= LIQ_SESSIONS / 2 && down > 0 ? r2(up / down) : null,
      state: stateOf(stockVerdict(sym, hist, feed.filter((r) => r.symbol === sym), demergers), closes),
      series: last && typeof last[0] === 'string' ? last[0] : null,
    };
    if (ret !== null) rets.push([sym, ret]);
  }
  rets.sort((a, b) => a[1] - b[1]); rets.forEach(([s], i) => { out[s].rs = rets.length > 1 ? Math.round((i / (rets.length - 1)) * 100) : null; });
  return { asOf, indexRet63, stocks: out };
}
