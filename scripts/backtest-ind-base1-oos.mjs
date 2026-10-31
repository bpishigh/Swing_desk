// C-118 test (a): the frozen C-54 momentum baseline on India 2011-2019. Same rule, same definitions, one run, no sweeps. Registered in docs/backtests/manifest.json (C-118).
// Differences from scripts/backtest-ind-base1.mjs, all stated in the C-118 row: data 2010-2019 (C-116), delisted names kept, regime index = Nifty 500 where NSE has it, else the BSE 500 scaled onto it
// (src/backtest/index-splice.ts), signal nights first session of each month Jan 2011 to Dec 2019, one window (no fit / holdout split: nothing was tuned on this data).
// Usage: node --max-old-space-size=8000 scripts/backtest-ind-base1-oos.mjs [--leak]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { resolveHistory, asOfHistories, toDays } from '../src/backtest/india-asof.ts';
import { BASE, eligible, topShare, tierCost, bootMean, mean, compound } from '../src/backtest/ind-base.ts';
import { spliceIndex, above200 } from '../src/backtest/index-splice.ts';
import { formatReport } from '../src/backtest/report.ts';
const LEAK = process.argv.includes('--leak'), R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const D = loadIndia('data/india', { pre2020: true, to: '2020-01-31', allSymbols: true });
const { dates, T, days, res, allowed, FH: finalH } = D;
const nifty = {}, bse = {};
for (let y = 2010; y <= 2020; y++) { let o; try { o = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(o['Nifty 500'] ?? {})) nifty[d] = v[3]; for (const [d, v] of Object.entries(o['BSE 500'] ?? {})) bse[d] = v[3]; }
const sp = spliceIndex(dates, nifty, bse), idx = sp.values;
const regimeOn = (t) => above200(idx, t);
const S = []; for (let i = 1; i < T; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= '2011-01-01' && dates[i] <= '2020-01-31') S.push(i);
const hold = S.map((t) => ({ t, date: dates[t], entry: t + 1 }));
console.error(`sessions ${T} (${dates[0]} to ${dates[T - 1]}), signal nights ${S.length}, index from Nifty ${sp.fromNifty} / BSE ${sp.fromBse} / missing ${sp.missing}, resolution ${JSON.stringify(res.counts)}, data ${D.snapshot.hash}`);
const t0 = Date.now(), base = hold.map((h) => { const hist = asOfHistories(days, h.t, res, allowed); const el = eligible(hist, h.t, BASE.skip); return { ...h, regime: regimeOn(h.t), el, top: topShare(el, BASE.cut) }; });
console.error(`signals built ${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (LEAK) {
  let seed = 20261031; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const picks = [...new Set(Array.from({ length: 8 }, () => Math.floor(rnd() * (base.length - 1))))].sort((a, b) => a - b); let bad = 0;
  const actions = null; void actions;
  for (const k of picks) {
    const t = base[k].t, d2 = toDays(D.sel.slice(0, t + 1)), r2 = resolveHistory(D.sel.slice(0, t + 1), D.actionsUsed, D.overridesUsed);
    const hh = asOfHistories(d2, t, r2, allowed), el = eligible(hh, t), same = el.map((p) => p.sym).join() === base[k].el.map((p) => p.sym).join() && topShare(el).map((p) => p.sym).join() === base[k].top.map((p) => p.sym).join();
    if (!same) bad++; console.log(base[k].date, same ? 'same' : 'DIFFERENT', base[k].top.length, 'picks');
  }
  console.log(bad ? `LEAK CHECK FAIL: ${bad}` : `LEAK CHECK PASS: ${picks.length} nights identical`); process.exit(bad ? 1 : 0);
}
const px = (sym, i) => { const s = finalH.series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] === s.c[k]) return s.c[k]; return NaN; };
const lastIdx = hold.length - 1;
function monthly(picksOf, mult) {
  const out = [], flags = { delisted: 0, noEntryPrice: 0 };
  const names = hold.map((h, k) => (!base[k].regime ? [] : picksOf(base[k])));
  for (let k = 0; k < lastIdx; k++) {
    const e0 = hold[k].entry, e1 = hold[k + 1].entry, cur = names[k];
    if (!cur.length) { out.push({ k, date: hold[k].date, r: 0, n: 0 }); continue; }
    const prev = new Set((names[k - 1] || []).map((p) => p.sym)), next = new Set(names[k + 1].map((p) => p.sym));
    let sum = 0, n = 0;
    for (const p of cur) {
      const s = finalH.series.get(p.sym); if (!s || !(s.c[e0] > 0)) { flags.noEntryPrice++; continue; }
      let c1 = s.c[e1]; if (!(c1 > 0)) { c1 = px(p.sym, e1); flags.delisted++; if (!(c1 > 0)) continue; }
      const cost = tierCost(p.value, mult); let r = c1 / s.c[e0] - 1; if (!prev.has(p.sym)) r -= cost / 2; if (!next.has(p.sym) || k + 1 === lastIdx) r -= cost / 2; sum += r; n++;
    }
    out.push({ k, date: hold[k].date, r: n ? sum / n : 0, n });
  }
  return { rows: out, flags };
}
const idxRet = (k) => idx[hold[k + 1].entry] / idx[hold[k].entry] - 1;
function evalAll(strat, uni) {
  const rows = strat.rows, u = uni.rows, exU = rows.map((x, i) => x.r - u[i].r), n500 = rows.map((x) => idxRet(x.k));
  const [lo, hi] = bootMean(exU), drop3 = [...exU].sort((a, b) => b - a).slice(3), byYear = {};
  rows.forEach((x, i) => { const y = x.date.slice(0, 4); (byYear[y] ??= { s: [], u: [], n: [], ex: [] }).s.push(x.r); byYear[y].u.push(u[i].r); byYear[y].n.push(n500[i]); byYear[y].ex.push(exU[i]); });
  const yearsPos = Object.values(byYear).filter((o) => mean(o.ex) > 0).length;
  return { months: rows.length, invested: rows.filter((x) => x.n > 0).length, meanNet: mean(rows.map((x) => x.r)), meanExUniverse: mean(exU), ci90: [lo, hi], compStrategy: compound(rows.map((x) => x.r)), compUniverse: compound(u.map((x) => x.r)), compIndex: compound(n500), meanExAfterDrop3: mean(drop3), years: Object.keys(byYear).length, yearsPositive: yearsPos,
    byYear: Object.fromEntries(Object.entries(byYear).map(([y, o]) => [y, { meanExcess: mean(o.ex), strategy: compound(o.s), universe: compound(o.u), index: compound(o.n) }])) };
}
const S1 = monthly((b) => b.top, 1), U1 = monthly((b) => b.el, 1), S2 = monthly((b) => b.top, 2), U2 = monthly((b) => b.el, 2);
const r1 = evalAll(S1, U1), r2 = evalAll(S2, U2);
const crit = (e) => ({ meanExcessAboveZero: e.meanExUniverse > 0, ciLowAboveZero: e.ci90[0] > 0, aboveZeroAfterDropping3Months: e.meanExAfterDrop3 > 0, yearsPositiveAtLeast6of9: e.yearsPositive >= 6 && e.years === 9 });
const pass = (c) => Object.values(c).every(Boolean);
// standard report (C-117): the picks in invested months, 20/60/120 sessions from entry, net of tier cost, against the equal-weight eligible list over the same window
const trades = [];
for (const [k, h] of hold.entries()) { if (!base[k].regime) continue; const leg = (list, hz) => { const v = []; for (const p of list) { const s = finalH.series.get(p.sym); if (!s || !(s.c[h.entry] > 0)) continue; const c1 = px(p.sym, h.entry + hz); if (c1 > 0) v.push([p, c1 / s.c[h.entry] - 1]); } return v; };
  const mk = {}, per = {}; for (const hz of [20, 60, 120]) { if (h.entry + hz >= T) { mk[hz] = null; continue; } const u = leg(base[k].el, hz); mk[hz] = u.length ? mean(u.map((x) => x[1])) : null; per[hz] = new Map(leg(base[k].top, hz).map(([p, r]) => [p.sym, [p, r]])); }
  for (const p of base[k].top) { const net = {}; for (const hz of [20, 60, 120]) { const x = per[hz]?.get(p.sym); net[hz] = x ? x[1] - tierCost(p.value) : null; } trades.push({ sym: p.sym, entry: h.date, regime: 'on', net, mkt: mk }); } }
const report = formatReport('C-118 test (a): C-54 momentum baseline, India signals 2011-2019', trades, { market: 'india', survivorBiased: false, pricesAdjusted: true, sweepSize: 1, window: '2011-01 to 2019-12' });
const f2 = (x) => (x * 100).toFixed(2) + '%';
const out = { run: new Date().toISOString().slice(0, 10), data: D.snapshot, index: { fromNifty500: sp.fromNifty, fromBse500Scaled: sp.fromBse, missing: sp.missing }, flags: S1.flags, oos: r1, doubleCost: r2, criteria: crit(r1), criteriaDoubleCost: crit(r2), pass: pass(crit(r1)), passDoubleCost: pass(crit(r2)) };
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/c118-a-oos.json', JSON.stringify(out, null, 1) + '\n'); writeFileSync('docs/replay/C118-A-REPORT.md', report + '\n');
console.log(JSON.stringify({ months: r1.months, invested: r1.invested, meanNet: f2(r1.meanNet), meanExUniverse: f2(r1.meanExUniverse), ci90: r1.ci90.map(f2), after3: f2(r1.meanExAfterDrop3), comp: { strategy: f2(r1.compStrategy), universe: f2(r1.compUniverse), index: f2(r1.compIndex) }, yearsPositive: `${r1.yearsPositive} of ${r1.years}`, criteria: out.criteria, pass: out.pass, doubleCost: { meanEx: f2(r2.meanExUniverse), ci90: r2.ci90.map(f2), pass: out.passDoubleCost }, byYear: Object.fromEntries(Object.entries(r1.byYear).map(([y, o]) => [y, f2(o.meanExcess)])) }, null, 1));
