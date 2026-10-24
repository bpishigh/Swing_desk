// Is the stock-trend signal itself predictive? (Engine Rules C-106). No funds, no network: stored closes only. Writes data/funds/backtest-stocktrend.json.
// Usage: node --max-old-space-size=4000 scripts/stock-trend-test.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const byDay = {};
for (const f of readdirSync('data/india/prices-hist').filter((x) => /^\d{4}-\d\d\.json$/.test(x)).sort()) { const c = J('data/india/prices-hist/' + f); c.dates.forEach((d, i) => { const o = (byDay[d] ??= {}); for (const [s, a] of Object.entries(c.px)) if (a[i] != null) o[s] = a[i]; }); }
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) { const o = (byDay[f.slice(0, 10)] ??= {}); for (const [s, r] of Object.entries(J('data/india/bhav/' + f).rows)) if (r[5] != null) o[s] = r[5]; }
const dates = Object.keys(byDay).sort(), last = dates[dates.length - 1], universe = J('data/india/nifty500.json').symbols;
const syms = (Array.isArray(universe) ? universe : Object.keys(universe)).filter((s) => dates.some((d) => byDay[d][s] != null));
const closes = new Map(syms.map((s) => [s, dates.map((d) => byDay[d][s] ?? null)]));
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000), addM = (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCMonth(x.getUTCMonth() + n); return x.toISOString().slice(0, 10); };
const idxOn = (d) => { let lo = 0, hi = dates.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] <= d) { a = m; lo = m + 1; } else hi = m - 1; } return a; };
const broken = (c, from, to) => { for (let i = Math.max(1, from); i <= to; i++) { const a = c[i - 1], b = c[i]; if (a && b) { const r = b / a - 1; if (r < -0.4 || r > 0.6) return true; } } return false; };
const avg = (c, i, n) => { let s = 0; for (let k = i - n + 1; k <= i; k++) { if (!(c[k] > 0)) return null; s += c[k]; } return s / n; };
const TS = []; for (let y = 2022; y <= 2026; y++) for (const m of ['01-01', '04-01', '07-01', '10-01']) { const t = `${y}-${m}`; if (t >= '2022-07-01' && t <= last) TS.push(t); }
const H = [3, 6, 12], out = { ranOn: new Date().toISOString().slice(0, 10), rule: 'C-106', universe: syms.length, dates: TS.length, variants: {} };
const variants = { trend50_200: (c, i) => { const a = avg(c, i, 50), b = avg(c, i, 200); return a === null || b === null ? null : a > b; }, above200: (c, i) => { const b = avg(c, i, 200); return b === null || !(c[i] > 0) ? null : c[i] > b; } };
for (const [name, rule] of Object.entries(variants)) {
  out.variants[name] = {};
  for (const h of H) {
    const pts = [];
    for (const T of TS) {
      const E = addM(T, h); if (E > last) continue; const i = idxOn(T), j = idxOn(E); if (i < 205 || j <= i) continue;
      const yes = [], no = [];
      for (const [s, c] of closes) {
        const a = c[i], b = c[j]; if (!(a > 0 && b > 0) || days(dates[i], T) > 7 || days(dates[j], E) > 7) continue;
        if (broken(c, i - 300, j)) continue; const t = rule(c, i); if (t === null) continue; (t ? yes : no).push((b / a - 1) * 100);
      }
      const ok = yes.length >= 50 && no.length >= 50; pts.push({ date: T, nTrend: yes.length, nNot: no.length, medTrend: ok ? +median(yes).toFixed(2) : null, medNot: ok ? +median(no).toFixed(2) : null, diff: ok ? +(median(yes) - median(no)).toFixed(2) : null, counted: ok, pass: ok && median(yes) > median(no) });
    }
    const c = pts.filter((p) => p.counted), pass = c.filter((p) => p.pass).length, mean = c.length ? c.reduce((s, p) => s + p.diff, 0) / c.length : null;
    out.variants[name][h] = { points: pts, counted: c.length, passed: pass, meanDiff: mean === null ? null : +mean.toFixed(2), pass: c.length >= 6 && pass / c.length >= 0.6 && mean > 0 };
  }
}
// information only: top third by 126-session return
out.variants.top3rd126 = {};
for (const h of H) {
  const pts = [];
  for (const T of TS) {
    const E = addM(T, h); if (E > last) continue; const i = idxOn(T), j = idxOn(E); if (i < 205 || j <= i) continue;
    const rows = [];
    for (const [s, c] of closes) { const a = c[i], b = c[j], p = c[i - 126]; if (!(a > 0 && b > 0 && p > 0) || days(dates[i], T) > 7 || days(dates[j], E) > 7 || broken(c, i - 300, j)) continue; rows.push({ m: a / p, f: (b / a - 1) * 100 }); }
    rows.sort((x, y) => y.m - x.m); const k = Math.floor(rows.length / 3), top = rows.slice(0, k).map((r) => r.f), rest = rows.slice(k).map((r) => r.f), ok = top.length >= 50;
    pts.push({ date: T, nTop: top.length, diff: ok ? +(median(top) - median(rest)).toFixed(2) : null, counted: ok, pass: ok && median(top) > median(rest) });
  }
  const c = pts.filter((p) => p.counted), pass = c.filter((p) => p.pass).length, mean = c.length ? c.reduce((s, p) => s + p.diff, 0) / c.length : null;
  out.variants.top3rd126[h] = { points: pts, counted: c.length, passed: pass, meanDiff: mean === null ? null : +mean.toFixed(2), pass: c.length >= 6 && pass / c.length >= 0.6 && mean > 0 };
}
writeFileSync('data/funds/backtest-stocktrend.json', JSON.stringify(out) + '\n');
for (const [n, v] of Object.entries(out.variants)) for (const h of H) { const r = v[h]; console.log(n.padEnd(12), h + 'm', 'counted', r.counted, 'passed', r.passed, 'mean diff', r.meanDiff, r.pass ? 'PASS' : 'fail', JSON.stringify(r.points.map((p) => p.diff))); }
console.log('universe', syms.length, 'dates', TS.join(' '));
