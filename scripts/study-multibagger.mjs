// C-170 base-rate study and C-171 lift test (pre-registered: docs/replay/C170-C171-PREREG.md). One run, no tuning; the thresholds live in src/backtest/multibagger.ts and the pre-registration.
// Usage: node --max-old-space-size=8000 scripts/study-multibagger.mjs   Writes data/replay/c170-c171.json and docs/replay/C170-C171-REPORT.md
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { MB, forward, nearHigh, maxDaily, bandOf, baseRate, lift, rng } from '../src/backtest/multibagger.ts';

const D = loadIndia('data/india', { pre2020: true, allSymbols: true }), { dates, T, FH } = D;
const series = new Map(); for (const d of D.sel) for (const [sym, r] of Object.entries(d.rows)) if (!series.has(sym)) series.set(sym, r[0]);
const etf = /(BEES|ETF|LIQUID|GILT|NIFTY|SENSEX)/;
const syms = D.syms.filter((s) => ['EQ', 'BE'].includes(series.get(s)) && !etf.test(s));
const plus5 = (d) => `${Number(d.slice(0, 4)) + 5}${d.slice(4)}`;
const lastDate = dates[T - 1], starts = []; for (let i = 1; i < T; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= '2011-01-01' && plus5(dates[i]) <= lastDate) starts.push(i);
const endIdx = (i) => { const e = plus5(dates[i]); let k = D.first(e); if (k >= T || dates[k] > e) k--; return Math.min(k, T - 1); };
const rows = [], dropped = {}; let events = 0;
for (const i0 of starts) {
  const ym = dates[i0].slice(0, 7), y = Number(ym.slice(0, 4)), iEnd = endIdx(i0), cand = [];
  for (const s of syms) {
    const c = FH.series.get(s)?.c; if (!c || !(c[i0] > 0) || c[i0] < MB.minPrice || i0 < MB.minPrior) continue;
    let n = 0; for (let k = i0 - MB.minPrior; k < i0; k++) if (c[k] > 0) n++; if (n < MB.minPrior * 0.8) continue;   // 252 sessions back with a close on most of them
    const dv = D.dv20(s, i0); if (!(dv >= MB.minDv)) continue;
    cand.push({ s, c, dv, mx: maxDaily(c, i0), nh: nearHigh(c, i0) });
  }
  events += cand.length;
  const sorted = cand.map((x) => x.mx).filter((x) => x === x).sort((a, b) => b - a), maxCut = sorted[Math.max(0, Math.floor(sorted.length * MB.maxFrac) - 1)];
  for (const x of cand) {
    const f = forward(x.c, i0, iEnd); if (!f) continue; if (f.jumped) { dropped[y] = (dropped[y] ?? 0) + 1; continue; }
    const isMax = x.mx === x.mx && x.mx >= maxCut;
    rows.push({ sym: x.s, y, m: ym, hit3: f.peak >= 3, hit5: f.peak >= 5, price: x.c[i0], dv: x.dv, near: x.nh !== null && x.nh >= MB.near && !isMax, priceBand: bandOf(x.c[i0], MB.priceEdges), liqBand: bandOf(x.dv, MB.liqEdges) });
  }
}
console.error(`sessions ${T}, symbols ${syms.length}, start months ${starts.length}, eligible events ${events}, kept ${rows.length}, dropped ${Object.values(dropped).reduce((a, b) => a + b, 0)}`);
const rnd = rng(MB.seed), pct = (x, d = 2) => (x === null || x === undefined || !(x === x) ? '–' : (x * 100).toFixed(d) + '%'), fx = (x) => (x === null || !(x === x) ? '–' : x.toFixed(2));
const years = [...new Set(rows.map((r) => r.y))].sort(), PB = ['under Rs 50', 'Rs 50 to 200', 'Rs 200 to 1,000', 'Rs 1,000 and over'], LB = ['under Rs 1 crore', 'Rs 1 to 5 crore', 'Rs 5 to 25 crore', 'Rs 25 crore and over'];
const cut = (f) => rows.filter(f), out = { snapshot: D.snapshot, events, kept: rows.length, dropped, years: years.length };
out.base = { all3: baseRate(rows, 'hit3', rnd), all5: baseRate(rows, 'hit5', rnd) };
out.byYear = years.map((y) => { const g = cut((r) => r.y === y); return { y, n: g.length, r3: g.filter((r) => r.hit3).length / g.length, r5: g.filter((r) => r.hit5).length / g.length, dropped: dropped[y] ?? 0 }; });
out.byPrice = PB.map((l, b) => { const g = cut((r) => r.priceBand === b); return { band: l, n: g.length, r3: g.filter((r) => r.hit3).length / (g.length || 1), r5: g.filter((r) => r.hit5).length / (g.length || 1) }; });
out.byLiq = LB.map((l, b) => { const g = cut((r) => r.liqBand === b); return { band: l, n: g.length, r3: g.filter((r) => r.hit3).length / (g.length || 1), r5: g.filter((r) => r.hit5).length / (g.length || 1) }; });
const feats = [['F1 near the 52-week high, MAX names excluded', (r) => r.near], ...LB.map((l, b) => [`F2 liquidity ${l}`, (r) => r.liqBand === b])];
out.lift = feats.map(([name, f]) => ({ name, ...lift(rows, f, rnd) }));
out.priceInfo = PB.map((l, b) => ({ name: `Price ${l} (information only)`, ...lift(rows, (r) => r.priceBand === b, rnd) }));
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/c170-c171.json', JSON.stringify(out) + '\n');
const L = [];
L.push('# C-170 base rates and C-171 lift (India, price only)', '', `Run once on 12 Nov 2026 under docs/replay/C170-C171-PREREG.md. Data: ${D.snapshot.sessions} sessions, ${D.snapshot.first} to ${D.snapshot.last}, ${D.snapshot.symbols} symbols, snapshot ${D.snapshot.hash}. Paper study; not investment advice.`, '',
  `Start events: ${events} eligible stock-months from ${starts.length} monthly starts (Jan 2011 to ${dates[starts.at(-1)].slice(0, 7)}); ${rows.length} kept; ${Object.values(dropped).reduce((a, b) => a + b, 0)} paths dropped for a one-day change of 2x or more (see the table by year).`, '', '## C-170: base rates', '',
  `Reaching 3x within five years: ${pct(out.base.all3.rate)} (90% interval ${pct(out.base.all3.lo)} to ${pct(out.base.all3.hi)}). Reaching 5x: ${pct(out.base.all5.rate)} (${pct(out.base.all5.lo)} to ${pct(out.base.all5.hi)}). Intervals come from resampling the ${years.length} start years, so they say how much the answer depends on when you started.`, '',
  '| Start year | Events | Hit 3x | Hit 5x | Dropped |', '|---|---:|---:|---:|---:|', ...out.byYear.map((r) => `| ${r.y} | ${r.n} | ${pct(r.r3)} | ${pct(r.r5)} | ${r.dropped} |`), '',
  '| Price band at start | Events | Hit 3x | Hit 5x |', '|---|---:|---:|---:|', ...out.byPrice.map((r) => `| ${r.band} | ${r.n} | ${pct(r.r3)} | ${pct(r.r5)} |`), '',
  '| Liquidity band at start (20-session traded value) | Events | Hit 3x | Hit 5x |', '|---|---:|---:|---:|', ...out.byLiq.map((r) => `| ${r.band} | ${r.n} | ${pct(r.r3)} | ${pct(r.r5)} |`), '',
  '## C-171: lift on reaching 5x', '', 'Lift is the feature\'s 5x rate over the 5x rate of all eligible start events. An effect is called only if the per-year lower bound exceeds 1 in at least 60% of start years. Five features carry the call, so one of them passing by luck is plausible; weigh that.', '',
  '| Feature | Events | 5x with feature | 5x overall | Lift | Pooled 90% interval | Years passing | Called |', '|---|---:|---:|---:|---:|---|---:|---|',
  ...out.lift.map((r) => `| ${r.name} | ${r.n} | ${pct(r.featRate)} | ${pct(r.baseRate)} | ${fx(r.lift)} | ${fx(r.lo)} to ${fx(r.hi)} | ${r.passYears} of ${r.years} | ${r.share >= MB.effectShare ? 'EFFECT' : 'no effect called'} |`), '',
  'Information only (not part of the call):', '', '| Feature | Events | Lift | Pooled 90% interval | Years passing |', '|---|---:|---:|---|---:|', ...out.priceInfo.map((r) => `| ${r.name} | ${r.n} | ${fx(r.lift)} | ${fx(r.lo)} to ${fx(r.hi)} | ${r.passYears} of ${r.years} |`), '',
  'Per-year lift for each feature is in data/replay/c170-c171.json.', '', '## Limits', '', '- Size band was not tested: no market capitalisation as of each start date is stored (stated in the pre-registration).', '- Monthly starts overlap in time, so events are not independent; the interval resamples whole years for that reason.', '- Survivorship: delisted names are included at their last close, but the price files may miss some delistings; the true base rate for the whole market could be lower.', '- Corporate-action resolution is the desk\'s own; paths with a one-day move of 2x or more are dropped, which also drops real jumps (counted by year above).', '- Price only: dividends are not counted.');
writeFileSync('docs/replay/C170-C171-REPORT.md', L.join('\n') + '\n'); console.log(L.slice(0, 12).join('\n'));
