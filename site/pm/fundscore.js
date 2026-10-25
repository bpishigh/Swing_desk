// Fund scoring, phase 1 (17 Oct 2026; design section 9.1). Pure functions: NAV series in, category rank and score out. No network here.
// Measures: return over 1, 3 and 5 years against the fund's own category, and how often the fund beat the category median over rolling 1-year windows.
// Not yet in: expense ratio, benchmark/tracking difference, manager changes, portfolio overlap (inputs the design lists for later phases).
export const SETTINGS = {
  minPeers: 8,                 // fewer funds than this in a category with a 3-year record: no ranking
  weights: { r1: 0.2, r3: 0.35, r5: 0.3, consistency: 0.15 },
  rollingMonths: 36, rollingStepDays: 30,
  consistencyYears: 1,         // length of each rolling window; C-92 tests 3 in the back-test only (live stays 1 until adopted)
  strongAbove: 75, weakBelow: 25,   // score bands: top quarter Strong, bottom quarter Weak
  weakMonthsToReplace: 3,      // hysteresis: Weak this many monthly runs in a row before "Replace candidate" is said
};
                                            // YYYY-MM-DD -> NAV
                                                                                      
                                                                                                                                                                                                                                                                                      

/** AMFI writes the same SEBI category several ways ("Equity Scheme - Mid Cap Fund", "Equity Schemes - Mid Cap Fund"); fold them to one key. */
export function normCategory(raw        )         {
  let s = raw.replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
  s = s.replace(/^(Equity|Hybrid|Debt|Solution Oriented|Income\/Debt Oriented|Other|Index|Overseas Fund of Funds)\s*Schemes?\s*-\s*/i, '').replace(/^Index Funds - /i, 'Index Funds - ');
  s = s.replace(/Fund of Funds investing overseas/i, 'FoF Overseas').replace(/\bFund$/i, '').replace(/Dynamic Asset Allocation or Balanced Advantage|Balanced Advantage Fund\/ Dynamic Asset Allocation/i, 'Balanced Advantage').replace(/\s*-\s*ELSS$|^ELSS-? ?Tax Saver/i, 'ELSS').replace(/^ELSS.*$/i, 'ELSS').replace(/Multi Asset Allocation$/i, 'Multi Asset Allocation').replace(/^Sectoral\/ Thematic$|^Thematic$|^Sectoral$/i, 'Sectoral/Thematic').replace(/Focused$/i, 'Focused').trim();
  return s;
}
/** Categories scored in this phase: actively managed equity and hybrid growth funds. Debt and liquid are not scored for return (design). Index funds, ETFs and fund-of-funds
 *  are NOT ranked on return: a Nifty 50 fund and a midcap index fund are not comparable, and the design judges them on tracking difference and cost (next phase). */
export const scorable = (cat        )          => /^(Large Cap|Mid Cap|Small Cap|Large & Mid Cap|Multi Cap|Flexi Cap|Focused|Value|Contra|Dividend Yield|ELSS|Sectoral\/Thematic|Aggressive Hybrid|Balanced Advantage|Multi Asset Allocation|Equity Savings|Conservative Hybrid|Balanced Hybrid)$/i.test(cat);
export const returnOnly = (_cat        )          => false;

const dayMs = 86400000;
const t = (d        ) => Date.parse(d + 'T00:00:00Z');
/** NAV on or before `date` (within 7 days), else null. */
export function navOn(dates          , nav     , date        )                {
  let lo = 0, hi = dates.length - 1, ans = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= date) { ans = m; lo = m + 1; } else hi = m - 1; }
  if (ans < 0 || (t(date) - t(dates[ans])) / dayMs > 7) return null;
  return nav[dates[ans]];
}
export const addDays = (d        , n        )         => new Date(t(d) + n * dayMs).toISOString().slice(0, 10);
const addYears = (d        , n        )         => { const x = new Date(t(d)); x.setUTCFullYear(x.getUTCFullYear() - n); return x.toISOString().slice(0, 10); };
/** Annualised return (CAGR, %) over `years` ending on `asOf`; null when the fund is younger than that. */
export function cagr(dates          , nav     , asOf        , years        )                {
  const end = navOn(dates, nav, asOf), start = navOn(dates, nav, addYears(asOf, years));
  if (end === null || start === null || start <= 0 || dates[0] > addDays(addYears(asOf, years), 7)) return null;
  const r = years === 1 ? end / start - 1 : Math.pow(end / start, 1 / years) - 1;
  return r * 100;
}
const median = (a          )         => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pctRank = (v        , all          )         => (all.filter((x) => x < v).length + 0.5 * all.filter((x) => x === v).length) / all.length * 100;

/** Score every scheme against the others in its category. `series` holds each scheme's NAVs; schemes without a series are left out. */
                                                 
const defaultCat        = (x) => { const c = normCategory(x.category); return scorable(c) ? c : null; };
export function scoreAll(schemes          , series                  , asOf        , s = SETTINGS, catOf        = defaultCat)           {
  const info = new Map                                       ();
  for (const x of schemes) { const nav = series.get(x.code); if (nav) info.set(x.code, { dates: Object.keys(nav).sort(), nav }); }
  const byCat = new Map                  ();
  for (const x of schemes) { if (!info.has(x.code)) continue; const c = catOf(x); if (!c) continue; (byCat.get(c) ?? byCat.set(c, []).get(c) ).push(x); }
  const out           = [];
  for (const [cat, list] of byCat) {
    const m = list.map((x) => { const i = info.get(x.code) ; return { x, r1: cagr(i.dates, i.nav, asOf, 1), r3: cagr(i.dates, i.nav, asOf, 3), r5: cagr(i.dates, i.nav, asOf, 5) }; });
    // rolling 1-year windows over the last rollingMonths months: share of windows in which the fund beat the category median
    const ends           = []; for (let d = asOf; d >= addDays(asOf, -30 * s.rollingMonths); d = addDays(d, -s.rollingStepDays)) ends.push(d);
    const winRet = (code        , end        )                => { const i = info.get(code) ; const e = navOn(i.dates, i.nav, end), b = navOn(i.dates, i.nav, addYears(end, s.consistencyYears)); return e !== null && b !== null && b > 0 && i.dates[0] <= addDays(addYears(end, s.consistencyYears), 7) ? e / b - 1 : null; };
    const cons = new Map                                    ();
    for (const end of ends) {
      const rets = list.map((x) => [x.code, winRet(x.code, end)]         ).filter((r)                                 => r[1] !== null);
      if (rets.length < s.minPeers) continue;
      const med = median(rets.map((r) => r[1]));
      for (const [code, r] of rets) { const c = cons.get(code) ?? { won: 0, n: 0 }; c.n++; if (r >= med) c.won++; cons.set(code, c); }
    }
    const ranked = m.filter((r) => r.r3 !== null);
    const enough = ranked.length >= s.minPeers;
    const pct = (k                    ) => ranked.map((r) => r[k]).filter((v)              => v !== null);
    const consVals = [...cons.values()].filter((c) => c.n >= 12).map((c) => c.won / c.n);
    const scored = m.map((r) => {
      const c = cons.get(r.x.code), cv = c && c.n >= 12 ? c.won / c.n : null;
      const base         = { ...r.x, cat, r1: r.r1, r3: r.r3, r5: r.r5, consistency: cv === null ? null : cv * 100, score: null, rank: null, peers: ranked.length, band: null, returnOnly: returnOnly(cat) || undefined };
      if (r.r3 === null) return { ...base, note: 'Less than 3 years of NAV history: not scored.' };
      if (!enough) return { ...base, note: `Only ${ranked.length} funds in this category have a 3-year record (need ${s.minPeers}): not ranked.` };
      const parts                     = [[s.weights.r3, pctRank(r.r3, pct('r3'))]];
      if (r.r1 !== null) parts.push([s.weights.r1, pctRank(r.r1, pct('r1'))]);
      if (r.r5 !== null) parts.push([s.weights.r5, pctRank(r.r5, pct('r5'))]);
      if (cv !== null && consVals.length >= s.minPeers) parts.push([s.weights.consistency, pctRank(cv, consVals)]);
      const w = parts.reduce((a, p) => a + p[0], 0), score = parts.reduce((a, p) => a + p[0] * p[1], 0) / w;
      return { ...base, score: Math.round(score * 10) / 10 };
    });
    const ord = scored.filter((r) => r.score !== null).sort((a, b) => (b.score  - a.score ) || a.name.localeCompare(b.name));
    ord.forEach((r, i) => { r.rank = i + 1; r.band = r.score  >= s.strongAbove ? 'Strong' : r.score  < s.weakBelow ? 'Weak' : 'Average'; });
    out.push(...scored);
  }
  return out;
}
/** Hysteresis: "Replace candidate" only after the fund has been Weak for weakMonthsToReplace monthly runs in a row (history: month -> code -> band). */
export function replaceCandidate(history                                        , code        , s = SETTINGS)          {
  const months = Object.keys(history).sort().slice(-s.weakMonthsToReplace);
  return months.length >= s.weakMonthsToReplace && months.every((m) => history[m][code] === 'Weak');
}

// ---- Index funds and ETFs: judged against others that track the same index, not against the market ----
export const INDEX_SETTINGS = { ...SETTINGS, minPeers: 3, leadsPp: 0.15, lagsPp: -0.30 };   // pp = percentage points a year over 3 years against the median of the same-index group
const INDEX_WORD = /(nifty|sensex|bse|s&p|msci|crisil|hang seng|nasdaq|nyse|gold|silver)/i;
const EXCLUDE_INDEX = /debt|liquid|gilt|bond|sdl|g-sec|target|overnight|money|treasury|fund of fund|fof|ibx|maturity|income|alpha|momentum|quality|low vol|value 20|equal weight|factor|dividend opp|ev &|esg|elss|tax saver/i;
/** The index a scheme tracks, read from its name ("UTI Nifty 50 Index Fund" and "HDFC NIFTY 50 ETF" both give "Nifty 50"); null when the name does not say or it is a factor, debt or fund-of-funds product. */
export function indexKey(name        )                {
  if (EXCLUDE_INDEX.test(name)) return null;
  const m = INDEX_WORD.exec(name); if (!m) return null;
  let t = name.slice(m.index).split(/\s+-\s+|\s+(?:index fund|index|etf|exchange traded|plan|direct|growth(?=\s*(?:option|plan|-|$))|\()/i)[0];
  t = t.replace(/\bbees\b/gi, '').replace(/\s+/g, ' ').trim();
  if (!t) return null;
  const k = t.toLowerCase().replace(/[\s-]/g, '');
  const canon                         = { nifty: 'Nifty 50', nifty50: 'Nifty 50', sensex: 'BSE Sensex', bsesensex: 'BSE Sensex', gold: 'Gold', silver: 'Silver' };
  return canon[k] ?? t.replace(/\b(\w)(\w*)/g, (_, a, b) => a.toUpperCase() + b.toLowerCase()).replace(/([A-Za-z])(\d)/g, '$1 $2');
}
/** Score each same-index group; the Index/ETF band is Leads, In line or Lags by the 3-year gap to the group median (in line is the normal answer: a good index fund matches its index). */
export function scoreIndexGroups(schemes          , series                  , asOf        , s = INDEX_SETTINGS)                                     {
  const scored = scoreAll(schemes, series, asOf, s, (x) => indexKey(x.name));
  const med = new Map                (); const by = new Map                  ();
  for (const x of scored) if (x.r3 !== null) (by.get(x.cat) ?? by.set(x.cat, []).get(x.cat) ).push(x.r3);
  for (const [k, v] of by) med.set(k, median(v));
  const out = scored.map((x) => ({ ...x, d3: x.r3 === null || !med.has(x.cat) ? null : x.r3 - med.get(x.cat)  }));
  for (const x of out) if (x.rank !== null) x.band = x.d3  >= s.leadsPp ? 'Strong' : x.d3  <= s.lagsPp ? 'Weak' : 'Average';
  return out;
}
