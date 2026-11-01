import test from 'node:test';
import assert from 'node:assert/strict';
import { capped, volAdj, selectSleeve, sleeveWeights, isReviewSession, MOM30 } from '../src/engine/momentum-sleeve.ts';

test('capped weights sum to one and respect each cap', () => {
  const w = capped([10, 5, 3, 1, 1], [0.4, 0.4, 0.4, 0.4, 0.4]);
  assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  w.forEach((x) => assert.ok(x <= 0.4 + 1e-9));
});
test('volAdj needs a complete window and is higher for a steadier climb', () => {
  const steady = Array.from({ length: 300 }, (_, i) => 100 * 1.001 ** i), noisy = Array.from({ length: 300 }, (_, i) => 100 * 1.001 ** i * (1 + (i % 2 ? 0.03 : -0.03)));
  assert.equal(volAdj(steady, 50, 126), null);
  assert.ok((volAdj(steady, 299, 126) as number) > (volAdj(noisy, 299, 126) as number));
  assert.equal(volAdj(steady.map((x, i) => (i === 299 ? NaN : x)), 299, 126), null);
});
function world(n: number) {
  const series = new Map<string, { c: number[] }>(); const el: { sym: string; value: number }[] = [];
  for (let k = 0; k < n; k++) { const drift = 1 + (k % 17) / 10000 + k / 400000; series.set('S' + k, { c: Array.from({ length: 300 }, (_, i) => 100 * drift ** i * (1 + (((i * 7 + k * 13) % 11) - 5) / 400)) }); el.push({ sym: 'S' + k, value: 1e9 - k * 1e6 }); }
  return { series, el };
}
test('selection picks 30, keeps held names ranked 45 or better, weights are capped at 5%', () => {
  const { series, el } = world(220), first = selectSleeve(el, series, 299, new Set());
  assert.equal(first.picks.length, MOM30.HOLD); assert.equal(first.universe, 200);
  const w = sleeveWeights(first); assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-9); w.forEach((x) => assert.ok(x <= MOM30.CAPW + 1e-9));
  const held = first.ranked.find((r) => r.rank === 40)!.sym, again = selectSleeve(el, series, 299, new Set([held]));
  assert.ok(again.picks.some((p) => p.sym === held), 'a held name ranked 40 stays');
  const out = first.ranked.find((r) => r.rank === 60)!.sym; assert.ok(!selectSleeve(el, series, 299, new Set([out])).picks.some((p) => p.sym === out), 'a held name ranked 60 leaves');
});
test('review sessions are the first session of June and December only', () => {
  const d = ['2026-11-30', '2026-12-01', '2026-12-02', '2027-05-31', '2027-06-01'];
  assert.deepEqual(d.map((_, i) => isReviewSession(d, i)), [false, true, false, false, true]);
});
import { eligibleUs, US_UNI } from '../src/engine/momentum-sleeve.ts';
test('US eligibility keeps liquid, priced, long-history names and orders by dollar volume', () => {
  const mk = (px: number, vol: number, n = 300) => ({ c: Array.from({ length: n }, (_, i) => (i < n - 280 ? NaN : px)), v: Array.from({ length: n }, () => vol) });
  const s = new Map<string, any>([['BIG', mk(100, 1e6)], ['MID', mk(50, 8e5)], ['PENNY', mk(2, 1e8)], ['THIN', mk(100, 1e3)], ['SHORT', mk(100, 1e6, 100)]]);
  assert.deepEqual(eligibleUs(s, 299).map((e) => e.sym), ['BIG', 'MID']);
  assert.equal(US_UNI.minPrice, 5);
});
