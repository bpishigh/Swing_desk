import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate, type OpenTrade, type Evening } from '../src/engine/exits.ts';
import { equityCurve, halvingState, statsFor, freshMoney, tradeR, type Trade } from '../src/engine/journal.ts';

const clean = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'number' && !Number.isFinite(x) ? 'NaN' : x === undefined ? null : x)));

// helpers for rule tests
const T0 = '2026-10-05';
const trade = (over: Partial<OpenTrade> = {}): OpenTrade => ({ setup: '1', entryDate: '2026-09-28', stop0: 95, stop: 95, pivot: 100, lots: [{ shares: 600, price: 100 }], sells: [], maxClose: 100, addShares: 400, gttPlaced: true, ...over });
const run = (t: OpenTrade, ev: Evening, market: 'india' | 'us' = 'india', dropped = false) => evaluate(t, ev, T0, market, dropped);
const has = (r: ReturnType<typeof evaluate>, rule: string) => r.acts.some((a) => a.r.startsWith(rule));

// Engine Rules: Exits (nine rules).
test('rule 1: stop order placed the same evening', () => assert.ok(has(run(trade({ gttPlaced: false }), { close: 101 }), 'Rule 1')));
test('rule 2: close at or below the stop', () => assert.ok(has(run(trade(), { close: 95 }), 'Rule 2')));
test('rule 3: failed breakout within 3 sessions only for breakout setups', () => {
  assert.ok(has(run(trade({ entryDate: '2026-10-01' }), { close: 98 }), 'Rule 3'));
  assert.ok(!has(run(trade({ entryDate: '2026-10-01', setup: '2' }), { close: 98 }), 'Rule 3'));
  assert.ok(!has(run(trade({ entryDate: '2026-09-28' }), { close: 98 }), 'Rule 3')); // 5 sessions
});
test('rule 4: time stop after 10 sessions without a +1R close', () => {
  assert.ok(has(run(trade({ entryDate: '2026-09-18', maxClose: 103 }), { close: 102 }), 'Rule 4'));
  assert.ok(!has(run(trade({ entryDate: '2026-09-18', maxClose: 106 }), { close: 102 }), 'Rule 4'));
});
test('+1R: add 40%, unless the first +1R close is already +2R (skip the add, take the third)', () => {
  assert.ok(has(run(trade(), { close: 106 }), 'Add 40%'));
  const r = run(trade(), { close: 111 });
  assert.ok(has(r, 'Add skipped') && has(r, 'Rule 5'));
});
test('rule 5: sell a third at +2R and move the stop to breakeven', () => {
  const r = run(trade({ added: true }), { close: 111 });
  assert.ok(has(r, 'Rule 5')); assert.equal(r.newStop, 100);
});
test('rule 6: India trail is the 20 EMA in weeks 1 to 7, weekly 10-week average from week 8; US is weekly from the start', () => {
  const t = trade({ thirdSold: true, added: true, entryDate: '2026-09-21' });
  assert.ok(has(run(t, { close: 105, ema21: 108 }), 'Rule 6 · trail'));
  assert.ok(has(run(t, { close: 105, ema21: 108 }, 'us'), 'Rule 6') && !has(run(t, { close: 105, ema21: 108, wk10: 100, wkClose: 101 }, 'us'), 'Rule 6 · trail'));
  const old = trade({ thirdSold: true, added: true, entryDate: '2026-07-01' });
  assert.ok(has(run(old, { close: 105, wk10: 108, wkClose: 106 }), 'Rule 6 · weekly trail'));
});
test('rule 7: extended, sell another third at 20% above the 20 EMA or on a climax day', () => {
  const t = trade({ thirdSold: true, added: true, entryDate: '2026-09-21' });
  assert.ok(has(run(t, { close: 120, ema21: 100 }), 'Rule 7'));
  assert.ok(has(run(t, { close: 105, ema21: 100, climax: true }), 'Rule 7'));
});
test('rule 8: results within 2 sessions: exit below +2R, hold with breakeven stop at +2R or more', () => {
  assert.ok(has(run(trade({ resultsDate: '2026-10-06' }), { close: 101 }), 'Rule 8'));
  const r = run(trade({ resultsDate: '2026-10-06', added: true, thirdSold: true }), { close: 112 });
  assert.equal(r.acts.find((a) => a.r.startsWith('Rule 8'))!.c, 'a-move');
});
test('rule 9: regime drop tightens the stop (below +1R) to the higher of today\'s low and the 10 EMA', () => {
  const r = run(trade(), { close: 101, prevLow: 99, ema10: 98 }, 'india', true);
  assert.equal(r.newStop, 99);
});
test('no rule fires: hold', () => assert.ok(has(run(trade(), { close: 101 }), 'Hold')));

// Journal: new-trade equity only; risk halving; the Journal Test.
test('tradeR is P&L over R per share times the planned full size', () => {
  const t: Trade = { stop0: 95, fullShares: 100, lots: [{ shares: 100, price: 100 }], sells: [{ shares: 100, price: 110 }] };
  assert.equal(tradeR(t), 2);
});
test('three losses in a row halve risk until two winners close; equity 5% below peak also halves', () => {
  const loss = (d: string): Trade => ({ stop0: 95, fullShares: 100, entryDate: d, exitDate: d, lots: [{ shares: 100, price: 100 }], sells: [{ shares: 100, price: 95 }] });
  const win = (d: string): Trade => ({ stop0: 95, fullShares: 100, entryDate: d, exitDate: d, lots: [{ shares: 100, price: 100 }], sells: [{ shares: 100, price: 110 }] });
  assert.equal(halvingState([loss('a'), loss('b'), loss('c')], 1_000_000).streakHalved, true);
  assert.equal(halvingState([loss('a'), loss('b'), loss('c'), win('d')], 1_000_000).streakHalved, true);
  assert.equal(halvingState([loss('a'), loss('b'), loss('c'), win('d'), win('e')], 1_000_000).streakHalved, false);
  assert.equal(halvingState([{ ...loss('a'), sells: [{ shares: 100, price: 40 }] }], 100_000).ddHalved, true); // lost 6,000 of 100,000 = 6% below peak
  assert.equal(halvingState([{ ...loss('a'), sells: [{ shares: 100, price: 40 }] }], 1_000_000).ddHalved, false); // 0.6%
});
test('Journal Test needs 20 closed trades over 90 days and all four tests', () => {
  assert.equal(freshMoney([], 1_000_000).enough, false);
  assert.equal(statsFor([]).n, 0);
  assert.equal(equityCurve([], 500).eq, 500);
});

// Replay against the original v9 code.
test('replay vs v9 evaluate (700 cases)', () => {
  const { cases } = JSON.parse(readFileSync('fixtures/expected/exits-v9.json', 'utf8'));
  for (const [n, c] of cases.entries()) {
    const got = clean(evaluate(c.trade, c.ev, T0, c.market, c.dropped));
    assert.deepEqual(got, c.expected, `case ${n}`);
  }
});
test('replay vs v9 journal functions (250 trade sets)', () => {
  const { cases } = JSON.parse(readFileSync('fixtures/expected/journal-v9.json', 'utf8'));
  for (const [n, c] of cases.entries()) {
    const got = clean({ eq: equityCurve(c.closed, c.startCapital), halving: halvingState(c.closed, c.startCapital), stats: statsFor(c.closed), fresh: freshMoney(c.closed, c.startCapital) });
    assert.deepEqual(got, c.expected, `set ${n}`);
  }
});
