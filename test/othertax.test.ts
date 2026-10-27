import { test } from 'node:test';
import assert from 'node:assert/strict';
import { taxFromLines } from '../src/pm/tax.ts';
import rules from '../data/rules/tax.json' with { type: 'json' };

const L = (type: string, stcg: number, ltcg: number) => ({ fy: '2025-26', type: type as never, stcg, ltcg, confidence: 'Medium', unlabeled: 0 });

test('other assets: long-term at 12.5%, short-term needs a slab rate', () => {
  const m = new Map([['2025-26', [L('gold_silver_etf', 0, 80000), L('debt_fund', 20000, 0)]]]);
  const a = taxFromLines(m, rules)[0].other;
  assert.equal(a.ltcgTax, 10000); assert.equal(a.stcgTax, null); assert.equal(a.tax, null);
  const b = taxFromLines(m, rules, 0, 0.30)[0].other;
  assert.equal(b.stcgTax, 6000); assert.equal(b.tax, 16000);
});

test('other assets: short-term loss offsets long-term gain; equity is untouched', () => {
  const m = new Map([['2025-26', [L('intl_etf', -10000, 50000), L('listed_equity', 0, 100000)]]]);
  const y = taxFromLines(m, rules, 0, 0.3)[0];
  assert.equal(y.other.ltcgTaxable, 40000); assert.equal(y.other.tax, 5000); assert.equal(y.equity.tax, 0);
});
