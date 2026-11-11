// US stop feasibility (prerequisite of the US first-wave rules, 11 Nov 2026): how often is 3 x ATR(20) wider than 8% of price on the US universe? DESCRIPTIVE ONLY, no edge claim, run once, no tuning.
// Same measure as scripts/stop-feasibility.mjs (India): close-to-close ATR proxy, every 20th session, tiers by dollar-volume rank, plus how often an 8% trailing stop is hit within 20 sessions of entry.
// The store holds only companies listed today (survivor bias), which flatters volatility a little; stated, not corrected. Usage: node --max-old-space-size=7000 scripts/stop-feasibility-us.mjs -> data/us-stop-feasibility.json
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { eligibleUs } from '../src/engine/momentum-sleeve.ts';
import { loadDays } from './us-hist-lib.mjs';
const R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const tf = readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop(), tk = R('data/us/' + tf), allowed = new Set(tk.rows.filter(([, ty]) => ty === 'CS' || ty === 'ADRC').map(([s]) => s));
const days = loadDays().map((d) => ({ date: d.date, rows: d.rows.filter((r) => allowed.has(r[0])) })), dates = days.map((d) => d.date), N = days.length;
const FH = buildHistories(days, [], allowed), series = FH.series;
const q = (a, p) => { const s = [...a].filter((x) => x === x).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const pct = (x) => (x == null ? null : +(x * 100).toFixed(1));
const atrp = (c, i) => { let a = 0, n = 0; for (let j = i - 19; j <= i; j++) if (c[j] > 0 && c[j - 1] > 0) { a += Math.abs(c[j] - c[j - 1]); n++; } return n >= 16 ? a / n / c[i] : NaN; };
const hit = (c, e, H, d) => { let hi = c[e]; for (let j = e + 1; j <= Math.min(N - 1, e + H); j++) { if (c[j] > hi) hi = c[j]; if (c[j] > 0 && c[j] <= hi * (1 - d)) return j - e; } return 0; };
const tiers = ['top100', 'rank101-200', 'all']; const A = Object.fromEntries(tiers.map((t) => [t, { n: 0, w8: 0, w5: 0, atr: [], hit8in20: 0 }])), byYear = {};
for (let i = 300; i < N - 21; i += 20) {
  const el = eligibleUs(series, i).slice(0, 200);
  el.forEach((x, k) => {
    const c = series.get(x.sym).c, a = atrp(c, i); if (!(a > 0)) return; const e = i + 1; if (!(c[e] > 0)) return; const y = dates[i].slice(0, 4), t = k < 100 ? 'top100' : 'rank101-200';
    byYear[y] ??= { n: 0, w8: 0 }; byYear[y].n++; if (3 * a > 0.08) byYear[y].w8++;
    for (const key of [t, 'all']) { const z = A[key]; z.n++; z.atr.push(3 * a); if (3 * a > 0.08) z.w8++; if (3 * a > 0.05) z.w5++; if (hit(c, e, 20, 0.08) > 0) z.hit8in20++; }
  });
}
const out = { generated: new Date().toISOString(), data: { sessions: N, first: dates[0], last: dates.at(-1) }, note: 'Descriptive, no edge claim. Close-to-close ATR proxy (as the India run); US store holds companies listed today only (survivor bias, not corrected); prices split-adjusted by Nasdaq, no dividends.',
  atrFeasibility: Object.fromEntries(tiers.map((t) => [t, { observations: A[t].n, share3xATRabove8pct: pct(A[t].w8 / A[t].n), share3xATRabove5pct: pct(A[t].w5 / A[t].n), median3xATRpct: pct(q(A[t].atr, 0.5)), p75: pct(q(A[t].atr, 0.75)), p90: pct(q(A[t].atr, 0.9)), share8pctTrailingStopHitWithin20Sessions: pct(A[t].hit8in20 / A[t].n) }])),
  byYear: Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, { n: v.n, share3xATRabove8pct: pct(v.w8 / v.n) }])) };
writeFileSync('data/us-stop-feasibility.json', JSON.stringify(out, null, 1) + '\n'); console.log(JSON.stringify(out.atrFeasibility));
