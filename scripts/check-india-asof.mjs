// Leak check for the India as-of view: resolve on the full history once, and on data truncated at night t; the factors dated up to the previous session must be identical.
// Usage: node --max-old-space-size=6000 scripts/check-india-asof.mjs [--nights=12]
import { readFileSync, readdirSync, existsSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { resolveHistory } from '../src/backtest/india-asof.ts';
const N = Number((process.argv.find((a) => a.startsWith('--nights=')) || '--nights=12').slice(9));
const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => x.endsWith('.json')).sort()) bhav.push(JSON.parse(readFileSync('data/india/bhav/' + f)));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const actions = [...JSON.parse(readFileSync('data/india/corp-actions-history.json')), ...(existsSync('data/india/corp-actions.json') ? JSON.parse(readFileSync('data/india/corp-actions.json')) : [])];
const ov = existsSync('data/india/corp-action-overrides.json') ? JSON.parse(readFileSync('data/india/corp-action-overrides.json')) : {};
const full = resolveHistory(bhav, actions, ov);
console.log('full', JSON.stringify(full.counts));
let seed = 20261017; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const nights = [...new Set(Array.from({ length: N }, () => 250 + Math.floor(rnd() * (bhav.length - 251))))].sort((a, b) => a - b);
let bad = 0;
for (const t of nights) {
  const part = resolveHistory(bhav.slice(0, t + 1), actions, ov);
  const lim = bhav[t - 1].date;
  const key = (r) => r.splits.filter((s) => s[1] <= lim).map((s) => s.join('|')).sort().join(';');
  const dkey = (r) => r.dropped.filter((d) => d.date <= lim).map((d) => d.symbol + '|' + d.date).sort().join(';');
  const same = key(full) === key(part) && dkey(full) === dkey(part);
  console.log(bhav[t].date, same ? 'same' : 'DIFFERENT', part.splits.filter((s) => s[1] <= lim).length, 'factors known');
  if (!same) bad++;
}
console.log(bad ? `FAIL: ${bad} night(s) differ` : `PASS: ${nights.length} nights identical`); process.exit(bad ? 1 : 0);
