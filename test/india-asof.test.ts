import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asOfHistories, resolveHistory, toDays } from '../src/backtest/india-asof.ts';
import type { BhavDay } from '../src/ingest/india-stocks.ts';

const dates = Array.from({ length: 30 }, (_, i) => new Date(Date.parse('2024-01-01') + i * 86400000).toISOString().slice(0, 10));
// X: 1:1 bonus on day 15 (price halves, volume doubles); Y: a break with no action on day 20; Z: ordinary.
const px = (sym: string, i: number): number => (sym === 'X' ? (i < 15 ? 200 : 100) : sym === 'Y' ? (i < 20 ? 100 : 40) : 50);
const bhav: BhavDay[] = dates.map((date, i) => ({ date, rows: Object.fromEntries(['X', 'Y', 'Z'].map((s) => [s, ['EQ', null, px(s, i), px(s, i) + 1, px(s, i) - 1, px(s, i), 1000, null]])) as any }));
const actions = [{ symbol: 'X', subject: 'Bonus 1:1', exDate: dates[15] }];

test('a bonus dated on or before the previous session is applied; one dated tonight is not trusted', () => {
  const r = resolveHistory(bhav, actions, {});
  assert.equal(r.counts.resolved, 1); assert.equal(r.counts.unresolved, 1);
  const days = toDays(bhav), allowed = new Set(['X', 'Y', 'Z']);
  const later = asOfHistories(days, 17, r, allowed), x = later.series.get('X')!;
  assert.ok(Math.abs(x.c[10] - 100) < 1e-9 && Math.abs(x.c[16] - 100) < 1e-9, 'adjusted flat');
  const night = asOfHistories(days, 15, r, allowed).series.get('X')!;
  assert.ok(Number.isNaN(night.c[10]), 'break night: history before it dropped, not adjusted');
});
test('an unresolved break drops the history before it from that night on, and not before', () => {
  const r = resolveHistory(bhav, actions, {}), days = toDays(bhav), allowed = new Set(['X', 'Y', 'Z']);
  const before = asOfHistories(days, 19, r, allowed).series.get('Y')!;
  assert.equal(before.c[5], 100);
  const after = asOfHistories(days, 22, r, allowed).series.get('Y')!;
  assert.ok(Number.isNaN(after.c[5]) && after.c[20] === 40);
});
test('later days are never read', () => {
  const r = resolveHistory(bhav, actions, {}), days = toDays(bhav);
  const h = asOfHistories(days, 12, r, new Set(['Z']));
  assert.equal(h.dates.length, 13);
});
