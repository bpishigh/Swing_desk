// IPO base breakout replay (docs/replay/IPO-BASE-PREREG.md). One run per market, rule as built (src/engine/ipo-base.ts), no tuning.
// Usage: node --max-old-space-size=7000 scripts/replay-ipo-base.mjs --market=in|us [--from=YYYY-MM-DD] [--to=YYYY-MM-DD] [--pre] [--out=docs/replay]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays } from '../src/backtest/india-asof.ts';
import { tierCost } from '../src/backtest/ind-base.ts';
import { usCost } from '../src/backtest/us-loader.ts';
import { newBook, stepBook, monthlyValues } from '../src/engine/stock-book.ts';
import { ipoBase, IPOB } from '../src/engine/ipo-base.ts';
import { scorecard } from '../src/engine/scorecard.ts';
import { loadDays } from './us-hist-lib.mjs';
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').slice(k.length + 3) || d;
const MK = arg('market', 'in'), FROM = arg('from', MK === 'us' ? '2017-01-02' : '2020-01-02'), TO = arg('to', '9999-12-31'), OUT = arg('out', 'docs/replay'), PRE = process.argv.includes('--pre'), EXTRA = 0.006;
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const STOPCAP = Number(arg('stopcap', 0)); if (STOPCAP > 0) IPOB.stopCap = STOPCAP;
const FLOOR = MK === 'us' ? 1e6 : 5e7; IPOB.floor = FLOOR;
let days, dates, splits = [], openAt, tier, compClose, uniqRows = null;
if (MK === 'in') {
  const raw = [];
  for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
  if (PRE) for (const f of readdirSync('data/india/bhav-pre2020').filter((x) => x.endsWith('.json.gz')).sort()) raw.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-pre2020/' + f))));
  for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) raw.push(R('data/india/bhav/' + f));
  raw.sort((a, b) => (a.date < b.date ? -1 : 1)); const uniq = raw.filter((d, i) => i === 0 || d.date !== raw[i - 1].date); uniqRows = uniq;
  const actions = [...(PRE ? R('data/india/corp-actions-history-pre2019.json', []) : []), ...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
  const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
  const res = resolveHistory(uniq, actions, ov); days = toDays(uniq); dates = days.map((d) => d.date); splits = res.splits;
  openAt = (sym, t) => { const r = uniq[t]?.rows?.[sym]; return r && r[2] > 0 ? r[2] : NaN; }; tier = (v) => tierCost(v) + EXTRA;
  const idx = {}; for (const f of readdirSync('data/india/idx-hist').filter((x) => /^idx-\d{4}\.json$/.test(x)).sort()) { const j = R('data/india/idx-hist/' + f); for (const [d, v] of Object.entries(j['Nifty 500'] ?? {})) idx[d] = v[3]; }
  compClose = idx;
} else {
  days = loadDays(); dates = days.map((d) => d.date); openAt = () => NaN; tier = (v) => usCost(v) + EXTRA;
  const spy = JSON.parse(gunzipSync(readFileSync('data/us/hist-bench/SPY.json.gz')).toString()).bars; compClose = Object.fromEntries(spy.map((b) => [b[0], b[1]]));
}
// IPO list from the stored files (same rule as scripts/india-ipo-list.mjs): first appearance of an EQ symbol, renames removed (India), days with more than 20 first appearances dropped
const first = new Map(), seen = new Set(days[0].rows.map((r) => r[0])), perDay = new Map();
const eqRow = (sym, i) => (MK === 'in' ? uniqRows[i].rows[sym]?.[0] === 'EQ' && uniqRows[i].rows[sym][5] > 0 : true);   // as scripts/india-ipo-list.mjs: EQ series only
for (let i = 1; i < days.length; i++) { for (const r of days[i].rows) { const sym = r[0]; if (seen.has(sym)) continue; seen.add(sym); if (!eqRow(sym, i)) continue; first.set(sym, days[i].date); perDay.set(days[i].date, (perDay.get(days[i].date) ?? 0) + 1); } }
const renamed = new Set(); if (MK === 'in') for (const e of R('data/india/entities.json').entities) for (let i = 1; i < e.symbols.length; i++) renamed.add(e.symbols[i].symbol);
const ipo = [...first].filter(([s, d]) => perDay.get(d) <= 20 && !renamed.has(s)).map(([sym, listed]) => ({ sym, listed }));
const series = buildHistories(days, splits, new Set(ipo.map((x) => x.sym))).series;
const ck = Object.keys(compClose).sort(), ckIdx = new Map(ck.map((d, i) => [d, i]));
const compAt = (D) => { let lo = 0, hi = ck.length - 1, a = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (ck[m] <= D) { a = m; lo = m + 1; } else hi = m - 1; } return a; };
const lightAt = (D) => { const a = compAt(D); if (a < 199) return 'yellow'; let s = 0; for (let i = a - 199; i <= a; i++) s += compClose[ck[i]]; return compClose[ck[a]] >= s / 200 ? 'green' : 'red'; };
const pxAt = (sym, t) => { const s = series.get(sym); if (!s) return NaN; for (let k = t; k >= Math.max(0, t - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
const ageAt = (sym, t) => { const s = series.get(sym); if (!s) return 0; for (let k = t; k >= Math.max(0, t - 30); k--) if (s.c[k] > 0) return t - k; return 31; };
let t0 = dates.findIndex((d) => d >= FROM); if (t0 < 1) t0 = 1; let t1 = dates.length - 1; while (t1 > t0 && dates[t1] > TO) t1--;
const st = newBook('ipo-base', dates[t0]), log = [], wide = [], expo = { s: 0, n: 0 };
for (let t = t0; t <= t1; t++) {
  const D = dates[t], light = lightAt(D);
  const signal = (held, stx) => ipoBase({ series, t, dates, held, st: stx, ipo, light }, wide, log);
  stepBook(st, { D, open: (s) => openAt(s, t), age: (s) => ageAt(s, t), close: (s) => pxAt(s, t), cashRet: null, tier, signal });
  const v = st.daily.at(-1)?.v; if (v) { let pv = 0; for (const [s, p] of Object.entries(st.pos)) pv += p.sh * (pxAt(s, t) || p.entry); expo.s += pv / v; expo.n++; }
}
const pct = (x) => (x == null ? 'n/a' : (x * 100).toFixed(1) + '%'), bm = monthlyValues(st);
const compM = bm.map((x) => { const a = compAt(x.d); return { m: x.m, v: a >= 0 ? compClose[ck[a]] : null }; }).filter((x) => x.v > 0);
const trades = st.closed.map((c) => c.ret - tier(st.lastValue[c.sym] ?? 0)), avgNet = trades.length ? trades.reduce((a, x) => a + x, 0) / trades.length : null;
const sc = bm.length ? scorecard(bm.map((x) => ({ m: x.m, v: x.v })), compM, { n: trades.length, avg: avgNet }, 0) : null;
const yrs = Math.max(0.1, (sc?.months ?? 0) / 12), avgExp = expo.n ? expo.s / expo.n : null, bookRet = sc?.sinceStart?.book ?? null, compRet = sc?.sinceStart?.comp ?? null;
const compDd = (() => { let pk = 0, dd = 0; for (const x of compM) { pk = Math.max(pk, x.v); dd = Math.min(dd, x.v / pk - 1); } return dd; })();
const byYear = {}; for (let i = 1; i < bm.length; i++) { const y = bm[i].m.slice(0, 4), a = (byYear[y] ??= { b: 1, c: 1 }); a.b *= bm[i].v / bm[i - 1].v; if (compM[i] && compM[i - 1]) a.c *= compM[i].v / compM[i - 1].v; }
const p1 = avgNet != null && avgNet > 0, p2 = bookRet != null && compRet != null && avgExp != null && bookRet > avgExp * compRet, p3 = sc && sc.drawdown >= 1.5 * compDd, p4 = STOPCAP > 0 ? st.closed.length >= 60 : st.closed.length / yrs >= 30;
const stamp = new Date().toISOString().slice(0, 10), tag = (MK === 'us' ? 'US' : PRE ? 'IN-HOLDOUT' : 'IN') + (STOPCAP > 0 ? `-STOP${Math.round(STOPCAP * 100)}` : ''), sessions = `${dates[t0]} to ${dates[t1]}`;
const L = [`# IPO base breakout replay: ${tag}`, ``, `Run ${stamp}, sessions ${sessions}. One run, rule as built, no tuning (docs/replay/IPO-BASE-PREREG.md). Paper only; not a financial adviser.`, ``,
  `IPO list: ${ipo.length} names; signals logged ${log.length}, bought ${log.filter((x) => x.taken).length}; skipped for no slot ${log.filter((x) => x.why === 'no slot').length}, stop too wide ${log.filter((x) => x.why === 'stop too wide').length}.`, ``,
  `| Months | Book since start | ${MK === 'us' ? 'SPY' : 'Nifty 500'} since start | Excess | Max drawdown | Comparator max drawdown | Closed trades | Stop-outs | Net per trade | Avg exposure |`, `|---|---|---|---|---|---|---|---|---|---|`,
  `| ${sc?.months ?? 0} | ${pct(bookRet)} | ${pct(compRet)} | ${pct(sc?.sinceStart?.excess)} | ${pct(sc?.drawdown)} | ${pct(compDd)} | ${st.closed.length} (${(st.closed.length / yrs).toFixed(0)} a year) | ${st.closed.filter((c) => c.why === 'stop').length} | ${pct(avgNet)} | ${pct(avgExp)} |`, ``,
  `Calendar years (book, comparator): ` + Object.entries(byYear).map(([y, a]) => `${y} ${pct(a.b - 1)} vs ${pct(a.c - 1)}`).join('; '), ``,
  `## Pre-registered pass rule`, ``, `1. Net return per trade above zero: ${p1 ? 'yes' : 'no'}. 2. Book return above the comparator scaled by average exposure (${pct(avgExp != null && compRet != null ? avgExp * compRet : null)}): ${p2 ? 'yes' : 'no'}. 3. Max drawdown no worse than 1.5x the comparator's (${pct(1.5 * compDd)}): ${p3 ? 'yes' : 'no'}. 4. ${STOPCAP > 0 ? 'At least 60 closed trades in total (candidate rule, see the addendum)' : 'At least 30 closed trades a year'}: ${p4 ? 'yes' : 'no'}. **Result: ${p1 && p2 && p3 && p4 ? 'PASS' : 'FAIL'}${MK === 'us' ? ' (US run is an implementation check, never evidence)' : ''}.**`, ``,
  `**Labels.** ${MK === 'us' ? 'Survivor bias is heavy (all stored US symbols still trade, so failed IPOs are absent); no opens are stored, so fills use the fill session\'s close; first appearances include spin-offs, SPAC mergers and ticker changes; ' : 'India 2020 to 2026 prices have been seen in other tests (not for this rule); the IPO list uses the entity table, built with later knowledge; relistings and demergers can look like listings; '}the market light is the comparator index against its own 200-session average (no light history is stored); costs include an extra 0.6% round trip; cash earns nothing.`];
mkdirSync(OUT, { recursive: true }); writeFileSync(`${OUT}/IPO-BASE-REPLAY-${tag}.md`, L.join('\n') + '\n'); writeFileSync(`${OUT}/IPO-BASE-REPLAY-${tag}.json`, JSON.stringify({ run: stamp, sessions, ipo: ipo.length, summary: { sc: sc && { months: sc.months, sinceStart: sc.sinceStart, drawdown: sc.drawdown }, closed: st.closed.length, avgNet, avgExp, compDd, pass: { p1, p2, p3, p4 } }, byYear, log: log.slice(-5000) }) + '\n');
console.log(L.join('\n'));
