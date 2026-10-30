import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { acctAllocation, poolAccounts, poolInputs, candidatesFrom, paperPicks, paperVerdicts, buildPaperTest, paperMessage, awayText, dashNames, orderRun, staleAccounts, buildOverlay, normName } from '../src/pm/orderinputs.ts';
import { sizeOrders } from '../src/pm/swingorders.ts';

const J = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const C = J('settings/allocation.json'), taxRules = J('data/rules/tax.json'), P = C.swingPools;
const rep = (o: any = {}) => ({ holdings: [{ name: 'Held Ltd', symbol: 'HELD', kind: 'Stock', book: 'Legacy', assetClass: 'direct_equity', qty: 100, cost: 900000, value: 1000000 }], openLots: [], books: {}, tax: [], journal: [], saleProposals: [], swingProposals: [], resolver: { unexplained: [] }, journalSkipped: [], ...o });
const acct = (key: string, label: string, owner: string, report: any, A: any = { capital: 1000000, profile: 'Aggressive' }) => ({ a: { key, label, owner, report }, A, ...acctAllocation(C, report, A) });
const cand = { sym: 'AAA', name: 'AAA Ltd', setup: '1', trigger: 1005, stop: 940 };
const ctx = (extra: any = {}) => ({ light: 'green', vix: 14, P, taxRules, taxRowConfident: true, today: '2026-10-30', ...extra });

test('ledgerMaxAgeDays is a setting: 35 days, as the owner uploads trades monthly', () => assert.equal(P.ledgerMaxAgeDays, 35));

test('candidates: the scan Ready list first, then the paper book OFFICIAL orders, one line per stock; capwaived and comparator never (C-113)', () => {
  const scan = { ready: [{ sym: 'AAA', setup: { id: '1', trigger: 100, stop: 90 }, diag: { atr14: 3 }, close: 98 }, { sym: 'BBB', setup: null }] };
  const paper = { newOrdersTonight: [{ stream: 'official', sym: 'AAA', setup: '2', trigger: 1, stop: 1 }, { stream: 'official', sym: 'CCC', setup: '4', trigger: 50, stop: 45 }, { stream: 'capwaived', sym: 'DDD', setup: '4', trigger: 80, stop: 70 }, { stream: 'comparator', sym: 'EEE', setup: '2', trigger: 60, stop: 55 }] };
  const c = candidatesFrom(scan, paper, { AAA: 'Aaa Ltd' });
  assert.deepEqual(c.map((x) => x.sym), ['AAA', 'CCC']);
  assert.equal(c[0].atr, 3); assert.equal(c[0].name, 'Aaa Ltd'); assert.equal(c[1].atr, undefined);
});
test('names: only the stocks the dashboard shows get a company name, not tonight\'s new orders', () => {
  const n = dashNames({ ready: [{ sym: 'AAA' }], watch: [{ sym: 'BBB' }] }, { live: [{ sym: 'LLL' }], recent: [], newOrdersTonight: [{ sym: 'CCC' }] }, { AAA: 'A', BBB: 'B', LLL: 'L', CCC: 'C' });
  assert.deepEqual(n, { AAA: 'A', BBB: 'B', LLL: 'L' });
});
test('name matching ignores case, punctuation and Ltd/Limited', () => assert.equal(normName('Aaa Industries Limited.'), normName('AAA INDUSTRIES LTD')));

test('stale ledger: more than the limit is stale, exactly the limit is not, no save date is stale', () => {
  const s = staleAccounts([{ label: 'A', savedAt: '2026-10-23T05:00:00Z' }, { label: 'B', savedAt: '2026-10-22T05:00:00Z' }, { label: 'C' }], '2026-10-30', 7);
  assert.deepEqual(s.map((x) => x.label), ['B', 'C']);
  assert.equal(s[0].ageDays, 8);
});

test('household sizing is built from each account\'s own target, stops, Legacy blocks and swing names', () => {
  const lotsB = [{ name: 'AAA Ltd', book: 'Legacy', qty: 10, price: 100, unitCost: 100, type: 'listed_equity', date: '2026-09-01' }];
  const xs = [acct('a', 'A', 'P1', rep()), acct('b', 'B', 'P2', rep({ openLots: lotsB }))];
  const ok = poolAccounts(xs); assert.equal(ok.length, 2);
  const pool = poolInputs(ok, P, '2026-10-30');
  const capA = xs[0].res.rows.find((r: any) => r.cls === 'direct_equity').amount;
  assert.equal(pool.rows[0].swingCapital, capA); assert.ok(capA > 0);
  const { out } = orderRun(ok, pool, [cand] as any, ctx());
  // the same call written out by hand: capital per account, B blocked by its short-term Legacy lot in the same stock
  const hand = sizeOrders([cand] as any, [{ ...pool.accts[0], openRisk: 0, stopsMissing: [], blocked: [], heldValue: {} }, { ...pool.accts[1], openRisk: 0, stopsMissing: [], blocked: ['AAA Ltd'], heldValue: {} }] as any, pool.rows, { light: 'green', vix: 14, s: P, stcgYtd: pool.stcg, taxRowConfident: true, provenGreen: false } as any);
  assert.deepEqual(out.lines.map((l) => l.perAccount.map((p) => [p.label, p.qty, p.ok])), hand.lines.map((l) => l.perAccount.map((p) => [p.label, p.qty, p.ok])));
  const b = out.lines[0].perAccount[1]; assert.equal(b.ok, false); assert.match(b.note!, /blocked/);
  assert.ok(out.lines[0].perAccount[0].qty > 0); assert.equal(out.lines[0].account, 'A');
});
test('a typed stop on an open Swing lot counts as open risk, and a missing one is named', () => {
  const swing = (name: string, stop?: number) => ({ name, book: 'Swing', qty: 100, price: 500, unitCost: 500, type: 'listed_equity', date: '2026-10-20', ...(stop ? { stop } : {}) });
  const xs = [acct('a', 'A', 'P1', rep({ openLots: [swing('X Ltd'), swing('Y Ltd')] }), { capital: 1000000, profile: 'Aggressive', stops: { 'X Ltd': 480 } }), acct('b', 'B', 'P2', rep())];
  const ok = poolAccounts(xs), pool = poolInputs(ok, P, '2026-10-30');
  const { out, oa } = orderRun(ok, pool, [], ctx());
  assert.equal(oa[0].openRisk, 100 * 20); assert.deepEqual(oa[0].stopsMissing, ['Y Ltd']);
  assert.equal(out.householdPositions, 2);
  assert.match(out.notes.join(' '), /without a stop recorded/);
});

test('overlay: with nothing stale the lines are exactly the sized lines and there is no banner', () => {
  const xs = [acct('a', 'A', 'P1', rep()), acct('b', 'B', 'P2', rep())], ok = poolAccounts(xs), pool = poolInputs(ok, P, '2026-10-30');
  const { out } = orderRun(ok, pool, [cand] as any, ctx());
  const ov = buildOverlay({ asOf: '2026-10-30', light: 'green', vix: 14, out, stale: [], maxAgeDays: 7, accounts: ['A', 'B'] });
  assert.equal(ov.banner, null); assert.deepEqual(ov.lines.map(({ reason, close, ...l }) => l), out.lines); assert.ok(ov.lines.every((l) => l.reason === null || !l.account)); assert.equal(ov.risk, out.risk);
});
test('overlay: a stale account is blanked with the reason, a line routed to it is not placed, the other account keeps its size', () => {
  const xs = [acct('a', 'A', 'P1', rep()), acct('b', 'B', 'P2', rep())], ok = poolAccounts(xs), pool = poolInputs(ok, P, '2026-10-30');
  const { out } = orderRun(ok, pool, [cand] as any, ctx());
  const routed = out.lines[0].account!, other = routed === 'A' ? 'B' : 'A';
  const ov = buildOverlay({ asOf: '2026-10-30', light: 'green', vix: 14, out, stale: [{ label: routed, savedAt: '2026-10-01', ageDays: 29 }], maxAgeDays: 7, accounts: ['A', 'B'] });
  const l = ov.lines[0];
  assert.equal(l.account, null); assert.match(l.verdict, /^Not sized: /);
  const stale = l.perAccount.find((p) => p.label === routed)!, kept = l.perAccount.find((p) => p.label === other)!;
  assert.equal(stale.qty, 0); assert.equal(stale.ok, false); assert.match(stale.note!, /29 days ago \(limit 7\)/);
  assert.deepEqual(kept, out.lines[0].perAccount.find((p) => p.label === other));
  assert.match(ov.banner!, new RegExp('Not sized for ' + routed));
});
test('overlay: nothing sized when there is no market light, as on the page', () => {
  const xs = [acct('a', 'A', 'P1', rep()), acct('b', 'B', 'P2', rep())], ok = poolAccounts(xs), pool = poolInputs(ok, P, '2026-10-30');
  const { out } = orderRun(ok, pool, [cand] as any, ctx({ light: null }));
  assert.equal(out.lines.length, 0); assert.match(out.notes.join(' '), /No market light/);
});

// the function route: signed in only (the file names holdings' sizes, so it sits behind Cloudflare Access like the morning card)
import { handle } from '../functions/api/portfolio.ts';
import { resetAccessCache } from '../functions/_lib/access.ts';
test('GET ?view=sized and ?view=paper need a sign-in', async () => {
  resetAccessCache();
  const env = { TEAM_DOMAIN: 't.cloudflareaccess.com', POLICY_AUD: 'a', ALLOWED_EMAILS: 'o@example.com', GITHUB_TOKEN: 'x', REPO: 'o/r' };
  const res = await handle(new Request('https://x/api/portfolio?view=sized'), env, (async () => new Response('{}', { status: 500 })) as typeof fetch);
  assert.equal(res.status, 401);
  const res2 = await handle(new Request('https://x/api/portfolio?view=paper'), env, (async () => new Response('{}', { status: 500 })) as typeof fetch);
  assert.equal(res2.status, 401);
});

import { sizedMessage, shortReason } from '../src/pm/orderinputs.ts';
test('Telegram text: placed lines name the account, quantity and binding limit; a line nobody takes gives its reason once', () => {
  const xs = [acct('a', 'A', 'P1', rep()), acct('b', 'B', 'P2', rep())], ok = poolAccounts(xs), pool = poolInputs(ok, P, '2026-10-30');
  const { out } = orderRun(ok, pool, [cand, { ...cand, sym: 'WIDE', name: 'Wide Ltd', stop: 500 }] as any, ctx());
  const ov = buildOverlay({ asOf: '2026-10-30', light: 'green', vix: 14, out, stale: [], maxAgeDays: 7, accounts: ['A', 'B'] });
  const m = sizedMessage(ov)!;
  assert.match(m, /^Swing orders · OFFICIAL · Fri 30 Oct · GREEN light\nRisk 0\.5% of swing capital per trade/); assert.match(m, /BUY TONIGHT\n• AAA Ltd \(.*\): [AB] buy \d+, first \d+, buy above 1005, stop 940\. Limit: /);
  const wide = m.split('\n').find((x) => x.startsWith('• Wide Ltd'))!; assert.ok(wide && /stop [\d.]+% below entry, over the \d+% limit/.test(wide) && !/A: .*; B: /.test(wide), 'one shared reason in a few words, not repeated per account');
  assert.match(m, /SKIPPED \(1\)/);
  assert.match(m, /A suggestion, never an order\. Paper-test picks are in a separate message\.$/);
});
test('Telegram text: no official orders still sends a message every night; a stale account is named in it', () => {
  const xs = [acct('a', 'A', 'P1', rep()), acct('b', 'B', 'P2', rep())], ok = poolAccounts(xs), pool = poolInputs(ok, P, '2026-10-30');
  const none = buildOverlay({ asOf: '2026-10-30', light: 'green', vix: 14, out: orderRun(ok, pool, [], ctx()).out, stale: [], maxAgeDays: 7, accounts: ['A', 'B'] });
  assert.match(sizedMessage(none)!, /BUY TONIGHT\nNo official orders tonight\./);
  const { out } = orderRun(ok, pool, [cand] as any, ctx());
  const stale = buildOverlay({ asOf: '2026-10-30', light: 'green', vix: 14, out, stale: [{ label: 'B', savedAt: '2026-10-01', ageDays: 29 }], maxAgeDays: 7, accounts: ['A', 'B'] });
  assert.match(sizedMessage(stale)!, /NOT SIZED \(ledger older than 7 days\)\n• B: saved 1 Oct, 29 days ago\nUpload them again/);
  const dark = buildOverlay({ asOf: '2026-10-30', light: null, vix: null, out: orderRun(ok, pool, [cand] as any, ctx({ light: null })).out, stale: [], maxAgeDays: 7, accounts: ['A', 'B'] });
  assert.match(sizedMessage(dark)!, /No market light/);
});

test('a stale account does not hide the real reason: the stock\'s own reason comes from the accounts that are current', () => {
  const xs = [acct('a', 'A', 'P1', rep()), acct('b', 'B', 'P2', rep())], ok = poolAccounts(xs), pool = poolInputs(ok, P, '2026-10-30');
  const { out } = orderRun(ok, pool, [{ ...cand, sym: 'WIDE', name: 'Wide Ltd', stop: 500 }] as any, ctx());
  const ov = buildOverlay({ asOf: '2026-10-30', light: 'green', vix: 14, out, stale: [{ label: 'B', savedAt: '2026-10-01', ageDays: 29 }], maxAgeDays: 7, accounts: ['A', 'B'] });
  assert.match(ov.lines[0].reason!, /^stop [\d.]+% below entry, over the \d+% limit for /); assert.doesNotMatch(ov.lines[0].reason!, /ledger/);
  assert.equal(shortReason('something else'), 'something else');
});

test('buy above: the message shows tonight\'s close and the gap to the trigger', () => {
  assert.equal(awayText(1689.37, 1625), 'close 1625.00, needs +4.0%'); assert.equal(awayText(100, 105), 'close 105.00, already above it'); assert.equal(awayText(100, null), '');
  const xs = [acct('a', 'A', 'P1', rep()), acct('b', 'B', 'P2', rep())], ok = poolAccounts(xs), pool = poolInputs(ok, P, '2026-10-30');
  const { out } = orderRun(ok, pool, [cand] as any, ctx());
  const ov = buildOverlay({ asOf: '2026-10-30', light: 'green', vix: 14, out, stale: [], maxAgeDays: 7, accounts: ['A', 'B'], closes: { AAA: 980 } });
  assert.equal(ov.lines[0].close, 980); assert.match(sizedMessage(ov)!, /buy above 1005 \(close 980\.00, needs \+2\.6%\), stop 940/);
});
const paperNight = { asOf: '2026-10-30', official: { orders: 0, meanR: null }, capwaived: { orders: 20, open: 6, pending: 4, closed: 4, meanR: -0.469 }, comparator: { orders: 7, meanR: -0.903 },
  newOrdersTonight: [{ stream: 'official', sym: 'OFF', setup: '1', trigger: 100, stop: 95 },
    { stream: 'capwaived', sym: 'SYRMA', setup: '4', trigger: 1689.37, stop: 1491.64, kind: 'trigger', tags: ['over cap'], stopPct: 11.7, maxStopPct: 6, roomR: 4 },
    { stream: 'comparator', sym: 'CMP', setup: '2', trigger: 200, stop: 180, kind: 'close', tags: [], stopPct: 10, maxStopPct: 7, roomR: null }] };
test('paper picks: only capwaived and comparator, each tagged with its stream and never an official order', () => {
  const k = paperPicks(paperNight, { SYRMA: 'Syrma SGS' });
  assert.deepEqual(k.map((x) => x.stream + ':' + x.cand.sym), ['capwaived:SYRMA', 'comparator:CMP']); assert.equal(k[0].cand.name, 'Syrma SGS'); assert.equal(k[1].kind, 'close'); assert.equal(k[0].stopPct, 11.7);
});
test('paper verdicts: the live rules\' verdict per pick, from a separate run that uses no real risk room', () => {
  const xs = [acct('a', 'A', 'P1', rep()), acct('b', 'B', 'P2', rep())], ok = poolAccounts(xs), pool = poolInputs(ok, P, '2026-10-30');
  const picks = paperPicks({ newOrdersTonight: [{ stream: 'capwaived', sym: 'WIDE', setup: '4', trigger: 1000, stop: 700 }, { stream: 'comparator', sym: 'WIDE', setup: '4', trigger: 1000, stop: 700 }] });
  const v = paperVerdicts(ok, pool, picks, ctx(), [], 7);
  assert.match(v['capwaived:WIDE'], /over the \d+% limit/); assert.match(v['comparator:WIDE'], /over the \d+% limit/);
  const before = JSON.stringify(orderRun(ok, pool, [cand] as any, ctx()).out); paperVerdicts(ok, pool, picks, ctx(), [], 7);
  assert.equal(JSON.stringify(orderRun(ok, pool, [cand] as any, ctx()).out), before, 'paper picks leave the official sizing unchanged');
});
test('paper message: every pick is tagged, says it is not for placing, shows the tally, and still sends when empty', () => {
  const pt = buildPaperTest({ asOf: '2026-10-30', light: 'red', picks: paperPicks(paperNight), verdicts: { 'capwaived:SYRMA': 'stop 11.7% below entry, over the 6% limit for setup 4' }, closes: { SYRMA: 1625 }, paper: paperNight });
  const m = paperMessage(pt);
  assert.match(m, /^Swing PAPER TEST · Fri 30 Oct · RED light\nNot for placing\./);
  assert.match(m, /CAPWAIVED, buy above a trigger.*\(1\)\n• SYRMA \(setup 4\) \[capwaived\]: buy above 1689\.37 \(close 1625\.00, needs \+4\.0%\), stop 1491\.64, 11\.7% wide\. Live rules: stop 11\.7% below entry/);
  assert.match(m, /COMPARATOR, bought at the next close.*\(1\)\n• CMP \(setup 2\) \[comparator\]: enter at the next close \(reference 200\), stop 180, 10% wide\./);
  assert.ok(!/OFF/.test(m), 'official picks are not in the paper note'); assert.match(m, /So far: official 0 orders, capwaived 20 orders \(avg −0\.47R\), comparator 7 orders \(avg −0\.90R\)\./);
  const empty = paperMessage(buildPaperTest({ asOf: '2026-10-30', light: 'red', picks: [], verdicts: {}, paper: paperNight }));
  assert.match(empty, /CAPWAIVED.*\(0\)\nNone tonight\./); assert.match(empty, /COMPARATOR.*\(0\)\nNone tonight\./);
});
