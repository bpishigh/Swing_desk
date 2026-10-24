// Holdings health (Engine Rules C-101). Pure. A fund-level reading from the stocks it holds: how much of the fund sits in stocks above their 200-session average, and what those stocks returned over 6 months.
// Information only: it changes no verdict, allocation, buy or sell. It is recorded monthly so it can be tested against the fund's next-year return (see C-101).
export const HH = { sma: 200, retSessions: 126, staleDays: 7, breakLookback: 300, breakDown: -0.4, breakUp: 0.6, minCoverage: 0.6, minPeers: 8, strongAbove: 75, weakBelow: 25 };
                                                                       // ret as a fraction
                                                                                      
                                                                                                                
const days = (a        , b        ) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

/** Trend reading of one stock from its stored closes (oldest first, null for a missing day); null when unreadable. */
export function stockTrend(dates          , closes                   , priceDate        , cfg = HH)               {
  const n = closes.length; if (n < cfg.sma || dates.length !== n) return null;
  const last = closes[n - 1]; if (last === null || last === undefined || !(last > 0) || days(dates[n - 1], priceDate) > cfg.staleDays) return null;
  const w = closes.slice(-cfg.sma); if (w.some((v) => v === null || v === undefined || !(v > 0))) return null;
  const avg = (w            ).reduce((a, b) => a + b, 0) / cfg.sma;
  for (let i = Math.max(1, n - cfg.breakLookback); i < n; i++) { const a = closes[i - 1], b = closes[i]; if (a && b) { const r = b / a - 1; if (r < cfg.breakDown || r > cfg.breakUp) return null; } }
  const base = closes[n - 1 - cfg.retSessions]; if (base === null || base === undefined || !(base > 0)) return null;
  return { above: last > avg, ret: last / base - 1 };
}
/** One fund's reading. `resolve` turns a portfolio line into a stock symbol (or null). Covered only when readable weight is at least minCoverage of the fund's equity weight. */
export function fundHealth(lines        , resolve                            , trend                    , cfg = HH)                {
  let eq = 0, rd = 0, up = 0, rs = 0, nr = 0;
  for (const l of lines) { if (!(l.weight > 0)) continue; eq += l.weight; const s = resolve(l), t = s ? trend.get(s) : undefined; if (!t) continue; rd += l.weight; nr++; if (t.above) up += l.weight; rs += l.weight * t.ret; }
  if (!(eq > 0) || rd / eq < cfg.minCoverage) return null;
  return { coverage: rd / eq, aboveShare: up / rd, ret6m: rs / rd, readable: nr, lines: lines.length };
}
const pctRank = (v        , all          )         => (all.filter((x) => x < v).length + 0.5 * all.filter((x) => x === v).length) / all.length * 100;
                                                                                                                                    
/** Percentile inside the category = mean of the percentile ranks on aboveShare and ret6m among covered funds; categories under minPeers are not ranked. */
export function rankHealth(funds                                            , cfg = HH)           {
  const by = new Map                      (); for (const f of funds) (by.get(f.cat) ?? by.set(f.cat, []).get(f.cat) ).push(f);
  const out           = [];
  for (const [, list] of by) {
    const ok = list.length >= cfg.minPeers, a = list.map((f) => f.aboveShare), r = list.map((f) => f.ret6m);
    for (const f of list) { const pct = ok ? (pctRank(f.aboveShare, a) + pctRank(f.ret6m, r)) / 2 : null; out.push({ ...f, pct: pct === null ? null : Math.round(pct * 10) / 10, band: pct === null ? null : pct >= cfg.strongAbove ? 'Strong' : pct < cfg.weakBelow ? 'Weak' : 'Average' }); }
  }
  return out;
}
