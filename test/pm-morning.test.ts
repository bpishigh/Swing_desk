import { test } from 'node:test';
import assert from 'node:assert/strict';
import { morningSummary, type HoldingRow } from '../src/pm/morning.ts';
import { handle } from '../functions/api/portfolio.ts';
import { resetAccessCache } from '../functions/_lib/access.ts';

const row = (symbol: string, label: string, value = 1000, account = 'A'): HoldingRow => ({ account, symbol, name: symbol + ' LTD', value, label, why: 'because' });
const base = { asOf: '2026-10-20', previousAsOf: '2026-10-19', seeded: true };

test('new exits are those not Exit last night; recovered are Exit last night and not now', () => {
  const rows = [row('AAA', 'Exit', 500), row('BBB', 'Exit', 900), row('CCC', 'Keep'), row('DDD', 'No verdict')];
  const m = morningSummary({ ...base, rows, prev: { 'A|AAA': 'Exit', 'A|BBB': 'Keep', 'A|CCC': 'Exit', 'A|DDD': 'Keep' } });
  assert.deepEqual(m.newExits.map((r) => r.symbol), ['BBB']);
  assert.deepEqual(m.recovered.map((r) => r.symbol), ['CCC']);
  assert.deepEqual(m.exits.map((r) => r.symbol), ['BBB', 'AAA']);                     // biggest first
  assert.deepEqual(m.counts, { stocks: 4, exit: 2, keep: 1, noVerdict: 1 });
});
test('the first night reports no changes, only the counts', () => {
  const m = morningSummary({ ...base, seeded: false, rows: [row('AAA', 'Exit')], prev: {} });
  assert.equal(m.newExits.length, 0); assert.equal(m.recovered.length, 0); assert.equal(m.counts.exit, 1);
});
test('results within 10 sessions are listed in date order; later, past and missing dates are not', () => {
  const rows = [row('AAA', 'Keep'), row('BBB', 'Keep'), row('CCC', 'Keep'), row('DDD', 'Keep'), row('EEE', 'Keep')];
  const m = morningSummary({ ...base, rows, prev: {}, resultsNext: { AAA: '2026-10-22', BBB: '2026-10-20', CCC: '2026-11-30', DDD: '2026-10-19' } });
  assert.deepEqual(m.resultsDue.map((r) => [r.symbol, r.sessions]), [['BBB', 0], ['AAA', 2]]);
});
test('the same symbol in two accounts is kept apart', () => {
  const m = morningSummary({ ...base, rows: [row('AAA', 'Exit', 1, 'A'), row('AAA', 'Exit', 2, 'B')], prev: { 'A|AAA': 'Exit' } });
  assert.deepEqual(m.newExits.map((r) => r.account), ['B']);
});

// the function route: signed in only, and it returns only the morning part of the file
test('GET ?view=morning needs a sign-in and returns only the summary', async () => {
  resetAccessCache();
  const env = { TEAM_DOMAIN: 't.cloudflareaccess.com', POLICY_AUD: 'a', ALLOWED_EMAILS: 'o@example.com', GITHUB_TOKEN: 'x', REPO: 'o/r' };
  const res = await handle(new Request('https://x/api/portfolio?view=morning'), env, (async () => new Response('{}', { status: 500 })) as typeof fetch);
  assert.equal(res.status, 401);
});
