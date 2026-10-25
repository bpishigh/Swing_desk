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
