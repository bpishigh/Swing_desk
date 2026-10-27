import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worstDrawdown } from '../src/pm/drawdown.ts';

const day = (i: number, value: number, invested: number) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), value, invested, missingPrices: 0 });

test('a fall is measured from the peak', () => {
  const s = Array.from({ length: 30 }, (_, i) => day(i, i < 10 ? 100 + i : i < 20 ? 109 - (i - 9) * 3 : 80, 100));
  const d = worstDrawdown(s)!;
  assert.ok(d.depth > 0.25 && d.depth < 0.3, String(d.depth));
});

test('a deposit does not hide a fall, and does not count as a gain', () => {
  const s = Array.from({ length: 30 }, (_, i) => i < 15 ? day(i, 100, 100) : i === 15 ? day(i, 140, 140) : day(i, i < 20 ? 140 : 105, 140));
  const d = worstDrawdown(s)!;
  assert.ok(Math.abs(d.depth - 0.25) < 0.01, String(d.depth));
});

test('too little history gives nothing', () => { assert.equal(worstDrawdown([day(0, 1, 1)]), null); });
