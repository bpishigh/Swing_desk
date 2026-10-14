// Builds the browser side of the Portfolio Manager: strips types from src/pm/*.ts into site/pm/*.js and copies the PUBLIC data it needs into site/pm-data/.
// No personal data is ever read or written here. Run by build-site.mjs and on its own.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

mkdirSync('site/pm', { recursive: true }); mkdirSync('site/pm-data', { recursive: true });
const put = (p, s) => { if (!existsSync(p) || readFileSync(p, 'utf8') !== s) writeFileSync(p, s); };
for (const f of readdirSync('src/pm').filter((x) => x.endsWith('.ts'))) {
  const js = stripTypeScriptTypes(readFileSync(`src/pm/${f}`, 'utf8'), { mode: 'strip' }).replace(/(from\s+['"]\.\/[\w-]+)\.ts(['"])/g, '$1.js$2');
  put(`site/pm/${f.replace(/\.ts$/, '.js')}`, js);
}
const cp = (a, b) => { if (!existsSync(b) || !readFileSync(a).equals(readFileSync(b))) copyFileSync(a, b); };
for (const f of ['charges', 'tax', 'dividend', 'demergers', 'ipos', 'fund-overrides', 'amfi-schemes']) cp(`data/rules/${f}.json`, `site/pm-data/${f}.json`);
cp('data/india/corp-actions-history.json', 'site/pm-data/corp-actions-history.json');
const bf = readdirSync('data/india/bhav').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop();
const bhav = JSON.parse(readFileSync('data/india/bhav/' + bf, 'utf8'));
const prices = {}; for (const [s, r] of Object.entries(bhav.rows)) if (r[5] != null) prices[s] = r[5];
put('site/pm-data/prices.json', JSON.stringify({ asOf: bf.slice(0, 10), prices }) + '\n');
// stored daily closes for the valuation chart (public data), one file per month so closed months never change in git.
// Older months come from data/india/prices-hist (closes only, back-filled by the manual workflow); the main daily store wins where both have a day.
const byDay = {};                                           // date -> { symbol: close }
const histDir = 'data/india/prices-hist';
if (existsSync(histDir)) for (const f of readdirSync(histDir).filter((x) => /^\d{4}-\d\d\.json$/.test(x))) { const c = JSON.parse(readFileSync(`${histDir}/${f}`, 'utf8')); c.dates.forEach((d, i) => { const o = (byDay[d] = {}); for (const [sym, a] of Object.entries(c.px)) if (a[i] != null) o[sym] = a[i]; }); }
const days = readdirSync('data/india/bhav').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
for (const f of days) { const o = (byDay[f.slice(0, 10)] = {}); for (const [sym, r] of Object.entries(JSON.parse(readFileSync('data/india/bhav/' + f, 'utf8')).rows)) if (r[5] != null) o[sym] = r[5]; }
const months = {};
for (const d of Object.keys(byDay).sort()) { const c = (months[d.slice(0, 7)] ??= { dates: [], px: {} }); const i = c.dates.length; c.dates.push(d); for (const [sym, v] of Object.entries(byDay[d])) (c.px[sym] ??= [])[i] = v; }
mkdirSync('site/pm-data/prices', { recursive: true });
for (const [m, c] of Object.entries(months)) { for (const a of Object.values(c.px)) for (let i = 0; i < c.dates.length; i++) if (a[i] === undefined) a[i] = null; put(`site/pm-data/prices/${m}.json`, JSON.stringify(c) + '\n'); }
put('site/pm-data/prices/index.json', JSON.stringify(Object.keys(months)) + '\n');
console.log('site/pm built; prices as of', bf.slice(0, 10), Object.keys(prices).length, 'symbols');
