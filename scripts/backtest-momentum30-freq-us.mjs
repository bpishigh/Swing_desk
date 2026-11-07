// C-150: the C-131 sleeve (US) replayed with a trailing stop on each name. Reuses the C-131 code and its eligibility cache. One run, levels and decision rule fixed in advance, no tuning.
// Usage: node --max-old-space-size=7000 scripts/backtest-momentum30-stops-us.mjs
// C-131: the C-129 momentum sleeve method on US stocks, against SPY. Registered in docs/backtests/manifest.json as C-131-r1 before this run. One run, no tuning.
// The store holds companies listed today only (survivor bias): a pass cannot confirm the factor, a fail is the informative result.
// Usage: node --max-old-space-size=7000 scripts/backtest-momentum30-us.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { bootMean, mean } from '../src/backtest/ind-base.ts';
import { loadUs, usCost } from '../src/backtest/us-loader.ts';
import { volAdj, zscores, capped } from '../src/engine/momentum-sleeve.ts';
const f = (x) => (x * 100).toFixed(1) + '%', g = (x) => (x * 100).toFixed(2) + '%';
const UNI = 200, HOLD = 30, KEEP = 45, W6 = 126, W12 = 252, CAPW = 0.05, CAPX = 5, MINPX = 5, MINVAL = 20e6, MINSESS = 260;
const D = loadUs(), { dates, N, spy } = D, series = D.hist.series, from = '2017-10-01', to = '2026-10-31';
const carry = (a) => { for (let i = 1; i < a.length; i++) if (!(a[i] > 0)) a[i] = a[i - 1]; return a; };
const qb = JSON.parse(gunzipSync(readFileSync('data/us/hist-bench/QQQ.json.gz')).toString()).bars, qi = new Map(qb.map((b) => [b[0], b[1]])), qqq = carry(Float64Array.from(dates, (d) => qi.get(d) ?? NaN)), spyC = carry(Float64Array.from(spy));
const M = []; for (let i = 1; i < N; i++) if (dates[i].slice(0, 7) !== dates[i - 1].slice(0, 7) && dates[i] >= from && dates[i] <= to) M.push(i);
const px = (sym, i) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
const median = (a) => { const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
function eligible(t) {   // 200 most traded listed companies on night t, as the C-129 list but in dollars
  const out = [];
  for (const [sym, s] of series) {
    const c = s.c[t]; if (!(c >= MINPX)) continue;
    let n = 0; for (let i = 0; i <= t; i++) if (s.c[i] > 0) n++; if (n < MINSESS) continue;
    const vals = []; for (let i = t - 19; i <= t; i++) if (i >= 0 && s.c[i] > 0 && s.v[i] >= 0) vals.push(s.c[i] * s.v[i]); if (vals.length < 15) continue;
    const value = median(vals); if (value >= MINVAL) out.push({ sym, value });
  }
  return out.sort((a, b) => b.value - a.value || (a.sym < b.sym ? -1 : 1));
}
const allSig = [];
for (const t of M) { const el = eligible(t); if (el.length >= UNI) allSig.push({ t, el }); }
const t0 = allSig.find((s) => ['06', '12'].includes(dates[s.t].slice(5, 7))).t;
let signals = [];
const SETFREQ = (months) => { signals = allSig.filter((s) => s.t >= t0 && (s.t === t0 || months.includes(dates[s.t].slice(5, 7)))); };
SETFREQ(['06', '12']);
if (!signals.length) throw new Error('no review date with a full list');
function select(k, prev) {
  const { t, el } = signals[k], uni = el.slice(0, UNI), rows = [];
  for (const p of uni) { const s = series.get(p.sym); const a6 = volAdj(s.c, t, W6), a12 = volAdj(s.c, t, W12); if (a6 === null || a12 === null) continue; rows.push({ ...p, a6, a12 }); }
  const z6 = zscores(rows.map((r) => r.a6)), z12 = zscores(rows.map((r) => r.a12)); rows.forEach((r, i) => { r.s = (z6[i] + z12[i]) / 2; r.mult = r.s >= 0 ? 1 + r.s : 1 / (1 - r.s); });
  rows.sort((a, b) => b.s - a.s || (a.sym < b.sym ? -1 : 1)); rows.forEach((r, i) => { r.rank = i + 1; });
  const keep = rows.filter((r) => prev.has(r.sym) && r.rank <= KEEP), chosen = new Set(keep.map((r) => r.sym)); for (const r of rows) { if (chosen.size >= HOLD) break; if (!chosen.has(r.sym)) chosen.add(r.sym); }
  return { picks: rows.filter((r) => chosen.has(r.sym)), total: uni.reduce((a, b) => a + b.value, 0) };
}
function run(weighting, stop = 0) {
  let cash = 1, held = new Map(), prev = new Set(); const lastValue = new Map(), eq = new Array(N).fill(NaN); let first = null; const turn = [], costs = [], names = [];
  const hi = new Map(); let queue = [], nstops = 0;
  const value = (i) => { let v = cash; for (const [sym, sh] of held) { const p = px(sym, i); v += sh * (p > 0 ? p : 0); } return v; };
  const sigAt = new Map(signals.map((s, k) => [s.t + 1, k]));
  for (let i = 0; i < N; i++) {
    if (stop && queue.length) { for (const sym of queue) { const sh = held.get(sym), p = px(sym, i); if (!(sh > 0) || !(p > 0)) continue; cash += sh * p * (1 - usCost(lastValue.get(sym) ?? 0) / 2); held.delete(sym); hi.delete(sym); nstops++; } queue = []; }
    if (sigAt.has(i)) {
      const k = sigAt.get(i), sel = select(k, prev), V = value(i); first ??= i; names.push(sel.picks.length);
      for (const p of signals[k].el) lastValue.set(p.sym, p.value);
      let w; if (weighting === 'equal') w = sel.picks.map(() => 1 / sel.picks.length); else { const raw = sel.picks.map((r) => r.value * r.mult); w = capped(raw, sel.picks.map((r) => Math.min(CAPW, CAPX * r.value / sel.total))); if (w.reduce((a, b) => a + b, 0) < 1 - 1e-9) w = capped(raw, raw.map(() => CAPW)); }
      const target = new Map(sel.picks.map((r, j) => [r.sym, w[j] * V])), all = new Set([...held.keys(), ...target.keys()]); let traded = 0, cost = 0;
      for (const sym of all) { const p = px(sym, i); if (!(p > 0)) continue; const cur = (held.get(sym) ?? 0) * p, tgt = target.get(sym) ?? 0, d = Math.abs(tgt - cur); traded += d; cost += d * usCost(lastValue.get(sym) ?? 0) / 2; }
      turn.push(traded / (2 * V)); costs.push({ d: dates[i], frac: cost / V }); const V2 = V - cost; held = new Map(); cash = 0;
      for (const [sym, amt] of target) { const p = px(sym, i); if (p > 0) held.set(sym, (amt / V) * V2 / p); else cash += (amt / V) * V2; }
      prev = new Set(held.keys());
    }
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
const result = { id: 'C-150-us', run: new Date().toISOString().slice(0, 10), rule: 'faster schedule helps only if annual return beats semi-annual by 1+ point, worst fall no more than 3 points worse, and it wins both halves of the period; none qualifying means stay semi-annual; must qualify in both markets', rows, verdict, chosen: q[0]?.freq ?? null };
writeFileSync('data/replay/c150-momentum-frequency-us.json', JSON.stringify(result, null, 1) + '\n');
for (const r of rows) console.log(`${r.freq}: ${r.from} to ${r.to} x${r.multiple} annual ${(r.cagr * 100).toFixed(1)}% (halves ${(r.cagrFirstHalf * 100).toFixed(1)}% / ${(r.cagrSecondHalf * 100).toFixed(1)}%) worst fall ${(r.worstFall * 100).toFixed(1)}% costs/yr ${(r.costPerYear * 100).toFixed(2)}% reviews ${r.reviews}`);
console.log(JSON.stringify(verdict), 'chosen', result.chosen);
