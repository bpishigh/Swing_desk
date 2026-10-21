import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { tickerRuns, denylistHits, loadDenylist } from '../scripts/check-no-personal-data.mjs';

test('a list of three or more stock tickers in a string is flagged; public ETFs and short lists are not', () => {
  const leak = 'EMAs not refreshed (Dhan technical page stale): ALPHA, BETA, GAMMA, DELTA, OMEGA';
  assert.equal(tickerRuns(leak).length, 1);
  assert.equal(tickerRuns('US 200 SMA computed for XLE, XLU, XLV, IGV').length, 0); // public sector ETFs
  assert.equal(tickerRuns('ALPHA: price from earlier run; BETA price from earlier run').length, 0); // two names, no list
});
test('deny-list matches whole tickers only, case-insensitively, and comes from env', () => {
  const deny = loadDenylist({ PRIVACY_DENYLIST: 'alpha, BETA\nm&m' } as unknown as NodeJS.ProcessEnv, '/nonexistent');
  assert.deepEqual(deny, ['ALPHA', 'BETA', 'M&M']);
  assert.deepEqual(denylistHits('stale: beta and ALPHA', deny).sort(), ['ALPHA', 'BETA']);
  assert.deepEqual(denylistHits('ALPHABET and BETAMAX', deny), []);
});
test('the committed repo passes the check, and a deny-listed ticker in committed data would fail it', () => {
  execFileSync('node', ['scripts/check-no-personal-data.mjs'], { stdio: 'pipe', env: { ...process.env, PRIVACY_DENYLIST: '' } });
  assert.throws(() => execFileSync('node', ['scripts/check-no-personal-data.mjs'], { stdio: 'pipe', env: { ...process.env, PRIVACY_DENYLIST: 'NIFTY' } }), /status 1|Command failed/);
});
