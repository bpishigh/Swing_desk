import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xirrAt, xirrTrend, monthEnds, valuesByName, HX } from '../src/pm/holdingxirr.ts';

const part = (flows: [string, number][], values: Record<string, number>, divs: [string, number][] = []) => ({ flows: flows.map(([date, amount]) => ({ date, amount })), divs: divs.map(([date, amount]) => ({ date, amount })), values });

test('one buy, doubled in a year: XIRR about 100%', () => {
  const r = xirrAt([part([['2024-01-01', -100]], { '2025-01-01': 200 })], '2025-01-01')!;
  assert.ok(Math.abs(r.price! - 1) < 0.01);
});
test('nothing is reported before the first buy is old enough', () => {
  assert.equal(xirrAt([part([['2024-12-01', -100]], { '2025-01-01': 200 })], '2025-01-01'), null);
});
test('a sale before the date counts as an inflow; dividends only in the with-dividend figure', () => {
  const p = part([['2023-01-01', -100], ['2024-01-01', 150]], { '2024-07-01': 0 }, [['2023-07-01', 5]]);
  const r = xirrAt([p], '2024-07-01')!;
  assert.ok(r.price! > 0.2 && r.withDiv! > r.price!);
});
test('two accounts holding the same stock are added up', () => {
  const a = part([['2024-01-01', -100]], { '2025-01-01': 150 }), b = part([['2024-01-01', -100]], { '2025-01-01': 150 });
  const one = xirrAt([a], '2025-01-01')!.price!, both = xirrAt([a, b], '2025-01-01')!.price!;
  assert.ok(Math.abs(one - both) < 1e-6);
});
test('trend: rising, falling and flat against three month-ends earlier', () => {
  const dates = ['2025-01-31', '2025-02-28', '2025-03-31', '2025-04-30', '2025-05-31'];
  const mk = (vals: number[]) => part([['2023-01-01', -100]], Object.fromEntries(dates.map((d, i) => [d, vals[i]])));
  assert.equal(xirrTrend([mk([140, 140, 140, 180, 220])], dates).label, 'rising');
  assert.equal(xirrTrend([mk([220, 200, 180, 150, 120])], dates).label, 'falling');
  const grow = dates.map((d) => 100 * Math.pow(1.2, (Date.parse(d) - Date.parse('2023-01-01')) / (365 * 86400000)));   // steady 20% a year
  assert.equal(xirrTrend([mk(grow)], dates).label, 'flat');
});
test('a young holding is labelled too early, not zero', () => {
  const t = xirrTrend([part([['2025-04-01', -100]], { '2025-05-31': 110 })], ['2025-05-31']);
  assert.equal(t.label, 'too early'); assert.equal(t.now, null);
});
test('month-ends: last session of each month, newest n plus the final date', () => {
  const ds = ['2025-01-30', '2025-01-31', '2025-02-27', '2025-02-28', '2025-03-03'];
  assert.deepEqual(monthEnds(ds, 5), ['2025-01-31', '2025-02-28', '2025-03-03']);
  assert.deepEqual(monthEnds(ds, 1), ['2025-02-28', '2025-03-03']);
});
test('values by name: units from the replay times the day price; a split is applied', () => {
  const t = (date: string, qty: number, price: number) => ({ instrument: 'AAA', isin: 'INE1', side: 'buy', qty, price, value: qty * price, date, time: '', exchange: '', orderId: date, tradeId: date } as any);
  const v = valuesByName([t('2024-01-02', 10, 100)], [{ type: 'split', key: 'INE1', ratio: 2, date: '2024-03-01', source: 'x' } as any], ['2024-02-01', '2024-04-01'], (_k, d) => (d < '2024-03-01' ? 100 : 55), () => 'AAA');
  assert.equal(v.get('AAA')!['2024-02-01'], 1000); assert.equal(v.get('AAA')!['2024-04-01'], 1100);
});
test('missing price on a date leaves that date out, never a guess', () => {
  const t = { instrument: 'AAA', isin: 'INE1', side: 'buy', qty: 10, price: 100, value: 1000, date: '2024-01-02', time: '', exchange: '', orderId: '1', tradeId: '1' } as any;
  const v = valuesByName([t], [], ['2024-02-01'], () => undefined, () => 'AAA');
  assert.equal(v.get('AAA'), undefined);
});
test('rules are what the page says', () => { assert.equal(HX.minDays, 180); });
