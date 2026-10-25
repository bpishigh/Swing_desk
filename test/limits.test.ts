import { test } from 'node:test'; import assert from 'node:assert/strict';
import { fundHouse, buildSectorIndex, sectorOf, checkLimits, goalStatus, LIMIT_DEFAULTS } from '../src/pm/limits.ts';
import type { Exposure } from '../src/pm/lookthrough.ts';
const ex = (key: string, name: string, total: number): Exposure => ({ key, name, direct: total, viaFunds: 0, total, pctCapital: 0, pctEquity: 0, sources: [], overCap: false });
test('fundHouse reads the house from a scheme name', () => {
  assert.equal(fundHouse('Parag Parikh Flexi Cap Fund - Direct Plan - Growth'), 'Parag Parikh');
  assert.equal(fundHouse('SBI Contra Fund'), 'SBI'); assert.equal(fundHouse('Aditya Birla Sun Life Liquid Fund'), 'Aditya Birla Sun Life'); assert.equal(fundHouse('HDFC Mid-Cap Opportunities'), 'HDFC');
  assert.equal(fundHouse('Zzz Odd Fund'), 'Zzz');
});
test('sector index finds a company by symbol or by name', () => {
  const ix = buildSectorIndex({ HDFCBANK: 'Financial Services', INFY: 'Information Technology' }, { HDFCBANK: 'HDFC Bank Limited', INFY: 'Infosys Limited' });
  assert.equal(sectorOf({ key: 'S:INFY', name: 'x' }, ix), 'Information Technology'); assert.equal(sectorOf({ key: 'N:hdfc bank', name: 'HDFC Bank Ltd' }, ix), 'Financial Services'); assert.equal(sectorOf({ key: 'N:foo', name: 'Foo' }, ix), 'Not classified');
});
test('checkLimits flags a company, a sector and a fund house over their limits', () => {
  const ix = buildSectorIndex({ HDFCBANK: 'Financial Services', ICICIBANK: 'Financial Services', INFY: 'Information Technology' }, { HDFCBANK: 'HDFC Bank Limited', ICICIBANK: 'ICICI Bank Limited', INFY: 'Infosys Limited' });
  const r = checkLimits([ex('S:HDFCBANK', 'HDFC Bank Ltd', 200), ex('S:ICICIBANK', 'ICICI Bank', 150), ex('S:INFY', 'Infosys', 50)], 1000, [{ name: 'SBI Contra Fund', value: 700 }, { name: 'HDFC Flexi Cap', value: 300 }], ix);
  assert.equal(r.company[0].name, 'HDFC Bank Ltd'); assert.equal(r.company[0].over, true); assert.equal(r.company[2].over, false);
  assert.equal(r.sector[0].name, 'Financial Services'); assert.equal(Math.round(r.sector[0].pct * 100), 35); assert.equal(r.sector[0].over, true);
  assert.equal(r.house[0].name, 'SBI'); assert.equal(r.house[0].over, true); assert.equal(r.house[1].over, false); assert.equal(r.classifiedShare, 1);
  assert.equal(LIMIT_DEFAULTS.company, 0.1);
});
test('goalStatus: funded share, shortfall, monthly need and the near-date equity warning', () => {
  const g = { id: '1', name: 'Flat', amount: 4000000, date: '2028-10-25', holdings: ['A', 'B', 'Gone'] };
  const s = goalStatus(g, [{ name: 'A', value: 1000000, riskClass: true }, { name: 'B', value: 500000, riskClass: false }], '2026-10-25');
  assert.equal(s.funded, 1500000); assert.equal(s.pct, 0.375); assert.equal(s.months, 24); assert.equal(s.shortfall, 2500000); assert.equal(Math.round(s.perMonth!), 104167);
  assert.match(s.warn!, /67% .* within 24 months/); assert.deepEqual(s.missing, ['Gone']);
  const far = goalStatus({ ...g, date: '2035-10-25' }, [{ name: 'A', value: 1000000, riskClass: true }], '2026-10-25'); assert.equal(far.warn, null);
  const done = goalStatus({ ...g, amount: 100 }, [{ name: 'A', value: 1000000, riskClass: false }], '2026-10-25'); assert.equal(done.shortfall, 0); assert.equal(done.perMonth, null);
  const past = goalStatus({ ...g, date: '2026-01-01' }, [{ name: 'A', value: 1, riskClass: false }], '2026-10-25'); assert.match(past.warn!, /date has passed/);
});
