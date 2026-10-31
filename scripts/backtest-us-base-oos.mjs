// C-119 test (a): a US copy of the C-54 momentum baseline on the Nasdaq-sourced store, signals 2018-01 to 2025-09. SURVIVOR-BIASED UPWARD (C-116, C-119). One run, no sweeps.
// First session of each month: 500 most-traded (median 20-day dollar value) common stocks and ADRs with price >= $10, 20-day mean dollar volume >= $10M and 260 sessions of history;
// 12-1 momentum (close 21 sessions ago over close 252 sessions ago); top tenth equal weight; cash when SPY is below its 200-session average. Cost by 20-day dollar volume, half on entry, half on exit,
// charged only on changes. Usage: node --max-old-space-size=8000 scripts/backtest-us-base-oos.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { loadUs, usCost } from '../src/backtest/us-loader.ts';
import { bootMean, mean, compound } from '../src/backtest/ind-base.ts';
import { formatReport } from '../src/backtest/report.ts';
const D = loadUs(), { dates, N, spy, hist } = D;
const F = { minPrice: 10, minDV: 10e6, universe: 500, minSessions: 260, lookback: 252, skip: 21, cut: 0.10 };
const med = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
function eligible(t) {
  const out = [];
  for (const [sym, s] of hist.series) {
    const c = s.c[t]; if (!(c >= F.minPrice)) continue;
    let n = 0; for (let i = 0; i <= t; i++) if (s.c[i] === s.c[i]) n++; if (n < F.minSessions) continue;
    const vals = [], dvs = []; for (let i = t - 19; i <= t; i++) if (s.c[i] > 0 && s.v[i] === s.v[i]) { vals.push(s.c[i] * s.v[i]); dvs.push(s.c[i] * s.v[i]); }
    if (vals.length < 15) continue; const dv = vals.reduce((a, b) => a + b, 0) / vals.length; if (dv < F.minDV) continue;
    const a = s.c[t - F.skip], b = s.c[t - F.lookback]; out.push({ sym, value: med(vals), dv, mom: a > 0 && b > 0 ? a / b - 1 : NaN });
  }
  out.sort((x, y) => y.value - x.value || (x.sym < y.sym ? -1 : 1)); return out.slice(0, F.universe);
}
const top = (list) => { const w = list.filter((p) => p.mom === p.mom).sort((x, y) => y.mom - x.mom || (x.sym < y.sym ? -1 : 1)); return w.slice(0, Math.max(1, Math.ceil(w.length * F.cut))); };
const spyOn = (t) => { if (t < 199) return false; let s = 0; for (let i = t - 199; i <= t; i++) s += spy[i]; return spy[t] >= s / 200; };
const S = []; for (let i = 1; i < N; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= '2018-01-01' && dates[i] <= '2025-10-31') S.push(i);
const hold = S.map((t) => ({ t, date: dates[t], entry: t + 1 }));
const t0 = Date.now(), base = hold.map((h) => { const el = eligible(h.t); return { ...h, regime: spyOn(h.t), el, top: top(el) }; });
console.error(`signals ${base.length} built ${((Date.now() - t0) / 1000).toFixed(0)}s, data ${D.snapshot.hash}`);
const lastIdx = hold.length - 1, px = (sym, i) => { const s = hist.series.get(sym); for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] === s.c[k]) return s.c[k]; return NaN; };
function monthly(pick, mult) {
  const out = [], names = base.map((b) => (b.regime ? pick(b) : []));
  for (let k = 0; k < lastIdx; k++) {
    const e0 = hold[k].entry, e1 = hold[k + 1].entry, cur = names[k]; if (!cur.length) { out.push({ k, date: hold[k].date, r: 0, n: 0 }); continue; }
    const prev = new Set((names[k - 1] || []).map((p) => p.sym)), next = new Set(names[k + 1].map((p) => p.sym)); let sum = 0, n = 0;
    for (const p of cur) { const s = hist.series.get(p.sym); if (!s || !(s.c[e0] > 0)) continue; let c1 = s.c[e1]; if (!(c1 > 0)) { c1 = px(p.sym, e1); if (!(c1 > 0)) continue; }
      const cost = usCost(p.dv) * mult; let r = c1 / s.c[e0] - 1; if (!prev.has(p.sym)) r -= cost / 2; if (!next.has(p.sym) || k + 1 === lastIdx) r -= cost / 2; sum += r; n++; }
    out.push({ k, date: hold[k].date, r: n ? sum / n : 0, n });
  }
  return out;
}
const spyRet = (k) => spy[hold[k + 1].entry] / spy[hold[k].entry] - 1;
function evalAll(sr, ur) {
  const exU = sr.map((x, i) => x.r - ur[i].r), [lo, hi] = bootMean(exU, 3, 5000, 20261016), drop3 = [...exU].sort((a, b) => b - a).slice(3), byYear = {};
  sr.forEach((x, i) => { const y = x.date.slice(0, 4); (byYear[y] ??= { ex: [], s: [], u: [], b: [] }).ex.push(exU[i]); byYear[y].s.push(x.r); byYear[y].u.push(ur[i].r); byYear[y].b.push(spyRet(x.k)); });
  return { months: sr.length, invested: sr.filter((x) => x.n > 0).length, meanNet: mean(sr.map((x) => x.r)), meanExUniverse: mean(exU), ci90: [lo, hi], meanExAfterDrop3: mean(drop3), compStrategy: compound(sr.map((x) => x.r)), compUniverse: compound(ur.map((x) => x.r)), compSpy: compound(sr.map((x) => spyRet(x.k))),
    years: Object.keys(byYear).length, yearsPositive: Object.values(byYear).filter((o) => mean(o.ex) > 0).length, byYear: Object.fromEntries(Object.entries(byYear).map(([y, o]) => [y, { meanExcess: mean(o.ex), strategy: compound(o.s), universe: compound(o.u), spy: compound(o.b) }])) };
}
const r1 = evalAll(monthly((b) => b.top, 1), monthly((b) => b.el, 1)), r2 = evalAll(monthly((b) => b.top, 2), monthly((b) => b.el, 2));
const crit = (e) => ({ meanExcessAboveZero: e.meanExUniverse > 0, ciLowAboveZero: e.ci90[0] > 0, aboveZeroAfterDropping3Months: e.meanExAfterDrop3 > 0, yearsPositiveAtLeast5of8: e.yearsPositive >= 5 && e.years === 8 });
// C-117 report: the picks in invested months, 20/60/120 sessions from entry, net of tier cost, against the equal-weight eligible list over the same window
const trades = [];
for (const [k, h] of hold.entries()) { if (!base[k].regime) continue; const leg = (list, hz) => { const v = []; for (const p of list) { const s = hist.series.get(p.sym); if (!s || !(s.c[h.entry] > 0)) continue; const c1 = px(p.sym, h.entry + hz); if (c1 > 0) v.push([p, c1 / s.c[h.entry] - 1]); } return v; };
  const mk = {}, per = {}; for (const hz of [20, 60, 120]) { if (h.entry + hz >= N) { mk[hz] = null; continue; } const u = leg(base[k].el, hz); mk[hz] = u.length ? mean(u.map((x) => x[1])) : null; per[hz] = new Map(leg(base[k].top, hz).map(([p, r]) => [p.sym, r])); }
  for (const p of base[k].top) { const net = {}; for (const hz of [20, 60, 120]) { const r = per[hz]?.get(p.sym); net[hz] = r === undefined ? null : r - usCost(p.dv); } trades.push({ sym: p.sym, entry: h.date, regime: 'on', net, mkt: mk }); } }
const report = formatReport('C-119 test (a): US momentum baseline, signals 2018-2025', trades, { market: 'us', survivorBiased: true, pricesAdjusted: true, sweepSize: 1, window: '2018-01 to 2025-09' });
const out = { run: new Date().toISOString().slice(0, 10), data: D.snapshot, label: 'SURVIVOR-BIASED UPWARD', oos: r1, doubleCost: r2, criteria: crit(r1), criteriaDoubleCost: crit(r2), pass: Object.values(crit(r1)).every(Boolean), passDoubleCost: Object.values(crit(r2)).every(Boolean) };
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/c119-a-us.json', JSON.stringify(out, null, 1) + '\n'); writeFileSync('docs/replay/C119-A-REPORT.md', report + '\n');
const f = (x) => (x * 100).toFixed(2) + '%';
console.log(JSON.stringify({ months: r1.months, invested: r1.invested, meanNet: f(r1.meanNet), meanExUniverse: f(r1.meanExUniverse), ci90: r1.ci90.map(f), after3: f(r1.meanExAfterDrop3), comp: { strategy: f(r1.compStrategy), universe: f(r1.compUniverse), spy: f(r1.compSpy) }, yearsPositive: `${r1.yearsPositive} of ${r1.years}`, criteria: out.criteria, pass: out.pass, doubleCost: { meanEx: f(r2.meanExUniverse), ci90: r2.ci90.map(f), pass: out.passDoubleCost }, byYear: Object.fromEntries(Object.entries(r1.byYear).map(([y, o]) => [y, f(o.meanExcess)])) }, null, 1));
