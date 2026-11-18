// What do stocks that grow have in common (docs/replay/GROWTH-FACTORS-PREREG.md). Month-end cross-section, forward outcomes.
// Usage: node --max-old-space-size=7000 scripts/growth-factors-study.mjs --from=2011-01 --to=2017-12 --tag=discovery [--combo=f1,f2,f3 --dir=1,-1,1]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays } from '../src/backtest/india-asof.ts';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const FROM = arg('from', '2011-01'), TO = arg('to', '2017-12'), TAG = arg('tag', 'discovery'), OUT = 'docs/replay';
const GATE_ARG = arg('gate', 'none');
const COMBO = arg('combo', '').split(',').filter(Boolean), DIRS = arg('dir', '').split(',').filter(Boolean).map(Number);
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const raw = [];
for (const dir of ['bhav-hist', 'bhav-pre2020']) for (const f of readdirSync('data/india/' + dir).filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync(`data/india/${dir}/${f}`))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) raw.push(R('data/india/bhav/' + f));
raw.sort((a, b) => (a.date < b.date ? -1 : 1)); const uniq = raw.filter((d, i) => i === 0 || d.date !== raw[i - 1].date);
const actions = [...R('data/india/corp-actions-history-pre2019.json', []), ...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
const res = resolveHistory(uniq, actions, ov), days = toDays(uniq), dates = days.map((d) => d.date), N = dates.length;
const eq = new Set(); for (const d of uniq) for (const [s, r] of Object.entries(d.rows)) if (r[0] === 'EQ') eq.add(s);
const series = buildHistories(days, res.splits, eq).series; const syms = [...series.keys()];
const firstIdx = new Map(); for (let i = 0; i < N; i++) for (const r of days[i].rows) if (!firstIdx.has(r[0])) firstIdx.set(r[0], i);
const FUND = process.argv.includes('--fund');
const NAMES = [...(FUND ? ['revYoY', 'patYoY', 'revAccel', 'marginChg', 'patAccel'] : []), 'mom12_1', 'mom6', 'mom3', 'prox52', 'vol126', 'logTV', 'tvTrend', 'price', 'deliv', 'range40', 'udVol', 'age', 'dist200', 'fromLow'];
const monthEnds = []; for (let t = 1; t < N; t++) if (dates[t].slice(0, 7) !== dates[t + 1]?.slice(0, 7) && dates[t].slice(0, 7) >= FROM && dates[t].slice(0, 7) <= TO) monthEnds.push(t);
const tvAt = (s, a, b) => { let x = 0, n = 0; for (let i = a; i <= b; i++) if (s.c[i] > 0 && s.v[i] >= 0) { x += s.c[i] * s.v[i]; n++; } return n >= (b - a + 1) * 0.7 ? x / n : NaN; };
const FIL = new Map(); if (FUND) for (const f of readdirSync('data/india/filings').filter((x) => x.endsWith('.json.gz'))) { try { const j = JSON.parse(gunzipSync(readFileSync('data/india/filings/' + f))); FIL.set(j.entity ?? f.replace('.json.gz', ''), j.results ?? []); } catch {} }
const eom = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(), addM = (p, k) => { let y = +p.slice(0, 4), m = +p.slice(5, 7) + k; while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; } return `${y}-${String(m).padStart(2, '0')}-${String(eom(y, m)).padStart(2, '0')}`; };
function fund(sym, D) {
  const rs = FIL.get(sym); if (!rs) return {};
  const by = new Map();
  for (const r of rs) { if (!r.original || !r.asOf || r.asOf.slice(0, 10) > D) continue; const cur = by.get(r.period); if (!cur || (r.basis === 'consolidated' && cur.basis !== 'consolidated') || (r.basis === cur.basis && r.asOf < cur.asOf)) by.set(r.period, r); }
  const per = [...by.keys()].sort(); if (!per.length) return {}; const q0 = per.at(-1); if ((new Date(D) - new Date(q0)) / 86400000 > 150) return {};
  const g = (p, fld) => { const a = by.get(p)?.fields?.[fld], b = by.get(addM(p, -12))?.fields?.[fld]; return a != null && b > 0 ? a / b - 1 : NaN; };
  const q1 = addM(q0, -3), out = {};
  const r0 = g(q0, 'revenue'), r1 = g(q1, 'revenue'), p0 = g(q0, 'pat'), p1 = g(q1, 'pat');
  out.revYoY = r0; out.patYoY = p0; out.revAccel = r0 - r1; out.patAccel = p0 - p1;
  const m = (p) => { const f = by.get(p)?.fields; return f?.revenue > 0 && f.pbt != null ? f.pbt / f.revenue : NaN; }; out.marginChg = m(q0) - m(addM(q0, -12));
  return out;
}
const rows = [];
for (const t of monthEnds) {
  if (t + 756 > N - 1) continue;
  const U = [];
  for (const sym of syms) {
    const s = series.get(sym); if (!(s.c[t] > 0) || !(s.c[t - 252] > 0) || !(s.c[t - 21] > 0)) continue;
    const tv = tvAt(s, t - 19, t); if (!(tv >= 2e7)) continue;
    let hi = 0, lo = Infinity, s200 = 0, n200 = 0, m40hi = 0, m40lo = Infinity, up = 0, dn = 0, sr = 0, sr2 = 0, nr = 0, dv = 0, ndv = 0;
    for (let k = t - 251; k <= t; k++) { if (s.h[k] > hi) hi = s.h[k]; if (s.l[k] > 0 && s.l[k] < lo) lo = s.l[k]; }
    for (let k = t - 199; k <= t; k++) if (s.c[k] > 0) { s200 += s.c[k]; n200++; }
    for (let k = t - 39; k <= t; k++) if (s.c[k] > 0) { if (s.c[k] > m40hi) m40hi = s.c[k]; if (s.c[k] < m40lo) m40lo = s.c[k]; }
    for (let k = t - 49; k <= t; k++) if (s.c[k] > 0 && s.c[k - 1] > 0 && s.v[k] >= 0) { if (s.c[k] >= s.c[k - 1]) up += s.v[k]; else dn += s.v[k]; }
    for (let k = t - 125; k <= t; k++) if (s.c[k] > 0 && s.c[k - 1] > 0) { const r = s.c[k] / s.c[k - 1] - 1; sr += r; sr2 += r * r; nr++; }
    for (let k = t - 59; k <= t; k++) { const d = uniq[k].rows[sym]?.[7]; if (d > 0) { dv += d; ndv++; } }
    if (n200 < 180 || nr < 100) continue;
    const tvOld = tvAt(s, t - 250, t - 125), f = {
      mom12_1: s.c[t - 21] / s.c[t - 252] - 1, mom6: s.c[t] / s.c[t - 126] - 1, mom3: s.c[t] / s.c[t - 63] - 1, prox52: s.c[t] / hi, vol126: Math.sqrt(sr2 / nr - (sr / nr) ** 2), logTV: Math.log(tv), tvTrend: tv / tvOld, price: s.c[t],
      deliv: ndv >= 30 ? dv / ndv : NaN, range40: (m40hi - m40lo) / m40hi, udVol: dn > 0 ? up / dn : NaN, age: t - (firstIdx.get(sym) ?? 0), dist200: s.c[t] / (s200 / n200) - 1, fromLow: s.c[t] / lo - 1, ...(FUND ? fund(sym, dates[t]) : {}) };
    let mx = 0; for (let k = t + 1; k <= t + 756; k++) if (s.c[k] > mx) mx = s.c[k];
    let c12 = NaN; for (let k = t + 252; k > t + 200; k--) if (s.c[k] > 0) { c12 = s.c[k] / s.c[t] - 1; break; }
    U.push({ sym, t, y: dates[t].slice(0, 4), f, a: mx / s.c[t] >= 3, b: mx / s.c[t] >= 5, c: c12 });
  }
  if (U.length < 150) continue;
  for (const name of NAMES) { const v = U.map((u, i) => [u.f[name], i]).filter((x) => Number.isFinite(x[0])).sort((a, b) => a[0] - b[0]); v.forEach(([, i], r) => { U[i][name + '_p'] = r / v.length; }); }
  rows.push(...U);
}
const med = (a) => { const x = a.filter(Number.isFinite).sort((p, q) => p - q); return x.length ? x[x.length >> 1] : NaN; }, mean = (a) => { const x = a.filter(Number.isFinite); return x.length ? x.reduce((p, q) => p + q, 0) / x.length : NaN; };
const pc = (x) => (Number.isFinite(x) ? (x * 100).toFixed(1) + '%' : 'n/a');
const baseA = rows.filter((r) => r.a).length / rows.length, baseB = rows.filter((r) => r.b).length / rows.length, baseC = med(rows.map((r) => r.c));
const sum = { stockMonths: rows.length, months: monthEnds.length, baseA, baseB, baseCmedian: baseC, baseCmean: mean(rows.map((r) => r.c)) };
const years = [...new Set(rows.map((r) => r.y))].sort();
const table = {};
for (const name of NAMES) {
  const qs = [0, 1, 2, 3, 4].map((q) => rows.filter((r) => r[name + '_p'] >= q / 5 && r[name + '_p'] < (q + 1) / 5)), cell = qs.map((a) => ({ n: a.length, A: a.filter((r) => r.a).length / a.length, B: a.filter((r) => r.b).length / a.length, Cmed: med(a.map((r) => r.c)), Cmean: mean(a.map((r) => r.c)) }));
  const yr = years.map((y) => { const q5 = qs[4].filter((r) => r.y === y), q1 = qs[0].filter((r) => r.y === y), all = rows.filter((r) => r.y === y); return { y, q5A: q5.length ? q5.filter((r) => r.a).length / q5.length : null, q1A: q1.length ? q1.filter((r) => r.a).length / q1.length : null, baseA: all.filter((r) => r.a).length / all.length, q5C: med(q5.map((r) => r.c)), q1C: med(q1.map((r) => r.c)) }; });
  const sub = rows.filter((r) => Number.isFinite(r.f[name])), baseS = sub.filter((r) => r.a).length / sub.length;
  table[name] = { cell, baseS, nSub: sub.length, liftTop: cell[4].A / baseS, liftBot: cell[0].A / baseS, yr };
}
// combined rule
let combo = null;
if (COMBO.length) { const sel = rows.filter((r) => COMBO.every((n, i) => (DIRS[i] > 0 ? r[n + '_p'] >= 0.8 : r[n + '_p'] < 0.2))); combo = { names: COMBO, dirs: DIRS, n: sel.length, A: sel.filter((r) => r.a).length / sel.length, B: sel.filter((r) => r.b).length / sel.length, Cmed: med(sel.map((r) => r.c)), Cmean: mean(sel.map((r) => r.c)), lift: sel.filter((r) => r.a).length / sel.length / baseA, years: years.map((y) => { const s2 = sel.filter((r) => r.y === y), all = rows.filter((r) => r.y === y); return { y, n: s2.length, A: s2.length ? s2.filter((r) => r.a).length / s2.length : null, baseA: all.filter((r) => r.a).length / all.length, Cmed: med(s2.map((r) => r.c)) }; }) }; }
let pf = null;
if (process.argv.includes('--portfolio') && COMBO.length) {
  const bse = {}, nif = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['BSE 500'] ?? {})) if (v?.[3] > 0) bse[d] = v[3]; for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) if (v?.[3] > 0) nif[d] = v[3]; }
  const join = Object.keys(nif).sort().find((d) => bse[d] > 0), kk = bse[join] / nif[join], idxd = {}; for (const d of Object.keys(bse)) if (d < join) idxd[d] = bse[d]; for (const d of Object.keys(nif)) idxd[d] = nif[d] * kk;
  const GATE = arg('gate', 'none'), greenAt = (D) => { const a = ia(D); if (a < 199) return false; let m = 0; for (let i = a - 199; i <= a; i++) m += idxd[ik[i]]; return idxd[ik[a]] > m / 200; };
  const ik = Object.keys(idxd).sort(), ia = (D) => { let lo = 0, hi = ik.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ik[m] <= D) { a = m; lo = m + 1; } else hi = m - 1; } return a; };
  const sel = rows.filter((r) => COMBO.every((n, i) => (DIRS[i] > 0 ? r[n + '_p'] >= 0.8 : r[n + '_p'] < 0.2))), byT = new Map(); for (const r of sel) { if (!byT.has(r.t)) byT.set(r.t, []); byT.get(r.t).push(r); }
  const tEnds = [...byT.keys()].sort((a, b) => a - b); let cash = 1, pos = [], peak = 1, mdd = 0, inv = 0, nd = 0, taken = 0, skipped = 0, d0 = null, d1 = null; const held = new Set();
  const pxAt = (sym, t, from) => { const s2 = series.get(sym); for (let k = t; k >= from; k--) if (s2.c[k] > 0) return s2.c[k]; return NaN; };
  const tStart = tEnds[0] + 1, tStop = Math.min(N - 1, tEnds.at(-1) + 781);
  for (let t = tStart; t <= tStop; t++) {
    for (const p of [...pos]) if (p.xj === t) { cash += p.val * (1 + p.r); held.delete(p.sym); pos.splice(pos.indexOf(p), 1); }
    const mark = () => { let v = cash; for (const p of pos) v += p.val * (pxAt(p.sym, t, p.t) / p.ent); return v; };
    let gateOk = true; if (GATE === 'green' || GATE === 'both') gateOk = gateOk && greenAt(dates[t - 1]); if (GATE === 'dd15' || GATE === 'both') gateOk = gateOk && mark() / peak - 1 > -0.15;
    const todays = !gateOk ? [] : (byT.get(t - 1) ?? []).filter((r) => !held.has(r.sym)).sort((x, y) => y.f.mom6 - x.f.mom6);
    if (todays.length) { const eq0 = mark(); for (const r of todays) { const ent = uniq[t].rows?.[r.sym]?.[2]; if (!(ent > 0)) continue; if (pos.length >= 50) { skipped++; continue; } const val = Math.min(eq0 * 0.02, cash); if (val <= 0) { skipped++; continue; }
      const s2 = series.get(r.sym); let hi = ent, xo = null, j = t; for (; j <= Math.min(N - 2, t + 780); j++) { if (!(s2.c[j] > 0)) continue; if (s2.c[j] > hi) hi = s2.c[j]; if (s2.c[j] <= hi * 0.65) { const o = uniq[j + 1]?.rows?.[r.sym]?.[2]; xo = o > 0 ? o : s2.c[j]; break; } }
      if (xo == null) { let m = Math.min(N - 1, t + 780); while (m > t && !(s2.c[m] > 0)) m--; xo = s2.c[m]; }
      cash -= val; held.add(r.sym); pos.push({ sym: r.sym, t, ent, val, r: xo / ent - 1 - 0.02, xj: Math.min(j + 1, N - 1) }); taken++; } }
    const v = mark(); if (d0 == null) d0 = dates[t]; d1 = dates[t]; peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); inv += 1 - cash / v; nd++; if (t > tEnds.at(-1) + 1 && pos.length === 0) break; pf = { final: v };
  }
  const yrs = (new Date(d1) - new Date(d0)) / 31557600000, b0 = idxd[ik[ia(d0)]], b1 = idxd[ik[ia(d1)]]; let bp = b0, bdd = 0; for (let t = dates.indexOf(d0); t <= dates.indexOf(d1); t++) { const c = idxd[ik[ia(dates[t])]]; bp = Math.max(bp, c); bdd = Math.min(bdd, c / bp - 1); }
  pf = { from: d0, to: d1, final: pf.final, cagr: Math.pow(pf.final, 1 / yrs) - 1, mdd, avgInvested: inv / nd, taken, skipped, bench: Math.pow(b1 / b0, 1 / yrs) - 1, benchMdd: bdd };
}
mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/GROWTH-FACTORS-${TAG}.json`, JSON.stringify({ sum, table, combo }));
let md = `# What do stocks that grow have in common, ${TAG} (${FROM}..${TO})\n\nRule: docs/replay/GROWTH-FACTORS-PREREG.md. ${sum.stockMonths} stock-months over ${sum.months} month-ends. All-stock rate of 3x within 756 sessions ${pc(baseA)}, 5x ${pc(baseB)}, 12-month median return ${pc(baseC)}.\n\n| factor | Q1 3x rate | Q2 | Q3 | Q4 | Q5 | lift Q5 | lift Q1 | rate in covered stocks | stock-months covered | Q1 12m median | Q5 12m median |\n|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const n of NAMES) { const t = table[n]; md += `| ${n} | ${t.cell.map((c) => pc(c.A)).join(' | ')} | ${t.liftTop.toFixed(2)} | ${t.liftBot.toFixed(2)} | ${pc(t.baseS)} | ${t.nSub} | ${pc(t.cell[0].Cmed)} | ${pc(t.cell[4].Cmed)} |\n`; }
md += `\n## Year consistency (Q5 3x rate above all-stock rate / Q1 below)\n\n| factor | ` + years.join(' | ') + ` | years Q5>base | years Q1<base |\n|---|` + years.map(() => '---|').join('') + `---|---|\n`;
for (const n of NAMES) { const y = table[n].yr; md += `| ${n} | ${y.map((r) => (r.q5A == null ? '-' : r.q5A > r.baseA ? 'Q5+' : 'Q5-') + '/' + (r.q1A == null ? '-' : r.q1A < r.baseA ? 'Q1+' : 'Q1-')).join(' | ')} | ${y.filter((r) => r.q5A > r.baseA).length} | ${y.filter((r) => r.q1A < r.baseA).length} |\n`; }
if (combo) md += `\n## Combined rule ${COMBO.map((n, i) => n + (DIRS[i] > 0 ? ' top quintile' : ' bottom quintile')).join(' + ')}\n\n${combo.n} stock-months; 3x rate ${pc(combo.A)} (lift ${combo.lift.toFixed(2)}); 5x ${pc(combo.B)}; 12m median ${pc(combo.Cmed)}, mean ${pc(combo.Cmean)}.\n\n| year | n | 3x rate | all-stock 3x rate | 12m median |\n|---|---|---|---|---|\n` + combo.years.map((y) => `| ${y.y} | ${y.n} | ${pc(y.A)} | ${pc(y.baseA)} | ${pc(y.Cmed)} |`).join('\n') + '\n';
if (pf) md += `\n## Portfolio replay (max 50 names, 2% each, 35% trail, cost 2.0%, gate ${GATE_ARG})\n\n${pf.from} to ${pf.to}: final ${pf.final.toFixed(2)}x, CAGR ${pc(pf.cagr)}, max drawdown ${pc(pf.mdd)}, average invested ${pc(pf.avgInvested)}, ${pf.taken} bought, ${pf.skipped} skipped. Nifty 500: CAGR ${pc(pf.bench)}, max drawdown ${pc(pf.benchMdd)}.\n`;
writeFileSync(`${OUT}/GROWTH-FACTORS-${TAG}.md`, md); console.log(md);
