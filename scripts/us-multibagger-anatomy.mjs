// US multibagger anatomy (docs/replay/US-MULTIBAGGER-ANATOMY-PREREG.md). Part 1 winners, Part 2 first-breakout classification.
import { loadUS, summarize, pc } from './lib/study-harness.mjs';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const H = loadUS(), { dates, series, syms, N } = H;
const med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; };
const mean = (a) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN; };
const q = (a, p) => { const x = a.filter(Number.isFinite).sort((m, n) => m - n); return x.length ? x[Math.min(x.length - 1, Math.floor(x.length * p))] : NaN; };
// SEC facts (744 tickers) -> per ticker {sic, by period}
const FACT = new Map();
for (const s of syms) { const f = `data/us/facts/${s}.json.gz`; if (!existsSync(f)) continue; try { const j = JSON.parse(gunzipSync(readFileSync(f))); const by = new Map(); for (const r of j.results ?? []) if (r.revision === 0 && r.asOf) by.set(r.period, r); FACT.set(s, { sic: j.sic, by, per: [...by.keys()].sort() }); } catch {} }
const eom = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(), addM = (p, k) => { let y = +p.slice(0, 4), m = +p.slice(5, 7) + k; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}-${String(eom(y, m)).padStart(2, '0')}`; };
function fund(sym, D) {
  const F = FACT.get(sym); if (!F) return {}; const ok = F.per.filter((p) => F.by.get(p).asOf.slice(0, 10) <= D); if (!ok.length) return {}; const q0 = ok.at(-1); if ((new Date(D) - new Date(q0)) / 864e5 > 150) return {};
  const g = (p, fld) => { const a = F.by.get(p)?.fields?.[fld], b = F.by.get(addM(p, -12))?.fields?.[fld]; return a != null && b > 0 ? a / b - 1 : NaN; };
  const r0 = g(q0, 'revenue'), r1 = g(addM(q0, -3), 'revenue'), f0 = F.by.get(q0).fields, m = (p) => { const f = F.by.get(p)?.fields; return f?.revenue > 0 && f.pbt != null ? f.pbt / f.revenue : NaN; };
  return { revYoY: r0, revAccel: r0 - r1, profitable: f0.pat != null ? (f0.pat > 0 ? 1 : 0) : NaN, marginChg: m(q0) - m(addM(q0, -12)) };
}
const sic2 = (sym) => { const s = FACT.get(sym)?.sic; return s != null ? Math.floor(s / 100) : null; };
const grp = (s) => (s == null ? 'no facts' : s >= 28 && s <= 28 ? 'chem/pharma (28)' : s >= 35 && s <= 38 ? 'tech/instruments (35-38)' : s === 73 ? 'software/services (73)' : s >= 60 && s <= 67 ? 'finance (60-67)' : s >= 10 && s <= 14 ? 'mining/energy (10-14)' : s >= 20 && s <= 39 ? 'other manufacturing' : s >= 50 && s <= 59 ? 'trade/retail' : s >= 40 && s <= 49 ? 'transport/comm/util' : s >= 70 && s <= 89 ? 'other services' : 'other');
// sliding window max/min of the previous w closes
function slide(c, w, isMax) { const out = new Float64Array(N).fill(NaN), dq = []; for (let i = 0; i < N; i++) { if (i > 0) { const v = c[i - 1]; if (v > 0) { while (dq.length && (isMax ? c[dq.at(-1)] <= v : c[dq.at(-1)] >= v)) dq.pop(); dq.push(i - 1); } } while (dq.length && dq[0] < i - w) dq.shift(); if (dq.length && i >= w) out[i] = c[dq[0]]; } return out; }
// ---------- Part 1
const W = [];
for (const sym of syms) {
  const c = series.get(sym).c; let bad = false; for (let i = 1; i < N; i++) if (c[i] > 0 && c[i - 1] > 0 && Math.abs(c[i] / c[i - 1] - 1) > 0.8) { bad = true; break; } if (bad) continue;
  let best = 0, L = -1, P = -1; const dq = [];
  for (let j = 0; j < N; j++) { const v = c[j]; if (!(v > 0)) continue; while (dq.length && c[dq.at(-1)] >= v) dq.pop(); dq.push(j); while (dq.length && dq[0] < j - 1008) dq.shift(); const lo = c[dq[0]]; if (dq[0] >= 260 && lo >= 1 && v / lo > best) { best = v / lo; L = dq[0]; P = j; } }
  if (best < 4 || L < 0) continue; if (!(H.tv(sym, L - 19, L) >= 1e6)) continue;
  W.push({ sym, L, P, ratio: best });
}
const uni = new Map(); // percentile helpers per date
function pctRank(t, fn, val) { const k = t + ':' + fn.name; if (!uni.has(k)) { const arr = []; for (const sym of syms) { const x = fn(sym, t); if (Number.isFinite(x)) arr.push(x); } arr.sort((a, b) => a - b); uni.set(k, arr); } const a = uni.get(k); let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < val) lo = m + 1; else hi = m; } return lo / a.length; }
const fPrice = (s, t) => (series.get(s).c[t] > 0 && H.tv(s, t - 19, t) >= 1e6 ? series.get(s).c[t] : NaN);
const fTV = (s, t) => { const x = H.tv(s, t - 19, t); return x >= 1e6 ? x : NaN; };
const fVol = (s, t) => { const c = series.get(s).c; let a = 0, b = 0, n = 0; for (let k = t - 125; k <= t; k++) if (c[k] > 0 && c[k - 1] > 0) { const r = c[k] / c[k - 1] - 1; a += r; b += r * r; n++; } return n > 100 && H.tv(s, t - 19, t) >= 1e6 ? Math.sqrt(b / n - (a / n) ** 2) : NaN; };
for (const w of W) {
  const c = series.get(w.sym).c, L = w.L; w.year = dates[L].slice(0, 4); w.price = c[L]; w.tv = H.tv(w.sym, L - 19, L);
  let mx = 0; for (let k = Math.max(0, L - 504); k <= L; k++) if (c[k] > mx) mx = c[k]; w.dd = c[L] / mx - 1; w.mom12 = c[L - 252] > 0 ? c[L] / c[L - 252] - 1 : NaN; w.vol = fVol(w.sym, L);
  w.pPrice = pctRank(L, fPrice, w.price); w.pTV = pctRank(L, fTV, w.tv); w.pVol = pctRank(L, fVol, w.vol); w.days = w.P - L;
  let hi = 0; w.B = -1; for (let k = L + 1; k <= w.P; k++) { let m = 0; for (let j = k - 251; j < k; j++) if (c[j] > m) m = c[j]; if (c[k] >= m && c[k] > 0) { w.B = k; break; } }
  if (w.B > 0) { w.bDays = w.B - L; w.done = Math.log(c[w.B] / c[L]) / Math.log(c[w.P] / c[L]); let v50 = 0, n = 0; const v = series.get(w.sym).v; for (let k = w.B - 50; k < w.B; k++) if (v[k] >= 0) { v50 += v[k]; n++; } w.volr = v[w.B] / (v50 / n); }
  Object.assign(w, Object.fromEntries(Object.entries(fund(w.sym, dates[L])).map(([k, v]) => ['L_' + k, v]))); Object.assign(w, Object.fromEntries(Object.entries(w.B > 0 ? fund(w.sym, dates[w.B]) : {}).map(([k, v]) => ['B_' + k, v]))); w.grp = grp(sic2(w.sym));
}
const show = (set, name) => { console.log(`\n== ${name}: n ${set.length}`); const f = (k, fmt) => console.log(k.padEnd(28), `p25 ${fmt(q(set.map((x) => x[k]), 0.25))}  median ${fmt(med(set.map((x) => x[k])))}  p75 ${fmt(q(set.map((x) => x[k]), 0.75))}`); const n0 = (x) => (Number.isFinite(x) ? x.toFixed(0) : 'n/a'), p0 = (x) => (Number.isFinite(x) ? (x * 100).toFixed(0) + '%' : 'n/a'), d2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
  f('price', d2); f('tv', (x) => '$' + (x / 1e6).toFixed(1) + 'm'); f('dd (into low vs 2y high)', p0); f('mom12 at low', p0); f('vol126 daily', (x) => (x * 100).toFixed(1) + '%'); f('price pct rank', p0); f('tv pct rank', p0); f('vol pct rank', p0); f('days trough->peak', n0); f('days trough->1st 252d high', n0); f('share of move done at breakout', p0); f('breakout volume ratio', d2);
  const nm = { dd: 'dd (into low vs 2y high)' }; };
for (const [name, set] of [['4x+ winners', W], ['10x+ winners', W.filter((x) => x.ratio >= 10)]]) {
  console.log(`\n== ${name}: n ${set.length}`); const P = (k, fmt) => console.log(k.padEnd(22), `p25 ${fmt(q(set.map((x) => x[k]), 0.25))}  median ${fmt(med(set.map((x) => x[k])))}  p75 ${fmt(q(set.map((x) => x[k]), 0.75))}`);
  const p0 = (x) => (Number.isFinite(x) ? (x * 100).toFixed(0) + '%' : 'n/a'), n0 = (x) => (Number.isFinite(x) ? x.toFixed(0) : 'n/a'), d2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
  P('price', d2); P('tv', (x) => '$' + (x / 1e6).toFixed(1) + 'm'); P('dd', p0); P('mom12', p0); P('vol', (x) => (x * 100).toFixed(1) + '%'); P('pPrice', p0); P('pTV', p0); P('pVol', p0); P('days', n0); P('bDays', n0); P('done', p0); P('volr', d2);
  console.log('trough year:', Object.entries(set.reduce((a, x) => ((a[x.year] = (a[x.year] ?? 0) + 1), a), {})).sort().map(([y, n]) => `${y}:${n}`).join(' '));
  const gs = set.reduce((a, x) => ((a[x.grp] = (a[x.grp] ?? 0) + 1), a), {}); console.log('SIC groups:', Object.entries(gs).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g} ${n}`).join(' | '));
  const withF = set.filter((x) => Number.isFinite(x.L_revYoY)); console.log(`with SEC facts at the trough: ${withF.length}; revYoY median ${p0(med(withF.map((x) => x.L_revYoY)))} (p25 ${p0(q(withF.map((x) => x.L_revYoY), 0.25))}, p75 ${p0(q(withF.map((x) => x.L_revYoY), 0.75))}); profitable ${p0(mean(withF.map((x) => x.L_profitable)))}; at breakout (${set.filter((x) => Number.isFinite(x.B_revYoY)).length}): revYoY median ${p0(med(set.map((x) => x.B_revYoY)))}, accel median ${p0(med(set.map((x) => x.B_revAccel)))}, profitable ${p0(mean(set.map((x) => x.B_profitable)))}`);
}
writeFileSync('/tmp/claude-0/-home-claude/777998c4-9f61-52d1-a143-48376f83c2ab/scratchpad/us-winners.json', JSON.stringify(W));
// ---------- Part 2
const FEATS = ['price', 'logTV', 'fromLow', 'ddLow', 'vol126', 'volr', 'mom6', 'mom12_1', 'dsLow', 'tvTrend', 'tight', 'revYoY', 'revAccel', 'profitable', 'marginChg'];
const E = [], isHigh = new Map();
for (const sym of syms) {
  const s = series.get(sym), c = s.c, v = s.v, hiP = slide(c, 252, true), loP = slide(c, 252, false), hiF = new Uint8Array(N), cum = new Int32Array(N + 1);
  for (let i = 0; i < N; i++) { hiF[i] = c[i] > 0 && c[i] >= hiP[i] ? 1 : 0; cum[i + 1] = cum[i] + hiF[i]; }
  for (let t = 260; t < N - 506; t++) {
    if (!hiF[t] || !(c[t] >= 1.5 * loP[t]) || c[t] < 1) continue; if (cum[t] - cum[t - 60] > 0) continue; const tv = H.tv(sym, t - 19, t); if (!(tv >= 2e6)) continue;
    const tr = H.trade(sym, t, { trail: 0.35, hold: 504 }); if (!tr || !(c[t + 1] > 0)) continue;
    let mxF = 0; for (let k = t + 2; k <= t + 505; k++) if (c[k] > mxF) mxF = c[k]; let c12 = NaN; for (let k = t + 253; k > t + 200; k--) if (c[k] > 0) { c12 = c[k] / c[t + 1] - 1; break; }
    let lowIdx = t, lo = 1e18; for (let k = t - 251; k < t; k++) if (c[k] > 0 && c[k] < lo) { lo = c[k]; lowIdx = k; } let mx2 = 0; for (let k = Math.max(0, t - 503); k <= t; k++) if (c[k] > mx2) mx2 = c[k];
    let sr = 0, sr2 = 0, nr = 0, a20 = 0, n20 = 0, a100 = 0, n100 = 0; for (let k = t - 125; k <= t; k++) if (c[k] > 0 && c[k - 1] > 0) { const r = c[k] / c[k - 1] - 1; sr += r; sr2 += r * r; nr++; if (k > t - 20) { a20 += Math.abs(r); n20++; } if (k > t - 100) { a100 += Math.abs(r); n100++; } }
    let v50 = 0, nv = 0; for (let k = t - 50; k < t; k++) if (v[k] >= 0) { v50 += v[k]; nv++; } const tvOld = H.tv(sym, t - 250, t - 125);
    E.push({ sym, t, y: dates[t].slice(0, 4), A: mxF / c[t + 1] >= 2, c12, ret: tr.ret, ex: tr.ret - (Number.isFinite(tr.bench) ? tr.bench : 0), f: { price: c[t], logTV: Math.log(tv), fromLow: c[t] / lo, ddLow: lo / mx2, vol126: nr > 100 ? Math.sqrt(sr2 / nr - (sr / nr) ** 2) : NaN, volr: nv > 40 ? v[t] / (v50 / nv) : NaN, mom6: c[t] / c[t - 126] - 1, mom12_1: c[t - 21] > 0 && c[t - 252] > 0 ? c[t - 21] / c[t - 252] - 1 : NaN, dsLow: t - lowIdx, tvTrend: tv / tvOld, tight: n20 > 15 && n100 > 80 ? a20 / n20 / (a100 / n100) : NaN, ...fund(sym, dates[t]) } });
  }
}
const half = (a, b) => E.filter((e) => dates[e.t] >= a && dates[e.t] <= b), H1 = half('2017-10-02', '2020-12-31'), H2 = half('2021-01-04', '2024-09-30');
console.log(`\nPart 2 events: first ${H1.length}, second ${H2.length}; base A rate first ${pc(H1.filter((e) => e.A).length / H1.length)} second ${pc(H2.filter((e) => e.A).length / H2.length)}; mean excess first ${pc(mean(H1.map((e) => e.ex)))} second ${pc(mean(H2.map((e) => e.ex)))}`);
const rate = (a) => a.filter((e) => e.A).length / a.length;
function tab(S) {
  const base = rate(S), mex = mean(S.map((e) => e.ex)), cut = {}, res = {}; const volC = [q(S.map((e) => e.f.vol126), 1 / 3), q(S.map((e) => e.f.vol126), 2 / 3)], terc = (e) => (e.f.vol126 < volC[0] ? 0 : e.f.vol126 < volC[1] ? 1 : 2);
  for (const n of FEATS) { const sub = S.filter((e) => Number.isFinite(e.f[n])); if (sub.length < 100) continue; const lo = q(sub.map((e) => e.f[n]), 0.2), hi = q(sub.map((e) => e.f[n]), 0.8); cut[n] = [lo, hi];
    const side = (dir) => { const sel = sub.filter((e) => (dir > 0 ? e.f[n] >= hi : e.f[n] <= lo)); const tl = [0, 1, 2].map((k) => { const T = sub.filter((e) => terc(e) === k), Q = sel.filter((e) => terc(e) === k); return Q.length >= 15 ? rate(Q) / rate(T) : NaN; }); return { dir, n: sel.length, lift: rate(sel) / rate(sub), tl, ex: mean(sel.map((e) => e.ex)), med12: med(sel.map((e) => e.c12)), exAll: mean(sub.map((e) => e.ex)) }; };
    res[n] = [side(1), side(-1)]; }
  return { base, mex, cut, res, terc, volC };
}
const T1 = tab(H1), T2 = tab(H2);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '  - ');
for (const [nm, T] of [['FIRST half (selection)', T1], ['SECOND half (descriptive until selection is scored)', T2]]) { console.log(`\n${nm}: base A ${pc(T.base)}`); console.log('feature   dir  n    lift  terciles(lo/mid/hi)    excess  vs all  12m med'); for (const [n, [t, b]] of Object.entries(T.res)) for (const r of [t, b]) console.log(n.padEnd(10), r.dir > 0 ? 'top ' : 'bot ', String(r.n).padStart(4), f2(r.lift), r.tl.map(f2).join('/').padEnd(16), pc(r.ex).padStart(7), pc(r.exAll).padStart(7), pc(r.med12).padStart(7)); }
// selection on first half
const kept = []; for (const [n, [t, b]] of Object.entries(T1.res)) { const r = t.lift >= b.lift ? t : b; if (n === 'vol126') continue; if (r.lift >= 1.4 && r.tl.every((x) => Number.isFinite(x) && x >= 1.15) && r.ex > r.exAll) kept.push({ n, dir: r.dir, lift: r.lift, minT: Math.min(...r.tl) }); }
kept.sort((a, b) => b.minT - a.minT); const chosen = kept.slice(0, 3); console.log('\nKept by the registered rule:', JSON.stringify(kept)); console.log('Chosen (max 3):', JSON.stringify(chosen));
if (chosen.length) { const inRule = (e) => chosen.every((c) => (c.dir > 0 ? e.f[c.n] >= T1.cut[c.n][1] : e.f[c.n] <= T1.cut[c.n][0])); for (const [nm, S, T] of [['first (chosen on)', H1, T1], ['SECOND (scored)', H2, T2]]) { const sel = S.filter(inRule); const yrs = [...new Set(sel.map((e) => e.y))].sort().map((y) => { const a = sel.filter((e) => e.y === y); return `${y}:${pc(mean(a.map((e) => e.ex)))}(${a.length})`; }); console.log(`${nm}: n ${sel.length}, A rate ${pc(rate(sel))} vs base ${pc(T.base)} (lift ${f2(rate(sel) / T.base)}), mean net ${pc(mean(sel.map((e) => e.ret)))}, mean excess ${pc(mean(sel.map((e) => e.ex)))} vs event mean ${pc(T.mex)}, 12m median ${pc(med(sel.map((e) => e.c12)))} vs ${pc(med(S.map((e) => e.c12)))}; years ${yrs.join(' ')}`); } }
