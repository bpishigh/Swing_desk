import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareMarket, summarise } from '../src/ops/compare.ts';

test('prices compare in percent, returns in points, missing values are reported not guessed', () => {
  const claude = { tracker: { close: 100, sma50: 95, sma200: 90, volume: 50, b: { close: 200 } }, breadth: 18, feedHist: { sectors: { 'Nifty IT': { close: 1000, r1m: -3.0, r3m: 4.0 }, 'Nifty Bank': { close: 500 } } } };
  const repo = { tracker: { close: 100.02, sma50: 96, sma200: 90.1, volume: 49, b: { close: 200 } }, breadth: 20.2, feedHist: { sectors: { 'Nifty IT': { close: 1000, r1m: -3.2, r3m: 4.05 } } } };
  const rows = compareMarket('India', claude, repo);
  const get = (item: string, field: string) => rows.find((r) => r.item === item && r.field === field)!;
  assert.equal(get('Nifty 50', 'close').status, 'match');
  assert.equal(get('Nifty 50', 'sma50').status, 'differs');           // 1.05% > 0.5%
  assert.equal(get('Nifty 50', 'volume').status, 'match');
  assert.equal(get('Nifty 50', 'high').status, 'missing');
  assert.equal(get('Breadth', 'breadth').status, 'match');            // 2.2 points inside 3
  assert.equal(get('Nifty IT', 'r1m').status, 'differs');             // 0.2 points > 0.1
  assert.equal(get('Nifty IT', 'r3m').status, 'match');
  assert.equal(get('Nifty Bank', 'close').status, 'missing');
  const s = summarise(rows);
  assert.equal(s.rows, rows.length); assert.equal(s.match + s.differs + s.missing, s.rows);
});
