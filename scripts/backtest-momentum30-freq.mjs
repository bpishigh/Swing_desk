// C-150: the C-129 sleeve replayed at three re-rank frequencies. Reuses the C-129 code and its eligibility cache. One run, levels and decision rule fixed in advance, no tuning.
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
const allSig = M.map((t, k) => k).filter((k) => k >= k0);
let signals = [];
const SETFREQ = (months) => { signals = allSig.filter((k) => k === k0 || months.includes(dates[M[k]].slice(5, 7))); };
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

// ---- C-150: how often the sleeve is re-ranked. Frequencies fixed in advance: monthly, quarterly (Mar/Jun/Sep/Dec), semi-annual (Jun/Dec, the registered schedule). No stop. Same start date for all three (the first June/December with a full list).
// DECISION RULE (registered before the run): a faster schedule helps only if, after the costs charged in the replay, its compound annual return beats semi-annual by at least 1 point a year, its worst peak-to-trough fall is no more than 3 points worse than semi-annual, and it beats semi-annual in BOTH halves of the period (split at the midpoint date). Several qualify: higher annual return. None: stay semi-annual. It must qualify in BOTH markets (the same frequency) before it is put forward.
const FREQ = [['semi-annual', ['06', '12']], ['quarterly', ['03', '06', '09', '12']], ['monthly', ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']]], T = 'tilt';
const yrs = (a, b) => (Date.parse(b) - Date.parse(a)) / (365.25 * 864e5);
const cg = (a, b) => Math.pow(b / a, 1 / yrs(DATES[A], DATES[B])) - 1;
let DATES = dates, A = 0, B = 0;
const rows = FREQ.map(([name, months]) => {
  SETFREQ(months);
  const r = run(T, 0);
  let pk = 0, mdd = 0, worstFrom = null, worstTo = null, pkAt = null, last = null;
  for (let i = r.first; i < N; i++) { if (!(r.eq[i] > 0)) continue; last = i; if (r.eq[i] > pk) { pk = r.eq[i]; pkAt = i; } const d = r.eq[i] / pk - 1; if (d < mdd) { mdd = d; worstFrom = dates[pkAt]; worstTo = dates[i]; } }
  const y = yrs(dates[r.first], dates[last]), mult = r.eq[last] / r.eq[r.first];
  const midT = (Date.parse(dates[r.first]) + Date.parse(dates[last])) / 2; let mid = r.first; for (let i = r.first; i <= last; i++) if (r.eq[i] > 0 && Math.abs(Date.parse(dates[i]) - midT) < Math.abs(Date.parse(dates[mid]) - midT)) mid = i;
  const half = (a, b) => Math.pow(r.eq[b] / r.eq[a], 1 / yrs(dates[a], dates[b])) - 1;
  const yearly = {}; for (let i = r.first + 1; i <= last; i++) { if (!(r.eq[i] > 0) || !(r.eq[i - 1] > 0)) continue; const yy = dates[i].slice(0, 4); yearly[yy] = (yearly[yy] ?? 1) * (r.eq[i] / r.eq[i - 1]); }
  return { freq: name, reviews: r.costs.length, from: dates[r.first], to: dates[last], years: +y.toFixed(2), multiple: +mult.toFixed(3), cagr: +(Math.pow(mult, 1 / y) - 1).toFixed(4), cagrFirstHalf: +half(r.first, mid).toFixed(4), cagrSecondHalf: +half(mid, last).toFixed(4), midpoint: dates[mid], worstFall: +mdd.toFixed(4), worstFrom, worstTo, turnoverPerReview: +r.turnover.toFixed(3), costPerYear: +(r.costs.reduce((a, c) => a + c.frac, 0) / y).toFixed(4), yearly: Object.fromEntries(Object.entries(yearly).map(([k, v]) => [k, +(v - 1).toFixed(4)])) };
});
const base = rows[0], verdict = rows.slice(1).map((r) => ({ freq: r.freq, cagrGap: +(r.cagr - base.cagr).toFixed(4), fallGap: +(r.worstFall - base.worstFall).toFixed(4), firstHalfGap: +(r.cagrFirstHalf - base.cagrFirstHalf).toFixed(4), secondHalfGap: +(r.cagrSecondHalf - base.cagrSecondHalf).toFixed(4), qualifies: r.cagr - base.cagr >= 0.01 && r.worstFall - base.worstFall >= -0.03 && r.cagrFirstHalf > base.cagrFirstHalf && r.cagrSecondHalf > base.cagrSecondHalf }));
const q = verdict.filter((v) => v.qualifies).sort((a, b) => b.cagrGap - a.cagrGap);
const result = { id: 'C-150-india', run: new Date().toISOString().slice(0, 10), rule: 'faster schedule helps only if annual return beats semi-annual by 1+ point, worst fall no more than 3 points worse, and it wins both halves of the period; none qualifying means stay semi-annual; must qualify in both markets', rows, verdict, chosen: q[0]?.freq ?? null };
writeFileSync('data/replay/c150-momentum-frequency-india.json', JSON.stringify(result, null, 1) + '\n');
// Kill-line check (9 Nov 2026, owner "yes"): with KILLCURVES=1 also write month-end equity curves per schedule and the two benchmarks, for scripts/kill-line-check.mjs. Output only; the run and its results above are unchanged.
if (process.env.KILLCURVES) {
  const monthEnd = (arr) => { const o = {}; for (let i = 0; i < N; i++) { if (dates[i] > '2025-12-31') break; if (arr[i] > 0) o[dates[i].slice(0, 7)] = arr[i]; } return o; };
  const curves = {}; for (const [name, months] of FREQ) { SETFREQ(months); curves[name] = monthEnd(run(T, 0).eq); }
  writeFileSync('data/replay/kill-line-curves-india.json', JSON.stringify({ note: 'Month-end equity of the C-129 sleeve replay at each re-rank schedule (semi-annual = the sleeve, monthly = the C-151 twin), no stop, and Nifty 200 / Nifty 500 (spliced as in C-129). Written for the kill-line check only.', curves, benchmarks: { 'Nifty 200': monthEnd(n200), 'Nifty 500': monthEnd(n500) } }) + '\n');
}
for (const r of rows) console.log(`${r.freq}: ${r.from} to ${r.to} x${r.multiple} annual ${(r.cagr * 100).toFixed(1)}% (halves ${(r.cagrFirstHalf * 100).toFixed(1)}% / ${(r.cagrSecondHalf * 100).toFixed(1)}%) worst fall ${(r.worstFall * 100).toFixed(1)}% costs/yr ${(r.costPerYear * 100).toFixed(2)}% reviews ${r.reviews}`);
console.log(JSON.stringify(verdict), 'chosen', result.chosen);
