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

                                                                                        
                                                                                  
                                                         
                                                          
                               
                                                                                                 
                                                                                                                               
 

/** The most recent close that is the lowest of PIVOT_SIDE sessions on each side (and so already confirmed by PIVOT_SIDE later sessions). */
export function swingLow(dates          , closes                   , side = PIVOT_SIDE)                  {
  for (let i = closes.length - 1 - side; i >= side; i--) {
    const c = closes[i]; if (c === null || c === undefined) continue;
    let lowest = true;
    for (let j = i - side; j <= i + side && lowest; j++) { const v = closes[j]; if (j !== i && v !== null && v !== undefined && v < c) lowest = false; }
    if (lowest) return { price: c, date: dates[i] };
  }
  return null;
}

export const sma = (closes                   , len = SMA_LEN)                => {
  const w = closes.slice(-len); if (w.length < len || w.some((v) => v === null || v === undefined)) return null;
  return (w            ).reduce((a, b) => a + b, 0) / len;
};

const ADJUSTS = /\b(split|sub-?division|bonus|demerger|de-merger|arrangement|consolidation|capital reduction|scheme)\b/i;
const dayDiff = (a        , b        ) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const f2 = (n        ) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function stockVerdict(symbol        , hist                          , feed                  = [])               {
  const none = (why        , extra                        = {})               => ({ symbol, label: 'No verdict', reasons: [why], pending: [], asOf: null, close: null, sma200: null, swingLow: null, below200: null, belowSwing: null, ...extra });
  const series = hist?.px[symbol];
  if (!hist || !series) return none('No stored price history for this symbol.');
  const dates = hist.dates, last = dates[dates.length - 1];
  let li = series.length - 1; while (li >= 0 && (series[li] === null || series[li] === undefined)) li--;
  if (li < 0) return none('No stored closes for this symbol.');
  if (dayDiff(last, dates[li]) > STALE_DAYS) return none(`Latest stored close is ${dates[li]}, older than ${STALE_DAYS} days.`, { asOf: dates[li] });
  const from = dates[Math.max(0, dates.length - CA_LOOKBACK)];
  const ca = feed.find((r) => r.symbol === symbol && r.exDate >= from && ADJUSTS.test(r.subject));
  if (ca) return none(`A corporate action (${ca.subject.trim()}, ex-date ${ca.exDate}) falls inside the price window, and stored closes are not adjusted for it. Check the chart.`, { asOf: dates[li] });
  const closes = series.slice(0, li + 1), d = dates.slice(0, li + 1);
  const close = closes[li]          , s200 = sma(closes), sw = swingLow(d, closes);
  const below200 = s200 === null ? null : close < s200, belowSwing = sw === null ? null : close < sw.price;
  const base = { symbol, asOf: d[li], close, sma200: s200, swingLow: sw, below200, belowSwing };
  const facts = [
    s200 === null ? 'The 200 SMA needs 200 sessions of closes; fewer are stored.' : `Close ${f2(close)} is ${below200 ? 'below' : 'above'} its 200 SMA ${f2(s200)}.`,
    sw === null ? 'No confirmed swing low in the stored window.' : `Close is ${belowSwing ? 'below' : 'above'} the last major swing low ${f2(sw.price)} (${sw.date}).`,
  ];
  if (below200 || belowSwing) return { ...base, label: 'Exit', reasons: ['Fails the exit test.', ...facts.filter((_, i) => (i === 0 ? below200 : belowSwing))], pending: [] };
  if (s200 === null) return { ...base, label: 'No verdict', reasons: [facts[0], 'Not below the swing low, but the exit test needs both legs, so no verdict yet.'], pending: [] };
  const pending = ['Ranking against the ten-name target (Trim) and the Swing screen (Promote) are not applied yet.'];
  return { ...base, label: 'Keep', reasons: ['Passes the exit test.', ...(sw === null ? [facts[0], facts[1]] : facts)], pending };
}
