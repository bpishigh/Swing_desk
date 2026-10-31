// C-126: stop-width cap at 1.5 times. Portfolio of the desk setups (current-cap book vs wider-cap book) against the index. Registered in docs/backtests/manifest.json.
// Trades come from the C-125 replays. The wider book = valid trades + stop-too-wide trades with room of at least 3R (or none overhead). 0.5% risk per trade, at most 5 open, date order. One run.
// Usage: node scripts/backtest-cap-portfolio.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { spliceIndex } from '../src/backtest/index-splice.ts';
import { bootMean, mean, compound } from '../src/backtest/ind-base.ts';
const R = (p) => JSON.parse(readFileSync(p, 'utf8')), RISK = 0.005, MAXPOS = 5;
// calendars and index series
const indDates = [...new Set(['bhav-pre2020', 'bhav-hist', 'bhav'].flatMap((d) => readdirSync(`data/india/${d}`).map((f) => f.slice(0, 10)).filter((f) => /^\d{4}-\d\d-\d\d$/.test(f))))].sort();
const nifty = {}, bse = {}; for (let y = 2010; y <= 2025; y++) { let o; try { o = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(o['Nifty 500'] ?? {})) nifty[d] = v[3]; for (const [d, v] of Object.entries(o['BSE 500'] ?? {})) bse[d] = v[3]; }
const idxAll = [...new Set([...Object.keys(nifty), ...Object.keys(bse)])].sort(), sp = spliceIndex(idxAll, nifty, bse), indIdx = new Map(idxAll.map((d, i) => [d, sp.values[i]]));
const spyBars = JSON.parse(gunzipSync(readFileSync('data/us/hist-bench/SPY.json.gz')).toString()).bars, usDates = spyBars.map((b) => b[0]), usIdx = new Map(spyBars.map((b) => [b[0], b[1]]));
const lastOnOrBefore = (m, d) => { const ks = [...m.keys()]; let v = NaN; for (let i = ks.length - 1; i >= 0; i--) if (ks[i] <= d) { v = m.get(ks[i]); break; } return v; };
function prep(trades, cal) {   // entry date = session after the signal date; exit date = entry + held - 1 sessions
  const ix = new Map(cal.map((d, i) => [d, i]));
  return trades.map((x) => { const si = ix.get(x.d); if (si === undefined) return null; const e = si + 1, h = x.v.live.held, ex = Math.min(cal.length - 1, e + h - 1); return { ...x, eD: cal[e], xD: cal[ex], e, ex, r: x.v.live.R }; }).filter(Boolean);
}
function portfolio(tr) {   // equity changes when a trade is closed, risk sized on equity at entry; skipped when 5 are open
  const ev = tr.slice().sort((a, b) => (a.e - b.e) || (a.s < b.s ? -1 : 1)), open = []; let eq = 1, peak = 1, mdd = 0, taken = 0, skipped = 0, first = null, last = null; const closed = [];
  const closeUpTo = (e) => { open.sort((a, b) => a.ex - b.ex); while (open.length && open[0].ex < e) { const t = open.shift(); eq += t.size * t.r; closed.push(t); peak = Math.max(peak, eq); mdd = Math.min(mdd, eq / peak - 1); } };
  for (const t of ev) { closeUpTo(t.e); if (open.length >= MAXPOS) { skipped++; continue; } first ??= t.eD; open.push({ ...t, size: RISK * eq }); taken++; }
  closeUpTo(Infinity); for (const t of closed) last = !last || t.xD > last ? t.xD : last;
  return { taken, skipped, compounded: eq - 1, maxDrawdown: mdd, from: first, to: last };
}
let seed = 20261031; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
function ciMean(tr) {   // 90% month-cluster bootstrap of mean R
  const by = {}; for (const t of tr) (by[t.ym] ??= []).push(t.r); const ms = Object.keys(by), out = [];
  for (let k = 0; k < 4000; k++) { let s = 0, n = 0; for (let i = 0; i < ms.length; i++) { const a = by[ms[Math.floor(rnd() * ms.length)]]; for (const r of a) { s += r; n++; } } out.push(s / n); } out.sort((a, b) => a - b); return [out[Math.floor(out.length * 0.05)], out[Math.floor(out.length * 0.95)]];
}
function evaluate(label, file, cal, idxMap, win) {
  const all = prep(R(file), cal).filter((t) => t.d >= win[0] && t.d <= win[1] && (win[2] ? t.xD <= win[2] : true));
  const roomOk = (t) => t.room === null || t.room >= 3, current = all.filter((t) => t.cls === 'valid'), wider = all.filter((t) => t.cls === 'valid' || (t.cls === 'tooWide' && roomOk(t)));
  const out = { label, window: win };
  for (const [name, book] of [['current', current], ['wider', wider]]) {
    const pf = portfolio(book), rs = book.map((t) => t.r), by = {}; for (const t of book) (by[t.d.slice(0, 4)] ??= []).push(t.r);
    const idx = (pf.from && pf.to) ? lastOnOrBefore(idxMap, pf.to) / lastOnOrBefore(idxMap, pf.from) - 1 : NaN, [lo, hi] = ciMean(book), yrs = Object.keys(by), pos = yrs.filter((y) => mean(by[y]) > 0).length;
    out[name] = { tradeCount: book.length, meanR: mean(rs), ci90: [lo, hi], portfolio: pf, indexReturn: idx, yearsWithTrades: yrs.length, yearsPositive: pos, byYear: Object.fromEntries(yrs.map((y) => [y, { n: by[y].length, meanR: mean(by[y]) }])) };
  }
  const w = out.wider; out.criteria = { meanRAboveZero: w.meanR > 0, ciLowAboveZero: w.ci90[0] > 0, atLeast100Trades: w.tradeCount >= 100, beatsIndex: w.portfolio.compounded > w.indexReturn, twoThirdsYearsPositive: w.yearsPositive >= Math.ceil((2 / 3) * w.yearsWithTrades) };
  out.pass = Object.values(out.criteria).every(Boolean); return out;
}
const res = {
  india1119: evaluate('India 2011-2019', 'data/replay/ind-setups-trades-live-oos.json', indDates, indIdx, ['2011-01-01', '2019-12-31']),
  us: evaluate('US 2018-2025 (survivor-biased upward)', 'data/replay/us-setups-trades-live.json', usDates, usIdx, ['2018-01-01', '2025-09-30']),
  india2126: evaluate('India 2021-2026 (reported; exits to 2025-12-31 only, the index file ends there)', 'data/replay/ind-setups-trades-live.json', indDates, indIdx, ['2021-01-01', '2026-12-31', '2025-12-31']),
};
const out = { run: new Date().toISOString().slice(0, 10), caps: '12 / 10.5 / 9 % (from 8 / 7 / 6)', risk: RISK, maxPositions: MAXPOS, results: res, judgedPass: res.india1119.pass && res.us.pass };
writeFileSync('data/replay/c126-cap-portfolio.json', JSON.stringify(out, null, 1) + '\n');
const f = (x) => (x * 100).toFixed(1) + '%', g = (x) => (x >= 0 ? '+' : '') + x.toFixed(2); let md = '# C-126: stop-width cap at 1.5 times, portfolio against the index\n\n0.5% risk per trade, at most 5 open, live exits, costs inside R. Index is price only.\n\n';
for (const r of Object.values(res)) { md += `## ${r.label}: ${r.pass ? 'PASS' : 'FAIL'}${r.label.includes('reported') ? ' (not judged)' : ''}\n\n| | Trades | Mean R (90%) | Taken / skipped | Portfolio | Max fall | Index | Years positive |\n|---|---|---|---|---|---|---|---|\n`;
  for (const n of ['current', 'wider']) { const b = r[n]; md += `| ${n} cap | ${b.tradeCount} | ${g(b.meanR)} (${g(b.ci90[0])} to ${g(b.ci90[1])}) | ${b.portfolio.taken} / ${b.portfolio.skipped} | ${f(b.portfolio.compounded)} | ${f(b.portfolio.maxDrawdown)} | ${f(b.indexReturn)} | ${b.yearsPositive} of ${b.yearsWithTrades} |\n`; }
  md += `\nConditions (wider cap): ${JSON.stringify(r.criteria)}\n\n`; }
md += `Judged markets (India 2011-2019 and US): ${out.judgedPass ? 'PASS' : 'FAIL'}\n`; writeFileSync('docs/replay/C126-REPORT.md', md); console.log(md);
