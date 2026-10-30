import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetClassOf } from '../src/pm/assetclass.ts';
import { FundMaster, type AmfiRow } from '../src/pm/funds.ts';
const rows: AmfiRow[] = [
  ['1', 'INF000A01111', '-', 'Alpha Small Cap Fund - Growth Option - Direct Plan', 'Equity Scheme - Small Cap Fund'],
  ['2', 'INF000A01112', '-', 'Alpha Small Cap Fund - Growth Option - Regular Plan', 'Equity Scheme - Small Cap Fund'],
  ['3', 'INF000A01113', 'INF000A01114', 'Alpha Small Cap Fund - IDCW Option - Direct Plan', 'Equity Scheme - Small Cap Fund'],
  ['4', 'INF000B01111', '-', 'Beta Midcap Fund - Direct Plan - Growth Option', 'Equity Scheme - Mid Cap Fund'],
  ['5', 'INF000C01111', '-', 'Gamma Defence Fund - Growth Option - Direct Plan', 'Equity Scheme - Thematic Fund'],
  ['6', 'INF000D01111', '-', 'ABC Gold Fund of Fund - Direct Plan - Growth', 'Other Scheme - FoF'],
  ['7', 'INF000D01112', '-', 'ABC Gold ETF Fund of Fund - Direct Plan - Growth', 'Other Scheme - FoF'],
];
const m = new FundMaster(rows);
test('ISIN wins over name', () => { const r = m.resolve('anything', 'INF000A01112'); assert.equal(r.match?.code, '2'); assert.equal(r.match?.how, 'isin'); });
test('Groww-style names map to plan and option exactly', () => {
  assert.equal(m.resolve('Alpha Small Cap Fund Direct Plan Growth').match?.code, '1');
  assert.equal(m.resolve('Beta Midcap Fund Direct Growth').match?.code, '4');
  assert.equal(m.resolve('Gamma Defence Fund Direct Growth').match?.code, '5');
  assert.equal(m.resolve('Alpha Small Cap Fund Regular Plan IDCW').match?.code ?? 'none', 'none'); // no regular IDCW row: not forced to the closest other plan
});
test('a name without plan or option, and a weak match, are flagged and never forced', () => {
  assert.match(m.resolve('Alpha Small Cap Fund').reason ?? '', /plan or option/);
  assert.equal(m.resolve('Totally Unknown Fund Direct Growth').match, null);
});
test('similar names are not confused (gold FoF vs gold ETF FoF)', () => { assert.equal(m.resolve('ABC Gold Fund of Fund Direct Growth').match?.code, '6'); });
test('Mid Cap and Midcap are the same words', () => {
  const m2 = new FundMaster([['9', 'INF000Z01111', '-', 'Beta Midcap Fund - Direct Plan - Growth Option', 'Equity Scheme - Mid Cap Fund']]);
  assert.equal(m2.resolve('Beta Mid Cap Fund Direct Growth').match?.code, '9');
});
test('a typed override with its evidence settles names the master cannot tell apart', () => {
  const m3 = new FundMaster([['1', 'I1', '-', 'Same Name Fund', 'c'], ['2', 'I2', '-', 'Same Name Fund', 'c']], [{ name: 'Same Name Fund Direct Growth', code: '2', isin: 'I2', evidence: 'NAV match' }]);
  assert.equal(m3.resolve('Same Name Fund Direct Growth').match?.code, '2');
});
import { fundTaxType } from '../src/pm/funds.ts';
test('AMFI category sets the fund tax class', () => {
  assert.equal(fundTaxType('Equity Scheme - Small Cap Fund'), 'equity_fund');
  assert.equal(fundTaxType('Equity Schemes - ELSS- Tax Saver Fund'), 'equity_fund');
  assert.equal(fundTaxType('Hybrid Scheme - Aggressive Hybrid Fund'), 'equity_fund');
  assert.equal(fundTaxType('Income/Debt Oriented Schemes - Liquid Fund'), 'debt_fund');
  assert.equal(fundTaxType('Other Scheme - FoF Overseas'), 'overseas_fof');
  assert.equal(fundTaxType('Hybrid Scheme - Multi Asset Allocation'), 'hybrid_other');
  assert.equal(fundTaxType('Hybrid Scheme - Conservative Hybrid Fund'), 'debt_fund');   // specified mutual fund: more than 65% in debt
  assert.equal(assetClassOf('Fund', 'X Conservative Hybrid Fund', 'Hybrid Scheme - Conservative Hybrid Fund', 'debt_fund'), 'hybrid');   // allocation still counts it as hybrid
  assert.equal(fundTaxType('Something Unknown'), 'fund_unclassified');
  // C-115: Equity Savings is taxed as an equity fund when its stated minimum equity is 65% or more, else (below, or unknown) the cautious hybrid rule
  assert.equal(fundTaxType('Hybrid Scheme - Equity Savings', 'X Equity Savings Fund', 65), 'equity_fund');
  assert.equal(fundTaxType('Hybrid Scheme - Equity Savings', 'X Equity Savings Fund', 20), 'hybrid_other');
  assert.equal(fundTaxType('Hybrid Scheme - Equity Savings', 'X Equity Savings Fund'), 'hybrid_other');
  assert.equal(fundTaxType('Hybrid Scheme - Equity Savings', 'X Equity Savings Fund', null), 'hybrid_other');
});
