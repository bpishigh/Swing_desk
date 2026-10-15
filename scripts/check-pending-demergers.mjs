// Checks each pending demerger record against the stored closes: the move across the ex-date should match 1/(1-costPct).
import { readFileSync } from 'node:fs';
const dir = 'site/pm-data/prices/'; const months = JSON.parse(readFileSync(dir + 'index.json', 'utf8'));
const dates = [], px = {};
for (const m of months) { const c = JSON.parse(readFileSync(dir + m + '.json', 'utf8')); const base = dates.length; dates.push(...c.dates); for (const [s, a] of Object.entries(c.px)) { const arr = (px[s] ??= []); while (arr.length < base) arr.push(null); arr.push(...a); } }
const recs = JSON.parse(readFileSync('data/rules/demergers-pending.json', 'utf8')).records;
for (const r of recs) {
  const a = px[r.parent]; const i = dates.findIndex((d) => d >= r.exDate);
  if (!a || i < 1 || a[i] == null || a[i - 1] == null) { console.log(r.parent, 'no price pair'); continue; }
  const exp = 1 - r.costPct, obs = a[i] / a[i - 1], dev = Math.abs(Math.log(obs / exp));
  const tol = Math.min(Math.log(1.25), 0.5 * Math.log(1 / exp));
  console.log(r.parent.padEnd(11), r.exDate, 'expected', exp.toFixed(3), 'observed', obs.toFixed(3), dev <= tol ? 'ACCEPTED' : 'REJECTED by price check', '(tolerance ±' + (Math.exp(tol) - 1).toFixed(3) + ')');
}
