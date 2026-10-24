// Forward test of the holdings-health reading (Engine Rules C-101). For each monthly snapshot in data/funds/holdhealth-log.json whose horizon has passed, compares the forward NAV return of the
// Strong and Weak bands with the category median (Test A: Strong beats it, Test B: Weak trails it). 12 months decides; 3 and 6 months are information only.
// Writes data/funds/holdhealth-test.json. Usage: node scripts/holdhealth-test.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { navOn, addDays } from '../src/pm/fundscore.ts';
const log = JSON.parse(readFileSync('data/funds/holdhealth-log.json', 'utf8')), BAR = { passShare: 0.6, minMonths: 6, minGroup: 10 };
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const plusMonths = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const today = new Date().toISOString().slice(0, 10), navs = new Map();
async function nav(code) { if (navs.has(code)) return navs.get(code); let m = null; for (let a = 0; a < 3 && !m; a++) { try { const r = await fetch('https://api.mfapi.in/mf/' + code); if (r.ok) { m = {}; for (const x of (await r.json()).data || []) { const [d, mo, y] = x.date.split('-'); const v = Number(x.nav); if (v > 0) m[`${y}-${mo}-${d}`] = v; } } } catch { await new Promise((r) => setTimeout(r, 800)); } } const d = m ? Object.keys(m).sort() : []; navs.set(code, m ? { m, d } : null); return navs.get(code); }
const out = { ranOn: today, rule: 'C-101', bar: BAR, horizons: {} };
for (const H of [3, 6, 12]) {
  const months = [];
  for (const [mon, snap] of Object.entries(log.months)) {
    const T = snap.priceDate, E = plusMonths(T, H); if (E > addDays(today, -7)) continue;   // horizon not yet passed
    const codes = Object.keys(snap.funds).filter((c) => snap.funds[c].band), fwd = new Map();
    for (const c of codes) { const n = await nav(c); if (!n) continue; const a = navOn(n.d, n.m, T), b = navOn(n.d, n.m, E); if (a && b) fwd.set(c, b / a - 1); }
    const med = new Map(), by = new Map(); for (const c of fwd.keys()) { const k = snap.funds[c].cat; (by.get(k) ?? by.set(k, []).get(k)).push(fwd.get(c)); } for (const [k, v] of by) med.set(k, median(v));
    const ex = (band) => codes.filter((c) => snap.funds[c].band === band && fwd.has(c)).map((c) => (fwd.get(c) - med.get(snap.funds[c].cat)) * 100);
    const A = ex('Strong'), B = ex('Weak'), mA = A.length ? median(A) : null, mB = B.length ? median(B) : null;
    months.push({ month: mon, nStrong: A.length, nWeak: B.length, medExcessStrong: mA, medExcessWeak: mB, countedA: A.length >= BAR.minGroup, countedB: B.length >= BAR.minGroup, passA: A.length >= BAR.minGroup && mA > 0, passB: B.length >= BAR.minGroup && mB < 0 });
  }
  const t = (c, p) => { const counted = months.filter((m) => m[c]).length, passed = months.filter((m) => m[c] && m[p]).length; return { counted, passed, pass: counted >= BAR.minMonths && passed / counted >= BAR.passShare }; };
  out.horizons[H] = { decides: H === 12, months, testA: t('countedA', 'passA'), testB: t('countedB', 'passB') };
}
writeFileSync('data/funds/holdhealth-test.json', JSON.stringify(out) + '\n');
for (const [H, r] of Object.entries(out.horizons)) console.log(H + ' months', r.decides ? '(decides)' : '(information)', JSON.stringify({ A: r.testA, B: r.testB, months: r.months.length }));
