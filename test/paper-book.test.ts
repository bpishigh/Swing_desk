import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, applySplits, newBook, tierCost, summarize, type PaperPos } from '../src/ingest/paper-book.ts';
import type { Hist } from '../src/ingest/us-scan.ts';

const mk = (n: number, bars: Array<[number, number, number]>): Hist => {   // [close, high, low] per session, padded flat before
  const dates = Array.from({ length: n }, (_, i) => new Date(Date.parse('2026-01-05') + i * 86400000).toISOString().slice(0, 10));
  const c = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), v = new Float64Array(n).fill(1e6);
  const off = n - bars.length;
  for (let i = 0; i < n; i++) { const b = bars[Math.max(0, i - off)]; c[i] = b[0]; h[i] = b[1]; l[i] = b[2]; }
  return { dates, series: new Map([['X', { c, h, l, v }]]) };
};
const pos = (over: Partial<PaperPos> = {}): PaperPos => ({
  id: 'T1', stream: 'official', sym: 'X', group: 'g', setup: '2', regime: 'yellow', signalDate: '2026-01-05', signalIdx: 0, status: 'pending', kind: 'trigger',
  trigger: 100, limit: 101, basis: 99, stopInitial: 95, stop: 95, atr14: 2, atrPct: 2, roomRef: 100, overhead: null, tags: [], dv20: 2e8, costPct: 0.002, maxStopPct: 8,
  left: 1, pnlR: 0, maxClose: 0, thirdSold: false, extSold: false, pend: null, splitsApplied: [], ...over,
});
const run = (h: Hist, p: PaperPos, from: number) => { const b = newBook('2026-01-05'); b.ledger.push(p); for (let t = from; t < h.dates.length; t++) advance(b, h, t, 'yellow', 'yellow'); return b.ledger[0]; };

test('tierCost steps by dollar volume', () => {
  assert.equal(tierCost(2e8), 0.002); assert.equal(tierCost(5e7), 0.0035); assert.equal(tierCost(1e7), 0.006);
});
test('trigger order not touched next session is "not filled"', () => {
  const h = mk(3, [[98, 99, 97], [98, 99, 97], [98, 99, 97]]);
  const p = run(h, pos({ signalIdx: 0 }), 1);
  assert.equal(p.status, 'closed'); assert.equal(p.exitReason, 'not filled'); assert.equal(p.resultR, undefined);
});
test('trigger fills at the trigger and the stop fills at the stop with cost', () => {
  const h = mk(3, [[99, 99, 98], [101, 102, 99.5], [94, 100, 93]]);
  const p = run(h, pos({ signalIdx: 0 }), 1);
  assert.equal(p.entry, 100); assert.equal(p.exitReason, 'stop'); assert.equal(p.exitDate, h.dates[2]);
  assert.ok(Math.abs((p.resultR as number) - (-1 - (0.002 * 100) / 5)) < 1e-9);
});
test('failed breakout acts at the NEXT close, not the same one', () => {
  const h = mk(4, [[99, 99, 98], [100.5, 102, 99.5], [98, 101, 97], [99, 100, 98]]);
  const p = run(h, pos({ signalIdx: 0, setup: '1', basis: 99.5 }), 1);
  assert.equal(p.exitReason, 'failed breakout'); assert.equal(p.exitDate, h.dates[3]);
});
test('pending order expires if not evaluated on the following session', () => {
  const h = mk(4, [[99, 99, 98], [99, 99, 98], [99, 99, 98], [99, 99, 98]]);
  const b = newBook('x'); b.ledger.push(pos({ signalIdx: 0 })); advance(b, h, 2, 'yellow', 'yellow');
  assert.equal(b.ledger[0].exitReason, 'expired');
});
test('split after the signal rescales levels once', () => {
  const b = newBook('x'); b.ledger.push(pos());
  applySplits(b, [['X', '2026-01-10', 1, 2]], '2026-01-12');
  applySplits(b, [['X', '2026-01-10', 1, 2]], '2026-01-12');
  assert.equal(b.ledger[0].trigger, 50); assert.equal(b.ledger[0].stop, 47.5); assert.deepEqual(b.ledger[0].splitsApplied, ['2026-01-10']);
});
test('split on or before the signal date is ignored', () => {
  const b = newBook('x'); b.ledger.push(pos());
  applySplits(b, [['X', '2026-01-05', 1, 2]], '2026-01-12');
  assert.equal(b.ledger[0].trigger, 100);
});
test('summarize counts by stream', () => {
  const b = newBook('x'); b.ledger.push(pos({ status: 'closed', resultR: 1 }), pos({ id: 'T2', status: 'closed', exitReason: 'not filled' }));
  const s = summarize(b) as any;
  assert.equal(s.official.orders, 2); assert.equal(s.official.closed, 1); assert.equal(s.official.notFilled, 1); assert.equal(s.official.meanR, 1);
});
