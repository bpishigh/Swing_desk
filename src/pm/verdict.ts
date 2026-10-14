// Verdicts for direct stocks (design section 4), first slice: the Exit test and Keep.
// Exit test (Engine Rules, Legacy book): a close below the 200 SMA, or below the last major swing low. Never deferred for tax.
// Swing low (owner-approved 14 Oct 2026, log in the Engine Rules change log): the most recent confirmed pivot low on daily closes, meaning a close
// that is the lowest of the 10 sessions on each side of it. The page holds closes only, so closes are used, not intraday lows.
// Keep here means "passes the exit test". Trim (outside the ten-name target) and Promote are separate verdicts that need the ranking and the screen.
// Pure: the caller supplies stored closes. Never guesses: with too little or unreliable data the answer is "No verdict" and says why.
export const PIVOT_SIDE = 10;          // sessions each side of a pivot low (owner-approved starting value)
export const SMA_LEN = 200;
export const STALE_DAYS = 7;           // last close older than this against the page's price date: no verdict
export const CA_LOOKBACK = 300;        // sessions: a split, bonus or demerger inside this window makes unadjusted closes unreliable

export interface PriceHistory { dates: string[]; px: Record<string, (number | null)[]> }
export interface CorpActionRow { symbol: string; exDate: string; subject: string }
export interface SwingLow { price: number; date: string }
export type VerdictLabel = 'Exit' | 'Keep' | 'No verdict';
export interface StockVerdict {
  symbol: string; label: VerdictLabel; reasons: string[]; pending: string[]; asOf: string | null;
  close: number | null; sma200: number | null; swingLow: SwingLow | null; below200: boolean | null; belowSwing: boolean | null;
  adjusted?: string[];   // splits and bonuses the closes were back-adjusted for
  partial?: string;      // set when only one leg of the exit test could be run, and which one (owner decision 15 Oct: keep the Exit, label the missing leg)
}

/** The most recent close that is the lowest of PIVOT_SIDE sessions on each side (and so already confirmed by PIVOT_SIDE later sessions). */
export function swingLow(dates: string[], closes: (number | null)[], side = PIVOT_SIDE): SwingLow | null {
  for (let i = closes.length - 1 - side; i >= side; i--) {
    const c = closes[i]; if (c === null || c === undefined) continue;
    let lowest = true;
    for (let j = i - side; j <= i + side && lowest; j++) { const v = closes[j]; if (j !== i && v !== null && v !== undefined && v < c) lowest = false; }
    if (lowest) return { price: c, date: dates[i] };
  }
  return null;
}

export const sma = (closes: (number | null)[], len = SMA_LEN): number | null => {
  const w = closes.slice(-len); if (w.length < len || w.some((v) => v === null || v === undefined)) return null;
  return (w as number[]).reduce((a, b) => a + b, 0) / len;
};

const ADJUSTS = /\b(split|sub-?division|bonus|demerger|de-merger|arrangement|consolidation|capital reduction|scheme)\b/i;
const BONUS = /^\s*bonus-?\s*(\d+)\s*:\s*(\d+)\s*$/i;                       // "Bonus 1:4" = 1 new share for every 4 held
const SPLIT = /^\s*(?:face value )?(?:split|sub-?division)[^]*?from\s+(?:rs|re)\.?\s*([\d.]+)\s*\/?-?\s*per share\s+to\s+(?:rs|re)\.?\s*([\d.]+)/i;
export const ADJUST_TOLERANCE = 0.25;   // the observed ex-date move may differ from the expected drop by at most this (ordinary market move allowance), and by less than half the log distance between "no change" and the expected drop, so a small bonus that did not show cannot pass

/** Price divisor for a plain split or bonus (closes before the ex-date are divided by it); null for anything else (demerger, scheme, rights, consolidation, NCRPS bonus). */
export function priceFactor(subject: string): number | null {
  const b = BONUS.exec(subject); if (b) { const n = +b[1], h = +b[2]; return n > 0 && h > 0 ? (n + h) / h : null; }
  const sp = SPLIT.exec(subject); if (sp) { const f = +sp[1], t = +sp[2]; return f > 0 && t > 0 && f > t ? f / t : null; }
  return null;
}

/** Back-adjust closes for the splits and bonuses of one symbol. Actions with the same ex-date are combined (a bonus announced with a split is one price move). Each combined factor is
 *  checked against the stored closes: the move across the ex-date must be about the expected drop, else the group is left "unresolved" and the caller falls back to No verdict.
 *  A group holding any action that is not a plain split or bonus (demerger, scheme, rights, NCRPS bonus) is unresolved. */
export function adjustSeries(dates: string[], series: (number | null)[], rows: CorpActionRow[], from: string): { series: (number | null)[]; unresolved: CorpActionRow[]; applied: { row: CorpActionRow; factor: number }[]; rejected: { rows: CorpActionRow[]; factor: number; observed: number | null }[] } {
  const out = series.slice(), unresolved: CorpActionRow[] = [], applied: { row: CorpActionRow; factor: number }[] = [], rejected: { rows: CorpActionRow[]; factor: number; observed: number | null }[] = [];
  const first = series.findIndex((v) => v !== null && v !== undefined);
  const groups = new Map<string, CorpActionRow[]>();
  for (const r of rows) if (ADJUSTS.test(r.subject)) (groups.get(r.exDate) ?? groups.set(r.exDate, []).get(r.exDate)!).push(r);
  for (const [exDate, g] of [...groups].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {   // latest first, so each factor sits on top of the later ones
    const inWindow = exDate >= from;                                       // only an action the verdict cannot adjust AND that sits in the window blocks it
    const fs = g.map((r) => priceFactor(r.subject));
    if (fs.some((f) => f === null)) { if (inWindow) unresolved.push(...g); continue; }
    const f = (fs as number[]).reduce((a, b) => a * b, 1);
    const i = dates.findIndex((d) => d >= exDate); if (i < 0) continue;     // ex-date after the last stored session: nothing to adjust yet
    if (first < 0 || i <= first) continue;                                 // before the stock's first close: nothing earlier to adjust
    let j = i - 1; while (j >= 0 && (out[j] === null || out[j] === undefined)) j--;
    const after = out[i], before = out[j];
    if (j < 0 || after === null || after === undefined || before === null || before === undefined) { rejected.push({ rows: g, factor: f, observed: null }); if (inWindow) unresolved.push(...g); continue; }
    const dev = Math.abs(Math.log(after / (before / f)));
    if (dev > Math.min(Math.log(1 + ADJUST_TOLERANCE), 0.5 * Math.log(f))) { rejected.push({ rows: g, factor: f, observed: after / before }); if (inWindow) unresolved.push(...g); continue; }   // the stored prices do not show this action
    for (let k = 0; k < i; k++) { const v = out[k]; if (v !== null && v !== undefined) out[k] = v / f; }
    for (const r of g) applied.push({ row: r, factor: priceFactor(r.subject) as number });
  }
  return { series: out, unresolved, applied, rejected };
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const f2 = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function stockVerdict(symbol: string, hist: PriceHistory | undefined, feed: CorpActionRow[] = []): StockVerdict {
  const none = (why: string, extra: Partial<StockVerdict> = {}): StockVerdict => ({ symbol, label: 'No verdict', reasons: [why], pending: [], asOf: null, close: null, sma200: null, swingLow: null, below200: null, belowSwing: null, ...extra });
  const series = hist?.px[symbol];
  if (!hist || !series) return none('No stored price history for this symbol.');
  const dates = hist.dates, last = dates[dates.length - 1];
  let li = series.length - 1; while (li >= 0 && (series[li] === null || series[li] === undefined)) li--;
  if (li < 0) return none('No stored closes for this symbol.');
  if (dayDiff(last, dates[li]) > STALE_DAYS) return none(`Latest stored close is ${dates[li]}, older than ${STALE_DAYS} days.`, { asOf: dates[li] });
  const from = dates[Math.max(0, dates.length - CA_LOOKBACK)];
  const adj = adjustSeries(dates, series, feed.filter((r) => r.symbol === symbol), from);
  const ca = adj.unresolved[0];
  if (ca) return none(`A corporate action (${ca.subject.trim()}, ex-date ${ca.exDate}) falls inside the price window and could not be adjusted for automatically (not a plain split or bonus, or the stored prices do not show it). Check the chart.`, { asOf: dates[li] });
  const closes = adj.series.slice(0, li + 1), d = dates.slice(0, li + 1);
  const close = closes[li] as number, s200 = sma(closes), sw = swingLow(d, closes);
  const below200 = s200 === null ? null : close < s200, belowSwing = sw === null ? null : close < sw.price;
  const base = { symbol, asOf: d[li], close, sma200: s200, swingLow: sw, below200, belowSwing, ...(adj.applied.length ? { adjusted: adj.applied.map((a) => `${a.row.subject.trim()} (ex ${a.row.exDate})`) } : {}) };
  const facts = [
    s200 === null ? 'The 200 SMA needs 200 sessions of closes; fewer are stored.' : `Close ${f2(close)} is ${below200 ? 'below' : 'above'} its 200 SMA ${f2(s200)}.`,
    sw === null ? 'No confirmed swing low in the stored window.' : `Close is ${belowSwing ? 'below' : 'above'} the last major swing low ${f2(sw.price)} (${sw.date}).`,
  ];
  if (below200 || belowSwing) {
    const partial = s200 === null ? 'swing low only: the 200 SMA is not available yet (under 200 sessions stored)' : undefined;
    return { ...base, label: 'Exit', reasons: ['Fails the exit test.', ...facts.filter((_, i) => (i === 0 ? below200 : belowSwing)), ...(partial ? ['Only the swing-low leg could be tested: the 200 SMA is not available yet (fewer than 200 sessions stored).'] : [])], pending: [], ...(partial ? { partial } : {}) };
  }
  if (s200 === null) return { ...base, label: 'No verdict', reasons: [facts[0], 'Not below the swing low, but the exit test needs both legs, so no verdict yet.'], pending: [] };
  const pending = ['Ranking against the ten-name target (Trim) and the Swing screen (Promote) are not applied yet.'];
  return { ...base, label: 'Keep', reasons: ['Passes the exit test.', ...(sw === null ? [facts[0], facts[1]] : facts)], pending };
}
