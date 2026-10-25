// Builds the browser side of the Portfolio Manager: strips types from src/pm/*.ts into site/pm/*.js and copies the PUBLIC data it needs into site/pm-data/.
// No personal data is ever read or written here. Run by build-site.mjs and on its own.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { computeContext } from '../src/pm/context.ts';

mkdirSync('site/pm', { recursive: true }); mkdirSync('site/pm-data', { recursive: true });
const put = (p, s) => { if (!existsSync(p) || readFileSync(p, 'utf8') !== s) writeFileSync(p, s); };
for (const f of readdirSync('src/pm').filter((x) => x.endsWith('.ts'))) {
  const js = stripTypeScriptTypes(readFileSync(`src/pm/${f}`, 'utf8'), { mode: 'strip' }).replace(/(from\s+['"]\.\/[\w-]+)\.ts(['"])/g, '$1.js$2');
  put(`site/pm/${f.replace(/\.ts$/, '.js')}`, js.replace(/from\s+(['"])\.\.\/engine\/(sizing|setups|journal)\.ts\1/g, "from './engine/$2.js'"));
}
// The two engine files the order sizing needs (pure, no personal data), copied into site/pm/engine/.
mkdirSync('site/pm/engine', { recursive: true });
for (const f of ['sizing', 'setups', 'journal', 'format']) put(`site/pm/engine/${f}.js`, stripTypeScriptTypes(readFileSync(`src/engine/${f}.ts`, 'utf8'), { mode: 'strip' }).replace(/(from\s+['"]\.\/[\w-]+)\.ts(['"])/g, '$1.js$2'));
const cp = (a, b) => { if (!existsSync(b) || !readFileSync(a).equals(readFileSync(b))) copyFileSync(a, b); };
for (const f of ['charges', 'tax', 'dividend', 'amfi-schemes', 'exit-loads']) cp(`data/rules/${f}.json`, `site/pm-data/${f}.json`);
cp('settings/allocation.json', 'site/pm-data/allocation.json');
if (existsSync('data/funds/backtest.json')) cp('data/funds/backtest.json', 'site/pm-data/backtest.json');   // C-81: the fund verdicts wait for this file; it also switches Replace on or off
// Saved nightly shortlists (public): every line of every night, for recognising a real buy as a Swing trade.
if (existsSync('data/india/shortlist')) {
  const lines = []; for (const f of readdirSync('data/india/shortlist').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) { const j = JSON.parse(readFileSync('data/india/shortlist/' + f, 'utf8')); for (const l of j.lines) lines.push({ ...l, signalDate: j.signalDate }); }
  const idx = existsSync('data/india/shortlist/index.json') ? JSON.parse(readFileSync('data/india/shortlist/index.json', 'utf8')) : {};
  const holidays = [], extra = [];
  if (existsSync('data/calendar')) for (const f of readdirSync('data/calendar').filter((x) => /^markets-\d{4}\.json$/.test(x))) { const c = JSON.parse(readFileSync('data/calendar/' + f, 'utf8')).india ?? {}; for (const h of c.holidays ?? []) holidays.push(typeof h === 'string' ? h : h.date); for (const e of c.extraSessions ?? []) extra.push(typeof e === 'string' ? e : e.date); }
  put('site/pm-data/shortlist.json', JSON.stringify({ lines, checked: idx.checked ?? [], goLive: idx.goLive ?? null, holidays: holidays.filter(Boolean), extra: extra.filter(Boolean) }) + '\n');
}
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
// Holdings health (C-101), information only: latest reading per fund, keyed by ISIN so a holding finds it.
if (existsSync('data/funds/holdhealth.json') && existsSync('data/funds/scores.json')) {
  const hh = JSON.parse(readFileSync('data/funds/holdhealth.json', 'utf8')), isin = new Map(JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds.map((f) => [f.code, f.isin])), out = {};
  for (const [code, v] of Object.entries(hh.funds)) if (isin.get(code)) out[isin.get(code)] = v;
  put('site/pm-data/holdhealth.json', JSON.stringify({ asOf: hh.asOf, priceDate: hh.priceDate, funds: out }) + '\n');
}
// Fund quality facts (C-108), information only: keyed by ISIN. Includes the 5-year return against index funds of the same segment (facts from scores.json; funds that closed are missing from both sides).
if (existsSync('data/stocks/facts.json')) put('site/pm-data/stockfacts.json', readFileSync('data/stocks/facts.json', 'utf8'));
if (existsSync('data/funds/quality.json')) {
  const q = JSON.parse(readFileSync('data/funds/quality.json', 'utf8')), out = {};
  const sc = existsSync('data/funds/scores.json') ? JSON.parse(readFileSync('data/funds/scores.json', 'utf8')).funds : [], r5 = new Map(sc.map((f) => [f.isin, f]));
  const med = (a) => { const v = [...a].sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
  const idx = (k) => sc.filter((f) => f.g === 'idx' && f.cat === k && f.r5 != null && !/etf|bees/i.test(f.name)).map((f) => f.r5);
  const SEG = { 'Large Cap': 'Nifty 50', 'Mid Cap': 'Nifty Midcap 150', 'Small Cap': 'Nifty Smallcap 250' }, PURE = new Set(['Large Cap', 'Mid Cap', 'Small Cap', 'Large & Mid Cap', 'Multi Cap', 'Flexi Cap', 'Focused', 'Value', 'Contra', 'Dividend Yield', 'ELSS']);
  for (const v of Object.values(q.funds)) if (v.isin) {
    const f = r5.get(v.isin); let vs5 = null;
    if (f && f.g === 'mf' && f.r5 != null && PURE.has(f.cat)) { for (const k of SEG[f.cat] ? [SEG[f.cat]] : ['Nifty 500', 'Nifty 50']) { const a = idx(k); if (a.length >= 3) { vs5 = { fund: +f.r5.toFixed(2), bench: k, benchR5: +med(a).toFixed(2), n: a.length }; break; } } }
    out[v.isin] = { asOf: v.asOf, managers: v.managers, aum: v.aum, benchmark: v.benchmark, expense: v.expense, turnover: v.turnover, launch: v.launch, exitLoad: v.exitLoad, flags: v.flags ?? [], vs5 };
  }
  put('site/pm-data/quality.json', JSON.stringify({ asOf: q.asOf, funds: out }) + '\n');
}
// Fund portfolios (Engine Rules C-78): public monthly disclosures, fetched by the fund-holdings workflow.
if (existsSync('data/funds/holdings.json')) copyFileSync('data/funds/holdings.json', 'site/pm-data/holdings.json');
// Daily traded volume and delivery % per stock, one file per month, for the trade review (what the market was doing when a buy was made). Public data.
// Closed months are not read again once their file exists, so the nightly build only touches the current month.
{
  mkdirSync('site/pm-data/volume', { recursive: true });
  const files = new Map();   // date -> path
  for (const [dir, gz] of [['data/india/bhav-hist', true], ['data/india/bhav', false]]) if (existsSync(dir)) for (const f of readdirSync(dir)) { const m = /^(\d{4}-\d\d-\d\d)\.json(\.gz)?$/.exec(f); if (m && m[1] >= '2021-01-01') files.set(m[1], `${dir}/${f}`); }
  const byMonth = new Map(); for (const d of [...files.keys()].sort()) (byMonth.get(d.slice(0, 7)) ?? byMonth.set(d.slice(0, 7), []).get(d.slice(0, 7))).push(d);
  const recent = [...byMonth.keys()].slice(-2)[0] ?? '0000-00';   // months before the second-last are closed
  const { gunzipSync } = await import('node:zlib');
  for (const [m, ds] of byMonth) {
    const out = `site/pm-data/volume/${m}.json`;
    // a closed month is kept as built unless its date list differs from the stored one (a late or corrected file); the last two months are always rebuilt, so a month boundary in any time zone is safe
    if (m < recent && existsSync(out)) { try { if (JSON.stringify(JSON.parse(readFileSync(out, 'utf8')).dates) === JSON.stringify(ds)) continue; } catch {} }
    const c = { dates: [], v: {}, d: {} };
    ds.forEach((d, i) => { const p = files.get(d), raw = p.endsWith('.gz') ? gunzipSync(readFileSync(p)).toString('utf8') : readFileSync(p, 'utf8'); c.dates.push(d);
      for (const [sym, r] of Object.entries(JSON.parse(raw).rows)) { if (r[6] == null) continue; (c.v[sym] ??= [])[i] = r[6]; if (r[7] != null) (c.d[sym] ??= [])[i] = r[7]; } });
    for (const k of ['v', 'd']) for (const a of Object.values(c[k])) for (let i = 0; i < c.dates.length; i++) if (a[i] === undefined) a[i] = null;
    put(out, JSON.stringify(c) + '\n');
  }
  put('site/pm-data/volume/index.json', JSON.stringify([...byMonth.keys()]) + '\n');
}
// context for each stock (trend, relative strength, liquidity, delivery): public data only, never part of a verdict
{
  const dts = [], px = {}; for (const m of Object.keys(months)) { const c = months[m]; const base = dts.length; dts.push(...c.dates); for (const [sym, a] of Object.entries(c.px)) { const arr = (px[sym] ??= []); while (arr.length < base) arr.push(null); arr.push(...a); } }
  for (const sym in px) while (px[sym].length < dts.length) px[sym].push(null);
  const feed = JSON.parse(readFileSync('data/india/corp-actions-history.json', 'utf8'));
  const bh = days.slice(-40).map((f) => ({ date: f.slice(0, 10), rows: JSON.parse(readFileSync('data/india/bhav/' + f, 'utf8')).rows }));
  const ic = existsSync('data/india/idx_closes.json') ? JSON.parse(readFileSync('data/india/idx_closes.json', 'utf8')).closes?.['Nifty 500'] : null;
  const idx = ic ? { dates: Object.keys(ic).sort(), closes: Object.keys(ic).sort().map((d) => ic[d]) } : null;
  const dem = JSON.parse(readFileSync('data/rules/demergers.json', 'utf8')).records;   // the public file is an empty stub: household records are private, so this public context carries no demerger adjustments
  const ctx = computeContext({ dates: dts, px }, feed, bh, idx, new Set(Object.keys(prices)), dem);
  put('site/pm-data/context.json', JSON.stringify(ctx) + '\n');
  if (existsSync('data/india/regime.json')) { const r = JSON.parse(readFileSync('data/india/regime.json', 'utf8')).latest; if (r) put('site/pm-data/regime.json', JSON.stringify({ date: r.date, name: r.name, breadth: r.breadth, distribution: r.distribution, followThrough: r.followThrough }) + '\n'); }
}
console.log('site/pm built; prices as of', bf.slice(0, 10), Object.keys(prices).length, 'symbols');
