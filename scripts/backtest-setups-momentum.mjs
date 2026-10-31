// C-127: desk setups restricted to top-momentum stocks. Registered in docs/backtests/manifest.json. One run per market, no tuning.
// Usage: node --max-old-space-size=7000 scripts/backtest-setups-momentum.mjs india|us      then: node scripts/backtest-setups-momentum.mjs combine
import { readFileSync, writeFileSync } from 'node:fs';
import { bootMean, mean, BASE, eligible as indEligible, topShare, tierCost } from '../src/backtest/ind-base.ts';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { asOfHistories } from '../src/backtest/india-asof.ts';
import { spliceIndex } from '../src/backtest/index-splice.ts';
import { loadUs } from '../src/backtest/us-loader.ts';
const MKT = process.argv[2], R = (p) => JSON.parse(readFileSync(p, 'utf8')), RISK = 0.005, MAXPOS = 5;
const f = (x) => (x * 100).toFixed(1) + '%', g = (x) => (x >= 0 ? '+' : '') + x.toFixed(2);
if (MKT === 'combine') {
  const a = R('data/replay/c127-india.json'), b = R('data/replay/c127-us.json'), pass = a.windows[0].pass && b.windows[0].pass;
  const md = `# C-127 combined\n\nIndia 2011-2019: ${a.windows[0].pass ? 'PASS' : 'FAIL'}\nUS 2018-2025: ${b.windows[0].pass ? 'PASS' : 'FAIL'}\nBoth judged markets: ${pass ? 'PASS' : 'FAIL'}\n`;
  writeFileSync('docs/replay/C127-REPORT.md', md + '\n' + readFileSync('docs/replay/C127-india-REPORT.md', 'utf8') + '\n' + readFileSync('docs/replay/C127-us-REPORT.md', 'utf8')); console.log(md); process.exit(0);
}
if (!['india', 'us'].includes(MKT)) { console.error('usage: india|us|combine'); process.exit(2); }
let dates, N, series, benchIdx, buildSignal, from, to, files, wins;
if (MKT === 'india') {
  const D = loadIndia('data/india', { pre2020: true, allSymbols: true }); ({ dates } = D); N = D.T; series = D.FH.series; from = '2011-01-01'; to = '2025-10-31';
  const nifty = {}, bse = {}; for (let y = 2010; y <= 2025; y++) { let o; try { o = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(o['Nifty 500'] ?? {})) nifty[d] = v[3]; for (const [d, v] of Object.entries(o['BSE 500'] ?? {})) bse[d] = v[3]; }
  benchIdx = spliceIndex(dates, nifty, bse).values;
  buildSignal = (t) => { const hist = asOfHistories(D.days, t, D.res, D.allowed), el = indEligible(hist, t, BASE.skip); return topShare(el, BASE.cut); };
  files = { 'India 2011-2019': ['data/replay/ind-setups-trades-live-oos.json', '2011-01-01', '2019-12-31', null, true], 'India 2021-2025 (reported, exits to 2025-12-31)': ['data/replay/ind-setups-trades-live.json', '2021-01-01', '2025-10-31', '2025-12-31', false] };
} else {
  const D = loadUs(); ({ dates, N } = D); series = D.hist.series; from = '2018-01-01'; to = '2025-10-31'; benchIdx = D.spy;
  const F = { minPrice: 10, minDV: 10e6, universe: 500, minSessions: 260, lookback: 252, skip: 21, cut: 0.10 }, med = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  buildSignal = (t) => { const out = [];
    for (const [sym, s] of series) { const c = s.c[t]; if (!(c >= F.minPrice)) continue; let n = 0; for (let i = 0; i <= t; i++) if (s.c[i] === s.c[i]) n++; if (n < F.minSessions) continue;
      const vals = []; for (let i = t - 19; i <= t; i++) if (s.c[i] > 0 && s.v[i] === s.v[i]) vals.push(s.c[i] * s.v[i]); if (vals.length < 15) continue; const dv = vals.reduce((a, b) => a + b, 0) / vals.length; if (dv < F.minDV) continue;
      const a = s.c[t - F.skip], b = s.c[t - F.lookback]; out.push({ sym, value: med(vals), mom: a > 0 && b > 0 ? a / b - 1 : NaN }); }
    out.sort((x, y) => y.value - x.value || (x.sym < y.sym ? -1 : 1)); const el = out.slice(0, F.universe);
    const w = el.filter((p) => p.mom === p.mom).sort((x, y) => y.mom - x.mom || (x.sym < y.sym ? -1 : 1)); return w.slice(0, Math.max(1, Math.ceil(w.length * F.cut))); };
  files = { 'US 2018-2025 (survivor-biased upward)': ['data/replay/us-setups-trades-live.json', '2018-01-01', '2025-09-30', null, true] };
}
const S = []; for (let i = 1; i < N; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= from && dates[i] <= to) S.push(i);
const t0 = Date.now(), sigD = S.map((t) => dates[t]), sigTop = S.map((t) => new Set(buildSignal(t).map((p) => p.sym))); console.error(`${MKT}: ${S.length} signals ${((Date.now() - t0) / 1000).toFixed(0)}s`);
const ix = new Map(dates.map((d, i) => [d, i])), idxAt = (d) => { let i = ix.get(d); if (i === undefined) return NaN; for (; i >= 0; i--) if (benchIdx[i] > 0) return benchIdx[i]; return NaN; };
function sigFor(d) { let lo = -1; for (let k = 0; k < sigD.length; k++) { if (sigD[k] <= d) lo = k; else break; } return lo; }
function portfolio(tr) {
  const ev = tr.slice().sort((a, b) => (a.e - b.e) || (a.s < b.s ? -1 : 1)), open = []; let eq = 1, peak = 1, mdd = 0, taken = 0, skipped = 0, first = null, last = null;
  const closeUpTo = (e) => { open.sort((a, b) => a.ex - b.ex); while (open.length && open[0].ex < e) { const t = open.shift(); eq += t.size * t.r; last = !last || t.xD > last ? t.xD : last; peak = Math.max(peak, eq); mdd = Math.min(mdd, eq / peak - 1); } };
  for (const t of ev) { closeUpTo(t.e); if (open.length >= MAXPOS) { skipped++; continue; } first ??= t.eD; open.push({ ...t, size: RISK * eq }); taken++; }
  closeUpTo(Infinity); return { taken, skipped, compounded: eq - 1, maxDrawdown: mdd, from: first, to: last };
}
let seed = 20261031; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
function ci(top, rest) {   // 90% month-cluster bootstrap: top mean, and top minus not-top mean
  const by = {}; for (const t of top) (by[t.ym] ??= { a: [], b: [] }).a.push(t.r); for (const t of rest) (by[t.ym] ??= { a: [], b: [] }).b.push(t.r);
  const ms = Object.keys(by), m = [], dlt = [];
  for (let k = 0; k < 4000; k++) { let sa = 0, na = 0, sb = 0, nb = 0; for (let i = 0; i < ms.length; i++) { const o = by[ms[Math.floor(rnd() * ms.length)]]; for (const r of o.a) { sa += r; na++; } for (const r of o.b) { sb += r; nb++; } } if (na) { m.push(sa / na); if (nb) dlt.push(sa / na - sb / nb); } }
  m.sort((a, b) => a - b); dlt.sort((a, b) => a - b); const q = (a, p) => a[Math.floor(a.length * p)]; return { top: [q(m, 0.05), q(m, 0.95)], diff: [q(dlt, 0.05), q(dlt, 0.95)] };
}
const windows = []; let md = `# C-127 setups plus momentum, ${MKT}\n\nTop group = stock in the top momentum group on the latest month-start signal. All filled setup trades, live exits, costs in R. Index price only.\n\n`;
for (const [label, [file, d0, d1, xmax, judged]] of Object.entries(files)) {
  const all = R(file).map((x) => { const si = ix.get(x.d); if (si === undefined || x.d < d0 || x.d > d1) return null; const k = sigFor(x.d); if (k < 0) return null; const e = si + 1, ex = Math.min(N - 1, e + x.v.live.held - 1); if (xmax && dates[ex] > xmax) return null; return { s: x.s, ym: x.ym, d: x.d, e, ex, eD: dates[e], xD: dates[ex], r: x.v.live.R, top: sigTop[k].has(x.s) }; }).filter(Boolean);
  const top = all.filter((t) => t.top), rest = all.filter((t) => !t.top), pf = portfolio(top), idx = pf.from ? idxAt(pf.to) / idxAt(pf.from) - 1 : NaN, c = ci(top, rest);
  const by = {}; for (const t of top) (by[t.d.slice(0, 4)] ??= []).push(t.r); const yrs = Object.keys(by), pos = yrs.filter((y) => mean(by[y]) > 0).length;
  const topM = mean(top.map((t) => t.r)), restM = mean(rest.map((t) => t.r));
  const criteria = { topMeanAboveZero: topM > 0, topCiLowAboveZero: c.top[0] > 0, atLeast100Top: top.length >= 100, beatsNotTop: c.diff[0] > 0, portfolioBeatsIndex: pf.compounded > idx, twoThirdsYears: pos >= Math.ceil((2 / 3) * yrs.length) };
  const pass = Object.values(criteria).every(Boolean);
  windows.push({ label, judged, pass, all: all.length, topCount: top.length, topMeanR: topM, topCi90: c.top, notTopCount: rest.length, notTopMeanR: restM, diffCi90: c.diff, portfolio: pf, indexReturn: idx, yearsPositive: pos, yearsWithTrades: yrs.length, byYear: Object.fromEntries(yrs.map((y) => [y, { n: by[y].length, meanR: mean(by[y]) }])), criteria });
  md += `## ${label}: ${pass ? 'PASS' : 'FAIL'}${judged ? '' : ' (not judged)'}\n- Filled trades ${all.length}; top ${top.length} (mean R ${g(topM)}, 90% ${g(c.top[0])} to ${g(c.top[1])}); not-top ${rest.length} (mean R ${g(restM)}); difference 90% ${g(c.diff[0])} to ${g(c.diff[1])}\n- Top-group portfolio ${f(pf.compounded)} (max fall ${f(pf.maxDrawdown)}, taken ${pf.taken}, skipped ${pf.skipped}); index ${f(idx)}; years positive ${pos} of ${yrs.length}\n- Conditions ${JSON.stringify(criteria)}\n\n`;
}
writeFileSync(`data/replay/c127-${MKT}.json`, JSON.stringify({ run: new Date().toISOString().slice(0, 10), market: MKT, windows }, null, 1) + '\n'); writeFileSync(`docs/replay/C127-${MKT}-REPORT.md`, md); console.log(md);
