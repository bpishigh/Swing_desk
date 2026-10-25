// C-109: rank-correlation test of the C-82 risk-aware score on Conservative Hybrid and Balanced Hybrid funds (Direct Growth), each category its own group.
// Writes data/funds/backtest-hybrid.json. Usage: node --max-old-space-size=6000 scripts/fund-hybrid-test.mjs
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { navOn } from '../src/pm/fundscore.ts';
import { scoreRisk, RISK } from '../src/pm/fundrisk.ts';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d), asOf = new Date().toISOString().slice(0, 10);
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const plusYear = (d) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCFullYear(x.getUTCFullYear() + 1); return x.toISOString().slice(0, 10); };
const rank = (v) => { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1][0] === o[i][0]) j++; for (let k = i; k <= j; k++) r[o[k][1]] = (i + j) / 2; i = j + 1; } return r; };
const spearman = (x, y) => { if (x.length < 3) return null; const a = rank(x), b = rank(y), n = a.length, ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n; let c = 0, va = 0, vb = 0; for (let i = 0; i < n; i++) { c += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; } return va && vb ? c / Math.sqrt(va * vb) : null; };
const amfi = J('data/rules/amfi-schemes.json'), SNAP = Date.parse((amfi.asOf ?? asOf) + 'T23:59:59Z');
const ts = (s) => { const [d, m, y] = s.split('-'); return Date.parse(`${d} ${m} ${y} UTC`); };
const recent = (s) => Number.isFinite(ts(s)) && SNAP - ts(s) < 12 * 86400000;
const extraDirect = new Set((J('data/rules/direct-growth-codes.json', { records: [] }).records || []).map((x) => x.code));
const direct = (r) => (/^Direct/i.test(r[5]) && /^Growth/i.test(r[6])) || extraDirect.has(r[0]);
const grp = (cat) => (/conservative hybrid/i.test(cat) ? 'Conservative Hybrid' : /balanced hybrid/i.test(cat) ? 'Balanced Hybrid' : null);
const schemes = amfi.rows.filter((r) => direct(r) && recent(r[8]) && grp(r[4])).map((r) => ({ code: r[0], isin: r[1] !== '-' ? r[1] : r[2], name: r[3], category: r[4] }));
console.log('hybrid schemes', schemes.length);
const series = new Map(); let failed = 0;
async function pool(items, fn, n = 8) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); })); }
await pool(schemes, async (s) => {
  for (let a = 0; a < 3; a++) {
    try { const r = await fetch('https://api.mfapi.in/mf/' + s.code); if (!r.ok) throw new Error('status ' + r.status); const j = await r.json(), m = {}; for (const x of j.data || []) { const [dd, mm, yy] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${yy}-${mm}-${dd}`] = v; } if (Object.keys(m).length) series.set(s.code, m); return; }
    catch { if (a === 2) failed++; else await new Promise((r) => setTimeout(r, 800 * (a + 1))); }
  }
});
const broken = (m) => { const d = Object.keys(m).sort(); for (let i = 1; i < d.length; i++) { const r = m[d[i]] / m[d[i - 1]]; if (r > 1.4 || r < 0.6) return d[i]; } return null; };
for (const [k, m] of [...series]) if (broken(m)) series.delete(k);
console.log('fetched', series.size, 'of', schemes.length, 'failed', failed);
if (series.size < schemes.length * 0.8) { console.error('too many fetch failures; no result written'); process.exit(1); }
const navDates = new Map(); for (const [k, m] of series) navDates.set(k, Object.keys(m).sort());
const BAR = { firstYear: 2015, lastYear: 2025, minScored: 10, passShare: 0.6, minYears: 5, minPeers: 5 }, years = [];
for (let y = BAR.firstYear; y <= BAR.lastYear; y++) {
  const T = `${y}-10-01`, E = plusYear(T), cut = new Map();
  for (const s of schemes) { const nav = series.get(s.code); if (!nav) continue; const d = navDates.get(s.code); if (d[0] > T) continue; const o = {}; for (const x of d) { if (x > T) break; o[x] = nav[x]; } cut.set(s.code, o); }
  const sc = scoreRisk(schemes.filter((s) => cut.has(s.code)), cut, T, (x) => grp(x.category), new Map(), () => BAR.minPeers, () => false).filter((r) => r.score != null);
  const fwd = new Map(); for (const r of sc) { const d = navDates.get(r.code), nav = series.get(r.code), a = navOn(d, nav, T), b = navOn(d, nav, E); if (a && b && a > 0) fwd.set(r.code, b / a - 1); }
  const by = new Map(); for (const r of sc) if (fwd.has(r.code)) (by.get(grp(r.category) ?? r.cat) ?? by.set(grp(r.category) ?? r.cat, []).get(grp(r.category) ?? r.cat)).push(fwd.get(r.code));
  const med = new Map([...by].map(([k, v]) => [k, median(v)])), use = sc.filter((r) => fwd.has(r.code)), key = (r) => grp(r.category) ?? r.cat;
  const rho = use.length >= 3 ? spearman(use.map((r) => r.score), use.map((r) => fwd.get(r.code) - med.get(key(r)))) : null;
  years.push({ date: T, scored: use.length, rho: rho === null ? null : +rho.toFixed(3), counted: use.length >= BAR.minScored && rho !== null, pass: use.length >= BAR.minScored && rho !== null && rho > 0 });
}
const c = years.filter((y) => y.counted), p = c.filter((y) => y.pass), mean = c.length ? c.reduce((s, y) => s + y.rho, 0) / c.length : null;
const res = { ranOn: asOf, rule: 'C-109', bar: BAR, years, counted: c.length, passed: p.length, meanRho: mean === null ? null : +mean.toFixed(3), testable: c.length >= BAR.minYears, pass: c.length >= BAR.minYears && p.length / c.length >= BAR.passShare && mean > 0 };
mkdirSync('data/funds', { recursive: true }); writeFileSync('data/funds/backtest-hybrid.json', JSON.stringify(res) + '\n');
console.log('C-109', JSON.stringify({ counted: res.counted, passed: res.passed, meanRho: res.meanRho, testable: res.testable, pass: res.pass, years: years.map((y) => [y.date.slice(0, 4), y.scored, y.rho]) }));
