// GROUPS-1 (docs/replay/GROUPS-1-PREREG.md)
import { loadIndia, pc } from './lib/study-harness.mjs';
import { readFileSync } from 'node:fs';
const H = loadIndia(), { dates, series, syms, N } = H, segI = JSON.parse(readFileSync('data/india/segments.json', 'utf8')).industry, inf = JSON.parse(readFileSync('data/india/industry-inferred.json', 'utf8')).map, probe = JSON.parse(readFileSync('data/india/probe-industry-yf.json', 'utf8')); const IND = {}; for (const sym of H.syms) { const g = segI[sym] ?? inf[probe[sym]?.industry] ?? null; if (g) IND[sym] = g; }
const med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; };
const raw = (sym, t) => H.openRaw(sym, t)?.[1] ?? NaN;
function feat(sym, t) {
  const c = series.get(sym).c, v = series.get(sym).v; if (!(c[t] > 0) || !(c[t - 252] > 0) || !(c[t - 126] > 0) || t < 504) return null;
  let mx2 = 0; for (let k = t - 503; k <= t; k++) if (c[k] > mx2) mx2 = c[k]; let hi = 0, hi60 = 0, lo60 = 1e18; for (let k = t - 251; k <= t; k++) if (c[k] > hi) hi = c[k]; for (let k = t - 59; k <= t; k++) if (c[k] > 0) { if (c[k] > hi60) hi60 = c[k]; if (c[k] < lo60) lo60 = c[k]; }
  let a = 0, b = 0, n = 0, a20 = 0, n20 = 0, a100 = 0, n100 = 0; for (let k = t - 125; k <= t; k++) if (c[k] > 0 && c[k - 1] > 0) { const r = c[k] / c[k - 1] - 1; a += r; b += r * r; n++; } for (let k = t - 99; k <= t; k++) if (c[k] > 0 && c[k - 1] > 0) { const r = Math.abs(c[k] / c[k - 1] - 1); a100 += r; n100++; if (k > t - 20) { a20 += r; n20++; } } if (n < 100) return null;
  let s200 = 0, n200 = 0; for (let k = t - 199; k <= t; k++) if (c[k] > 0) { s200 += c[k]; n200++; } let v50 = 0, nv = 0; for (let k = t - 50; k < t; k++) if (v[k] >= 0) { v50 += v[k]; nv++; }
  const tv = H.tv(sym, t - 19, t), tvo = H.tv(sym, t - 250, t - 125);
  return { mom6: c[t] / c[t - 126] - 1, mom12_1: c[t - 21] > 0 ? c[t - 21] / c[t - 252] - 1 : NaN, vol: Math.sqrt(b / n - (a / n) ** 2), dd2y: c[t] / mx2 - 1, belowHigh: c[t] / hi - 1, logTV: Math.log(tv), price: raw(sym, t), tvTrend: tv / tvo, tight: n20 > 15 && n100 > 80 ? (a20 / n20) / (a100 / n100) : NaN, volRatio: nv > 40 ? v[t] / (v50 / nv) : NaN, range60: hi60 / lo60, above200: n200 > 150 ? c[t] / (s200 / n200) - 1 : NaN, rs6: c[t] / c[t - 126] - 1 - H.idxRet(dates[t - 126], dates[t]) };
}
const FE = ['mom6', 'mom12_1', 'vol', 'dd2y', 'belowHigh', 'logTV', 'price', 'tvTrend', 'tight', 'volRatio', 'range60', 'above200', 'rs6'];
// cross-section distributions at month-ends
const me = []; for (let t = 130; t < N - 1; t++) if (dates[t].slice(0, 7) !== dates[t + 1].slice(0, 7)) me.push(t);
const dist = new Map(); const distAt = (t) => { if (dist.has(t)) return dist.get(t); const o = {}; for (const k of FE) o[k] = []; for (const sym of syms) { const c = series.get(sym).c; if (!(c[t] > 0) || !(raw(sym, t) >= 20) || !(H.tv(sym, t - 19, t) >= 2e7)) continue; const f = feat(sym, t); if (!f) continue; for (const k of FE) if (Number.isFinite(f[k])) o[k].push(f[k]); } for (const k of FE) o[k].sort((a, b) => a - b); dist.set(t, o); return o; };
const lastMe = (t) => { let lo = 0, hi = me.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (me[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r >= 0 ? me[r] : null; };
const rank = (arr, v) => { if (!arr.length || !Number.isFinite(v)) return NaN; let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return lo / arr.length; };
// strategies
const T0 = H.t0('2011-02-01'), T1 = N - 1 - 800, ev = { M1: [], M3: [], M4: [], GC: [] }, last = { M1: new Map(), M3: new Map(), M4: new Map() };
const cutC = new Map(); const cut10 = (t) => { if (!cutC.has(t)) { const r = []; for (const sym of syms) { const c = series.get(sym).c; if (c[t] > 0 && c[t - 126] > 0 && H.tv(sym, t - 19, t) >= 2e7) r.push(c[t] / c[t - 126] - 1); } r.sort((a, b) => a - b); cutC.set(t, r[Math.floor(r.length * 0.9)]); } return cutC.get(t); };
for (let t = Math.max(T0, 504); t <= T1; t++) {
  const D = dates[t], g = H.green(D); const isME = dates[t].slice(0, 7) !== dates[t + 1].slice(0, 7);
  const gcRows = []; 
  for (const sym of syms) {
    const c = series.get(sym).c, v = series.get(sym).v, rp = raw(sym, t); if (!(c[t] > 0) || !(rp >= 20) || !(c[t - 126] > 0)) continue; const tv = H.tv(sym, t - 19, t); if (!(tv >= 2e7)) continue;
    if (g) { let hi = 0; for (let k = t - 251; k < t; k++) if (c[k] > hi) hi = c[k]; if (c[t] >= hi) {
      let s200 = 0, n200 = 0, v50 = 0, nv = 0, hi60 = 0, lo60 = 1e18; for (let k = t - 199; k <= t; k++) if (c[k] > 0) { s200 += c[k]; n200++; } for (let k = t - 50; k < t; k++) if (v[k] >= 0) { v50 += v[k]; nv++; } for (let k = t - 59; k <= t; k++) if (c[k] > 0) { if (c[k] > hi60) hi60 = c[k]; if (c[k] < lo60) lo60 = c[k]; }
      const am = (x, y) => { let s = 0, n = 0; for (let k = x; k <= y; k++) if (c[k] > 0 && c[k - 1] > 0) { s += Math.abs(c[k] / c[k - 1] - 1); n++; } return n > (y - x) * 0.8 ? s / n : NaN; };
      const tryR = (r, cond) => { if (!cond || t - (last[r].get(sym) ?? -1e9) < (126)) return; const tr = H.trade(sym, t, { trail: 0.35, hold: 780, cost: 0.013 }); if (!tr) return; last[r].set(sym, t); ev[r].push({ ...tr, sym, t }); };
      const above = c[t] > s200 / n200; tryR('M1', above && nv > 40 && v[t] >= 2 * (v50 / nv) && hi60 / lo60 <= 1.35); tryR('M4', above && am(t - 19, t) < 0.6 * am(t - 99, t)); tryR('M3', c[t - 126] > 0 && c[t] / c[t - 126] - 1 >= cut10(t));
    } }
    if (isME) gcRows.push({ sym, t, rp });
  }
  if (isME && gcRows.length > 100) { const dd = distAt(t), take = []; for (const { sym, rp } of gcRows) { const f = feat(sym, t); if (!f) continue; const pr = rank(dd.price, rp), pm = rank(dd.mom6, f.mom6), pt = rank(dd.tvTrend, f.tvTrend); if (pr < 0.2 && pm >= 0.8 && pt >= 0.8) take.push([sym, f.mom6]); } take.sort((a, b) => b[1] - a[1]); for (const [sym] of take.slice(0, 50)) { const tr = H.trade(sym, t, { trail: 0.35, hold: 780, cost: 0.02 }); if (tr) ev.GC.push({ ...tr, sym, t }); } }
}

const mean = (a) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN; };
// group state per month-end
const gstate = new Map();
function stateAt(t) { if (gstate.has(t)) return gstate.get(t); const by = new Map(); for (const sym of syms) { const g = IND[sym]; if (!g) continue; const c = series.get(sym).c; if (!(c[t] > 0) || !(c[t - 126] > 0) || !(raw(sym, t) >= 20) || !(H.tv(sym, t - 19, t) >= 2e7)) continue; let s = 0, n = 0; for (let k = t - 199; k <= t; k++) if (c[k] > 0) { s += c[k]; n++; } if (n < 150) continue; const l = by.get(g) ?? { r: [], up: 0, n: 0 }; l.r.push(c[t] / c[t - 126] - 1); l.n++; if (c[t] > s / n) l.up++; by.set(g, l); }
  const gs = [...by.entries()].filter(([, l]) => l.n >= 8).map(([g, l]) => ({ g, med: med(l.r), breadth: l.up / l.n })); const sorted = [...gs].sort((a, b) => a.med - b.med); const st = new Map(); sorted.forEach((x, i) => st.set(x.g, { rank: sorted.length > 1 ? i / (sorted.length - 1) : 0.5, breadth: x.breadth, med: x.med })); st.posShare = gs.length ? gs.filter((x) => x.med > 0).length / gs.length : NaN; st.nGroups = gs.length; gstate.set(t, st); return st; }
const cutH = dates.findLastIndex((d) => d <= '2017-12-31');
const cell = (E) => { const r = E.map((e) => e.ret), ex = E.map((e) => e.ret - (Number.isFinite(e.bench) ? e.bench : 0)), srt = [...ex].sort((a, b) => b - a); return { n: E.length, mean: mean(r), med: med(r), win: r.filter((x) => x > 0).length / (r.length || 1), ex: mean(ex), ex2: E.length > 2 ? (srt.slice(2).reduce((a, b) => a + b, 0)) / (E.length - 2) : NaN }; };
const f1 = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
const res = {};
for (const [r, E0] of Object.entries(ev)) { const E = []; for (const e of E0) { const sym = e.sym, g = IND[sym], m = lastMe(e.t); if (!g || m == null) continue; const st = stateAt(m); const s = st.get(g); if (!s) continue; E.push({ ...e, rank: s.rank, breadth: s.breadth, pos: st.posShare }); }
  console.log(`\n=== ${r}: ${E0.length} trades, ${E.length} with a scored group (${f1(E.length / E0.length)}); coverage by year:`, [...new Set(E0.map((e) => e.D.slice(0, 4)))].sort().map((y) => `${y}:${f1(E.filter((e) => e.D.startsWith(y)).length / E0.filter((e) => e.D.startsWith(y)).length)}`).join(' '));
  res[r] = {};
  for (const [tn, strong] of [['G1 group strength rank>=75%', (e) => e.rank >= 0.75], ['G2 group breadth>=60%', (e) => e.breadth >= 0.6], ['G3 market phase: >70% of groups up', (e) => e.pos > 0.7]]) {
    console.log(' ' + tn); for (const [hn, H2] of [['2011-17', E.filter((e) => e.t <= cutH)], ['2018-23', E.filter((e) => e.t > cutH)]]) { const S = H2.filter(strong), Wk = H2.filter((e) => !strong(e)), a = cell(S), b = cell(Wk); const ys = [...new Set(H2.map((e) => e.D.slice(0, 4)))].sort(); let pos = 0, tot = 0; const yl = ys.map((y) => { const s1 = S.filter((e) => e.D.startsWith(y)), w1 = Wk.filter((e) => e.D.startsWith(y)); if (s1.length < 10 || w1.length < 10) return `${y}:-`; tot++; const d = cell(s1).ex - cell(w1).ex; if (d > 0) pos++; return `${y}:${(d * 100).toFixed(0)}`; });
      res[r][tn + hn] = { a, b, pos, tot };
      console.log(`   ${hn}: strong n ${a.n} mean ${f1(a.mean)} median ${f1(a.med)} win ${f1(a.win)} excess ${f1(a.ex)} ex-best-2 ${f1(a.ex2)} | rest n ${b.n} mean ${f1(b.mean)} median ${f1(b.med)} excess ${f1(b.ex)} | diff ${f1(a.ex - b.ex)} | years strong>rest ${pos}/${tot} (${yl.join(' ')})`); } } }
console.log('\nPASS CHECK (diff >= +5 pts both halves, n >= 150 both, ex-best-2 > 0 both, strong>rest in >= half the years in both halves):');
for (const [r, o] of Object.entries(res)) for (const tn of ['G1 group strength rank>=75%', 'G2 group breadth>=60%', 'G3 market phase: >70% of groups up']) { const a = o[tn + '2011-17'], b = o[tn + '2018-23']; const ok = [a, b].every((x) => x.a.n >= 150 && x.a.ex - x.b.ex >= 0.05 && x.a.ex2 > 0 && x.pos / Math.max(1, x.tot) >= 0.5); console.log(' ', r.padEnd(3), tn.padEnd(38), ok ? 'PASS' : 'fail'); }
