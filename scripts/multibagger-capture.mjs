// Descriptive: how many of the India 4x winners did the HUNT-1 multibagger rules (M1, M3, M4) flag between the trough and the peak, and how much of the move was left. Winner set from scripts/multibagger-anatomy.mjs --india.
import { loadIndia } from './lib/study-harness.mjs';
import { readFileSync } from 'node:fs';
const H = loadIndia(), { dates, series, syms } = H, W = JSON.parse(readFileSync(process.argv[2]));
const med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; }, p = (x) => (Number.isFinite(x) ? (x * 100).toFixed(0) + '%' : 'n/a');
const cutCache = new Map(); const cut10 = (t) => { if (!cutCache.has(t)) { const r = []; for (const sym of syms) { const c = series.get(sym).c; if (c[t] > 0 && c[t - 126] > 0 && H.tv(sym, t - 19, t) >= 2e7) r.push(c[t] / c[t - 126] - 1); } r.sort((a, b) => a - b); cutCache.set(t, r[Math.floor(r.length * 0.9)]); } return cutCache.get(t); };
const out = [];
for (const w of W) {
  const s = series.get(w.sym), c = s.c, v = s.v; const first = { M1: null, M3: null, M4: null, any: null };
  for (let t = Math.max(260, w.L); t <= w.P; t++) {
    if (!(c[t] > 0) || !H.green(dates[t])) continue; let hi = 0; for (let k = t - 251; k < t; k++) if (c[k] > hi) hi = c[k]; if (!(c[t] >= hi)) continue; if (!(H.tv(w.sym, t - 19, t) >= 2e7)) continue;
    let s200 = 0, n200 = 0, v50 = 0, nv = 0, hi60 = 0, lo60 = 1e18; for (let k = t - 199; k <= t; k++) if (c[k] > 0) { s200 += c[k]; n200++; } for (let k = t - 50; k < t; k++) if (v[k] >= 0) { v50 += v[k]; nv++; } for (let k = t - 59; k <= t; k++) if (c[k] > 0) { if (c[k] > hi60) hi60 = c[k]; if (c[k] < lo60) lo60 = c[k]; }
    const a = (x, y) => { let sm = 0, n = 0; for (let k = x; k <= y; k++) if (c[k] > 0 && c[k - 1] > 0) { sm += Math.abs(c[k] / c[k - 1] - 1); n++; } return n > (y - x) * 0.8 ? sm / n : NaN; };
    const above = c[t] > s200 / n200, volx = nv > 40 && v[t] >= 2 * (v50 / nv);
    if (!first.M1 && above && volx && hi60 / lo60 <= 1.35) first.M1 = t;
    if (!first.M4 && above && a(t - 19, t) < 0.6 * a(t - 99, t)) first.M4 = t;
    if (!first.M3 && c[t - 126] > 0 && c[t] / c[t - 126] - 1 >= cut10(t)) first.M3 = t;
    if (first.M1 && first.M3 && first.M4) break;
  }
  first.any = [first.M1, first.M3, first.M4].filter((x) => x != null).sort((a, b) => a - b)[0] ?? null;
  out.push({ w, first });
}
const left = (t, w) => { const c = series.get(w.sym).c; const e = c[t + 1] > 0 ? c[t + 1] : c[t]; return Math.log(c[w.P] / e) / Math.log(c[w.P] / c[w.L]); };
for (const [nm, f] of [['all 4x winners', () => true], ['crash launch (dd<=-50%)', (w) => w.dd <= -0.5], ['no crash (dd>-35%)', (w) => w.dd > -0.35], ['trough not in 2020', (w) => w.year !== '2020'], ['10x winners', (w) => w.ratio >= 10]]) {
  const S = out.filter((o) => f(o.w)); console.log(`== ${nm}: n ${S.length}`);
  for (const k of ['M1', 'M3', 'M4', 'any']) { const hit = S.filter((o) => o.first[k] != null); console.log(`  ${k}: flagged ${hit.length} (${p(hit.length / S.length)}); median sessions from trough ${med(hit.map((o) => o.first[k] - o.w.L))}; median share of the move still ahead at entry ${p(med(hit.map((o) => left(o.first[k], o.w))))}`); }
}
