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
// Data-quality check (no strategy): one-day moves in the split-adjusted closes that look like unadjusted corporate actions (down 35% or more, or up 50% or more), per year, for listed companies. Compared across 2011-2019 and 2021-2025.
const by = {};
for (const [sym, s] of series) { if (!isCo(sym)) continue; const c = s.c; for (let i = 1; i < c.length; i++) { if (!(c[i] > 0) || !(c[i - 1] > 0)) continue; const r = c[i] / c[i - 1] - 1, y = dates[i].slice(0, 4); const a = (by[y] ??= { names: new Set(), down: 0, up: 0, obs: 0 }); a.obs++; a.names.add(sym); if (r <= -0.35) a.down++; if (r >= 0.5) a.up++; } }
for (const y of Object.keys(by).sort()) { const a = by[y]; console.log(y, 'names', a.names.size, 'down>=35%', a.down, 'up>=50%', a.up, 'per million obs', ((a.down + a.up) / a.obs * 1e6).toFixed(0)); }
