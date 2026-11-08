// Stop feasibility check (exploration, owner question 8 Nov 2026): can a loss cap of 5 to 8% per position work for volatile stocks and for multibaggers?
// DESCRIPTIVE ONLY: measures how often ordinary price noise would hit such a stop, and what an 8% trailing stop with re-entry would have done on stocks that went on to multiply.
// No strategy is tested, no edge is claimed, and the multibagger set is picked with hindsight (an upper bound for any rule). Survivor-free as far as the stored files allow (delisted names kept).
// Usage: node --max-old-space-size=7000 scripts/stop-feasibility.mjs   -> data/stop-feasibility.json
import { writeFileSync } from 'node:fs';
import { loadIndia } from '../src/backtest/india-loader.ts';
const D = loadIndia('data/india', { pre2020: true, allSymbols: true }), { dates } = D, N = D.T, series = D.FH.series;
const from = D.first('2011-01-01'), to = D.first('2025-10-31');
const RT = 0.005;                      // 0.50% round trip per stop-out and re-entry (the desk's middle cost assumption)
const q = (a, p) => { const s = [...a].filter((x) => x === x).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const pct = (x) => (x == null ? null : +(x * 100).toFixed(1));
// forward-filled close arrays for liquid names
const C = new Map(); for (const [s, x] of series) { const c = Float64Array.from(x.c); for (let i = 1; i < N; i++) if (!(c[i] > 0)) c[i] = c[i - 1]; C.set(s, { c, raw: x.c, v: x.v }); }
const atrp = (c, i) => { let a = 0, n = 0; for (let j = i - 19; j <= i; j++) { if (c[j] > 0 && c[j - 1] > 0) { a += Math.abs(c[j] - c[j - 1]); n++; } } return n >= 16 ? a / n / c[i] : NaN; };
// sample dates: every 20th session
const samples = []; for (let i = from; i <= to - 260; i += 20) samples.push(i);
// liquid set at i, ranked by 20-session traded value; tiers by rank
const liquid = (i) => { const r = []; for (const s of C.keys()) { const x = series.get(s); const dv = D.dv20(s, i); if (dv >= 5e7 && x.c[i] > 0 && x.c[i - 250] > 0) r.push([s, dv]); } r.sort((a, b) => b[1] - a[1]); return r.slice(0, 750).map(([s], k) => [s, k < 100 ? 'top100' : k < 300 ? 'rank101-300' : 'rank301-750']); };
const tiers = ['top100', 'rank101-300', 'rank301-750', 'all'];
const A = {}, B = {}; for (const t of tiers) { A[t] = { n: 0, w8: 0, w5: 0, atr: [] }; B[t] = { n: 0, h: { 20: [0, 0], 60: [0, 0], 250: [0, 0] }, tt: [] }; }
const byYear = {};
const hit = (c, e, H, d) => { let hi = c[e]; for (let j = e + 1; j <= Math.min(N - 1, e + H); j++) { if (c[j] > hi) hi = c[j]; if (c[j] <= hi * (1 - d)) return j - e; } return 0; };
for (const i of samples) for (const [s, t] of liquid(i)) {
  const c = C.get(s).c, a = atrp(c, i); if (!(a > 0)) continue; const e = i + 1; if (!(c[e] > 0)) continue; const y = dates[i].slice(0, 4);
  byYear[y] = byYear[y] || { n: 0, w8: 0 }; byYear[y].n++;
  for (const k of [t, 'all']) { A[k].n++; A[k].atr.push(3 * a); if (3 * a > 0.08) A[k].w8++; if (3 * a > 0.05) A[k].w5++; }
  if (3 * a > 0.08) byYear[y].w8++;
  for (const k of [t, 'all']) { B[k].n++; for (const H of [20, 60, 250]) { const j8 = hit(c, e, H, 0.08), j5 = hit(c, e, H, 0.05); B[k].h[H][0] += j8 > 0; B[k].h[H][1] += j5 > 0; if (H === 60 && j8 > 0) B[k].tt.push(j8); } }
}
const out = { generated: new Date().toISOString(), data: D.snapshot, note: 'Descriptive exploration, no edge claim. Closing prices, close-to-close ATR proxy, fully adjusted for splits and bonuses by the stored actions.', samples: samples.length, atrFeasibility: {}, noiseHitRate: {}, byYear: {} };
for (const t of tiers) { out.atrFeasibility[t] = { observations: A[t].n, share3xATRabove8pct: pct(A[t].w8 / A[t].n), share3xATRabove5pct: pct(A[t].w5 / A[t].n), median3xATRpct: pct(q(A[t].atr, .5)), p75: pct(q(A[t].atr, .75)), p90: pct(q(A[t].atr, .9)) };
  out.noiseHitRate[t] = { observations: B[t].n, trail8: Object.fromEntries([20, 60, 250].map((H) => [H, pct(B[t].h[H][0] / B[t].n)])), trail5: Object.fromEntries([20, 60, 250].map((H) => [H, pct(B[t].h[H][1] / B[t].n)])), medianSessionsToHit8_within60: q(B[t].tt, .5) }; }
for (const [y, v] of Object.entries(byYear)) out.byYear[y] = { observations: v.n, share3xATRabove8pct: pct(v.w8 / v.n) };
// multibaggers: a liquid-at-start stock that rose 5x (closes, adjusted) within 750 sessions. First qualifying start per stock; run runs from the start to the peak inside the window.
const runs = [], ctrl = [];
for (const s of C.keys()) { const { c } = C.get(s); let done = false;
  for (let i = from; i <= to - 100 && !done; i += 20) { if (!(c[i] > 0) || D.dv20(s, i) < 2e7) continue; let pk = c[i], pj = i; const lim = Math.min(N - 1, i + 750); for (let j = i + 1; j <= lim; j++) if (c[j] > pk) { pk = c[j]; pj = j; } if (pk / c[i] >= 5) { runs.push({ s, i, pj, mult: pk / c[i] }); done = true; } }
}
function sim(c, i, pj, d, enterAt) {   // buy at close i, trailing stop d on closes, re-enter at the next close above the highest close seen at the stop-out; value at pj
  let v = 1, held = true, hi = c[i], ref = c[i], stops = 0, mdd = 0; let px = c[i];
  for (let j = i + 1; j <= pj; j++) { if (held) { v *= c[j] / c[j - 1]; if (c[j] > hi) hi = c[j]; mdd = Math.max(mdd, 1 - c[j] / hi); if (c[j] <= hi * (1 - d)) { held = false; v *= 1 - RT / 2; stops++; ref = hi; } } else if (c[j] > ref) { held = true; hi = c[j]; v *= 1 - RT / 2; } }
  return { v, stops, mdd };
}
const rows = runs.map((r) => { const c = C.get(r.s).c; let mdd = 0, hi = c[r.i]; for (let j = r.i + 1; j <= r.pj; j++) { if (c[j] > hi) hi = c[j]; mdd = Math.max(mdd, 1 - c[j] / hi); }
  const bh = c[r.pj] / c[r.i]; const s8 = sim(c, r.i, r.pj, 0.08), s15 = sim(c, r.i, r.pj, 0.15), s25 = sim(c, r.i, r.pj, 0.25);
  // realistic entry: the first close 50% above the run start, same exit date
  let k = r.i; for (let j = r.i + 1; j <= r.pj; j++) if (c[j] >= c[r.i] * 1.5) { k = j; break; } const bhL = k > r.i ? c[r.pj] / c[k] : NaN, s8L = k > r.i ? sim(c, k, r.pj, 0.08) : { v: NaN, stops: NaN };
  return { sym: r.s, start: dates[r.i], peak: dates[r.pj], mult: r.mult, sessions: r.pj - r.i, maxDD: mdd, bh, s8: s8.v, s8stops: s8.stops, s15: s15.v, s25: s25.v, bhLate: bhL, s8Late: s8L.v };
});
const med = (k) => q(rows.map((r) => r[k]), .5);
out.multibaggers = { definition: 'liquid at start (20-session traded value at least 2 crore), closes rose 5x or more within 750 sessions (first qualifying start per stock, 2011 to 2025)', count: rows.length,
  medianMultiple: +med('mult').toFixed(1), medianSessionsToPeak: med('sessions'),
  maxDrawdownDuringRun: { median: pct(med('maxDD')), p25: pct(q(rows.map((r) => r.maxDD), .25)), p75: pct(q(rows.map((r) => r.maxDD), .75)), shareAbove8: pct(rows.filter((r) => r.maxDD > 0.08).length / rows.length), shareAbove15: pct(rows.filter((r) => r.maxDD > 0.15).length / rows.length), shareAbove25: pct(rows.filter((r) => r.maxDD > 0.25).length / rows.length) },
  stopsPerRunTrail8: { median: med('s8stops'), mean: +(rows.reduce((a, r) => a + r.s8stops, 0) / rows.length).toFixed(1) },
  captureOfBuyAndHold_entryAtStart: { trail8WithReentry: pct(med('s8') / med('bh')), medianBuyHoldMultiple: +med('bh').toFixed(2), medianTrail8Multiple: +med('s8').toFixed(2), medianTrail15Multiple: +med('s15').toFixed(2), medianTrail25Multiple: +med('s25').toFixed(2) },
  entryAfterPlus50: { n: rows.filter((r) => r.bhLate === r.bhLate).length, medianBuyHoldMultiple: +q(rows.map((r) => r.bhLate), .5).toFixed(2), medianTrail8Multiple: +q(rows.map((r) => r.s8Late), .5).toFixed(2) },
  rows: rows.sort((a, b) => b.mult - a.mult).slice(0, 400).map((r) => ({ ...r, mult: +r.mult.toFixed(2), maxDD: +r.maxDD.toFixed(3), bh: +r.bh.toFixed(2), s8: +r.s8.toFixed(2), s15: +r.s15.toFixed(2), s25: +r.s25.toFixed(2), bhLate: r.bhLate === r.bhLate ? +r.bhLate.toFixed(2) : null, s8Late: r.s8Late === r.s8Late ? +r.s8Late.toFixed(2) : null })) };
// control: random liquid 750-session windows for non-multibaggers, same drawdown measure
const mb = new Set(runs.map((r) => r.s)); const dd = [];
for (const i of samples.filter((_, k) => k % 6 === 0)) for (const [s] of liquid(i)) { if (mb.has(s)) continue; const c = C.get(s).c; if (!(c[i] > 0) || i + 250 > to) continue; let hi = c[i], m = 0; for (let j = i + 1; j <= Math.min(to, i + 250); j++) { if (c[j] > hi) hi = c[j]; m = Math.max(m, 1 - c[j] / hi); } dd.push(m); }
out.controlMaxDrawdown250 = { windows: dd.length, median: pct(q(dd, .5)), p75: pct(q(dd, .75)), shareAbove8: pct(dd.filter((x) => x > 0.08).length / dd.length), shareAbove25: pct(dd.filter((x) => x > 0.25).length / dd.length) };
writeFileSync('data/stop-feasibility.json', JSON.stringify(out, null, 1) + '\n');
const { rows: _r, ...show } = out.multibaggers; console.log(JSON.stringify({ atr: out.atrFeasibility, hit: out.noiseHitRate, byYear: out.byYear, mb: show, ctrl: out.controlMaxDrawdown250 }, null, 1));
