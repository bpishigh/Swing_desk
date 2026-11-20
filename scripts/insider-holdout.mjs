// INSIDER addendum 1 holdout (docs/replay/INSIDER-PREREG.md).
import { loadIndia, pc } from './lib/study-harness.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { asOfResults } from '../src/engine/filings-asof.ts';
import { computeFeatures } from '../src/engine/fundamentals-asof.ts';
const H = loadIndia(), { dates, series, syms, N } = H;
const ents = JSON.parse(readFileSync('data/india/entities.json', 'utf8')).entities, bySym = new Map();
for (const e of ents) for (const u of e.symbols) { const a = bySym.get(u.symbol) || []; a.push([u, e]); bySym.set(u.symbol, a); }
const entityAt = (sym, D) => { const a = bySym.get(sym); if (!a) return null; return (a.find(([u]) => (u.from == null || u.from <= D) && (u.to == null || u.to >= D)) || a[a.length - 1])[1]; };
const splitsOf = new Map(); for (const [sym, date, factor] of H.splits) { const a = splitsOf.get(sym) || []; a.push({ date, factor }); splitsOf.set(sym, a); }
const cache = new Map(), factsOf = (e) => { if (cache.has(e.id)) return cache.get(e.id); const p = `data/india/filings/${e.id}.json.gz`; let f = null; if (existsSync(p)) { const st = JSON.parse(gunzipSync(readFileSync(p))); f = st.results.filter((y) => y.asOf).map((y) => ({ entity: e.id, period: y.period, basis: y.basis, asOf: y.asOf, revision: y.revision ?? 0, fields: y.fields, ytd: y.ytd, format: y.format, extra: y.extra })); } cache.set(e.id, f); return f; };
import { gunzipSync as gz } from 'node:zlib';
const med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; }, mean = (a) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN; };
const f1 = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const iso = (s) => { const m = /^(\d\d)-(\w{3})-(\d{4})/.exec(s ?? ''); return m && MON[m[2]] ? `${m[3]}-${MON[m[2]]}-${m[1]}` : null; };
const bySymRows = new Map(); let rowsN = 0, matched = 0; const symSet = new Set(syms);
for (let y = 2016; y <= 2025; y++) { const st = JSON.parse(gz(readFileSync(`data/india/pit/${y}.json.gz`))); for (const r of st.rows) { const mode = r.m, mk = /market purchase|market sale/i.test(mode ?? ''); if (!mk) continue; const d = iso(r.d); if (!d || !(r.v >= 0)) continue; rowsN++; if (symSet.has(r.s)) matched++; const prom = /promoter/i.test(r.c ?? '') && !/relative of (the )?(directors|promoter parul)/i.test(r.c ?? ''); const buy = /purchase/i.test(mode), a = bySymRows.get(r.s) ?? []; a.push({ d, prom, buy, v: r.v, gain: Number.isFinite(r.a) && Number.isFinite(r.b) ? r.a - r.b : 0 }); bySymRows.set(r.s, a); } }
for (const a of bySymRows.values()) a.sort((p, q) => (p.d < q.d ? -1 : 1));
console.log(`open-market PIT rows ${rowsN}, symbol matched to price history ${f1(matched / rowsN)}`);
const addDays = (D, n) => new Date(new Date(D) - n * 864e5).toISOString().slice(0, 10);
function state(sym, D) { const a = bySymRows.get(sym); if (!a) return null; const lo = addDays(D, 90); let pb = 0, ps = 0, ib = 0, is = 0, pn = 0, gain = 0; for (const r of a) { if (r.d > D) break; if (r.d <= lo) continue; if (r.prom) { if (r.buy) { pb += r.v; pn++; gain += r.gain; } else ps += r.v; } else if (r.buy) ib += r.v; else is += r.v; }
  const P1 = pb - ps >= 25e5, P2 = P1 && pn >= 2 && gain >= 0.5, P3 = ib - is >= 10e5 && !(ps - pb >= 25e5), P4 = ps - pb >= 1e7; return { P1, P2, P3, P4 }; }
const me = []; for (let t = 1; t < N - 1; t++) if (dates[t].slice(0, 7) !== dates[t + 1].slice(0, 7) && dates[t].slice(0, 7) >= '2024-12' && t + 252 <= N - 1) me.push(t);
const EV = ['P1', 'P2', 'P3', 'P4'], FL = { main: 2e7, low: 5e6 }, ev = {}, base = {}; for (const f of Object.keys(FL)) { ev[f] = Object.fromEntries(EV.map((k) => [k, []])); base[f] = []; }
for (const t of me) {
  const D = dates[t], rows = { main: [], low: [] };
  for (const sym of syms) {
    const c = series.get(sym).c, raw = H.openRaw(sym, t)?.[1]; if (!(c[t] > 0) || !(raw >= 20)) continue; const tv = H.tv(sym, t - 19, t); if (!(tv >= FL.low)) continue;
    let c12 = NaN; for (let k = t + 252; k > t + 150; k--) if (c[k] > 0) { c12 = c[k] / c[t] - 1; break; } if (!Number.isFinite(c12)) continue;
    let top = NaN; if (t + 756 <= N - 1) { top = 0; for (let k = t + 1; k <= t + 756; k++) if (c[k] > top) top = c[k]; top = top / c[t]; }
    const r = { sym, t, c12, top, y: D.slice(0, 4), D, st: state(sym, D) }; rows.low.push(r); if (tv >= FL.main) rows.main.push(r);
  }
  for (const f of Object.keys(FL)) { const R = rows[f]; if (R.length < 100) continue; const m12 = med(R.map((r) => r.c12)), q80 = R.map((r) => r.c12).sort((a, b) => a - b)[Math.floor(R.length * 0.8)];
    for (const r of R) { r.ex = r.c12 - m12; r.topq = r.c12 >= q80; r.x3 = Number.isFinite(r.top) ? r.top >= 3 : null; base[f].push(r); if (r.st) for (const k of EV) if (r.st[k]) ev[f][k].push(r); } }
}
const HALF = () => 'val';
const cell = (E) => { const ex = E.map((r) => r.ex), s = [...ex].sort((a, b) => b - a), k = Math.floor(E.length * 0.05), x3 = E.filter((r) => r.x3 != null); return { n: E.length, med: med(ex), mean: mean(ex), exTop5: s.length > k ? mean(s.slice(k)) : NaN, topq: E.filter((r) => r.topq).length / (E.length || 1), x3: x3.length ? x3.filter((r) => r.x3).length / x3.length : NaN, x3n: x3.length }; };
const out = {}, f = 'main', E = ev.main.P2, c = cell(E), bx = base.main.filter((r) => r.x3 != null);
console.log(`month-ends ${me.length} (${dates[me[0]]}..${dates[me.at(-1)]}); liquid stock-months ${base.main.length}; P2 events ${c.n}`);
console.log(`P2: n ${c.n} median excess ${f1(c.med)} mean ${f1(c.mean)} ex-top5% ${f1(c.exTop5)} top-quintile ${f1(c.topq)} 3x ${f1(c.x3)} (n ${c.x3n})`);
console.log('by month-end:', [...new Set(E.map((r) => r.D.slice(0, 7)))].map((m) => { const e = E.filter((r) => r.D.startsWith(m)); return `${m} ${f1(med(e.map((r) => r.ex)))} (${e.length})`; }).join(' | '));
console.log('P1 (read-only):', JSON.stringify(cell(ev.main.P1)), ' P3:', JSON.stringify(cell(ev.main.P3)));
console.log('PASS CHECK P2:', c.n >= 150 && c.med >= 0.05 && c.topq >= 0.26 && c.exTop5 > 0 ? 'PASS' : 'fail');
