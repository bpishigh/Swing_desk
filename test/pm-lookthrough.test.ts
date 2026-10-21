import test from 'node:test';
import assert from 'node:assert/strict';
import { lookThrough, type Position, type FundPortfolios } from '../src/pm/lookthrough.ts';

const pos: Position[] = [
  { name: 'HDFC Bank Limited', kind: 'Stock', value: 100000, isin: 'INE040A01034', symbol: 'HDFCBANK' },
  { name: 'Sample Tech Limited', kind: 'Stock', value: 50000, symbol: 'SMPT' },
  { name: 'Index Fund A', kind: 'Fund', value: 200000, fundIsin: 'FA' },
  { name: 'Active Fund B', kind: 'Fund', value: 100000, fundIsin: 'FB' },
  { name: 'Mystery Fund', kind: 'Fund', value: 50000, fundIsin: 'FZ' },
];
const ports: FundPortfolios = {
  FA: { asOf: '2026-09-30', lines: [{ name: 'HDFC Bank Ltd.', isin: 'INE040A01034', weight: 10 }, { name: 'Sample Tech', symbol: 'SMPT', weight: 6 }, { name: 'Reliance Industries Limited', weight: 8 }, { name: 'Filler One', weight: 30 }] },
  FB: { asOf: '2026-05-31', lines: [{ name: 'HDFC Bank Limited', weight: 8 }, { name: 'Reliance Industries Limited', weight: 12 }, { name: 'Tata Motors', weight: 5 }, { name: 'Filler Two', weight: 30 }] },
};
test('look-through adds direct and fund exposure, matching by ISIN, symbol and name', () => {
  const r = lookThrough(pos, ports, '2026-10-21', 1000000);
  const h = r.exposures.find((e) => e.name === 'HDFC Bank Limited')!;
  assert.equal(h.direct, 100000); assert.equal(h.viaFunds, 200000 * 0.10 + 100000 * 0.08);   // 28,000   // ISIN line and a name-only line
  assert.equal(h.total, 128000); assert.equal(Math.round(h.pctCapital * 1000), 128);
  assert.equal(r.exposures.find((e) => /Sample Tech/.test(e.name))!.viaFunds, 12000);   // matched by symbol
  assert.equal(r.exposures.filter((e) => /hdfc/i.test(e.name)).length, 1);   // not split into two rows
});
test('overlap is the sum of the smaller weights; coverage, stale and uncovered funds are reported, never guessed', () => {
  const r = lookThrough(pos, ports, '2026-10-21', 1000000);
  assert.equal(r.overlaps.length, 1); assert.equal(Math.round(r.overlaps[0].overlap * 100), 16);   // min(10,8)+min(8,12)=16
  assert.equal(r.overlaps[0].flag, false);
  assert.deepEqual(r.notCovered, ['Mystery Fund']);
  assert.equal(Math.round(r.coverage! * 100), 47);   // 300k of 350k covered, each only for its equity lines (54% and 55%)
  assert.deepEqual(r.stale.map((x) => x.fund), ['Active Fund B']);   // 143 days old
  assert.ok(r.unmatchedWeight['Index Fund A'] === 38 && r.unmatchedWeight['Active Fund B'] === 47);   // lines not tied to a stock you hold are counted, not dropped
});
test('flags: overlap above the setting, exposure above the cap; no cap set means no flag', () => {
  const twin: FundPortfolios = { FA: { asOf: '2026-09-30', lines: [{ name: 'HDFC Bank Limited', weight: 25 }, { name: 'Reliance Industries Limited', weight: 20 }, { name: 'Filler', weight: 10 }] }, FB: { asOf: '2026-09-30', lines: [{ name: 'HDFC Bank Limited', weight: 25 }, { name: 'Reliance Industries Limited', weight: 30 }] } };
  const r = lookThrough(pos, twin, '2026-10-21', 1000000, { positionCap: 0.1 });
  assert.equal(Math.round(r.overlaps[0].overlap * 100), 45); assert.equal(r.overlaps[0].flag, true);
  assert.equal(r.exposures[0].name, 'HDFC Bank Limited'); assert.equal(r.exposures[0].overCap, true);   // 175,000 of 1,000,000 against a 10% cap
  assert.equal(lookThrough(pos, twin, '2026-10-21', 1000000).exposures.some((e) => e.overCap), false);
});
test('no funds, no capital and empty portfolios do not break anything', () => {
  assert.equal(lookThrough([], {}, '2026-10-21', 0).coverage, null);
  const r = lookThrough([{ name: 'F', kind: 'Fund', value: 10, fundIsin: 'X' }], { X: { asOf: '2026-10-01', lines: [] } }, '2026-10-21', 100);
  assert.deepEqual(r.notCovered, ['F']);
});
test('a portfolio whose weights add to well over 100% is not covered', () => {
  const r = lookThrough([{ name: 'Arb', kind: 'Fund', value: 100, fundIsin: 'Y' }], { Y: { asOf: '2026-10-01', lines: [{ name: 'A', weight: 70 }, { name: 'B', weight: 60 }] } }, '2026-10-21', 1000);
  assert.deepEqual(r.notCovered, ['Arb']); assert.equal(r.exposures.length, 0);
});
test('a portfolio with under half its money in equity lines is not covered; renamed companies meet', () => {
  const r = lookThrough([{ name: 'Thin', kind: 'Fund', value: 100, fundIsin: 'T' }], { T: { asOf: '2026-10-01', lines: [{ name: 'A', weight: 4 }] } }, '2026-10-21', 1000);
  assert.deepEqual(r.notCovered, ['Thin']);
  const m = lookThrough([{ name: 'Eternal Limited', kind: 'Stock', value: 500, symbol: 'ETERNAL' }, { name: 'F', kind: 'Fund', value: 1000, fundIsin: 'F' }], { F: { asOf: '2026-10-01', lines: [{ name: 'Zomato Ltd', weight: 60 }] } }, '2026-10-21', 5000);
  assert.equal(m.exposures.length, 1); assert.equal(m.exposures[0].total, 1100);
});
test('an ETF with a portfolio is opened like a fund and matched to a direct stock by symbol', () => {
  const r = lookThrough([{ name: 'HDFC Bank Limited', kind: 'Stock', value: 100, symbol: 'HDFCBANK' }, { name: 'Nifty ETF', kind: 'ETF', value: 1000, fundIsin: 'E' }], { E: { asOf: '2026-10-20', lines: [{ name: 'HDFC Bank Limited', symbol: 'HDFCBANK', isin: 'INE040A01034', weight: 60 }] } }, '2026-10-21', 10000);
  assert.equal(r.exposures.length, 1); assert.equal(r.exposures[0].total, 700); assert.deepEqual(r.notCovered, []);
});
test('an ETF line with a symbol and a mutual fund line with only a name are one company, and overlap sees it', () => {
  const r = lookThrough([{ name: 'ETF B', kind: 'ETF', value: 1000, fundIsin: 'B' }, { name: 'Fund A', kind: 'Fund', value: 1000, fundIsin: 'A' }], {
    A: { asOf: '2026-09-30', lines: [{ name: 'HDFC Bank Ltd', weight: 60 }] },
    B: { asOf: '2026-10-20', lines: [{ name: 'HDFC Bank Limited', symbol: 'HDFCBANK', isin: 'INE040A01034', weight: 60 }] } }, '2026-10-21', 10000);
  assert.equal(r.exposures.length, 1); assert.equal(r.exposures[0].total, 1200);
  assert.equal(r.overlaps.length, 1); assert.equal(Math.round(r.overlaps[0].overlap * 100), 60);
});
test('coverage counts only the equity share of each portfolio', () => {
  const r = lookThrough([{ name: 'F', kind: 'Fund', value: 1000, fundIsin: 'F' }], { F: { asOf: '2026-10-01', lines: [{ name: 'A', weight: 55 }] } }, '2026-10-21', 5000);
  assert.equal(Math.round(r.coverage! * 100), 55);
});
