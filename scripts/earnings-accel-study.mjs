// EARNINGS-ACCEL (docs/replay/EARNINGS-ACCEL-PREREG.md).
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
const med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; }, mean = (a) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN; };
const f1 = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
const me = []; for (let t = 1; t < N - 1; t++) if (dates[t].slice(0, 7) !== dates[t + 1].slice(0, 7) && dates[t].slice(0, 7) >= '2019-01' && dates[t].slice(0, 7) <= '2024-11' && t + 252 <= N - 1) me.push(t);
const EV = ['E0', 'E1', 'E2', 'E3'], ev = Object.fromEntries(EV.map((k) => [k, []])), base = [];
for (const t of me) {
  const D = dates[t], rows = [];
  for (const sym of syms) {
    const c = series.get(sym).c, raw = H.openRaw(sym, t)?.[1]; if (!(c[t] > 0) || !(raw >= 20) || !(H.tv(sym, t - 19, t) >= 2e7)) continue;
    let c12 = NaN; for (let k = t + 252; k > t + 150; k--) if (c[k] > 0) { c12 = c[k] / c[t] - 1; break; } if (!Number.isFinite(c12)) continue;
    let top = NaN; if (t + 756 <= N - 1) { top = 0; for (let k = t + 1; k <= t + 756; k++) if (c[k] > top) top = c[k]; top = top / c[t]; }
    rows.push({ sym, t, c12, top, y: D.slice(0, 4), D });
  }
  if (rows.length < 100) continue;
  const m12 = med(rows.map((r) => r.c12)), q80 = rows.map((r) => r.c12).sort((a, b) => a - b)[Math.floor(rows.length * 0.8)];
  for (const r of rows) { r.ex = r.c12 - m12; r.topq = r.c12 >= q80; r.x3 = Number.isFinite(r.top) ? r.top >= 3 : null; base.push(r);
    const e = entityAt(r.sym, D); if (!e) continue; const facts = factsOf(e); if (!facts) continue;
    let v; try { v = asOfResults(facts, e.id, D, { limit: 6, events: e.events }); } catch { continue; }
    const q = v.quarters; if (q.length < 3 || !q[0].yoy || !q[1].yoy) continue;
    const a = q[0].yoy, b = q[1].yoy, c2 = q[2].yoy; const num = (x) => Number.isFinite(x);
    if (!num(a.pat) || !num(a.revenue) || !num(b.pat)) continue;
    const e0 = a.pat >= 0.25 && a.revenue >= 0.10, e1 = e0 && b.pat >= 0.25 && a.pat - b.pat >= 0.05;
    const e2 = num(b.revenue) && c2 && num(c2.revenue) && a.revenue >= 0.15 && a.revenue - b.revenue >= 0.05 && b.revenue > c2.revenue && a.pat > 0;
    const e3 = num(a.pbt) && num(b.pbt) && num(b.revenue) && a.pbt > b.pbt && a.revenue > b.revenue && a.pat > b.pat && a.pbt >= 0.15 && a.revenue >= 0.15 && a.pat >= 0.15;
    if (e0) ev.E0.push(r); if (e1) ev.E1.push(r); if (e2) ev.E2.push(r); if (e3) ev.E3.push(r); }
}
const HALF = (r) => (r.D <= '2022-06-30' ? 'disc' : 'val');
const cell = (E) => { const ex = E.map((r) => r.ex), s = [...ex].sort((a, b) => b - a), k = Math.floor(E.length * 0.05), x3 = E.filter((r) => r.x3 != null); return { n: E.length, med: med(ex), mean: mean(ex), exTop5: s.length > k ? mean(s.slice(k)) : NaN, topq: E.filter((r) => r.topq).length / (E.length || 1), x3: x3.length ? x3.filter((r) => r.x3).length / x3.length : NaN, x3n: x3.length }; };
const bx3 = base.filter((r) => r.x3 != null); console.log(`liquid stock-months ${base.length}; base 3x rate ${f1(bx3.filter((r) => r.x3).length / bx3.length)}; base top-quintile 20%`);
const out = {};
for (const k of [...EV]) { out[k] = {}; console.log('\n' + k); for (const h of ['disc', 'val']) { const E = ev[k].filter((r) => HALF(r) === h), c = cell(E); out[k][h] = c; console.log(`  ${h}: n ${c.n} median excess ${f1(c.med)} mean ${f1(c.mean)} ex-top5% ${f1(c.exTop5)} top-quintile share ${f1(c.topq)} 3x rate ${f1(c.x3)} (n ${c.x3n})`); }
  const ys = ['2019', '2020', '2021', '2022', '2023', '2024'], yl = ys.map((y) => { const E = ev[k].filter((r) => r.y === y); return E.length >= 20 ? [y, med(E.map((r) => r.ex)), E.length] : [y, NaN, E.length]; }); out[k].years = yl; console.log('  by entry year (median excess, n):', yl.map(([y, m, n]) => `${y} ${f1(m)} (${n})`).join(' | ')); }
console.log('\nPASS CHECK (n>=300 both halves, median excess >=5pts both, top-quintile share >=26% both, ex-top5% >0 both, median excess beats E0 both halves, positive median in >=4 of 6 years):');
for (const k of ['E1', 'E2', 'E3']) { const ok = ['disc', 'val'].every((h) => out[k][h].n >= 300 && out[k][h].med >= 0.05 && out[k][h].topq >= 0.26 && out[k][h].exTop5 > 0 && out[k][h].med > out.E0[h].med); const pos = out[k].years.filter(([, m]) => m > 0).length; console.log(' ', k, ok && pos >= 4 ? 'PASS' : 'fail', `(years positive ${pos}/6)`); }
