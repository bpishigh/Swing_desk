// C-133 and C-136: the market light on its own. Registered in docs/backtests/manifest.json (C-133-r1, C-136-r1) before this run. One run, no tuning.
// Question: do the months the light calls Green come before better index returns than the other months?
// The light is rebuilt for every session with the production code (src/engine/regime.ts, default rules). India: Nifty 50 + Nifty 500, breadth on today's Nifty 500 list.
// US: SPY + QQQ, breadth on stored US stocks that are in today's S&P 500 list. Pre-2010 (C-136): BSE 500 trend + distribution days only.
// Usage: node --max-old-space-size=7000 scripts/backtest-light.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { regimeFrom } from '../src/engine/regime.ts';
import { dateCalendar } from '../src/backtest/desk-sim.ts';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { loadUs } from '../src/backtest/us-loader.ts';
import { firstSessions, bootDiff, yearsAbove, mean } from '../src/backtest/groups.ts';
const R = (p) => JSON.parse(readFileSync(p, 'utf8')), f = (x) => (x * 100).toFixed(2) + '%';
const sma = (c, n) => c.map((_, i) => (i + 1 >= n && c.slice(i + 1 - n, i + 1).every((v) => v > 0) ? c.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n : undefined));
const BREAK = 22;
function breadthAt(series, i) {   // share of the list above its own 50-day average, the 22% one-day-move exclusion, as src/ingest/breadth.ts
  let up = 0, n = 0;
  for (const c of series) {
    if (i < 49) continue; let broken = false, sum = 0, ok = true;
    for (let k = i - 49; k <= i; k++) { const v = c[k]; if (!(v > 0)) { ok = false; break; } sum += v; if (k > i - 49 && Math.abs(v / c[k - 1] - 1) * 100 > BREAK) { broken = true; break; } }
    if (!ok || broken) continue; n++; if (c[i] > sum / 50) up++;
  }
  return n ? Math.round((1000 * up) / n) / 10 : undefined;
}
function runWindow(label, judged, months, from, to) {
  const m = months.filter((x) => x.d >= from && x.d <= to && x.r !== undefined && x.name);
  const r = m.map((x) => x.r), g = m.map((x) => x.name === 'green'), yrs = m.map((x) => x.d.slice(0, 4));
  const nG = g.filter(Boolean).length, nO = m.length - nG, mG = mean(r.filter((_, i) => g[i])), mO = mean(r.filter((_, i) => !g[i]));
  const [lo, hi] = bootDiff(r, g), yr = yearsAbove(yrs, r, g), tg = m.map((x) => x.trendGreen);
  const state = {}; for (const s of ['green', 'yellow', 'red']) { const v = m.filter((x) => x.name === s).map((x) => x.r); state[s] = { n: v.length, mean: v.length ? mean(v) : null, worst: v.length ? Math.min(...v) : null }; }
  const c = { greenAboveOther: mG > mO, lowerAboveZero: lo > 0, yearsTwoThirds: yr.counted > 0 && yr.wins >= Math.ceil((2 / 3) * yr.counted), enoughMonths: nG >= 12 && nO >= 12 };
  const trendDiff = mean(r.filter((_, i) => tg[i])) - mean(r.filter((_, i) => !tg[i]));
  return { label, judged, months: m.length, first: m[0]?.d, last: m.at(-1)?.d, greenMonths: nG, otherMonths: nO, meanGreen: mG, meanOther: mO, diff: mG - mO, ci90: [lo, hi], minDetectable: hi - (mG - mO), yearsCounted: yr.counted, yearsWin: yr.wins, byYear: yr.byYear, byState: state, trendOnlyDiff: trendDiff, conditions: c, pass: Object.values(c).every(Boolean) };
}
const out = { run: new Date().toISOString().slice(0, 10), markets: {} };
let md = '# C-133 and C-136: the market light on its own\n\nGreen months against all other months; outcome the index price return from the next close to the next month\'s next close.\n\n';
function report(market, res) {
  if (process.env.SMOKE) { for (const w of res) console.log('SMOKE', market, w.label, w.months, w.first, w.last, JSON.stringify(Object.fromEntries(Object.entries(w.byState).map(([k, v]) => [k, v.n]))), 'greenTrend', ''); return; }
  out.markets[market] = res;
  for (const w of res) md += `## ${market}: ${w.label}: ${w.judged ? (w.pass ? 'PASS' : 'FAIL') : 'reported, not judged'}\n- ${w.months} months ${w.first} to ${w.last}; Green ${w.greenMonths}, other ${w.otherMonths}\n- Mean next month: Green ${f(w.meanGreen)}, other ${f(w.meanOther)}; difference ${f(w.diff)}; 90% interval ${f(w.ci90[0])} to ${f(w.ci90[1])}; smallest difference this sample could detect about ${f(w.minDetectable)}\n- Years where Green beat other months: ${w.yearsWin} of ${w.yearsCounted} counted\n- By state (n, mean, worst month): ${['green', 'yellow', 'red'].map((s) => `${s} ${w.byState[s].n}, ${w.byState[s].mean === null ? '-' : f(w.byState[s].mean)}, ${w.byState[s].worst === null ? '-' : f(w.byState[s].worst)}`).join('; ')}\n- Trend part alone (descriptive): Green-trend months minus others ${f(w.trendOnlyDiff)}\n- Conditions ${JSON.stringify(w.conditions)}\n\n`;
}
// ---------- India (C-133)
{
  const D = loadIndia('data/india', { pre2020: true, allSymbols: true }), dates = D.dates, N = D.T, idxOf = (name) => { const o = {}; for (let y = 2012; y <= 2025; y++) { let j; try { j = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(j[name] ?? {})) o[d] = v; } return o; };
  const n50 = idxOf('Nifty 50'), n500 = idxOf('Nifty 500'), rdates = Object.keys(n50).sort().filter((d) => d in n500);
  const c50 = rdates.map((d) => n50[d][3]), c500 = rdates.map((d) => n500[d][3]), s50 = sma(c50, 50), s200 = sma(c50, 200), b50 = sma(c500, 50), b200 = sma(c500, 200);
  const di = new Map(dates.map((d, i) => [d, i])), list = new Set(R('data/india/nifty500.json').symbols), ser = [...list].map((s) => D.FH.series.get(s)?.c).filter(Boolean);
  const rows = rdates.map((d, k) => ({ date: d, close: c50[k], high: n50[d][1], low: n50[d][2], volume: n50[d][4], sma50: s50[k], sma200: s200[k], b: { close: c500[k], sma50: b50[k], sma200: b200[k] }, breadth: di.has(d) ? breadthAt(ser, di.get(d)) : undefined }));
  const rk = new Map(rows.map((r, k) => [r.date, k])), cal = dateCalendar(dates);
  const carry = (map) => { const a = new Float64Array(N).fill(NaN); let last = NaN; for (let i = 0; i < N; i++) { const v = map[dates[i]]?.[3]; if (v > 0) last = v; a[i] = last; } return a; };
  const idx500 = carry(n500), M = firstSessions(dates, '2012-03-01', '2025-10-31'), months = [];
  for (let q = 0; q < M.length; q++) {
    const i = M[q], d = dates[i], k = rk.get(d), res = k === undefined ? null : regimeFrom(rows.slice(0, k + 1), { cal }), nx = M[q + 1];
    months.push({ d, name: res && !res.incomplete ? res.name : null, trendGreen: res && !res.incomplete ? res.sma === 2 : false, r: nx !== undefined && idx500[i + 1] > 0 && idx500[nx + 1] > 0 ? idx500[nx + 1] / idx500[i + 1] - 1 : undefined });
  }
  report('India', [runWindow('Jan 2013 to Dec 2019 (judged)', true, months, '2013-01-01', '2019-12-31'), runWindow('Jan 2020 to Oct 2025 (reported)', false, months, '2020-01-01', '2025-10-31')]);
}
// ---------- US (C-133)
{
  const D = loadUs(), dates = D.dates, N = D.N, bars = (s) => JSON.parse(gunzipSync(readFileSync(`data/us/hist-bench/${s}.json.gz`)).toString()).bars;
  const spy = new Map(bars('SPY').map((b) => [b[0], b])), qqq = new Map(bars('QQQ').map((b) => [b[0], b]));
  const c1 = dates.map((d) => spy.get(d)?.[1]), c2 = dates.map((d) => qqq.get(d)?.[1] ?? NaN), s50 = sma(c1, 50), s200 = sma(c1, 200), q50 = sma(c2, 50), q200 = sma(c2, 200);
  const list = new Set(R('data/us/sp500.json').symbols.flatMap((s) => [s, s.replace('.', '_')])), ser = [...D.hist.series].filter(([s]) => list.has(s)).map(([, v]) => v.c);
  const rows = dates.map((d, k) => ({ date: d, close: c1[k], high: spy.get(d)?.[2], low: spy.get(d)?.[3], volume: spy.get(d)?.[4], sma50: s50[k], sma200: s200[k], b: { close: c2[k], sma50: q50[k], sma200: q200[k] }, breadth: k >= 49 ? breadthAt(ser, k) : undefined }));
  const cal = dateCalendar(dates), M = firstSessions(dates, '2017-12-01', '2026-10-31'), months = [];
  for (let q = 0; q < M.length; q++) {
    const i = M[q], res = regimeFrom(rows.slice(0, i + 1), { cal }), nx = M[q + 1];
    months.push({ d: dates[i], name: res && !res.incomplete ? res.name : null, trendGreen: res && !res.incomplete ? res.sma === 2 : false, r: nx !== undefined ? c1[nx + 1] / c1[i + 1] - 1 : undefined });
  }
  report('US', [runWindow('Jan 2018 to Dec 2023 (judged)', true, months, '2018-01-01', '2023-12-31'), runWindow('Jan 2024 to Oct 2026 (reported)', false, months, '2024-01-01', '2026-10-31')]);
}
// ---------- India before 2010 (C-136): BSE 500 trend light, partial
{
  const j = {}; for (let y = 2005; y <= 2010; y++) Object.assign(j, R(`data/india/idx-hist/idx-${y}.json`)['BSE 500'] ?? {});
  const rdates = Object.keys(j).sort(), c = rdates.map((d) => j[d][3]), s50 = sma(c, 50), s200 = sma(c, 200);
  const win = rdates.filter((d) => d >= '2006-01-01' && d <= '2009-12-31'), zero = win.filter((d) => !(j[d][4] > 0)).length / win.length, useVol = zero <= 0.05;
  const rows = rdates.map((d, k) => ({ date: d, close: c[k], high: j[d][1], low: j[d][2], volume: useVol ? j[d][4] : undefined, sma50: s50[k], sma200: s200[k] })), cal = dateCalendar(rdates);
  const M = firstSessions(rdates, '2005-12-01', '2010-01-31'), months = [];
  for (let q = 0; q < M.length; q++) {
    const i = M[q], res = regimeFrom(rows.slice(0, i + 1), { cal }), nx = M[q + 1];
    months.push({ d: rdates[i], name: res && !res.incomplete ? res.name : null, trendGreen: res && !res.incomplete ? res.sma === 2 : false, r: nx !== undefined ? c[nx + 1] / c[i + 1] - 1 : undefined });
  }
  out.preBseVolumeUsable = useVol; out.preBseZeroVolumeShare = zero; md += `BSE 500 volume zero or missing on ${(zero * 100).toFixed(1)}% of sessions in the window; distribution-day cap ${useVol ? 'kept' : 'dropped'}.\n\n`;
  report('India pre-2010 (BSE 500, partial light)', [runWindow('Jan 2006 to Dec 2009 (judged)', true, months, '2006-01-01', '2009-12-31')]);
}
writeFileSync('data/replay/c133-light.json', JSON.stringify(out, null, 1) + '\n'); writeFileSync('docs/replay/C133-REPORT.md', md); console.log(md);
