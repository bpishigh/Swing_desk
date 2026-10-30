// Nightly sized shortlist (Engine Rules C-111, Portfolio Manager phase 9). Usage: node scripts/sized-shortlist.mjs [--dry]
// Runs the saved accounts (portfolio/accounts/*.json, the private repo) through the same pipeline and the same sizing the Portfolio page uses (src/pm/orderinputs.ts),
// for tonight's candidates (the scan's Ready list plus the paper book's new orders), and writes portfolio/book/shortlist-sized-latest.json in the private repo.
// The public shortlist files (data/india/shortlist) are never touched. An account whose last save is older than swingPools.ledgerMaxAgeDays (default 7) is marked unsized. Changes no rule.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { runPipeline } from '../src/pm/pipeline.ts';
import { acctAllocation, poolAccounts, poolInputs, candidatesFrom, dashNames, orderRun, staleAccounts, buildOverlay, sizedMessage } from '../src/pm/orderinputs.ts';
import { loadPublicData, readJson as J } from './pm-nightly-lib.mjs';

const DRY = process.argv.includes('--dry'), OUT = 'portfolio/book/shortlist-sized-latest.json';
const files = existsSync('portfolio/accounts') ? readdirSync('portfolio/accounts').filter((f) => f.endsWith('.json')).sort() : [];
if (!files.length) { console.log('no accounts'); process.exit(0); }

const { data, alloc: C } = loadPublicData();
const scan = J('data/india/scan/latest.json', null), paper = J('data/india/paper/latest.json', null), reg = J('data/india/regime.json', {}).latest ?? null;
const tracker = readdirSync('data/india/tracker').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort(), vix = J('data/india/tracker/' + tracker[tracker.length - 1], {}).vix ?? null;
const asOf = scan?.asOf ?? paper?.asOf ?? data.pricesAsOf, light = reg?.name ?? null, P = C.swingPools, maxAge = Number.isFinite(P?.ledgerMaxAgeDays) ? P.ledgerMaxAgeDays : 7;

const write = (o) => {
  const text = JSON.stringify(o, null, 1) + '\n';
  if (DRY) { console.log(text.length > 4000 ? text.slice(0, 4000) + '...' : text); return; }
  mkdirSync('portfolio/book', { recursive: true });
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== text) writeFileSync(OUT, text);   // unchanged content is not rewritten, so the private repo only gets a commit when something moved
};

const xs = [], failed = [], saved = [];
for (const f of files) {
  const a = J('portfolio/accounts/' + f); if (!a.trades?.length) continue;
  const A = a.settings ?? {}, acct = { key: f.replace(/\.json$/, ''), label: a.label, owner: a.owner || '', report: null };
  try { acct.report = runPipeline([a.trades], a.broker, data, a.decisions || {}, A.swing || {}, A.types || {}); } catch (e) { failed.push(`${a.label}: ${e.message}`); continue; }
  xs.push({ a: acct, A, ...acctAllocation(C, acct.report, A) }); saved.push({ label: a.label, savedAt: a.savedAt });
}
const base = { asOf, light, vix, ledgerMaxAgeDays: maxAge, stale: [], risk: 0, cap: 0, maxPos: 0, why: [], householdOpenRisk: 0, householdCapRs: 0, householdPositions: 0, accounts: xs.map((x) => x.a.label), notes: [], lines: [] };
if (failed.length) { write({ ...base, banner: `Nothing sized tonight: could not read ${failed.join('; ')}.` }); console.log('failed:', failed.join(' | ')); process.exit(1); }
const ok = poolAccounts(xs);
if (ok.length < 2) { write({ ...base, banner: null, notes: ['Fewer than two accounts have a direct-equity target, so nothing is sized or routed (the Portfolio page needs two as well).'] }); console.log('fewer than two accounts'); process.exit(0); }

const cands = candidatesFrom(scan, paper, dashNames(scan, paper, J('data/names.json', { india: {} }).india));
const pool = poolInputs(ok, P, data.pricesAsOf);
const { out } = orderRun(ok, pool, cands, { light, vix, P, taxRules: data.taxRules, taxRowConfident: data.taxRules.types.listed_equity.confidence === 'High', today: data.pricesAsOf });
const ov = buildOverlay({ asOf, light, vix, out, stale: staleAccounts(saved.filter((s) => ok.some((x) => x.a.label === s.label)), data.pricesAsOf, maxAge), maxAgeDays: maxAge, accounts: ok.map((x) => x.a.label) });
if (reg?.date && scan?.asOf && reg.date !== scan.asOf) ov.notes = [...ov.notes, `The market light is from ${reg.date} and the scan is from ${scan.asOf}.`];
write(ov);
// ONE Telegram message per night, sent again only if its text changed (a re-run after you upload an account). State: portfolio/book/sized-state.json. A failed send is retried on the next run.
const msg = sizedMessage(ov);
if (msg && !DRY) {
  const hash = createHash('sha1').update(msg).digest('hex'), st = J('portfolio/book/sized-state.json', {});
  if (st.asOf !== asOf || st.hash !== hash) {
    try { execFileSync('node', ['scripts/alert.mjs', msg], { stdio: 'inherit' }); writeFileSync('portfolio/book/sized-state.json', JSON.stringify({ asOf, hash }, null, 1) + '\n'); }
    catch { console.error('sized shortlist alert not sent; will retry next run'); }
  }
} else if (msg) console.log(msg);
console.log(JSON.stringify({ asOf, light, accounts: ov.accounts.length, candidates: cands.length, placed: ov.lines.filter((l) => l.account).length, stale: ov.stale.length }));
