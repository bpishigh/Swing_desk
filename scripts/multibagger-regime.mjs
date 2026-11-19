// REGIME addendum (docs/replay/US-MULTIBAGGER-ANATOMY-PREREG.md). Usage: node scripts/multibagger-regime.mjs [--india]
import { loadUS, loadIndia } from './lib/study-harness.mjs';
const IN = process.argv.includes('--india'), H = IN ? loadIndia() : loadUS(), { dates, series, syms, N } = H;
const FLOOR = IN ? 2e7 : 2e6, FROM = IN ? '2011-02' : '2017-10', TO = '2023-11';
const med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; };
const pc = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
const me = []; for (let t = 1; t < N; t++) if (dates[t].slice(0, 7) !== dates[t + 1]?.slice(0, 7) && dates[t].slice(0, 7) >= FROM && dates[t].slice(0, 7) <= TO && t + 756 <= N - 1 && t >= (IN ? 300 : 504)) me.push(t);
const dd = (t) => { const a = H.idxAt(dates[t]); let hi = 0; for (let i = Math.max(0, a - 251); i <= a; i++) if (H.idx[H.ik[i]] > hi) hi = H.idx[H.ik[i]]; return H.idx[H.ik[a]] / hi - 1; };
const rows = [];
for (const t of me) { const d = dd(t), b = d <= -0.2 ? 'deep' : d <= -0.1 ? 'middle' : 'calm'; let ep = null;
  for (const sym of syms) { const c = series.get(sym).c; if (!(c[t] > 0) || !(c[t - 252] > 0)) continue; if (!(H.tv(sym, t - 19, t) >= FLOOR)) continue; let mx = 0; for (let k = Math.max(0, t - 503); k <= t; k++) if (c[k] > mx) mx = c[k]; let top = 0; for (let k = t + 1; k <= t + 756; k++) if (c[k] > top) top = c[k]; let c12 = NaN; for (let k = t + 252; k > t + 200; k--) if (c[k] > 0) { c12 = c[k] / c[t] - 1; break; }
    rows.push({ t, b, deepStock: c[t] / mx - 1 <= -0.5, a: top / c[t] >= 3, c12 }); } }
// episodes: runs of consecutive deep month-ends
const epId = new Map(); let e = 0, prev = null; for (const t of me) { const isDeep = dd(t) <= -0.2; if (isDeep) { if (prev !== true) e++; epId.set(t, e); } prev = isDeep; }
const epName = (id) => { const ts = [...epId].filter(([, v]) => v === id).map(([k]) => k); return `${dates[ts[0]]}..${dates[ts.at(-1)]}`; };
console.log(`${IN ? 'India' : 'US'} regime test: ${me.length} month-ends, ${rows.length} stock-months`);
console.log('bucket  month-ends  stock-months | all: 3x rate, 12m median | stocks >=50% below 2y high: n, 3x rate, 12m median');
const out = {}; for (const b of ['deep', 'middle', 'calm']) { const R = rows.filter((r) => r.b === b), D = R.filter((r) => r.deepStock); out[b] = { a: D.filter((r) => r.a).length / D.length };
  console.log(b.padEnd(7), String(new Set(R.map((r) => r.t)).size).padStart(4), String(R.length).padStart(10), '|', pc(R.filter((r) => r.a).length / R.length), pc(med(R.map((r) => r.c12))), '|', D.length, pc(out[b].a), pc(med(D.map((r) => r.c12)))); }
console.log('ratio deep/calm for beaten-down sub-group:', (out.deep.a / out.calm.a).toFixed(2));
console.log('episodes (deep index drawdown), beaten-down sub-group vs calm-bucket sub-group rate ' + pc(out.calm.a));
for (let id = 1; id <= e; id++) { const R = rows.filter((r) => epId.get(r.t) === id), D = R.filter((r) => r.deepStock); if (D.length) console.log(`  ${epName(id)}: month-ends ${new Set(R.map((r) => r.t)).size}, sub-group n ${D.length}, 3x ${pc(D.filter((r) => r.a).length / D.length)}, 12m median ${pc(med(D.map((r) => r.c12)))}, all-stock 3x ${pc(R.filter((r) => r.a).length / R.length)}`); }
