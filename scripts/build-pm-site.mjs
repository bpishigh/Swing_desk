// Builds the browser side of the Portfolio Manager: strips types from src/pm/*.ts into site/pm/*.js and copies the PUBLIC data it needs into site/pm-data/.
// No personal data is ever read or written here. Run by build-site.mjs and on its own.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { computeContext } from '../src/pm/context.ts';

mkdirSync('site/pm', { recursive: true }); mkdirSync('site/pm-data', { recursive: true });
const put = (p, s) => { if (!existsSync(p) || readFileSync(p, 'utf8') !== s) writeFileSync(p, s); };
for (const f of readdirSync('src/pm').filter((x) => x.endsWith('.ts'))) {
  const js = stripTypeScriptTypes(readFileSync(`src/pm/${f}`, 'utf8'), { mode: 'strip' }).replace(/(from\s+['"]\.\/[\w-]+)\.ts(['"])/g, '$1.js$2');
  put(`site/pm/${f.replace(/\.ts$/, '.js')}`, js);
}
const cp = (a, b) => { if (!existsSync(b) || !readFileSync(a).equals(readFileSync(b))) copyFileSync(a, b); };
for (const f of ['charges', 'tax', 'dividend', 'demergers', 'ipos', 'fund-overrides', 'amfi-schemes']) cp(`data/rules/${f}.json`, `site/pm-data/${f}.json`);
cp('data/india/corp-actions-history.json', 'site/pm-data/corp-actions-history.json');
if (existsSync('data/replay/track-record.json')) cp('data/replay/track-record.json', 'site/pm-data/track-record.json');
if (existsSync('data/india/segments.json')) cp('data/india/segments.json', 'site/pm-data/segments.json');
const bf = readdirSync('data/india/bhav').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop();
const bhav = JSON.parse(readFileSync('data/india/bhav/' + bf, 'utf8'));
const prices = {}; for (const [s, r] of Object.entries(bhav.rows)) if (r[5] != null) prices[s] = r[5];
// Next results dates (public NSE board-meeting data) for the held-stock view: the next date on or after the latest stored close, within 70 days.
if (existsSync('data/india/results-dates.json')) {
  const rd = JSON.parse(readFileSync('data/india/results-dates.json', 'utf8')), from = bf.slice(0, 10), lim = new Date(Date.parse(from) + 70 * 864e5).toISOString().slice(0, 10), next = {};
  for (const [sym, ds] of Object.entries(rd.dates || {})) { const d = ds.filter((x) => x >= from && x <= lim).sort()[0]; if (d) next[sym] = d; }
  // Second source (20 Oct 2026): NSE's event calendar for the whole market, refreshed nightly by scan-earnings.mjs. It is fresher than the weekly per-company board-meeting pull, so its date wins
  // where both have one; where they differ the name is listed under `differs` (not shown on the page, kept for checking).
  const differs = {}; let cal = null;
  if (existsSync('data/india/scan/results-calendar.json')) {
    cal = JSON.parse(readFileSync('data/india/scan/results-calendar.json', 'utf8'));
    for (const [sym, d] of Object.entries(cal.dates || {})) { if (d < from || d > lim) continue; if (next[sym] && next[sym] !== d) differs[sym] = [d, next[sym]]; next[sym] = d; }
  }
  put('site/pm-data/results-next.json', JSON.stringify({ asOf: from, fetchedAt: rd.fetchedAt, calendarAsOf: cal?.asOf ?? null, differs, next }) + '\n');
}
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
// context for each stock (trend, relative strength, liquidity, delivery): public data only, never part of a verdict
{
  const dts = [], px = {}; for (const m of Object.keys(months)) { const c = months[m]; const base = dts.length; dts.push(...c.dates); for (const [sym, a] of Object.entries(c.px)) { const arr = (px[sym] ??= []); while (arr.length < base) arr.push(null); arr.push(...a); } }
  for (const sym in px) while (px[sym].length < dts.length) px[sym].push(null);
  const feed = JSON.parse(readFileSync('data/india/corp-actions-history.json', 'utf8'));
  const bh = days.slice(-40).map((f) => ({ date: f.slice(0, 10), rows: JSON.parse(readFileSync('data/india/bhav/' + f, 'utf8')).rows }));
  const ic = existsSync('data/india/idx_closes.json') ? JSON.parse(readFileSync('data/india/idx_closes.json', 'utf8')).closes?.['Nifty 500'] : null;
  const idx = ic ? { dates: Object.keys(ic).sort(), closes: Object.keys(ic).sort().map((d) => ic[d]) } : null;
  const dem = JSON.parse(readFileSync('data/rules/demergers.json', 'utf8')).records;
  const ctx = computeContext({ dates: dts, px }, feed, bh, idx, new Set(Object.keys(prices)), dem);
  put('site/pm-data/context.json', JSON.stringify(ctx) + '\n');
  if (existsSync('data/india/regime.json')) { const r = JSON.parse(readFileSync('data/india/regime.json', 'utf8')).latest; if (r) put('site/pm-data/regime.json', JSON.stringify({ date: r.date, name: r.name, breadth: r.breadth, distribution: r.distribution, followThrough: r.followThrough }) + '\n'); }
}
console.log('site/pm built; prices as of', bf.slice(0, 10), Object.keys(prices).length, 'symbols');
