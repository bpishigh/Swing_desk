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

                                                                                        
                                                                                                                    
                                                                                                   // from data/rules/demergers.json: the company's published share of cost (and so of value) that went to the child
                                                         
                                                                   
                               
                                                                                                 
                                                                                                                               
                                                                                
                                                                                                                                                            
 

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
const BONUS = /^\s*bonus-?\s*(\d+)\s*:\s*(\d+)\s*$/i;                       // "Bonus 1:4" = 1 new share for every 4 held
const SPLIT = /^\s*(?:face value )?(?:split|sub-?division)[^]*?from\s+(?:rs|re)\.?\s*([\d.]+)\s*\/?-?\s*per share\s+to\s+(?:rs|re)\.?\s*([\d.]+)/i;
export const DEMERGER_BREAK = 0.15;   // C-50: a one-day fall at least this large across a demerger ex-date is taken as the demerger
export const ADJUST_TOLERANCE = 0.25;   // the observed ex-date move may differ from the expected drop by at most this (ordinary market move allowance), and by less than half the log distance between "no change" and the expected drop, so a small bonus that did not show cannot pass

/** Price divisor for a plain split or bonus (closes before the ex-date are divided by it); null for anything else (demerger, scheme, rights, consolidation, NCRPS bonus). */
export function priceFactor(subject        )                {
  const b = BONUS.exec(subject); if (b) { const n = +b[1], h = +b[2]; return n > 0 && h > 0 ? (n + h) / h : null; }
  const sp = SPLIT.exec(subject); if (sp) { const f = +sp[1], t = +sp[2]; return f > 0 && t > 0 && f > t ? f / t : null; }
  return null;
}

export const DIVIDEND_ADJUST_MIN = 0.05;   // a cash dividend (all payouts on the ex-date together) of at least this share of the prior close is adjusted for; ordinary dividends are left alone, as on every chart
const DIVIDEND = /\bdividend\b/i;
const RIGHTS = /^\s*rights(?: issue)?\s*:?\s*(\d+)\s*:\s*(\d+)\s*@\s*premium(?: of)?\s*(?:rs|re)\.?\s*([\d.]+)/i;   // "Rights 21:100 @ Premium Rs 76" = 21 new shares for every 100 held, issue price = face value + premium

/** Cash paid per share on the ex-date: the sum of every "Rs n" / "Re n" in the subject (an AGM dividend and a special dividend can share a row). null when no amount is stated. */
export function dividendAmount(subject        )                {
  if (!DIVIDEND.test(subject)) return null;
  let sum = 0, found = false; for (const m of subject.matchAll(/\b(?:rs|re)\.?\s*([\d]+(?:\.\d+)?)/gi)) { sum += +m[1]; found = true; }
  return found && sum > 0 ? sum : null;
}
/** Divisor for closes before a rights ex-date, by the theoretical ex-rights price (TERP = (held*P + new*S) / (held + new)); null if the terms are not in the subject or the issue is at or above the market price. */
export function rightsFactor(r               , prior        )                {
  const m = RIGHTS.exec(r.subject); if (!m) return null;
  const nw = +m[1], held = +m[2], fv = Number(r.faceVal), S = fv + +m[3];
  if (!(nw > 0 && held > 0 && fv > 0 && S > 0) || S >= prior) return null;
  const terp = (held * prior + nw * S) / (held + nw), f = prior / terp;
  return f > 1.0001 && f < 3 ? f : null;
}

const DEMERGER = /\bdemerger\b/i;
/** Divisor for the parent's closes before a demerger ex-date: 1 / (1 - the published cost share that went to the child). null when no typed record exists or the record is not a split of one business into two. */
export function demergerFactor(r               , recs               )                {
  if (!DEMERGER.test(r.subject)) return null;
  const d = recs.find((x) => x.parent === r.symbol && x.exDate === r.exDate && x.feed !== false);
  return d && d.costPct > 0 && d.costPct < 1 ? 1 / (1 - d.costPct) : null;
}

/** Back-adjust closes for the splits and bonuses of one symbol. Actions with the same ex-date are combined (a bonus announced with a split is one price move). Each combined factor is
 *  checked against the stored closes: the move across the ex-date must be about the expected drop, else the group is left "unresolved" and the caller falls back to No verdict.
 *  A group holding any action that is not a plain split or bonus (demerger, scheme, rights, NCRPS bonus) is unresolved. */
export function adjustSeries(dates          , series                   , rows                 , from        , demergers                = [])                                                                                                                                                                                                                                                                                    {
  const out = series.slice(), unresolved                  = [], applied                                           = [], rejected                                                                       = [], estimated                                              = [], truncated                  = [];
  const first = series.findIndex((v) => v !== null && v !== undefined);
  const groups = new Map                         ();
  for (const r of rows) if (ADJUSTS.test(r.subject) || DIVIDEND.test(r.subject) || RIGHTS.test(r.subject)) (groups.get(r.exDate) ?? groups.set(r.exDate, []).get(r.exDate) ).push(r);
  for (const [exDate, g] of [...groups].sort((a, b) => (a[0] < b[0] ? 1 : -1))) {   // latest first, so each factor sits on top of the later ones
    const inWindow = exDate >= from;                                       // only an action the verdict cannot adjust AND that sits in the window blocks it
    if (!g.some((r) => ADJUSTS.test(r.subject))) {                        // dividend and rights only: no stored-price check is possible (the move is inside ordinary noise), so the terms decide
      const i = dates.findIndex((d) => d >= exDate); if (i <= 0 || first < 0 || i <= first) continue;
      let j = i - 1; while (j >= 0 && (series[j] === null || series[j] === undefined)) j--; const prior = j >= 0 ? (series[j]          ) : 0; if (!(prior > 0)) continue;
      let f = 1; const used                  = [];
      const cash = g.filter((r) => DIVIDEND.test(r.subject)).map((r) => dividendAmount(r.subject)).filter((x)              => x !== null).reduce((a, b) => a + b, 0);
      if (cash / prior >= DIVIDEND_ADJUST_MIN && cash / prior < 0.6) { f *= prior / (prior - cash); used.push(...g.filter((r) => DIVIDEND.test(r.subject))); }
      for (const r of g) { const rf = rightsFactor(r, prior - (used.length ? cash : 0)); if (rf) { f *= rf; used.push(r); } }
      if (f > 1) { for (let k = 0; k < i; k++) { const v = out[k]; if (v !== null && v !== undefined) out[k] = v / f; } for (const r of used) applied.push({ row: r, factor: f }); }
      continue;
    }
    const onlyDemerger = g.filter((r) => ADJUSTS.test(r.subject)).every((r) => DEMERGER.test(r.subject));
    /** C-50: a demerger with no usable typed record. A one-day fall of DEMERGER_BREAK or more across the ex-date is taken as the demerger and the earlier closes are adjusted by the observed ratio; anything smaller drops the closes before the ex-date (the stock is then treated like a recent listing). */
    const demergerFallback = ()          => {
      if (!onlyDemerger) return false;
      const i = dates.findIndex((d) => d >= exDate); if (i < 0 || first < 0 || i <= first) return true;
      let j = i - 1; while (j >= 0 && (out[j] === null || out[j] === undefined)) j--;
      const after = out[i], before = j >= 0 ? out[j] : null;
      if (after === null || after === undefined || before === null || before === undefined) return false;
      const ratio = after / before;
      if (ratio <= 1 - DEMERGER_BREAK) { const f = 1 / ratio; for (let k = 0; k < i; k++) { const v = out[k]; if (v !== null && v !== undefined) out[k] = v * ratio; } estimated.push({ rows: g, factor: f }); return true; }
      if (!inWindow) return true;
      for (let k = 0; k < i; k++) out[k] = null;
      truncated.push(...g); return true;
    };
    const fs = g.map((r) => (ADJUSTS.test(r.subject) ? priceFactor(r.subject) ?? demergerFactor(r, demergers) : 1));   // a dividend or rights row sharing the ex-date with a split or bonus is left unadjusted
    if (fs.some((f) => f === null)) { if (!demergerFallback() && inWindow) unresolved.push(...g); continue; }
    const f = (fs            ).reduce((a, b) => a * b, 1);
    const i = dates.findIndex((d) => d >= exDate); if (i < 0) continue;     // ex-date after the last stored session: nothing to adjust yet
    if (first < 0 || i <= first) continue;                                 // before the stock's first close: nothing earlier to adjust
    let j = i - 1; while (j >= 0 && (out[j] === null || out[j] === undefined)) j--;
    const after = out[i], before = out[j];
    if (j < 0 || after === null || after === undefined || before === null || before === undefined) { rejected.push({ rows: g, factor: f, observed: null }); if (!demergerFallback() && inWindow) unresolved.push(...g); continue; }
    const dev = Math.abs(Math.log(after / (before / f)));
    if (dev > Math.min(Math.log(1 + ADJUST_TOLERANCE), 0.5 * Math.log(f))) { rejected.push({ rows: g, factor: f, observed: after / before }); if (!demergerFallback() && inWindow) unresolved.push(...g); continue; }   // the stored prices do not show this action
    for (let k = 0; k < i; k++) { const v = out[k]; if (v !== null && v !== undefined) out[k] = v / f; }
    for (const r of g) applied.push({ row: r, factor: priceFactor(r.subject)           });
  }
  return { series: out, unresolved, applied, rejected, estimated, truncated };
}

const dayDiff = (a        , b        ) => Math.round((Date.parse(a) - Date.parse(b)) / 86400000);
const f2 = (n        ) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function stockVerdict(symbol        , hist                          , feed                  = [], demergers                = [])               {
  const none = (why        , extra                        = {})               => ({ symbol, label: 'No verdict', reasons: [why], pending: [], asOf: null, close: null, sma200: null, swingLow: null, below200: null, belowSwing: null, ...extra });
  const series = hist?.px[symbol];
  if (!hist || !series) return none('No stored price history for this symbol.');
  const dates = hist.dates, last = dates[dates.length - 1];
  let li = series.length - 1; while (li >= 0 && (series[li] === null || series[li] === undefined)) li--;
  if (li < 0) return none('No stored closes for this symbol.');
  if (dayDiff(last, dates[li]) > STALE_DAYS) return none(`Latest stored close is ${dates[li]}, older than ${STALE_DAYS} days.`, { asOf: dates[li] });
  const from = dates[Math.max(0, dates.length - CA_LOOKBACK)];
  const adj = adjustSeries(dates, series, feed.filter((r) => r.symbol === symbol), from, demergers);
  const ca = adj.unresolved[0];
  if (ca) return none(`A corporate action (${ca.subject.trim()}, ex-date ${ca.exDate}) falls inside the price window and could not be adjusted for automatically (not a plain split or bonus, no typed demerger apportionment, or the stored prices do not show it). Check the chart.`, { asOf: dates[li] });
  const closes = adj.series.slice(0, li + 1), d = dates.slice(0, li + 1);
  const close = closes[li]          , s200 = sma(closes), sw = swingLow(d, closes);
  const below200 = s200 === null ? null : close < s200, belowSwing = sw === null ? null : close < sw.price;
  const base = { symbol, asOf: d[li], close, sma200: s200, swingLow: sw, below200, belowSwing, ...(adj.applied.length || adj.estimated.length || adj.truncated.length ? { adjusted: [...adj.applied.map((a) => `${a.row.subject.trim()} (ex ${a.row.exDate})`), ...adj.estimated.map((e) => `${e.rows[0].subject.trim()} (ex ${e.rows[0].exDate}), adjusted from price: the stored closes fell ${((1 - 1 / e.factor) * 100).toFixed(0)}% that day`), ...adj.truncated.map((t) => `${t.subject.trim()} (ex ${t.exDate}), closes before the ex-date dropped: no clear price break, treated like a recent listing`)] } : {}) };
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
