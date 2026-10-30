// Nightly sized shortlist (Engine Rules C-111, Portfolio Manager phase 9). Usage: node scripts/sized-shortlist.mjs [--dry]
// Runs the saved accounts (portfolio/accounts/*.json, the private repo) through the same pipeline and the same sizing the Portfolio page uses (src/pm/orderinputs.ts),
// for tonight's candidates (the scan's Ready list plus the paper book's new orders), and writes portfolio/book/shortlist-sized-latest.json in the private repo.
// Since C-113 the sized file and its message carry OFFICIAL candidates only; the paper book's capwaived and comparator picks go to portfolio/book/paper-test-latest.json and their own nightly message.
// The public shortlist files (data/india/shortlist) are never touched. An account whose last save is older than swingPools.ledgerMaxAgeDays (default 7) is marked unsized. Changes no rule.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { runPipeline } from '../src/pm/pipeline.ts';
import { acctAllocation, poolAccounts, poolInputs, candidatesFrom, paperPicks, paperVerdicts, buildPaperTest, paperMessage, dashNames, orderRun, staleAccounts, buildOverlay, sizedMessage } from '../src/pm/orderinputs.ts';
import { tradesOf } from '../src/pm/manual.ts';
import { loadPublicData, readJson as J } from './pm-nightly-lib.mjs';

const DRY = process.argv.includes('--dry'), OUT = 'portfolio/book/shortlist-sized-latest.json', OUT_PAPER = 'portfolio/book/paper-test-latest.json';
const files = existsSync('portfolio/accounts') ? readdirSync('portfolio/accounts').filter((f) => f.endsWith('.json')).sort() : [];
if (!files.length) { console.log('no accounts'); process.exit(0); }

const { data, alloc: C } = loadPublicData();
const scan = J('data/india/scan/latest.json', null), paper = J('data/india/paper/latest.json', null), reg = J('data/india/regime.json', {}).latest ?? null;
const tracker = readdirSync('data/india/tracker').filter((f) => /^\d{4}-\d\d-\d\d\.json$/.test(f)).sort(), vix = J('data/india/tracker/' + tracker[tracker.length - 1], {}).vix ?? null;
const asOf = scan?.asOf ?? paper?.asOf ?? data.pricesAsOf, light = reg?.name ?? null, P = C.swingPools, maxAge = Number.isFinite(P?.ledgerMaxAgeDays) ? P.ledgerMaxAgeDays : 7;

const closes = data.prices, picks = paperPicks(paper, J('data/names.json', { india: {} }).india);
const write = (o, out = OUT) => {
  const text = JSON.stringify(o, null, 1) + '\n';
  if (DRY) { console.log(text.length > 4000 ? text.slice(0, 4000) + '...' : text); return; }
  mkdirSync('portfolio/book', { recursive: true });
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) writeFileSync(out, text);   // unchanged content is not rewritten, so the private repo only gets a commit when something moved
};

// TWO Telegram messages per night, each sent again only if its text changed (a re-run after you upload an account): the official orders, then the paper test (C-113). State: portfolio/book/sized-state.json and paper-state.json. A failed send is retried on the next run.
const send = (msg, stateFile) => {
  if (!msg) return; if (DRY) { console.log(msg + '\n'); return; }
  const hash = createHash('sha1').update(msg).digest('hex'), st = J(stateFile, {});
  if (st.asOf === asOf && st.hash === hash) return;
  try { execFileSync('node', ['scripts/alert.mjs', msg], { stdio: 'inherit' }); writeFileSync(stateFile, JSON.stringify({ asOf, hash }, null, 1) + '\n'); }
  catch { console.error(`${stateFile}: alert not sent; will retry next run`); }
};
const xs = [], failed = [], saved = [];
for (const f of files) {
  const a = J('portfolio/accounts/' + f); if (!a.trades?.length) continue;
  const eff = tradesOf(a, J('data/names.json', { india: {} }).india), A = { ...(a.settings ?? {}), stops: { ...eff.stops, ...(a.settings?.stops ?? {}) } }, acct = { key: f.replace(/\.json$/, ''), label: a.label, owner: a.owner || '', report: null };   // hand-added trades count until an upload covers them; their typed stops too (C-114)
  try { acct.report = runPipeline([eff.effective], a.broker, data, a.decisions || {}, A.swing || {}, A.types || {}); } catch (e) { failed.push(`${a.label}: ${e.message}`); continue; }
  xs.push({ a: acct, A, ...acctAllocation(C, acct.report, A) }); saved.push({ label: a.label, savedAt: a.uploadedAt ?? a.savedAt });   // the last UPLOAD, not the last save (C-114)
}
const base = { asOf, light, vix, ledgerMaxAgeDays: maxAge, stale: [], risk: 0, cap: 0, maxPos: 0, why: [], householdOpenRisk: 0, householdCapRs: 0, householdPositions: 0, accounts: xs.map((x) => x.a.label), notes: [], lines: [] };
// the paper-test file and its message (every night, whatever the accounts look like)
const paperOut = (verdicts) => { const pt = buildPaperTest({ asOf, light, picks, verdicts, closes, paper }); write(pt, OUT_PAPER); send(paperMessage(pt), 'portfolio/book/paper-state.json'); };
if (failed.length) { paperOut({}); write({ ...base, banner: `Nothing sized tonight: could not read ${failed.join('; ')}.` }); console.log('failed:', failed.join(' | ')); process.exit(1); }
const ok = poolAccounts(xs);
if (ok.length < 2) { paperOut({}); write({ ...base, banner: null, notes: ['Fewer than two accounts have a direct-equity target, so nothing is sized or routed (the Portfolio page needs two as well).'] }); console.log('fewer than two accounts'); process.exit(0); }

const cands = candidatesFrom(scan, paper, dashNames(scan, paper, J('data/names.json', { india: {} }).india));
const pool = poolInputs(ok, P, data.pricesAsOf);
const { out } = orderRun(ok, pool, cands, { light, vix, P, taxRules: data.taxRules, taxRowConfident: data.taxRules.types.listed_equity.confidence === 'High', today: data.pricesAsOf });
const stale = staleAccounts(saved.filter((s) => ok.some((x) => x.a.label === s.label)), data.pricesAsOf, maxAge), ctx = { light, vix, P, taxRules: data.taxRules, taxRowConfident: data.taxRules.types.listed_equity.confidence === 'High', today: data.pricesAsOf };
const ov = buildOverlay({ asOf, light, vix, out, stale, maxAgeDays: maxAge, accounts: ok.map((x) => x.a.label), closes });
if (reg?.date && scan?.asOf && reg.date !== scan.asOf) ov.notes = [...ov.notes, `The market light is from ${reg.date} and the scan is from ${scan.asOf}.`];
write(ov);
send(sizedMessage(ov), 'portfolio/book/sized-state.json');
paperOut(paperVerdicts(ok, pool, picks, ctx, stale, maxAge));
console.log(JSON.stringify({ asOf, light, accounts: ov.accounts.length, official: cands.length, placed: ov.lines.filter((l) => l.account).length, paper: picks.length, stale: ov.stale.length }));
