// STRATEGY-WINNERS (docs/replay/STRATEGY-WINNERS-PREREG.md)
import { loadIndia, pc } from './lib/study-harness.mjs';
import { readFileSync } from 'node:fs';
const H = loadIndia(), { dates, series, syms, N } = H, IND = JSON.parse(readFileSync('data/india/segments.json', 'utf8')).industry;
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
const me = []; for (let t = 504; t < N - 1; t++) if (dates[t].slice(0, 7) !== dates[t + 1].slice(0, 7)) me.push(t);
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
// features at entry with percentile ranks
for (const [r, E] of Object.entries(ev)) for (const e of E) { const f = feat(e.sym, e.t); const m = lastMe(e.t); if (!f || m == null) { e.f = null; continue; } const dd = distAt(m); e.f = {}; for (const k of FE) e.f[k] = rank(dd[k], f[k]); e.f.idxDD = (() => { const a = H.idxAt(dates[e.t]); let hi = 0; for (let i = Math.max(0, a - 251); i <= a; i++) if (H.idx[H.ik[i]] > hi) hi = H.idx[H.ik[i]]; return H.idx[H.ik[a]] / hi - 1; })(); e.ind = IND[e.sym] ?? null; }
function auc(W, L, k) { const w = W.map((e) => e.f[k]).filter(Number.isFinite), l = L.map((e) => e.f[k]).filter(Number.isFinite); if (w.length < 20 || l.length < 20) return NaN; const all = [...w.map((x) => [x, 1]), ...l.map((x) => [x, 0])].sort((a, b) => a[0] - b[0]); let rs = 0, i = 0; while (i < all.length) { let j = i; while (j < all.length && all[j][0] === all[i][0]) j++; const avg = (i + 1 + j) / 2; for (let q = i; q < j; q++) if (all[q][1]) rs += avg; i = j; } return (rs - w.length * (w.length + 1) / 2) / (w.length * l.length); }
const cutH = dates.findLastIndex((d) => d <= '2017-12-31'); const out = {};
for (const [r, E0] of Object.entries(ev)) { const E = E0.filter((e) => e.f); console.log(`\n=== ${r}: ${E.length} trades with features (${E0.length} total)`); out[r] = {};
  for (const [hn, H2] of [['first 2011-17', E.filter((e) => e.t <= cutH)], ['second 2018-23', E.filter((e) => e.t > cutH)]]) { const srt = [...H2].sort((a, b) => b.ret - a.ret), W10 = srt.slice(0, Math.round(H2.length * 0.1)), W3 = H2.filter((e) => e.ret >= 2), Lr = new Set(W10); const L10 = H2.filter((e) => !Lr.has(e)), L3 = H2.filter((e) => e.ret < 2);
    console.log(` ${hn}: n ${H2.length}; W10 n ${W10.length} (min ret ${pc(W10.at(-1)?.ret)}), median ret all ${pc(med(H2.map((e) => e.ret)))}, W10 ${pc(med(W10.map((e) => e.ret)))}; W3 n ${W3.length}`);
    out[r][hn] = {}; for (const k of [...FE, 'idxDD']) { out[r][hn][k] = { a10: auc(W10, L10, k), a3: auc(W3, L3, k), mw: med(W10.map((e) => e.f[k])), ml: med(L10.map((e) => e.f[k])) }; }
    const yrs = {}; for (const e of H2) { const y = e.D.slice(0, 4); yrs[y] ??= [0, 0]; yrs[y][0]++; } const wy = {}; for (const e of W10) { const y = e.D.slice(0, 4); wy[y] = (wy[y] ?? 0) + 1; } console.log('   W10 by entry year (winners/trades):', Object.keys(yrs).sort().map((y) => `${y}:${wy[y] ?? 0}/${yrs[y][0]}`).join(' '));
    const ic = {}, wc = {}; let nw = 0, na = 0; for (const e of H2) if (e.ind) { na++; ic[e.ind] = (ic[e.ind] ?? 0) + 1; } for (const e of W10) if (e.ind) { nw++; wc[e.ind] = (wc[e.ind] ?? 0) + 1; } console.log(`   industry coverage ${pc(na / H2.length)} of trades, ${pc(nw / W10.length)} of winners; winners over-represented:`, Object.entries(wc).filter(([i, n]) => n >= 5).map(([i, n]) => [i, n / nw / (ic[i] / na)]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([i, x]) => `${i} ${x.toFixed(1)}x`).join(', ')); }
  console.log(' factor        AUC W10 first/second | AUC W3 first/second | median pct rank winners vs rest (first, second)'); for (const k of [...FE, 'idxDD']) { const a = out[r]['first 2011-17'][k], b = out[r]['second 2018-23'][k]; console.log('  ' + k.padEnd(11), [a.a10, b.a10].map((x) => (Number.isFinite(x) ? x.toFixed(2) : ' - ')).join('/').padEnd(11), '|', [a.a3, b.a3].map((x) => (Number.isFinite(x) ? x.toFixed(2) : ' - ')).join('/').padEnd(11), '|', k === 'idxDD' ? '' : `${(a.mw * 100).toFixed(0)} v ${(a.ml * 100).toFixed(0)}, ${(b.mw * 100).toFixed(0)} v ${(b.ml * 100).toFixed(0)}`); } }
console.log('\nCOMMON (same side of 0.5 by >= 0.05 in both halves, W10):'); for (const k of [...FE, 'idxDD']) { const dirs = []; for (const r of Object.keys(out)) { const a = out[r]['first 2011-17'][k].a10, b = out[r]['second 2018-23'][k].a10; if (Number.isFinite(a) && Number.isFinite(b) && ((a >= 0.55 && b >= 0.55) || (a <= 0.45 && b <= 0.45))) dirs.push(`${r}${a > 0.5 ? '+' : '-'}`); } if (dirs.length) console.log(' ', k.padEnd(11), dirs.join(' '), dirs.length >= 2 ? '<= common' : ''); }
