// C-61 forward paper test of the results-day rule (registered 18 Oct 2026): "ran up into results" (run-up above the frozen cut) AND "reaction day at least +2% above the market".
// New results only: events whose entry session (the close after the results reaction) is on or after the start date in data/india/earnings-forward-config.json. Nothing here trades or alerts.
// Entry = close E+1, exit = close E+21, cost 0.4% round trip. Every results event is logged so the signal can be compared with the unfiltered top run-up group and with all results.
// Usage: node scripts/earnings-forward.mjs [--freeze]   (--freeze: loads the full history once to compute the run-up cut and writes the config)
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'; import { gunzipSync } from 'node:zlib';
import { resolveHistory, toDays } from '../src/backtest/india-asof.ts';
import { buildHistories } from '../src/ingest/us-scan.ts';
const FREEZE = process.argv.includes('--freeze'), R = (p) => JSON.parse(readFileSync(p, 'utf8'));
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*', referer: 'https://www.nseindia.com/' };
const MON = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
const iso = (s) => { const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(String(s ?? '')); return m && MON[m[2]] ? `${m[3]}-${MON[m[2]]}-${m[1].padStart(2, '0')}` : null; };
const nse = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
const RDF = 'data/india/results-dates.json', RD = R(RDF), want = new Set(R('data/india/nifty500.json').symbols);
// 1) refresh results dates for the last 50 and next 30 days (one all-company call); skipped quietly when NSE is unreachable (e.g. in the sandbox)
if (!FREEZE) { try {
  let cookie = ''; try { const r = await fetch('https://www.nseindia.com/', { headers: UA }); cookie = (r.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; '); } catch {}
  const a = new Date(Date.now() - 50 * 864e5), b = new Date(Date.now() + 30 * 864e5);
  const r = await fetch(`https://www.nseindia.com/api/corporate-board-meetings?index=equities&from_date=${nse(a)}&to_date=${nse(b)}`, { headers: { ...UA, ...(cookie ? { cookie } : {}) }, signal: AbortSignal.timeout(60000) });
  const rows = r.ok ? await r.json() : []; let add = 0;
  if (Array.isArray(rows)) for (const x of rows) { if (!want.has(x.bm_symbol) || !/results/i.test(`${x.bm_purpose ?? ''} ${x.bm_desc ?? ''}`)) continue; const t = iso(x.bm_date); if (!t) continue; const set = new Set(RD.dates[x.bm_symbol] || []); if (!set.has(t)) { set.add(t); RD.dates[x.bm_symbol] = [...set].sort(); add++; } }
  if (add) writeFileSync(RDF, JSON.stringify(RD) + '\n'); console.log(`results dates refreshed: ${rows.length} meetings read, ${add} new`);
} catch (e) { console.log('results dates not refreshed:', String(e).slice(0, 80)); } }
// 2) prices
const bhav = [];
if (FREEZE) for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) bhav.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => x.endsWith('.json')).sort()) bhav.push(R('data/india/bhav/' + f));
bhav.sort((a, b) => (a.date < b.date ? -1 : 1));
const days = toDays(bhav), dates = days.map((d) => d.date), T = days.length;
const actions = [...R('data/india/corp-actions-history.json'), ...(existsSync('data/india/corp-actions.json') ? R('data/india/corp-actions.json') : [])];
const ov = existsSync('data/india/corp-action-overrides.json') ? R('data/india/corp-action-overrides.json') : {};
const res = resolveHistory(bhav, actions, ov), allowed = new Set(); for (const d of days) for (const r of d.rows) allowed.add(r[0]);
const H = buildHistories(days, res.splits, allowed), syms = Object.keys(RD.dates).filter((s) => H.series.has(s));
const c = (s, i) => { const v = H.series.get(s)?.c[i]; return v > 0 ? v : NaN; }, ret = (s, a, b) => c(s, b) / c(s, a) - 1;
const first = (d) => { let lo = 0, hi = T; while (lo < hi) { const m = (lo + hi) >> 1; if (dates[m] < d) lo = m + 1; else hi = m; } return lo; };
const mc = new Map(); const mkt = (a, b) => { const k = a + ':' + b; if (mc.has(k)) return mc.get(k); let s = 0, n = 0; for (const x of syms) { let r = ret(x, a, b); if (r === r) { r = Math.max(-0.5, Math.min(0.5, r)); s += r; n++; } } const v = n > 30 ? s / n : NaN; mc.set(k, v); return v; };
const CFG = 'data/india/earnings-forward-config.json';
if (FREEZE) {
  const runs = []; for (const s of syms) for (const d of RD.dates[s]) { const E = first(d); if (E < 15 || E + 21 >= T || Math.abs(new Date(dates[E]) - new Date(d)) > 4 * 864e5) continue; const v = ret(s, E - 11, E - 1) - mkt(E - 11, E - 1); if (v === v && Math.abs(v) < 3) runs.push(v); }
  runs.sort((a, b) => a - b); const cut = runs[Math.floor(runs.length * 2 / 3)];
  const cfg = { registered: '2026-10-18', start: '2026-10-19', runupCut: +cut.toFixed(4), reactionCut: 0.02, hold: 20, cost: 0.004, sample: runs.length, note: 'run-up = close(E-11) to close(E-1) minus equal-weight market; cut = two-thirds point of all results events Jan 2020 to Aug 2026. Frozen.' };
  writeFileSync(CFG, JSON.stringify(cfg, null, 1) + '\n'); console.log('config written', cfg); process.exit(0);
}
const cfg = R(CFG), STATE = 'data/india/earnings-forward.json', st = existsSync(STATE) ? R(STATE) : { events: {} };
for (const s of syms) for (const d of RD.dates[s]) {
  const E = first(d); if (E < 12 || E + 1 >= T || Math.abs(new Date(dates[E]) - new Date(d)) > 4 * 864e5) continue; const X = E + 1; if (dates[X] < (process.env.EF_START || cfg.start)) continue;
  const key = s + '|' + d, run = ret(s, E - 11, E - 1) - mkt(E - 11, E - 1), rea = ret(s, E - 1, X) - mkt(E - 1, X); if (![run, rea].every((v) => v === v)) continue;
  const ev = st.events[key] || { s, d, entry: dates[X], px: +c(s, X).toFixed(2) }; ev.run = +run.toFixed(4); ev.rea = +rea.toFixed(4); ev.top = run >= cfg.runupCut; ev.signal = ev.top && rea >= cfg.reactionCut;
  if (!ev.done && E + 1 + cfg.hold < T) { const Y = X + cfg.hold, r = ret(s, X, Y); if (r === r) { ev.exit = dates[Y]; ev.r = +r.toFixed(4); ev.m = +mkt(X, Y).toFixed(4); ev.done = true; } }
  st.events[key] = ev;
}
const all = Object.values(st.events), done = all.filter((e) => e.done), mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN), pct = (v) => (v * 100).toFixed(2) + '%';
const grp = (n, f) => { const g = done.filter(f), net = g.map((e) => e.r - cfg.cost); return { group: n, matured: g.length, open: all.filter(f).length - g.length, meanNet: net.length ? +mean(net).toFixed(4) : null, win: net.length ? +(net.filter((v) => v > 0).length / net.length).toFixed(3) : null, market: g.length ? +mean(g.map((e) => e.m)).toFixed(4) : null }; };
st.summary = { updated: new Date().toISOString().slice(0, 10), cut: cfg.runupCut, groups: [grp('signal (ran up + reaction >= +2%)', (e) => e.signal), grp('ran up, any reaction', (e) => e.top), grp('all results stocks', () => true)] };
if (!process.env.EF_START) writeFileSync(STATE, JSON.stringify(st, null, 1) + '\n');
console.log(`events logged ${all.length}, matured ${done.length}`); for (const g of st.summary.groups) console.log(g.group.padEnd(38), `matured ${g.matured} open ${g.open}`, g.meanNet === null ? '' : `net ${pct(g.meanNet)} win ${(g.win * 100).toFixed(0)}% market ${pct(g.market)}`);
