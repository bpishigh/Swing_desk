// C-118 support: how closely does BSE 500 stand in for Nifty 500 in the regime test (close at or above the 200-session average)? Uses the sessions where both exist.
// Writes data/replay/c118-index-proxy.json: agreement of the on/off flag overall and by year, flips, and the correlation of daily returns. Usage: node scripts/check-index-proxy.mjs
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
const D = 'data/india/idx-hist/', nifty = {}, bse = {};
for (const f of readdirSync(D).filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) {
  const o = JSON.parse(readFileSync(D + f, 'utf8'));
  for (const [d, v] of Object.entries(o['Nifty 500'] ?? {})) nifty[d] = v[3];
  for (const [d, v] of Object.entries(o['BSE 500'] ?? {})) bse[d] = v[3];
}
// only sessions on which BOTH have a close, in date order (the 200-session window is counted on this common list)
const dates = Object.keys(nifty).filter((d) => d in bse).sort();
const N = dates.map((d) => nifty[d]), B = dates.map((d) => bse[d]);
const flag = (a, i) => { if (i < 199) return null; let s = 0; for (let k = i - 199; k <= i; k++) s += a[k]; return a[i] >= s / 200; };
let agree = 0, tot = 0, flipsN = 0, flipsB = 0; const byYear = {}; let prevN = null, prevB = null;
for (let i = 199; i < dates.length; i++) {
  const n = flag(N, i), b = flag(B, i), y = dates[i].slice(0, 4); (byYear[y] ??= { agree: 0, n: 0, niftyOn: 0 });
  tot++; byYear[y].n++; if (n === b) { agree++; byYear[y].agree++; } if (n) byYear[y].niftyOn++;
  if (prevN !== null && n !== prevN) flipsN++; if (prevB !== null && b !== prevB) flipsB++; prevN = n; prevB = b;
}
const rn = [], rb = []; for (let i = 1; i < dates.length; i++) { rn.push(N[i] / N[i - 1] - 1); rb.push(B[i] / B[i - 1] - 1); }
const mean = (x) => x.reduce((a, b) => a + b, 0) / x.length, mn = mean(rn), mb = mean(rb);
const corr = rn.reduce((s, v, i) => s + (v - mn) * (rb[i] - mb), 0) / Math.sqrt(rn.reduce((s, v) => s + (v - mn) ** 2, 0) * rb.reduce((s, v) => s + (v - mb) ** 2, 0));
const out = { commonSessions: dates.length, first: dates[0], last: dates[dates.length - 1], flagDays: tot, agreement: +(agree / tot).toFixed(4), flipsNifty500: flipsN, flipsBSE500: flipsB, dailyReturnCorrelation: +corr.toFixed(4),
  byYear: Object.fromEntries(Object.entries(byYear).map(([y, o]) => [y, { days: o.n, agreement: +(o.agree / o.n).toFixed(3), niftyOnShare: +(o.niftyOn / o.n).toFixed(3) }])) };
mkdirSync('data/replay', { recursive: true }); writeFileSync('data/replay/c118-index-proxy.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out));
