// Overall (across-category) fund score, Engine Rules C-143, and its look-ahead test, C-144. Pure: NAV series in, scores and per-year result out.
// Nothing after each 1 Oct date is used to score; the next 12 months are used only to judge.
import { cagr, navOn,          } from './fundscore.js';
import { riskStats } from './fundrisk.js';

export const OS = { firstYear: 2015, lastYear: 2025, minFunds: 30, minCash: 5, topShare: 0.2, passShare: 0.6, minYears: 5, worstYearSlack: 3, w3: 0.5, w5: 0.25, wd: 0.25 };
                                                                                             
                                                                                                                                                                                                                            
                                                                                                                                                                                                                                                     

const median = (a          )         => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** Percentile rank 0..100 of each value among all; ties share the average rank. */
export function pctOf(vals          )           {
  const idx = vals.map((v, i) => [v, i]                    ).sort((x, y) => x[0] - y[0]), out = new Array        (vals.length); let k = 0;
  while (k < idx.length) { let m = k; while (m + 1 < idx.length && idx[m + 1][0] === idx[k][0]) m++; for (let q = k; q <= m; q++) out[idx[q][1]] = ((k + m) / 2 / Math.max(1, idx.length - 1)) * 100; k = m + 1; }
  return out;
}
/** C-143: 3-year and 5-year return above cash over volatility, and the worst 3-year fall, each ranked across all funds; blended 50/25/25 (2/3 and 1/3 without a 5-year figure); the blend is ranked again. */
export function overallScores(rows       , rf3        , rf5        )                      {
  const p3 = pctOf(rows.map((f) => (f.r3 - rf3) / f.vol)), pd = pctOf(rows.map((f) => f.dd)), has5 = rows.map((f) => f.r5 !== null && Number.isFinite(f.r5));
  const p5 = pctOf(rows.map((f, i) => (has5[i] ? ((f.r5          ) - rf5) / f.vol : -1e9)));
  const blend = rows.map((_, i) => (has5[i] ? OS.w3 * p3[i] + OS.w5 * p5[i] + OS.wd * pd[i] : (OS.w3 / (OS.w3 + OS.wd)) * p3[i] + (OS.wd / (OS.w3 + OS.wd)) * pd[i]));
  const sc = pctOf(blend); return new Map(rows.map((f, i) => [f.code, sc[i]]));
}
const plusYear = (d        )         => { const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 1); return x.toISOString().slice(0, 10); };
/** Next-year return (%) and annualised volatility (%) of a NAV from T to E; null if the window is not covered. */
export function forward(nav     , dates          , T        , E        )                                      {
  const a = navOn(dates, nav, T), b = navOn(dates, nav, E); if (!(a && b && a > 0)) return null;
  const d = dates.filter((x) => x >= T && x <= E); if (d.length < 200) return null;
  const r           = []; for (let i = 1; i < d.length; i++) { const p = nav[d[i - 1]], q = nav[d[i]]; if (p > 0 && q > 0) r.push(Math.log(q / p)); }
  if (r.length < 200) return null; const mean = r.reduce((s, x) => s + x, 0) / r.length, sd = Math.sqrt(r.reduce((s, x) => s + (x - mean) ** 2, 0) / (r.length - 1));
  return sd > 0 ? { ret: (b / a - 1) * 100, vol: sd * Math.sqrt(252) * 100 } : null;
}
/** `funds` are the equity and hybrid schemes; `cash` the Liquid schemes (they set the cash rate, they are not scored). */
export function overallTest(funds          , cash          , series                  , cfg = OS)         {
  const dates = new Map                  (); for (const [k, nav] of series) dates.set(k, Object.keys(nav).sort());
  const years            = [];
  for (let y = cfg.firstYear; y <= cfg.lastYear; y++) {
    const T = `${y}-10-01`, E = plusYear(T);
    const cashR3           = [], cashR5           = [], cashFwd           = [];
    for (const c of cash) { const nav = series.get(c), d = dates.get(c); if (!nav || !d) continue; const r3 = cagr(d, nav, T, 3), r5 = cagr(d, nav, T, 5), a = navOn(d, nav, T), b = navOn(d, nav, E); if (r3 === null || !(a && b)) continue; cashR3.push(r3); if (r5 !== null) cashR5.push(r5); cashFwd.push((b / a - 1) * 100); }
    if (cashR3.length < cfg.minCash) continue;
    const rf3 = median(cashR3), rf5 = cashR5.length >= cfg.minCash ? median(cashR5) : rf3, rfFwd = median(cashFwd);
    const rows                                                     = [];
    for (const code of funds) {
      const nav = series.get(code), d = dates.get(code); if (!nav || !d) continue;
      const r3 = cagr(d, nav, T, 3), r5 = cagr(d, nav, T, 5), st = riskStats(nav, T), f = forward(nav, d, T, E);
      if (r3 === null || !st || !f || !(st.vol > 0)) continue;
      rows.push({ code, r3, r5, vol: st.vol, dd: st.dd, fwd: f });
    }
    if (rows.length < cfg.minFunds) continue;
    const sc = overallScores(rows, rf3, rf5), by = [...rows].sort((a, b) => (sc.get(b.code)          ) - (sc.get(a.code)          ) || (a.code < b.code ? -1 : 1)), n = Math.max(1, Math.round(rows.length * cfg.topShare));
    const sharpe = (r                     ) => (r.fwd.ret - rfFwd) / r.fwd.vol, med = (g             , f                                    ) => median(g.map(f));
    const top = by.slice(0, n), bot = by.slice(-n), past = [...rows].sort((a, b) => b.r3 - a.r3 || (a.code < b.code ? -1 : 1)).slice(0, n);   // comparator, not judged: the top fifth by plain past 3-year return
    years.push({ date: T, eligible: rows.length, topN: n, topSharpe: med(top, sharpe), allSharpe: med(rows, sharpe), botSharpe: med(bot, sharpe), exSharpe: med(top, sharpe) - med(rows, sharpe), topRet: med(top, (r) => r.fwd.ret), allRet: med(rows, (r) => r.fwd.ret), botRet: med(bot, (r) => r.fwd.ret), retRank3Sharpe: med(past, sharpe) });
  }
  const counted = years.length, beat = years.filter((y) => y.exSharpe > 0).length, beatBottom = years.filter((y) => y.topSharpe > y.botSharpe).length;
  const medianEx = counted ? median(years.map((y) => y.exSharpe)) : null, worstTop = counted ? Math.min(...years.map((y) => y.topRet)) : null, worstAll = counted ? Math.min(...years.map((y) => y.allRet)) : null;
  const parts = { share: counted >= cfg.minYears && beat / counted >= cfg.passShare, median: medianEx !== null && medianEx > 0, worst: worstTop !== null && worstAll !== null && worstTop >= worstAll - cfg.worstYearSlack };
  return { years, counted, beat, medianEx, worstTop, worstAll, beatBottom, parts, pass: parts.share && parts.median && parts.worst };
}
