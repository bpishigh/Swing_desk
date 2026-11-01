// Nightly MOM-30 v1 momentum sleeve (Engine Rules C-129 build, C-130 stream): paper only, no orders, no alerts.
// Writes data/india/momentum-sleeve/latest.json (tonight's ranks, the list and its status), state.json (the paper book) and reads settings/strategies.json.
// The book changes only on review dates (first session of June and December) and once at the start: signal on the first session's close, simulated fill at the next close.
// Usage: node --max-old-space-size=6000 scripts/momentum-sleeve.mjs [--asof=YYYY-MM-DD] [--dry]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories } from '../src/ingest/us-scan.ts';
import { resolveHistory, toDays, asOfHistories } from '../src/backtest/india-asof.ts';
import { eligible, BASE, tierCost } from '../src/backtest/ind-base.ts';
import { MOM30, selectSleeve, sleeveWeights, isReviewSession } from '../src/engine/momentum-sleeve.ts';

const ASOF = process.argv.find((a) => a.startsWith('--asof='))?.slice(7), DRY = process.argv.includes('--dry');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const strat = (R('settings/strategies.json', { strategies: [] }).strategies || []).find((s) => s.id === 'mom30-india');
if (!strat) { console.error('settings/strategies.json has no mom30-india entry'); process.exit(1); }
const START_AFTER = process.env.MOM_START || strat.startAfter;

const bhav = [];
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) bhav.push(R('data/india/bhav/' + f));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const uniq = bhav.filter((d, i) => i === 0 || d.date !== bhav[i - 1].date), sel0 = ASOF ? uniq.filter((d) => d.date <= ASOF) : uniq;
const actions = [...R('data/india/corp-actions-history.json', []), ...R('data/india/corp-actions.json', [])];
const ov = { ...R('data/india/corp-action-overrides-hist.json', {}), ...R('data/india/corp-action-overrides.json', {}) };
const res = resolveHistory(sel0, actions, ov), days = toDays(sel0), dates = days.map((d) => d.date), t = days.length - 1, D = dates[t];
const industry = R('data/india/segments.json', {}).industry ?? {}, allowed = new Set(Object.keys(industry));
for (const d of days) for (const r of d.rows) allowed.add(r[0]);   // as in the C-129 replay (allSymbols)
const asOf = asOfHistories(days, t, res, allowed), FH = buildHistories(days, res.splits, allowed);
const series = FH.series, names = R('data/names.json', { india: {} }).india ?? {};
const px = (sym, i) => { const s = series.get(sym); if (!s) return NaN; for (let k = i; k >= Math.max(0, i - 400); k--) if (s.c[k] > 0) return s.c[k]; return NaN; };
const ret = (sym, w) => { const s = series.get(sym); return s && s.c[t] > 0 && s.c[t - w] > 0 ? s.c[t] / s.c[t - w] - 1 : null; };

const dir = process.env.MOM_DIR || 'data/india/momentum-sleeve', stFile = dir + '/state.json';
const st = R(stFile, { version: MOM30.version, startAfter: START_AFTER, book: null, pending: null, lastSignal: null, reviews: [], daily: [], monthly: {} });
const held = () => new Set(Object.keys(st.book?.shares ?? {}));
const value = (i) => { let v = st.book.cash; for (const [sym, sh] of Object.entries(st.book.shares)) { const p = px(sym, i); v += sh * (p > 0 ? p : 0); } return v; };

// 1) fill a pending rebalance at tonight's close (the session after the signal)
if (st.pending && D > st.pending.signalDate) {
  const first = !st.book, V = first ? 100 : value(t), tgt = new Map(st.pending.target.map((x) => [x.sym, x.w * V]));
  const cur = first ? new Map() : new Map(Object.entries(st.book.shares).map(([s, n]) => [s, n * (px(s, t) > 0 ? px(s, t) : 0)]));
  const lastValue = { ...(st.book?.lastValue ?? {}), ...st.pending.values };
  let traded = 0, cost = 0; for (const sym of new Set([...cur.keys(), ...tgt.keys()])) { if (!(px(sym, t) > 0)) continue; const d = Math.abs((tgt.get(sym) ?? 0) - (cur.get(sym) ?? 0)); traded += d; cost += d * tierCost(lastValue[sym] ?? 0) / 2; }
  const V2 = V - cost, shares = {}; let cash = 0;
  for (const [sym, amt] of tgt) { const p = px(sym, t); if (p > 0) shares[sym] = (amt / V) * V2 / p; else cash += (amt / V) * V2; }
  const before = first ? [] : Object.keys(st.book.shares), after = Object.keys(shares);
  st.reviews.push({ signalDate: st.pending.signalDate, fillDate: D, count: after.length, entered: after.filter((s) => !before.includes(s)), left: before.filter((s) => !after.includes(s)), turnoverPct: Math.round(traded / (2 * V) * 1000) / 10, costPct: Math.round(cost / V * 10000) / 100, check: st.pending.check });
  st.book = { cash, shares, lastValue, startedFill: st.book?.startedFill ?? D }; st.pending = null;
}
// 2) mark the book
if (st.book && (!st.daily.length || st.daily.at(-1).d < D)) { const v = value(t); st.daily.push({ d: D, v: Math.round(v * 1e4) / 1e4 }); st.monthly[D.slice(0, 7)] = { d: D, v: Math.round(v * 1e4) / 1e4 }; }
// 3) signal tonight?  First ever run after the start date, or the first session of a review month.
// Listed companies only: a symbol with an industry (index lists) or a company name. Liquid funds and gold/silver ETFs are not companies; the C-129 replay let GOLDBEES in at 2 to 5% on four review dates (see Engine Rules C-130).
const isCo = (sym) => sym in industry || sym in names;
const el = eligible(asOf, t, BASE.skip).filter((p) => isCo(p.sym)).map((p) => ({ sym: p.sym, value: p.value }));
const preview = selectSleeve(el, series, t, held()), wts = sleeveWeights(preview);
const needFirst = !st.book && !st.pending && D > START_AFTER;
if (!st.pending && st.lastSignal !== D && D > START_AFTER && (needFirst || (st.book && isReviewSession(dates, t)))) {
  // live path (as-of histories for eligibility, adjusted closes for returns) against the replay path (every figure from the fully adjusted histories, as the C-129 script does)
  const elR = eligible(FH, t, BASE.skip).filter((p) => isCo(p.sym)).map((p) => ({ sym: p.sym, value: p.value })), selR = selectSleeve(elR, series, t, held()), wR = sleeveWeights(selR);
  const a = new Map(preview.picks.map((p, i) => [p.sym, wts[i]])), b = new Map(selR.picks.map((p, i) => [p.sym, wR[i]]));
  const same = a.size === b.size && [...a.keys()].every((s) => b.has(s)), maxDiff = Math.max(0, ...[...new Set([...a.keys(), ...b.keys()])].map((s) => Math.abs((a.get(s) ?? 0) - (b.get(s) ?? 0)))) * 100;
  st.pending = { signalDate: D, target: preview.picks.map((p, i) => ({ sym: p.sym, w: wts[i] })), values: Object.fromEntries(el.map((e) => [e.sym, e.value])), check: { sameNames: same, maxWeightDiffPp: Math.round(maxDiff * 1000) / 1000, pass: same && maxDiff <= 0.1 } };
  st.lastSignal = D;
}
// 4) tonight's list for the page
const hs = held(), tgtW = st.pending ? new Map(st.pending.target.map((x) => [x.sym, x.w])) : null, book = st.book ? value(t) : null;
const status = (r) => (hs.size ? (hs.has(r.sym) ? (r.rank <= MOM30.HOLD ? 'Held' : r.rank <= MOM30.KEEP ? 'In buffer' : 'Would leave') : r.rank <= MOM30.HOLD ? 'Would enter' : '') : r.rank <= MOM30.HOLD ? 'Preview' : '');
const wNow = (sym) => (st.book && book > 0 ? (st.book.shares[sym] ?? 0) * (px(sym, t) > 0 ? px(sym, t) : 0) / book : null);
const prevW = new Map(preview.picks.map((p, i) => [p.sym, wts[i]]));
const top = preview.ranked.slice(0, 60);
const heldNotTop = [...hs].filter((s) => !top.some((r) => r.sym === s)).map((s) => preview.ranked.find((r) => r.sym === s) ?? { sym: s, rank: null, s: null, mult: null, value: 0 });
const rows = [...top, ...heldNotTop].map((r) => ({ rank: r.rank, sym: r.sym, name: names[r.sym] ?? null, score: r.s === null ? null : Math.round(r.s * 100) / 100, weightNow: wNow(r.sym) === null ? null : Math.round(wNow(r.sym) * 1e4) / 1e4, weightTarget: Math.round((prevW.get(r.sym) ?? 0) * 1e4) / 1e4, status: status(r), r6: ret(r.sym, 126), r12: ret(r.sym, 252) }));
const nextRev = (() => { const [y, m] = D.split('-').map(Number); const c = [[y, 6], [y, 12], [y + 1, 6]].find(([yy, mm]) => yy * 12 + mm > y * 12 + m); return `${c[0]}-${String(c[1]).padStart(2, '0')}`; })();
// monthly comparison lines: the sleeve (rebased), NSE's own index (hand-downloaded month-end series) and Nifty 500, all rebased to the first month-end after the first fill
const nse = new Map((existsSync('data/replay/nse-momentum30-price.csv') ? readFileSync('data/replay/nse-momentum30-price.csv', 'utf8').trim().split('\n').slice(1) : []).map((l) => { const [d, c] = l.split(','); return [d.slice(0, 7), { d, c: Number(c) }]; }));
const refm = R(dir + '/reference.json', {}), months = Object.keys(st.monthly).sort(), n500 = (d) => R(`data/india/tracker/${d}.json`)?.b?.close ?? null;
const origin = months.find((m) => st.book && st.monthly[m].d >= st.book.startedFill && st.monthly[m].d.slice(0, 7) !== st.book.startedFill.slice(0, 7)) ?? null;
const line = (key, f) => { if (!origin) return null; const base = f(origin); if (!(base > 0)) return null; return months.filter((m) => m >= origin).map((m) => { const v = f(m); return v > 0 ? { m, x: Math.round(v / base * 1e4) / 100 } : { m, x: null }; }); };
const board = origin ? { origin, lines: { sleeve: line('sleeve', (m) => st.monthly[m]?.v), nse: line('nse', (m) => nse.get(m)?.c), n500: line('n500', (m) => n500(st.monthly[m]?.d)), n200: line('n200', (m) => refm[m]?.nifty200), fund: line('fund', (m) => refm[m]?.fundNav) } } : null;
const rep = R('data/replay/c129-momentum30.json', {});
const out = {
  version: MOM30.version, asOf: D, startAfter: START_AFTER, universe: preview.universe, nextReview: nextRev, lastBuild: st.reviews.at(-1)?.fillDate ?? null,
  state: st.book ? 'running' : st.pending ? 'pending fill' : 'waiting', pending: st.pending ? { signalDate: st.pending.signalDate, check: st.pending.check } : null,
  heldCount: hs.size, valueIndex: book === null ? null : Math.round(book * 100) / 100, sinceFill: st.book && st.daily.length ? Math.round((book / 100 - 1) * 1e4) / 100 : null,
  rows, reviews: st.reviews, daily: st.daily.slice(-400), board, replication: { correlation: rep.replication?.corr ?? rep.replication?.correlation ?? 0.915, source: 'C-129 replication check, 178 months' },
  wouldEnter: rows.filter((r) => r.status === 'Would enter').map((r) => r.sym), wouldLeave: rows.filter((r) => r.status === 'Would leave').map((r) => r.sym),
};
if (process.env.DBG) console.log(rows.slice(0, 45).map((r) => `${r.rank} ${r.sym} ${r.score} ${(names[r.sym] ?? "").slice(0, 28)}`).join("\n"));
console.log(JSON.stringify({ asOf: D, state: out.state, universe: out.universe, held: out.heldCount, pending: out.pending, reviews: st.reviews.length, top3: rows.slice(0, 3).map((r) => r.sym) }));
if (!DRY) { mkdirSync(dir, { recursive: true }); writeFileSync(stFile, JSON.stringify(st, null, 1) + '\n'); writeFileSync(dir + '/latest.json', JSON.stringify(out) + '\n'); }
