import { test } from 'node:test'; import assert from 'node:assert/strict';
import { fundCard, stockCard, sellCostCard } from '../src/pm/fundcard.ts';
test('fundCard shows facts, flags and bars, and escapes text', () => {
  const html = fundCard({ why: ['score <b>x</b>'], tiles: [{ k: 'Rank', v: '#1' }], fq: { managers: [{ name: 'A B', since: '2026-08-01' }], aum: 1234.5, benchmark: 'NIFTY 50', expense: 0.5, turnover: 12, flags: [{ kind: 'new-manager', text: 'A B started managing it on 2026-08-01, under 12 months ago' }], vs5: { fund: 12, bench: 'Nifty 50', benchR5: 10, n: 5 } }, hh: { aboveShare: 0.5, ret6m: 0.04, pct: 60, cat: 'Flexi Cap' } });
  assert.ok(html.includes('₹1,235 cr') && html.includes('fchip warn') && html.includes('Ahead by 2.0') && html.includes('50%') && html.includes('score &lt;b&gt;'));
  assert.ok(!fundCard({}).includes('Facts only'));
});
test('stockCard renders tiles and notes', () => { assert.ok(stockCard({ tiles: [{ k: 'RS', v: 'top 5%', s: 'x' }], notes: ['n'] }).includes('top 5%')); });
test('sellCostCard counts no free limit and shows the only-sale tax separately', () => {
  const base = { value: 167000, gain: 66985, longGain: 66985, shortGain: 0, load: 0, charges: 0, lots: [{ date: '2023-01-01', value: 167000, gain: 66985, long: true, tax: 8373, load: 0 }], notes: [], exemptionLeft: 125000 };
  const h = sellCostCard({ ...base, tax: 8373, net: 158627, taxWithExemption: 0 } as any);
  assert.ok(h.includes('₹8,373') && h.includes('only sale this year') && h.includes('1,25,000'));
  assert.ok(!sellCostCard({ ...base, tax: 0, net: 167000, taxWithExemption: 0 } as any).includes('only sale'));
});
test('sellCostCard lists lots oldest first with their status, only when there is more than one', () => {
  const lots = [
    { date: '2026-09-01', value: 50000, gain: 2000, long: false, tax: 400, load: 500, loadEnds: '2027-09-01' },
    { date: '2023-01-01', value: 100000, gain: 40000, long: true, tax: 5000, load: 0 },
  ];
  const h = sellCostCard({ value: 150000, gain: 42000, longGain: 40000, shortGain: 2000, tax: 5400, load: 500, charges: 0, net: 144100, lots, notes: [] } as any);
  assert.ok(h.includes('Lot by lot (2 lots') && h.indexOf('2023-01-01') < h.indexOf('2026-09-01') && h.includes('Exit load to 2027-09-01') && h.includes('Long-term'));
  assert.ok(!sellCostCard({ value: 100000, gain: 40000, longGain: 40000, shortGain: 0, tax: 5000, load: 0, charges: 0, net: 95000, lots: [lots[1]], notes: [] } as any).includes('Lot by lot'));
});
test('intlTiles adds where it invests, currency and tax, and survives a fund with no page facts', async () => {
  const { intlTiles } = await import('../src/pm/fundcard.ts');
  const t = intlTiles({ aum: 900, ter: 0.5, exit: 'none', bench: 'Nasdaq 100 Total Return Index', risk: 'Very High' }, 'Axis NASDAQ 100 US Specific Equity Passive FOF');
  assert.ok(t.some((x) => x.k === 'Where it invests' && x.v.includes('United States')) && t.some((x) => x.k === 'Currency') && t.some((x) => x.k === 'Tax on gains') && t.some((x) => x.k === 'Fund size'));
  assert.ok(intlTiles(null, 'Edelweiss Europe Dynamic Equity Offshore Fund').some((x) => x.v.includes('Europe')));
  assert.deepEqual(intlTiles(null), []);
});

import { mixTiles } from '../src/pm/fundcard.ts';
test('mixTiles shows equity, debt and the rest against the fund\'s own range', () => {
  const t = mixTiles({ eq: 66.5, debt: 16.2, cash: 1.8, eqMin: 65, eqMax: 80 });
  assert.equal(t.length, 3); assert.match(t[0].s ?? '', /65% to 80%/); assert.equal(t[2].v, '1.8%');
  assert.deepEqual(mixTiles(null), []);
});
