// See the study notes below. Usage: node --max-old-space-size=7000 scripts/anchor-study.mjs [--out=docs/replay]
// Batch A replay (decision D8, claude/batch-a-fundamentals-rules-draft.md): one registered run per book (A1, A2, A3, A5, A6) over the stored price and filing history, with the rules exactly as built for the live books
// (src/engine/batch-a.ts, src/engine/fundamentals-asof.ts, src/engine/stock-book.ts). No tuning. Paper only.
// Method: each session t from --from, the book steps with the same stepBook as the live runner (signal at the close, fill at the next open, tier costs, stops).
// Company figures are rebuilt as of each session: for every top-500 name at each month's first session, and for any name whose filing was broadcast that day (the A1 signal day). Between those days a name keeps its last figures.
// Known limits, printed in every report: (1) the top-500 list is rebuilt monthly and held for the month; (2) cash earns nothing in the replay (the live books credit the liquid-fund rate); (3) the Nifty 500 is the comparator for all five (the Value 50 fund has no record before May 2023);
// (4) prices 2020 to 2026 have been seen in other tests; (5) filings may be missing for companies delisted since (data/india/survivorship-filings.json).
// Usage: node --max-old-space-size=7000 scripts/replay-batch-a.mjs [--book=A1,A2,...,B1,B2,B3] [--from=2021-01-01] [--to=YYYY-MM-DD] [--out=docs/replay] [--smoke]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { eligible, BASE, tierCost } from '../src/backtest/ind-base.ts';

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const FROM = '2010-01-01', TO = arg('to', '9999-12-31'), OUT = arg('out', 'docs/replay'), SMOKE = process.argv.includes('--smoke');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);


const raw = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav-pre2020').filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-pre2020/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) raw.push(R('data/india/bhav/' + f));
raw.sort((a, b) => (a.date < b.date ? -1 : 1));
const uniq = raw.filter((d, i) => i === 0 || d.date !== raw[i - 1].date);
const actions = [...R('data/india/corp-actions-history-pre2019.json', []), ...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
const res = resolveHistory(uniq, actions, ov), days = toDays(uniq), dates = days.map((d) => d.date);
const industry = R('data/india/segments.json', {}).industry ?? {}, names = R('data/names.json', { india: {} }).india ?? {}, allowed = new Set(Object.keys(industry));
for (const d of days) for (const r of d.rows) allowed.add(r[0]);
const isCo = (sym) => sym in industry || sym in names;
const FH = buildHistories(days, res.splits, allowed), series = FH.series;

// 18b anchor lock-in event study (C-209, report only, run once). Listing = first session a symbol appears in the stored daily files after 4 Jan 2010 (symbols present on that day are pre-existing). Series kept: EQ and BE only, so SME listings are not in the data and cannot be reported.
// Window for the 30- or 90-calendar-day lock-in end: centred on (listing date - 2 calendar days + 30 or 90), from 7 sessions before to 4 sessions after (11 sessions). Window return = close at the last session before the window opens to the close 4 sessions after the centre.
// Baseline: the same name's average 11-session return over non-overlapping windows from 20 sessions after listing, skipping windows that touch either lock-in window. Also the Nifty 500 over the same window where its history exists (2020 on).
const ents = R('data/india/entities.json').entities;
const firstSeen = new Map(); days.forEach((d, i) => { for (const r of d.rows) if (!firstSeen.has(r[0])) firstSeen.set(r[0], i); });
const multi = new Set(); for (const e of ents) { const s = [...e.symbols].sort((a, b) => ((a.from ?? '') < (b.from ?? '') ? -1 : 1)); for (let i = 1; i < s.length; i++) multi.add(s[i].symbol); }   // symbol that is not the entity's first: a rename, not a listing
const idx500 = (() => { const o = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) o[d] = v[3]; } return o; })();
const idxAt = (d) => idx500[d] ?? null, dayAdd = (iso, n) => { const x = new Date(iso + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const firstIdx = (iso) => { let lo = 0, hi = dates.length - 1, a = dates.length; while (lo <= hi) { const m = (lo + hi) >> 1; if (dates[m] >= iso) { a = m; hi = m - 1; } else lo = m + 1; } return a; };
const CUT = '2022-05-01', L = 7, A = 4, W = L + A;
const rows = []; let listings = 0, skippedRename = 0, skippedShort = 0;
for (const [sym, i0] of firstSeen) {
  if (i0 < 1 || !isCo(sym)) continue; if (multi.has(sym)) { skippedRename++; continue; }
  const s = series.get(sym); if (!s) continue; const c = s.c, listDate = dates[i0]; listings++;
  const ends = [30, ...(listDate >= CUT ? [90] : [])].map((k) => ({ k, ic: firstIdx(dayAdd(listDate, -2 + k)) }));
  if (c.length < i0 + 40) { skippedShort++; continue; }
  const touched = (j) => ends.some((e) => j + W > e.ic - L && j < e.ic + A + 1);
  const base = []; for (let j = i0 + 20; j + W < c.length; j += W) { if (touched(j)) continue; if (c[j] > 0 && c[j + W] > 0) base.push(c[j + W] / c[j] - 1); }
  const bAvg = base.length >= 5 ? base.reduce((a, x) => a + x, 0) / base.length : null;
  for (const e of ends) { const a = e.ic - L - 1, b = e.ic + A; if (a < i0 + 1 || b >= c.length || !(c[a] > 0) || !(c[b] > 0)) continue;
    const r = c[b] / c[a] - 1, i1 = idxAt(dates[a]), i2 = idxAt(dates[b]); rows.push({ sym, listDate, k: e.k, group: listDate >= CUT ? 'from May 2022' : 'before May 2022', r, ex: bAvg == null ? null : r - bAvg, vsIdx: i1 && i2 ? r - (i2 / i1 - 1) : null }); } }
const stat = (a, f) => { const v = a.map(f).filter((x) => x != null); if (!v.length) return { n: 0 }; v.sort((x, y) => x - y); return { n: v.length, mean: v.reduce((m, x) => m + x, 0) / v.length, median: v[Math.floor(v.length / 2)], neg: v.filter((x) => x < 0).length / v.length }; };
const groups = [['30-day end, listed before May 2022', (x) => x.k === 30 && x.group === 'before May 2022'], ['30-day end, listed from May 2022', (x) => x.k === 30 && x.group === 'from May 2022'], ['90-day end, listed from May 2022', (x) => x.k === 90]];
const out = { run: new Date().toISOString().slice(0, 10), listings, skippedRename, skippedShort, window: `${L} sessions before to ${A} after the centre`, groups: Object.fromEntries(groups.map(([n, f]) => { const a = rows.filter(f); return [n, { raw: stat(a, (x) => x.r), vsOwnAverage: stat(a, (x) => x.ex), vsNifty500: stat(a, (x) => x.vsIdx) }]; })) };
mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/ANCHOR-LOCKIN-STUDY.json`, JSON.stringify(out, null, 1));
const p1 = (x) => (x == null ? 'n/a' : (x * 100).toFixed(1) + '%');
const M = [`# Anchor lock-in event study (package 18b, C-209)`, ``, `Run ${out.run}. One run, registered before it ran, report only: nothing is switched on from it (C-2). Paper only; not a financial adviser.`, ``, `**Method.** A listing is the first session a symbol appears in the stored daily files after 4 Jan 2010. ${listings} listings found; ${skippedRename} symbols skipped as renames of an existing company; ${skippedShort} skipped for fewer than 40 sessions of history. The window is centred 2 calendar days before listing plus 30 (or 90) days, from ${L} sessions before to ${A} sessions after. The 90-day end applies to issues from April 2022 (listings from 1 May 2022 are used as the proxy; not verified against SEBI's circular). Baseline: the same name's average ${W}-session return over its other windows. The Nifty 500 comparison uses the stored index history.`, ``, `| Group | n | Mean window return | Share negative | Mean vs own average | Share below own average | n vs Nifty 500 | Mean vs Nifty 500 |`, `|---|---|---|---|---|---|---|---|`];
for (const [n] of groups) { const g = out.groups[n]; M.push(`| ${n} | ${g.raw.n} | ${p1(g.raw.mean)} | ${p1(g.raw.neg)} | ${p1(g.vsOwnAverage.mean)} | ${p1(g.vsOwnAverage.neg)} | ${g.vsNifty500.n} | ${p1(g.vsNifty500.mean)} |`); }
M.push(``, `**Not covered.** SME listings: the stored files keep only the EQ and BE series, so SME names are absent and cannot be reported separately. Only listed companies are counted (ETFs and funds dropped), but first appearances are not all IPOs: SME names moving to the main board, series changes and demerged companies also show up, so the count is higher than the number of main-board IPOs. Symbol changes of companies not in the entity table may be counted as listings. Listing date is the first stored session; the real allotment date was not used. Delisted names are in the prices but survivors are over-represented among long histories. The 2020 to 2026 period has been seen in other tests.`, ``, `Counts, not conclusions: with this many events a mean under about 1 percentage point is within noise; look at the share negative and the size of the median (in the JSON).`);
writeFileSync(`${OUT}/ANCHOR-LOCKIN-STUDY.md`, M.join('\n') + '\n'); console.log(M.join('\n'));
