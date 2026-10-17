// C-54 IND-BASE-1 runner. Pre-registration: docs/replay/IND-BASE-1-PREREG.md. Signals use the as-of view; realised returns use the fully adjusted series (what a holder actually earned).
// Usage: node --max-old-space-size=8000 scripts/backtest-ind-base1.mjs [--reveal] [--leak]
//   default : writes the fit-window result (docs/replay/IND-BASE-1-RESULT-*.md, data/replay/ind-base1-fit.json) and the holdout to data/replay/ind-base1-holdout.json UNREAD.
//   --reveal: prints and records the holdout against the pass criteria (one reveal, logged by committing the output).
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { resolveHistory, asOfHistories, toDays } from '../src/backtest/india-asof.ts';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { BASE, eligible, topShare, tierCost, bootMean, mean, compound } from '../src/backtest/ind-base.ts';
const AUDIT = process.argv.includes('--audit'), REVEAL = process.argv.includes('--reveal'), LEAK = process.argv.includes('--leak');
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => x.endsWith('.json')).sort()) bhav.push(R('data/india/bhav/' + f));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const days = toDays(bhav), dates = days.map((d) => d.date), T = days.length;
const actions = [...R('data/india/corp-actions-history.json'), ...(existsSync('data/india/corp-actions.json') ? R('data/india/corp-actions.json') : [])];
const ov = existsSync('data/india/corp-action-overrides.json') ? R('data/india/corp-action-overrides.json') : {};
const res = resolveHistory(bhav, actions, ov);
const allowed = new Set(); for (const d of days) for (const r of d.rows) allowed.add(r[0]);
const finalH = buildHistories(days, res.splits, allowed);            // fully adjusted: realised returns only
// Nifty 500 aligned to sessions, last known close carried over the three missing days
const idxRaw = {}; for (let y = 2020; y <= 2025; y++) Object.assign(idxRaw, Object.fromEntries(Object.entries(R(`data/india/idx-hist/idx-${y}.json`)['Nifty 500'] || {}).map(([d, v]) => [d, v[3]])));
const idx = new Float64Array(T).fill(NaN); let last = NaN; const carried = [];
for (let i = 0; i < T; i++) { if (dates[i] in idxRaw) last = idxRaw[dates[i]]; else if (dates[i] <= '2025-10-16') carried.push(dates[i]); idx[i] = dates[i] <= '2025-10-16' ? last : NaN; }
const regimeOn = (t) => { if (t < 199) return false; let s = 0; for (let i = t - 199; i <= t; i++) s += idx[i]; return idx[t] >= s / 200; };
// signal nights: first session of each month, Jan 2021 to Oct 2025
const S = []; for (let i = 1; i < T; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= '2021-01-01' && dates[i] <= '2025-10-31') S.push(i);
const hold = S.map((t) => ({ t, date: dates[t], entry: t + 1 }));
console.error(`sessions ${T}, signal nights ${S.length}, index days carried ${carried.length}, resolution ${JSON.stringify(res.counts)}`);

// per signal night: eligible list, top share, regime, using only what was known
const sig = (cut, skip) => hold.map((h) => { const hist = asOfHistories(days, h.t, res, allowed); const el = eligible(hist, h.t, skip); return { ...h, regime: regimeOn(h.t), el, top: topShare(el, cut) }; });
const t0 = Date.now(); const base = sig(BASE.cut, BASE.skip); const etf=/(BEES|ETF|IETF|LIQUID|GILT|NIFTY|SENSEX)/; const etfPicks=base.reduce((a,b)=>a+b.top.filter(p=>etf.test(p.sym)).length,0), allPicks=base.reduce((a,b)=>a+b.top.length,0); console.error(`etf-like picks ${etfPicks} of ${allPicks}`);
console.error(`signals built ${((Date.now() - t0) / 1000).toFixed(0)}s`);

if (LEAK) {   // integrity: signals rebuilt from data truncated at the night (resolution included) must equal the signals used
  let seed = 20261018; const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const picks = [...new Set(Array.from({ length: 10 }, () => Math.floor(rnd() * base.length)))].sort((a, b) => a - b); let bad = 0;
  for (const k of picks) {
    const t = base[k].t, rTrunc = resolveHistory(bhav.slice(0, t + 1), actions, ov), dTrunc = toDays(bhav.slice(0, t + 1));
    const hh = asOfHistories(dTrunc, t, rTrunc, allowed), top = topShare(eligible(hh, t)).map((p) => p.sym).join(','), used = base[k].top.map((p) => p.sym).join(',');
    const el = eligible(hh, t).map((p) => p.sym).join(','), elUsed = base[k].el.map((p) => p.sym).join(',');
    const same = top === used && el === elUsed && regimeOn(t) === base[k].regime; if (!same) bad++; console.log(base[k].date, same ? 'same' : 'DIFFERENT', base[k].top.length, 'picks');
  }
  console.log(bad ? `LEAK CHECK FAIL: ${bad}` : `LEAK CHECK PASS: ${picks.length} nights identical`); process.exit(bad ? 1 : 0);
}
const px = (sym, i) => { const s = finalH.series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] === s.c[k]) return s.c[k]; return NaN; };
const lastIdx = hold.length - 1;
/** Monthly net returns of a rule: list picks per month, same regime rule, costs charged half on entry and half on exit, only on changes. */
function monthly(picksOf, mult, regimeFilter = true) {
  const out = []; let flags = { delisted: 0, demergerInHold: 0, noEntryPrice: 0 };
  const names = hold.map((h, k) => (regimeFilter && !base[k].regime ? [] : picksOf(base[k], k)));
  for (let k = 0; k < lastIdx; k++) {
    const e0 = hold[k].entry, e1 = hold[k + 1].entry, cur = names[k];
    if (!cur.length) { out.push({ k, date: hold[k].date, r: 0, n: 0 }); continue; }
    const prev = new Set((names[k - 1] || []).map((p) => p.sym)), next = new Set(names[k + 1].map((p) => p.sym));
    let sum = 0, n = 0;
    for (const p of cur) {
      const s = finalH.series.get(p.sym); if (!s || !(s.c[e0] > 0)) { flags.noEntryPrice++; continue; }
      let c1 = s.c[e1]; if (!(c1 > 0)) { c1 = px(p.sym, e1); flags.delisted++; if (!(c1 > 0)) continue; }
      const cost = tierCost(p.value, mult);
      let r = c1 / s.c[e0] - 1; if (!prev.has(p.sym)) r -= cost / 2; if (!next.has(p.sym) || k + 1 === lastIdx) r -= cost / 2;
      sum += r; n++; if (AUDIT) (globalThis.TRACE ??= []).push([p.sym, hold[k].date, c1 / s.c[e0] - 1, Math.round(p.value / 1e7)]);
    }
    out.push({ k, date: hold[k].date, r: n ? sum / n : 0, n });
  }
  return { rows: out, flags };
}
const idxRet = (k) => idx[hold[k + 1].entry] / idx[hold[k].entry] - 1;
const inWin = (d, w) => (w === 'fit' ? d >= '2021-01-01' && d <= '2023-12-31' : d >= '2024-01-01');
const baseline = (mult = 1, cutSet) => monthly((b) => (cutSet ? topShare(b.el, cutSet) : b.top), mult);
const universe = (mult = 1) => monthly((b) => b.el, mult);
function evalWin(strat, uni, w) {
  const rows = strat.rows.filter((x) => inWin(x.date, w)), u = uni.rows.filter((x) => inWin(x.date, w));
  const exU = rows.map((x, i) => x.r - u[i].r), n500 = rows.map((x) => idxRet(x.k));
  const [lo, hi] = bootMean(exU);
  const drop3 = [...exU].sort((a, b) => b - a).slice(3);
  const byYear = {}; rows.forEach((x, i) => { const y = x.date.slice(0, 4); (byYear[y] ??= { s: [], u: [], n: [] }).s.push(x.r); byYear[y].u.push(u[i].r); byYear[y].n.push(n500[i]); });
  return { months: rows.length, invested: rows.filter((x) => x.n > 0).length, meanNet: mean(rows.map((x) => x.r)), meanExUniverse: mean(exU), ci90: [lo, hi], compStrategy: compound(rows.map((x) => x.r)), compUniverse: compound(u.map((x) => x.r)), compNifty500: compound(n500), exVsNifty500: compound(rows.map((x) => x.r)) - compound(n500), meanExAfterDrop3: mean(drop3),
    byYear: Object.fromEntries(Object.entries(byYear).map(([y, o]) => [y, { strategy: compound(o.s), universe: compound(o.u), nifty500: compound(o.n) }])) };
}
const criteria = (e, h) => ({ P1: e.meanExUniverse > 0 && e.ci90[0] > 0 && (!h || h.meanExUniverse > 0), P2: e.exVsNifty500 > 0 && (!h || h.exVsNifty500 > 0), P3: e.meanExAfterDrop3 > 0 });
if (AUDIT) { const S0 = baseline(1); const tr = globalThis.TRACE.filter((x) => x[1] >= '2021-01-01' && x[1] <= '2023-12-31'); tr.sort((a, b) => b[2] - a[2]); console.log('TOP 15 name-months'); tr.slice(0, 15).forEach((x) => console.log(x[0], x[1], (x[2] * 100).toFixed(0) + '%', x[3] + 'cr/day')); console.log('BOTTOM 5'); tr.slice(-5).forEach((x) => console.log(x[0], x[1], (x[2] * 100).toFixed(0) + '%', x[3] + 'cr/day')); const sp = new Set(res.splits.map((r) => r[0] + '|' + r[1].slice(0, 7))); console.log('count of name-months', tr.length, 'mean gross', (mean(tr.map((x) => x[2])) * 100).toFixed(2) + '%', 'median', (tr.map((x) => x[2]).sort((a, b) => a - b)[tr.length >> 1] * 100).toFixed(2) + '%'); console.log('top-15 with a resolved factor that month:', tr.slice(0, 15).filter((x) => sp.has(x[0] + '|' + x[1].slice(0, 7)) || sp.has(x[0] + '|' + dates[Math.min(T - 1, dates.indexOf(x[1]) + 20)].slice(0, 7))).map((x) => x[0]).join(',') || 'none'); process.exit(0); }
const S1 = baseline(1), U1 = universe(1), S2 = baseline(2), U2 = universe(2);
const fit = evalWin(S1, U1, 'fit'), hold_ = evalWin(S1, U1, 'hold'), fit2 = evalWin(S2, U2, 'fit'), hold2 = evalWin(S2, U2, 'hold');
// variants (fit window only)
const vNoSkip = (() => { const b = sig(BASE.cut, 0); const m = monthly((_, k) => b[k].top, 1); return evalWin(m, U1, 'fit'); })();
const vTop5 = evalWin(baseline(1, 0.05), U1, 'fit'), vTop20 = evalWin(baseline(1, 0.20), U1, 'fit');
const vNoFilter = (() => { const m = monthly((b) => b.top, 1, false), u = monthly((b) => b.el, 1, false); return evalWin(m, u, 'fit'); })();
// holding curve: invested months, picks vs eligible list, net of one full round trip, annualised
function curve(win) {
  const out = {};
  for (const hz of [20, 60, 120]) {
    const ex = [], raw = [];
    hold.forEach((h, k) => { if (!base[k].regime || !inWin(h.date, win) || h.entry + hz >= T) return; const leg = (list) => { const v = []; for (const p of list) { const s = finalH.series.get(p.sym); if (!s || !(s.c[h.entry] > 0)) continue; const c1 = px(p.sym, h.entry + hz); if (c1 > 0) v.push(c1 / s.c[h.entry] - 1 - tierCost(p.value)); } return mean(v); }; const a = leg(base[k].top), u = leg(base[k].el); if (a === a && u === u) { ex.push(a - u); raw.push(a); } });
    const [lo, hi] = bootMean(ex); out[hz] = { signalMonths: ex.length, meanNet: mean(raw), meanExcess: mean(ex), annualisedExcess: mean(ex) * 252 / hz, ci90Annualised: [lo * 252 / hz, hi * 252 / hz] };
  }
  const best = Math.max(...Object.values(out).map((o) => o.annualisedExcess)); out.flag20 = out[20].annualisedExcess < 0.75 * best ? 'FLAG: 20-session below 75% of the best horizon' : 'no flag'; return out;
}
const curveFit = curve('fit'), curveHold = curve('hold');
const f2 = (x) => (x * 100).toFixed(2) + '%';
const crit = criteria(fit, null), crit2 = criteria(fit2, null);
const fitOut = { run: new Date().toISOString().slice(0, 10), flagsStrategy: S1.flags, fit, fitDoubleCost: fit2, variantsFit: { noSkip: vNoSkip, top5: vTop5, top20: vTop20, filterOff: vNoFilter }, holdingCurveFit: curveFit, fitCriteria: crit, fitCriteriaDoubleCost: crit2 };
mkdirSync('data/replay', { recursive: true });
writeFileSync('data/replay/ind-base1-fit.json', JSON.stringify(fitOut, null, 1) + '\n');
if (!REVEAL) {
  writeFileSync('data/replay/ind-base1-holdout.json', JSON.stringify({ holdout: hold_, holdoutDoubleCost: hold2, holdingCurveHoldout: curveHold }, null, 1) + '\n');
  console.log('FIT WINDOW (holdout written, not read)'); console.log(JSON.stringify({ fit: { months: fit.months, invested: fit.invested, meanNet: f2(fit.meanNet), meanExUniverse: f2(fit.meanExUniverse), ci90: fit.ci90.map(f2), compStrategy: f2(fit.compStrategy), compUniverse: f2(fit.compUniverse), compNifty500: f2(fit.compNifty500), exVsNifty500: f2(fit.exVsNifty500), meanExAfterDrop3: f2(fit.meanExAfterDrop3), byYear: fit.byYear }, criteria: crit, doubleCost: { meanExUniverse: f2(fit2.meanExUniverse), ci90: fit2.ci90.map(f2), exVsNifty500: f2(fit2.exVsNifty500), meanExAfterDrop3: f2(fit2.meanExAfterDrop3), criteria: crit2 }, variants: Object.fromEntries(Object.entries(fitOut.variantsFit).map(([k, v]) => [k, { meanExUniverse: f2(v.meanExUniverse), exVsNifty500: f2(v.exVsNifty500), compStrategy: f2(v.compStrategy) }])), curve: curveFit, flags: S1.flags }, null, 1));
} else {
  const ho = R('data/replay/ind-base1-holdout.json');
  const c = criteria(fit, ho.holdout), c2 = criteria(fit2, ho.holdoutDoubleCost);
  console.log('HOLDOUT REVEAL'); console.log(JSON.stringify({ holdout: { months: ho.holdout.months, meanNet: f2(ho.holdout.meanNet), meanExUniverse: f2(ho.holdout.meanExUniverse), exVsNifty500: f2(ho.holdout.exVsNifty500), compStrategy: f2(ho.holdout.compStrategy), compUniverse: f2(ho.holdout.compUniverse), compNifty500: f2(ho.holdout.compNifty500), byYear: ho.holdout.byYear }, criteria: c, criteriaDoubleCost: c2, curve: ho.holdingCurveHoldout }, null, 1));
}
