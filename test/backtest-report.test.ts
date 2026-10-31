import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickQuality, splitBy, exTopGroup, sensitivity, caveats, formatReport, type TradeRec } from '../src/backtest/report.ts';

const mk = (i: number, g: string, x20: number, x60: number | null, x120: number | null, regime = 'green'): TradeRec => ({
  sym: 'S' + i, entry: `${2021 + (i % 4)}-0${1 + (i % 9)}-1${i % 9}`, group: g, regime,
  net: { 20: x20 + 0.01, 60: x60 === null ? null : x60 + 0.02, 120: x120 === null ? null : x120 + 0.04 }, mkt: { 20: 0.01, 60: 0.02, 120: 0.04 } });
const T: TradeRec[] = Array.from({ length: 60 }, (_, i) => mk(i, i % 3 === 0 ? 'Banks' : 'Metals', i % 2 ? 0.03 : -0.01, 0.02, i === 5 ? null : 0.05));

test('pick quality: lengths compare on the same picks, excess is net minus market, hit rate counts positive net', () => {
  const q = pickQuality(T);
  assert.equal(q.length, 3); assert.ok(q.every((s) => s.n === 59));          // the one pick without 120 sessions is out of every length
  assert.ok(Math.abs(q[1].meanExcess - 0.02) < 1e-9 && q[1].hit === 1);
  assert.ok(q[0].ci[0] <= q[0].meanExcess && q[0].meanExcess <= q[0].ci[1]);
  assert.equal(pickQuality(T, [20, 60, 120], false)[1].n, 60);                // without `common`, 60 sessions keeps all 60
});
test('splits and the group removed', () => {
  const y = splitBy(T, 'year', 60); assert.deepEqual(y.map((x) => x.label), ['2021', '2022', '2023', '2024']);
  assert.ok(splitBy(T, 'group', 60).every((x) => x.n > 0));
  const g = [...T.map((t) => ({ ...t, net: { ...t.net, 60: (t.net[60] as number) + (t.group === 'Banks' ? 0.1 : 0) } }))];
  const e = exTopGroup(g, 60); assert.equal(e.dropped, 'Banks'); assert.ok(Math.abs(e.meanExcess - 0.02) < 1e-9);
  assert.equal(exTopGroup([{ ...T[0], group: undefined }], 60).dropped, null);
});
test('sensitivity: a lone peak is flagged, a plateau is not', () => {
  assert.equal(sensitivity([{ value: 1, metric: 0.1 }, { value: 2, metric: 0.9 }, { value: 3, metric: 0.1 }]).spiky, true);
  assert.equal(sensitivity([{ value: 1, metric: 0.8 }, { value: 2, metric: 0.9 }, { value: 3, metric: 0.7 }]).spiky, false);
  const s = sensitivity([{ value: 5, metric: 0.2 }, { value: 7, metric: 0.5 }]); assert.equal(s.bestValue, 7); assert.equal(s.sweepSize, 2);
  assert.equal(sensitivity([]).bestValue, null);
});
test('caveats: US is labelled survivor-biased, India is not; sweep size and unadjusted prices are named', () => {
  assert.ok(caveats({ market: 'us' }).some((l) => /Survivor-biased upward/.test(l)));
  assert.ok(!caveats({ market: 'india' }).some((l) => /Survivor-biased/.test(l)));
  const c = caveats({ market: 'india', sweepSize: 12, pricesAdjusted: false, window: '2010-2019' });
  assert.ok(c.some((l) => /sweep of 12/.test(l)) && c.some((l) => /NOT adjusted/.test(l)) && c.some((l) => /2010-2019/.test(l)));
});
test('the report text carries every section and the caveat', () => {
  const t = formatReport('Test run', T, { market: 'us' });
  for (const s of ['Pick quality', 'Without the best group', 'By year', 'By regime', 'By group', 'Survivor-biased upward']) assert.ok(t.includes(s), s);
});
