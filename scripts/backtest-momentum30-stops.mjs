// C-149: the C-129 sleeve (India) replayed with a trailing stop on each name. Reuses the C-129 code and its eligibility cache. One run, levels and decision rule fixed in advance, no tuning.
// Usage: node --max-old-space-size=7000 scripts/backtest-momentum30-stops.mjs
// C-129: Nifty200 Momentum 30-style sleeve (methodology replication with stand-ins). Registered in docs/backtests/manifest.json. One run, no tuning.
// Usage: node --max-old-space-size=7000 scripts/backtest-momentum30.mjs      (needs /tmp/c128-el-india.json, or rebuilds it, ~20 min)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { bootMean, mean, BASE, eligible as indEligible, tierCost } from '../src/backtest/ind-base.ts';
import { loadIndia } from '../src/backtest/india-loader.ts';
import { asOfHistories } from '../src/backtest/india-asof.ts';
import { spliceIndex } from '../src/backtest/index-splice.ts';
import { selectSleeve, capped } from '../src/engine/momentum-sleeve.ts';
const R = (p) => JSON.parse(readFileSync(p, 'utf8')), f = (x) => (x * 100).toFixed(1) + '%', g = (x) => (x * 100).toFixed(2) + '%';
const UNI = 200, CAPW = 0.05, CAPX = 5;
const D = loadIndia('data/india', { pre2020: true, allSymbols: true }), { dates } = D, N = D.T, series = D.FH.series, from = '2011-01-01', to = '2025-10-31';
const idxOf = (name) => { const o = {}; for (let y = 2010; y <= 2025; y++) { let j; try { j = R(`data/india/idx-hist/idx-${y}.json`); } catch { continue; } for (const [d, v] of Object.entries(j[name] ?? {})) o[d] = v[3]; } return o; };
const bse = idxOf('BSE 500'), carry = (a) => { for (let i = 1; i < a.length; i++) if (!(a[i] > 0)) a[i] = a[i - 1]; return a; };
const n200 = carry(spliceIndex(dates, idxOf('Nifty 200'), bse).values), n500 = carry(spliceIndex(dates, idxOf('Nifty 500'), bse).values);
const M = []; for (let i = 1; i < N; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= from && dates[i] <= to) M.push(i);
const cache = '/tmp/c128-el-india.json'; let EL;
if (existsSync(cache)) EL = R(cache); else { EL = M.map((t) => indEligible(asOfHistories(D.days, t, D.res, D.allowed), t, BASE.skip).map((p) => ({ sym: p.sym, value: p.value }))); writeFileSync(cache, JSON.stringify(EL)); }
if (EL.length !== M.length) throw new Error(`list count ${EL.length} != signals ${M.length}`);
const px = (sym, i) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
// The arithmetic (volAdj, z-scores, caps, selection, weights) is the shared module the live job uses (src/engine/momentum-sleeve.ts), so the C-130 live-versus-replay check compares two runs of one definition against two data paths.
const select = (k, prev) => { const sel = selectSleeve(EL[k], series, M[k], prev); return { picks: sel.picks, total: sel.total, universe: sel.universe }; };
const k0 = EL.findIndex((l) => l.length >= UNI);   // the first lists are empty: eligibility needs 260 sessions of history and the data starts in 2010
const signals = M.map((t, k) => k).filter((k) => k >= k0 && (k === k0 || ['06', '12'].includes(dates[M[k]].slice(5, 7))));
function run(weighting, stop = 0) {   // weighting: 'tilt' (score x traded value, capped) or 'equal'
  let cash = 1, held = new Map(), prev = new Set(), lastValue = new Map(); const eq = new Array(N).fill(NaN); let first = null, turn = [], names = [], costs = [];
  const hi = new Map(); let queue = [], nstops = 0;
  const value = (i) => { let v = cash; for (const [sym, sh] of held) { const p = px(sym, i); v += sh * (p > 0 ? p : 0); } return v; };
  const sigAt = new Map(signals.map((k) => [M[k] + 1, k]));
  for (let i = 0; i < N; i++) {
    if (dates[i] > '2025-12-31') break;
    if (stop && queue.length) { for (const sym of queue) { const sh = held.get(sym), p = px(sym, i); if (!(sh > 0) || !(p > 0)) continue; cash += sh * p * (1 - tierCost(lastValue.get(sym) ?? 0) / 2); held.delete(sym); hi.delete(sym); nstops++; } queue = []; }
    if (sigAt.has(i)) { const k = sigAt.get(i), sel = select(k, prev), V = value(i); first ??= i; names.push(sel.picks.length);
      for (const p of EL[k]) lastValue.set(p.sym, p.value);
      let w; if (weighting === 'equal') w = sel.picks.map(() => 1 / sel.picks.length); else { const raw = sel.picks.map((r) => r.value * r.mult); w = capped(raw, sel.picks.map((r) => Math.min(CAPW, CAPX * r.value / sel.total))); if (w.reduce((a, b) => a + b, 0) < 1 - 1e-9) w = capped(raw, raw.map(() => CAPW)); /* the 5x rule cannot allocate 100% when the picks are small by traded value: fall back to the 5% cap alone (first run left part of the portfolio unallocated and showed -100%) */ }
      const target = new Map(sel.picks.map((r, j) => [r.sym, w[j] * V])), all = new Set([...held.keys(), ...target.keys()]); let traded = 0, cost = 0;
      for (const sym of all) { const p = px(sym, i); if (!(p > 0)) continue; const cur = (held.get(sym) ?? 0) * p, tgt = target.get(sym) ?? 0, d = Math.abs(tgt - cur); traded += d; cost += d * tierCost(lastValue.get(sym) ?? 0) / 2; }
      turn.push(traded / (2 * V)); costs.push({ d: dates[i], frac: cost / V }); const V2 = V - cost; held = new Map(); cash = 0; for (const [sym, amt] of target) { const p = px(sym, i); if (p > 0) held.set(sym, (amt / V) * V2 / p); else cash += (amt / V) * V2; }
      prev = new Set(held.keys()); }
    if (stop) { for (const sym of held.keys()) { const p = px(sym, i); if (!(p > 0)) continue; hi.set(sym, Math.max(hi.get(sym) ?? p, p)); if (p <= (1 - stop) * hi.get(sym) && !queue.includes(sym)) queue.push(sym); } }
    if (first !== null && i >= first) eq[i] = value(i);
  }
  return { eq, first, turnover: mean(turn), holdings: mean(names), costs, nstops };
}

// ---- C-149: the same sleeve with a trailing stop on each name. Levels fixed in advance: none, 5%, 8%, 25% below the highest close since bought.
// A name whose close is that far below its highest close since it was bought is sold at the NEXT session's close (these stores carry no opens; the live twin sells at the next open) with half the round-trip cost, and is not replaced until the next signal. Weighting: the registered tilt weighting. Decision rule (registered before this run): a level counts as helping only if it lowers the worst peak-to-trough fall of the sleeve and its compound annual return stays within 2 points a year of the no-stop sleeve; if several qualify take the smaller fall, then the wider stop; if none qualifies, no stop.
const LEVELS = [0, 0.05, 0.08, 0.25], T = 'tilt';
const yrs = (a, b) => (Date.parse(b) - Date.parse(a)) / (365.25 * 864e5);
const rows = LEVELS.map((lv) => {
  const r = run(T, lv), idx = [];
  let pk = 0, mdd = 0, worstFrom = null, worstTo = null, pkAt = null, last = null;
  for (let i = r.first; i < N; i++) { if (!(r.eq[i] > 0)) continue; last = i; if (r.eq[i] > pk) { pk = r.eq[i]; pkAt = i; } const d = r.eq[i] / pk - 1; if (d < mdd) { mdd = d; worstFrom = dates[pkAt]; worstTo = dates[i]; } }
  const y = yrs(dates[r.first], dates[last]), mult = r.eq[last] / r.eq[r.first];
  const yearly = {}; for (let i = r.first + 1; i <= last; i++) { if (!(r.eq[i] > 0) || !(r.eq[i - 1] > 0)) continue; const yy = dates[i].slice(0, 4); yearly[yy] = (yearly[yy] ?? 1) * (r.eq[i] / r.eq[i - 1]); }
  return { stop: lv, from: dates[r.first], to: dates[last], years: +y.toFixed(2), multiple: +mult.toFixed(3), cagr: +(Math.pow(mult, 1 / y) - 1).toFixed(4), worstFall: +mdd.toFixed(4), worstFrom, worstTo, stopsFired: r.nstops, yearly: Object.fromEntries(Object.entries(yearly).map(([k, v]) => [k, +(v - 1).toFixed(4)])) };
});
const base = rows[0], verdict = rows.slice(1).map((r) => ({ stop: r.stop, lowersFall: r.worstFall > base.worstFall, cagrGap: +(r.cagr - base.cagr).toFixed(4), qualifies: r.worstFall > base.worstFall && r.cagr - base.cagr >= -0.02 }));
const q = verdict.filter((v) => v.qualifies).sort((a, b) => rows.find((r) => r.stop === b.stop).worstFall - rows.find((r) => r.stop === a.stop).worstFall || b.stop - a.stop);
const result = { id: 'C-149-india', run: new Date().toISOString().slice(0, 10), rule: 'a level helps only if it lowers the worst fall and keeps compound annual return within 2 points of no stop; pick the smaller fall, then the wider stop; none qualifying means no stop', weighting: T, rows, verdict, chosen: q[0]?.stop ?? null };
writeFileSync('data/replay/c149-momentum-stops-india.json', JSON.stringify(result, null, 1) + '\n');
for (const r of rows) console.log(`stop ${r.stop ? (r.stop * 100) + '%' : 'none'}: ${r.from} to ${r.to} x${r.multiple} annual ${(r.cagr * 100).toFixed(1)}% worst fall ${(r.worstFall * 100).toFixed(1)}% (${r.worstFrom} to ${r.worstTo}) stops ${r.stopsFired}`);
console.log(JSON.stringify(verdict), 'chosen', result.chosen);
