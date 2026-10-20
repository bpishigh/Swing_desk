// Nightly Exit alerts for the direct stocks in the uploaded accounts (portfolio/accounts/*.json), 17 Oct 2026.
// Replays each account through the same pipeline the upload page uses, runs stockVerdict (200 SMA + swing low) on every open direct-stock holding, and
// sends ONE Telegram message when a holding newly turns Exit (or on the first run, one summary). Usage: node scripts/holding-alerts.mjs [--dry]
// State: portfolio/book/holdings-state.json. Changes no rule; positions are never typed in.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { runPipeline } from '../src/pm/pipeline.ts';
import { stockVerdict } from '../src/pm/verdict.ts';
import { morningSummary } from '../src/pm/morning.ts';
const DRY = process.argv.includes('--dry');
const J = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const files = existsSync('portfolio/accounts') ? readdirSync('portfolio/accounts').filter((f) => f.endsWith('.json')) : [];
if (!files.length) { console.log('no accounts'); process.exit(0); }
const bf = readdirSync('data/india/bhav').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort();
const bhav = J('data/india/bhav/' + bf[bf.length - 1]);
const prices = {}; for (const [s, r] of Object.entries(bhav.rows)) if (r[5] != null) prices[s] = r[5];
const byDay = {};
const hd = 'data/india/prices-hist';
if (existsSync(hd)) for (const f of readdirSync(hd).filter((x) => /^\d{4}-\d\d\.json$/.test(x))) { const c = J(`${hd}/${f}`); c.dates.forEach((d, i) => { const o = (byDay[d] = {}); for (const [s, a] of Object.entries(c.px)) if (a[i] != null) o[s] = a[i]; }); }
for (const f of bf) { const o = (byDay[f.slice(0, 10)] = {}); for (const [s, r] of Object.entries(f === bf[bf.length - 1] ? bhav.rows : J('data/india/bhav/' + f).rows)) if (r[5] != null) o[s] = r[5]; }
const dates = Object.keys(byDay).sort(); const px = {};
dates.forEach((d, i) => { for (const [s, v] of Object.entries(byDay[d])) (px[s] ??= new Array(dates.length).fill(null))[i] = v; });
const hist = { dates, px };
const data = { feed: J('data/india/corp-actions-history.json', []), demergers: J('data/rules/demergers.json').records, ipos: J('data/rules/ipos.json').records, amfi: J('data/rules/amfi-schemes.json').rows, fundOverrides: J('data/rules/fund-overrides.json').records, charges: J('data/rules/charges.json'), taxRules: J('data/rules/tax.json'), divRules: J('data/rules/dividend.json'), prices, pricesAsOf: bhav.date ?? bf[bf.length - 1].slice(0, 10), priceHistory: hist };
const asOf = dates[dates.length - 1];
const now = {}, rows = [];
for (const f of files) {
  const a = J('portfolio/accounts/' + f); const owner = a.owner || a.label;
  if (!a.trades?.length) continue;
  let rep; try { rep = runPipeline([a.trades], a.broker, data, a.decisions || {}); } catch (e) { console.error('pipeline failed for', a.label, e.message); continue; }
  for (const h of rep.holdings) {
    if (h.kind !== 'Stock' || !(h.qty > 0)) continue;
    const v = stockVerdict(h.symbol, hist, data.feed, data.demergers);
    const key = `${a.label}|${h.symbol}`; now[key] = v.label;
    rows.push({ account: a.label, owner, symbol: h.symbol, name: h.name, book: h.book, qty: h.qty, value: h.value, label: v.label, why: v.reasons.slice(0, 2).join(' ') });
  }
}
const state = J('portfolio/book/holdings-state.json', { verdicts: {}, seeded: false });
const exits = rows.filter((r) => r.label === 'Exit');
const newly = exits.filter((r) => state.verdicts[`${r.account}|${r.symbol}`] !== 'Exit');
const inr = (n) => (n == null ? '' : ' ₹' + Math.round(n).toLocaleString('en-IN'));
const line = (r) => `${r.name} (${r.account}, ${r.book}${inr(r.value)})`;
let msg = null;
if (!state.seeded) msg = `Holdings check ${asOf}: ${rows.length} direct stocks across your accounts, ${exits.length} fail the exit test. Biggest: ` + exits.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 8).map(line).join('; ') + '. From tomorrow you only hear about new Exits.';
else if (newly.length) msg = `Holdings check ${asOf}: ${newly.length} newly fail the exit test:\n` + newly.map((r) => `${line(r)} - ${r.why}`).join('\n');
const back = Object.entries(state.verdicts).filter(([k, v]) => v === 'Exit' && now[k] && now[k] !== 'Exit').map(([k]) => k);
if (state.seeded && back.length) msg = (msg ? msg + '\n' : `Holdings check ${asOf}:\n`) + 'Back above the test: ' + back.join(', ');
console.log(JSON.stringify({ asOf, holdings: rows.length, exits: exits.length, newly: newly.length, seeded: state.seeded }));
if (msg) console.log(msg);
if (DRY) process.exit(0);
let ok = true;
if (msg) { try { execFileSync('node', ['scripts/alert.mjs', msg], { stdio: 'inherit' }); } catch { ok = false; console.error('alert not sent; will retry next run'); } }
if (ok) writeFileSync('portfolio/book/holdings-state.json', JSON.stringify({ seeded: true, asOf, verdicts: now }, null, 1) + '\n');
// the front-page card (src/pm/morning.ts): what changed since the last evening; a second run on the same day keeps the first run's changes
const prevLatest = J('portfolio/book/holdings-latest.json', null), sameDay = prevLatest?.asOf === asOf && prevLatest?.morning;
const morning = sameDay ? { ...morningSummary({ asOf, previousAsOf: prevLatest.morning.previousAsOf, rows, prev: {}, seeded: false, resultsNext: J('site/pm-data/results-next.json', { next: {} }).next }), newExits: prevLatest.morning.newExits, recovered: prevLatest.morning.recovered, seeded: prevLatest.morning.seeded }
  : morningSummary({ asOf, previousAsOf: state.asOf ?? null, rows, prev: state.verdicts, seeded: state.seeded, resultsNext: J('site/pm-data/results-next.json', { next: {} }).next });
writeFileSync('portfolio/book/holdings-latest.json', JSON.stringify({ asOf, rows, morning }, null, 1) + '\n');
if (!ok) process.exit(1);
