// C-149: the C-131 sleeve (US) replayed with a trailing stop on each name. Reuses the C-131 code and its eligibility cache. One run, levels and decision rule fixed in advance, no tuning.
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
const signals = [];   // review sessions (first session of June and December) with a full list
for (const t of M) if (['06', '12'].includes(dates[t].slice(5, 7))) { const el = eligible(t); if (el.length >= UNI) signals.push({ t, el }); }
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
const result = { id: 'C-149-us', run: new Date().toISOString().slice(0, 10), rule: 'a level helps only if it lowers the worst fall and keeps compound annual return within 2 points of no stop; pick the smaller fall, then the wider stop; none qualifying means no stop', weighting: T, rows, verdict, chosen: q[0]?.stop ?? null };
writeFileSync('data/replay/c149-momentum-stops-us.json', JSON.stringify(result, null, 1) + '\n');
for (const r of rows) console.log(`stop ${r.stop ? (r.stop * 100) + '%' : 'none'}: ${r.from} to ${r.to} x${r.multiple} annual ${(r.cagr * 100).toFixed(1)}% worst fall ${(r.worstFall * 100).toFixed(1)}% (${r.worstFrom} to ${r.worstTo}) stops ${r.stopsFired}`);
console.log(JSON.stringify(verdict), 'chosen', result.chosen);
