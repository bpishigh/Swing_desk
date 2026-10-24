// The swing desk's trend rules read on mutual fund NAVs (Engine Rules C-107): Test 1 the trend template, Test 2 the Exit state (NAV below its 200-session average or last swing low).
// Fetches NAV history for Direct-Growth plain-equity and thematic funds, writes data/funds/backtest-swingrules.json. Usage: node scripts/fund-swingrules-test.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { normCategory } from '../src/pm/fundscore.ts';
import { themeOf } from '../src/pm/fundtheme.ts';
import { sma, swingLow } from '../src/pm/verdict.ts';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d), asOf = new Date().toISOString().slice(0, 10);
const amfi = J('data/rules/amfi-schemes.json'), SNAP = Date.parse((amfi.asOf ?? asOf) + 'T23:59:59Z');
if (Date.now() - SNAP > 35 * 86400000) { console.error('AMFI scheme list is more than 35 days old: refresh it first'); process.exit(1); }
const ts = (s) => { const [d, m, y] = s.split('-'); return Date.parse(`${d} ${m} ${y} UTC`); }, recent = (s) => Number.isFinite(ts(s)) && SNAP - ts(s) < 12 * 86400000;
const extraDirect = new Set((J('data/rules/direct-growth-codes.json', { records: [] }).records || []).map((x) => x.code));
const direct = (r) => (/^Direct/i.test(r[5]) && /^Growth/i.test(r[6])) || extraDirect.has(r[0]);
const EQ = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
const funds = [];
for (const r of amfi.rows) { if (!direct(r) || !recent(r[8])) continue; const c = normCategory(r[4]); if (EQ.has(c)) funds.push({ code: r[0], name: r[3], pop: 'equity', group: c }); else if (c === 'Sectoral/Thematic') { const t = themeOf(r[3]); if (t) funds.push({ code: r[0], name: r[3], pop: 'thematic', group: 'Thematic · ' + t }); } }
console.log('funds', funds.length, 'equity', funds.filter((f) => f.pop === 'equity').length, 'thematic', funds.filter((f) => f.pop === 'thematic').length);
const nav = new Map(); let failed = 0;
async function pool(items, fn, n = 8) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
await pool(funds, async (f) => {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch('https://api.mfapi.in/mf/' + f.code); if (!r.ok) throw new Error('status ' + r.status); const j = await r.json(), m = []; for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'), v = Number(x.nav); if (v > 0) m.push([`${yy}-${mm}-${dd}`, v]); } m.sort((p, q) => (p[0] < q[0] ? -1 : 1)); if (m.length) nav.set(f.code, { d: m.map((x) => x[0]), v: m.map((x) => x[1]) }); return; }
    catch { if (a === 2) failed++; else await new Promise((r) => setTimeout(r, 800 * (a + 1))); }
  }
}, 8);
for (const [k, s] of [...nav]) { let bad = false; for (let i = 1; i < s.v.length; i++) { const r = s.v[i] / s.v[i - 1]; if (r > 1.4 || r < 0.6) { bad = true; break; } } if (bad) nav.delete(k); }
console.log('fetched', nav.size, 'of', funds.length, 'failed', failed);
if (nav.size < funds.length * 0.8) { console.error('too many fetch failures; no result written'); process.exit(1); }
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const addM = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); }, day = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const idxOn = (d, T) => { let lo = 0, hi = d.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (d[m] <= T) { a = m; lo = m + 1; } else hi = m - 1; } return a >= 0 && day(d[a], T) <= 7 ? a : -1; };
const avg = (v, i, n) => { if (i - n + 1 < 0) return null; let s = 0; for (let k = i - n + 1; k <= i; k++) s += v[k]; return s / n; };
const lastNav = [...nav.values()].map((s) => s.d[s.d.length - 1]).sort().pop(), TS = []; for (let y = 2016; y <= 2026; y++) for (const m of ['01-01', '04-01', '07-01', '10-01']) TS.push(`${y}-${m}`);
const H = [3, 6, 12];
function classify(s, i) {
  const v = s.v, p = v[i], s50 = avg(v, i, 50), s150 = avg(v, i, 150), s200 = avg(v, i, 200), s200b = avg(v, i - 21, 200); if (s200 === null || s200b === null) return null;
  let lo = Infinity, hi = -Infinity; for (let k = i - 251; k <= i; k++) { if (v[k] < lo) lo = v[k]; if (v[k] > hi) hi = v[k]; }
  const tmpl = p > s150 && p > s200 && s150 > s200 && s200 > s200b && s50 > s150 && s50 > s200 && p > s50 && p >= 1.3 * lo && p >= 0.75 * hi;
  const sl = swingLow(s.d.slice(0, i + 1), v.slice(0, i + 1)), exit = p < s200 || (sl !== null && p < sl.price);
  return { tmpl, exit, above200: p > s200, cross: s50 > s200, mom: p / v[i - 126] - 1 };
}
const meta = new Map(funds.map((f) => [f.code, f])), out = { ranOn: asOf, rule: 'C-107', funds: nav.size, tests: {} };
const stat = (pts, minN) => { const c = pts.filter((p) => p.counted), pass = c.filter((p) => p.pass).length, mean = c.length ? c.reduce((s, p) => s + p.diff, 0) / c.length : null, oct = pts.filter((p) => p.date.endsWith('-10-01') && p.counted), octPos = oct.filter((p) => p.diff > 0).length; return { counted: c.length, passed: pass, meanDiff: mean === null ? null : +mean.toFixed(2), octDates: oct.length, octPositive: octPos, pass: c.length >= 20 && pass / c.length >= 0.6 && mean > 0 && octPos >= 6, points: pts }; };
for (const h of H) {
  const t1 = { all: [], equity: [], thematic: [] }, t2 = { equity: [], thematic: [] }, info = { above200: [], cross: [], mom3: [] };
  for (const T of TS) {
    const E = addM(T, h); if (E > addM(lastNav, 0)) continue;
    const rows = [];
    for (const [code, s] of nav) { const i = idxOn(s.d, T), j = idxOn(s.d, E); if (i < 259 || j <= i) continue; const c = classify(s, i); if (!c) continue; rows.push({ code, group: meta.get(code).group, pop: meta.get(code).pop, fwd: (s.v[j] / s.v[i] - 1) * 100, ...c }); }
    const gm = new Map(); for (const r of rows) (gm.get(r.group) ?? gm.set(r.group, []).get(r.group)).push(r.fwd);
    const med = new Map([...gm].filter(([, v]) => v.length >= 5).map(([k, v]) => [k, median(v)])); const ok = rows.filter((r) => med.has(r.group)); for (const r of ok) r.ex = r.fwd - med.get(r.group);
    const topThird = new Set(); for (const [g] of med) { const m = ok.filter((r) => r.group === g).sort((a, b) => b.mom - a.mom); m.slice(0, Math.floor(m.length / 3)).forEach((r) => topThird.add(r.code)); }
    const one = (pts, T, sel, pops) => { const a = ok.filter((r) => pops.includes(r.pop) && sel(r)); const counted = a.length >= 10; pts.push({ date: T, n: a.length, diff: counted ? +median(a.map((r) => r.ex)).toFixed(2) : null, counted, pass: counted && median(a.map((r) => r.ex)) > 0 }); };
    one(t1.all, T, (r) => r.tmpl, ['equity', 'thematic']); one(t1.equity, T, (r) => r.tmpl, ['equity']); one(t1.thematic, T, (r) => r.tmpl, ['thematic']);
    one(info.above200, T, (r) => r.above200, ['equity', 'thematic']); one(info.cross, T, (r) => r.cross, ['equity', 'thematic']); one(info.mom3, T, (r) => topThird.has(r.code), ['equity', 'thematic']);
    for (const pop of ['equity', 'thematic']) { const keep = ok.filter((r) => r.pop === pop && !r.exit), ex = ok.filter((r) => r.pop === pop && r.exit), counted = keep.length >= 10 && ex.length >= 10; const d = counted ? median(keep.map((r) => r.ex)) - median(ex.map((r) => r.ex)) : null; t2[pop].push({ date: T, nKeep: keep.length, nExit: ex.length, diff: d === null ? null : +d.toFixed(2), counted, pass: counted && d > 0 }); }
  }
  out.tests[h] = { test1: Object.fromEntries(Object.entries(t1).map(([k, v]) => [k, stat(v)])), test2: Object.fromEntries(Object.entries(t2).map(([k, v]) => [k, stat(v)])), info: Object.fromEntries(Object.entries(info).map(([k, v]) => [k, stat(v)])) };
}
writeFileSync('data/funds/backtest-swingrules.json', JSON.stringify(out) + '\n');
const line = (n, r) => console.log(n.padEnd(34), 'counted', r.counted, 'passed', r.passed, 'mean', r.meanDiff, 'oct+', r.octPositive + '/' + r.octDates, r.pass ? 'PASS' : 'fail');
for (const h of H) { console.log('--', h + ' months'); for (const [k, r] of Object.entries(out.tests[h].test1)) line('T1 template ' + k, r); for (const [k, r] of Object.entries(out.tests[h].test2)) line('T2 keep-exit ' + k, r); for (const [k, r] of Object.entries(out.tests[h].info)) line('info ' + k, r); }
