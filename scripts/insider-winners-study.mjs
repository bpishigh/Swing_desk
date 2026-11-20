// INSIDER-WINNERS (docs/replay/INSIDER-WINNERS-PREREG.md).
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
const segI = JSON.parse(readFileSync('data/india/segments.json', 'utf8')).industry, inf = JSON.parse(readFileSync('data/india/industry-inferred.json', 'utf8')).map, probe = JSON.parse(readFileSync('data/india/probe-industry-yf.json', 'utf8')); const IND = (sym) => segI[sym] ?? inf[probe[sym]?.industry] ?? null;
const addDays = (D, n) => new Date(new Date(D) - n * 864e5).toISOString().slice(0, 10);
// rows carry holdings before/after; reread to keep the first 'before' per window
const raw2 = new Map(); for (let y = 2016; y <= 2025; y++) { const st = JSON.parse(gz(readFileSync(`data/india/pit/${y}.json.gz`))); for (const r of st.rows) { if (!/market purchase|market sale/i.test(r.m ?? '')) continue; const d = iso(r.d); if (!d) continue; const a = raw2.get(r.s) ?? []; a.push({ d, prom: /promoter/i.test(r.c ?? '') && !/relative of (the )?(directors|promoter parul)/i.test(r.c ?? ''), buy: /purchase/i.test(r.m), v: r.v, b: r.b, a: r.a }); raw2.set(r.s, a); } } for (const a of raw2.values()) a.sort((p, q) => (p.d < q.d ? -1 : 1));
function ev0(sym, D) { const a = raw2.get(sym); if (!a) return null; const lo = addDays(D, 90); let pb = 0, ps = 0, ib = 0, is = 0, pn = 0, n = 0, gain = 0, b0 = NaN; for (const r of a) { if (r.d > D) break; if (r.d <= lo) continue; if (r.prom) { if (r.buy) { pb += r.v; pn++; n++; gain += (Number.isFinite(r.a) && Number.isFinite(r.b) ? r.a - r.b : 0); if (!Number.isFinite(b0) && Number.isFinite(r.b)) b0 = r.b; } else ps += r.v; } else if (r.buy) { ib += r.v; n++; } else is += r.v; }
  const P1 = pb - ps >= 25e5, P3 = ib - is >= 10e5 && !(ps - pb >= 25e5); if (!P1 && !P3) return null; const net = Math.max(0, pb - ps) + Math.max(0, ib - is); return { net, n, promShare: net > 0 ? Math.max(0, pb - ps) / net : NaN, b0, gain }; }
const me = []; for (let t = 1; t < N - 1; t++) if (dates[t].slice(0, 7) !== dates[t + 1].slice(0, 7) && dates[t].slice(0, 7) >= '2016-06' && dates[t].slice(0, 7) <= '2023-11' && t + 756 <= N - 1) me.push(t);
const FE = ['bvAdv', 'nBuys', 'promShare', 'b0', 'gain', 'mom6', 'mom12', 'belowHigh', 'dd2y', 'vol', 'logTV', 'price', 'fromLow', 'above200'];
const rows = [], liq = new Map(); const lastEv = new Map();
for (const t of me) { const D = dates[t], m12s = [];
  const cand = [];
  for (const sym of syms) { const c = series.get(sym).c, raw = H.openRaw(sym, t)?.[1]; if (!(c[t] > 0) || !(raw >= 20) || !(c[t - 252] > 0)) continue; const tv = H.tv(sym, t - 19, t); if (!(tv >= 2e7)) continue;
    let c12 = NaN; for (let k = t + 252; k > t + 150; k--) if (c[k] > 0) { c12 = c[k] / c[t] - 1; break; } if (Number.isFinite(c12)) m12s.push(c12);
    const e = ev0(sym, D); if (!e) continue; cand.push({ sym, c, raw, tv, c12, e }); }
  m12s.sort((a, b) => a - b); const mm = m12s[m12s.length >> 1];
  for (const { sym, c, raw, tv, c12, e } of cand) { if (!Number.isFinite(c12)) continue; let top = 0; for (let k = t + 1; k <= t + 756; k++) if (c[k] > top) top = c[k];
    let hi = 0, hi2 = 0, lo = 1e18, s200 = 0, n200 = 0, a = 0, b = 0, n = 0; for (let k = t - 251; k <= t; k++) if (c[k] > 0) { if (c[k] > hi) hi = c[k]; if (c[k] < lo) lo = c[k]; } for (let k = t - 503; k <= t; k++) if (c[k] > hi2) hi2 = c[k]; for (let k = t - 199; k <= t; k++) if (c[k] > 0) { s200 += c[k]; n200++; } for (let k = t - 125; k <= t; k++) if (c[k] > 0 && c[k - 1] > 0) { const r = c[k] / c[k - 1] - 1; a += r; b += r * r; n++; }
    const f = { bvAdv: e.net / tv, nBuys: e.n, promShare: e.promShare, b0: e.b0, gain: e.gain, mom6: c[t - 126] > 0 ? c[t] / c[t - 126] - 1 : NaN, mom12: c[t] / c[t - 252] - 1, belowHigh: c[t] / hi - 1, dd2y: c[t] / hi2 - 1, vol: Math.sqrt(b / n - (a / n) ** 2), logTV: Math.log(tv), price: raw, fromLow: c[t] / lo - 1, above200: c[t] > s200 / n200 ? 1 : 0 };
    const key = sym; const prev = lastEv.get(key); const episode = prev == null || t - prev > 126; lastEv.set(key, t);
    rows.push({ sym, t, D, y: D.slice(0, 4), mult: top / c[t], x3: top / c[t] >= 3, x5: top / c[t] >= 5, ex: c12 - mm, f, episode, ind: IND(sym) }); } }
const HALF = (r) => (r.D <= '2020-12-31' ? 'disc' : 'val'), disc = rows.filter((r) => HALF(r) === 'disc'), val = rows.filter((r) => HALF(r) === 'val');
const rate = (A, k = 'x3') => (A.length ? A.filter((r) => r[k]).length / A.length : NaN), q = (a, p) => { const x = a.filter(Number.isFinite).sort((m, n) => m - n); return x[Math.min(x.length - 1, Math.floor(x.length * p))]; };
console.log(`events (stock-months) ${rows.length}: discovery ${disc.length}, validation ${val.length}; 3x rate all ${f1(rate(rows))} disc ${f1(rate(disc))} val ${f1(rate(val))}; 5x ${f1(rate(rows, 'x5'))}; episodes ${rows.filter((r) => r.episode).length}`);
// Part 1
console.log('\nPART 1 winners (3x) by entry year: events / winners / rate / winner episodes');
for (const y of [...new Set(rows.map((r) => r.y))].sort()) { const A = rows.filter((r) => r.y === y); console.log(`  ${y}: ${A.length} / ${A.filter((r) => r.x3).length} / ${f1(rate(A))} / ${A.filter((r) => r.x3 && r.episode).length}`); }
const w20 = rows.filter((r) => r.x3 && r.episode); console.log(`winner episodes ${w20.length}; entered in 2020 (Mar-Dec) ${w20.filter((r) => r.D >= '2020-03' && r.D < '2021-01').length}`);
const indOf = (A) => { const m = new Map(); for (const r of A) { const g = r.ind ?? 'unknown'; m.set(g, (m.get(g) ?? 0) + 1); } return m; }; const allI = indOf(rows), winI = indOf(rows.filter((r) => r.x3));
console.log('\nindustry: events share -> winner share (3x), rate (top by winners)'); console.log([...winI.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([g, n]) => `  ${g}: ${f1(allI.get(g) / rows.length)} -> ${f1(n / rows.filter((r) => r.x3).length)}, rate ${f1(n / allI.get(g))} (n ${allI.get(g)})`).join('\n'));
console.log('\nTop 25 winner episodes by multiple:'); for (const r of [...w20].sort((a, b) => b.mult - a.mult).slice(0, 25)) console.log(`  ${r.sym.padEnd(12)} ${r.D} ${r.mult.toFixed(1)}x  buy ${(r.f.bvAdv).toFixed(2)} days-of-volume, buys ${r.f.nBuys}, prom share ${Number.isFinite(r.f.promShare) ? (r.f.promShare * 100).toFixed(0) + '%' : 'n/a'}, mom6 ${f1(r.f.mom6)}, below high ${f1(r.f.belowHigh)}, ${r.ind ?? ''}`);
// Part 2
const cuts = {}; for (const k of FE) cuts[k] = [0.2, 0.4, 0.6, 0.8].map((p) => q(disc.map((r) => r.f[k]), p));
const bin = (k, v) => { if (!Number.isFinite(v)) return -1; let b = 0; for (const c of cuts[k]) if (v > c) b++; return b; };
const base = rate(disc), baseV = rate(val); console.log(`\nPART 2 features: lift of 3x rate vs event base (disc base ${f1(base)}, val base ${f1(baseV)}); Q1 lowest ... Q5 highest; discovery | validation (same cuts)`);
const useful = [];
for (const k of FE) { const L = [0, 1, 2, 3, 4].map((b) => { const A = disc.filter((r) => bin(k, r.f[k]) === b), B = val.filter((r) => bin(k, r.f[k]) === b); return [rate(A) / base, rate(B) / baseV, A.length, B.length]; }); console.log(`  ${k.padEnd(10)} disc ${L.map((x) => x[0].toFixed(2)).join(' ')} | val ${L.map((x) => x[1].toFixed(2)).join(' ')} | cuts ${cuts[k].map((x) => (Math.abs(x) < 100 ? x.toFixed(2) : x.toFixed(0))).join(',')}`);
  for (const [side, b, opp] of [['high', 4, 0], ['low', 0, 4]]) { if (!(L[b][0] >= 1.4 && L[opp][0] <= 1.0)) continue; const ys = ['2016', '2017', '2018', '2019', '2020'].map((y) => { const A = disc.filter((r) => r.y === y && r.f[k] != null), Q = A.filter((r) => bin(k, r.f[k]) === b); return Q.length >= 20 && A.length ? rate(Q) / rate(A) : NaN; }); const okY = ys.filter((x) => x > 1).length >= 4; const vok = L[b][1] >= 1.2; console.log(`     -> ${k} ${side}: disc lift ${L[b][0].toFixed(2)} opp ${L[opp][0].toFixed(2)}; yearly lifts ${ys.map((x) => (Number.isFinite(x) ? x.toFixed(2) : '-')).join(' ')}; years>1 ${okY}; val lift ${L[b][1].toFixed(2)} ${vok ? 'holds' : 'weak'}`); if (okY) useful.push({ k, side, b, lift: L[b][0], vok }); } }
useful.sort((a, b) => b.lift - a.lift); console.log('\nuseful features (disc):', useful.map((u) => `${u.k} ${u.side} ${u.lift.toFixed(2)} val ${u.vok ? 'ok' : 'weak'}`).join('; ') || 'none');
// Part 3
const two = useful.filter((u) => u.vok || true).slice(0, 2); if (two.length < 1) { console.log('\nPART 3: no useful feature; no rule.'); process.exit(0); }
const pick = (r) => two.every((u) => bin(u.k, r.f[u.k]) === u.b); const D3 = disc.filter(pick), V3 = val.filter(pick);
const cell = (E) => { const exs = E.map((r) => r.ex), s = [...exs].sort((a, b) => b - a), k = Math.floor(E.length * 0.05); return { n: E.length, x3: rate(E), x5: rate(E, 'x5'), med: [...exs].sort((a, b) => a - b)[exs.length >> 1], exTop5: E.length > k ? s.slice(k).reduce((a, b) => a + b, 0) / (E.length - k) : NaN }; };
const d = cell(D3), v = cell(V3); console.log(`\nPART 3 rule = event and ${two.map((u) => u.k + ' ' + u.side).join(' and ')}`);
console.log(`  discovery: n ${d.n} 3x ${f1(d.x3)} (lift ${(d.x3 / base).toFixed(2)}) 5x ${f1(d.x5)} median excess ${f1(d.med)}`);
console.log(`  validation: n ${v.n} 3x ${f1(v.x3)} (lift ${(v.x3 / baseV).toFixed(2)}) 5x ${f1(v.x5)} median excess ${f1(v.med)} ex-top5% ${f1(v.exTop5)}`);
const yrs = ['2021', '2022', '2023'].map((y) => { const E = V3.filter((r) => r.y === y), A = val.filter((r) => r.y === y); return E.length >= 10 ? [y, rate(E) / rate(A), E.length] : [y, NaN, E.length]; }); console.log('  validation years (lift, n):', yrs.map(([y, l, n]) => `${y} ${Number.isFinite(l) ? l.toFixed(2) : '-'} (${n})`).join(' | '));
console.log('  PASS CHECK:', d.n >= 150 && d.x3 / base >= 1.8 && v.n >= 150 && v.x3 / baseV >= 1.5 && v.med >= 0.08 && yrs.filter(([, l]) => l > 1).length >= 2 && v.exTop5 > 0 ? 'PASS' : 'fail');
