import { test } from 'node:test'; import assert from 'node:assert/strict';
import { parseStockPage, parsePledge } from '../src/pm/stockfacts.ts';
const page = (pp: unknown) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: pp } })}</script></html>`;
test('parseStockPage reads valuation, growth and holding by quarter', () => {
  const f = parseStockPage(page({ stockData: { fundamentals: [{ name: 'Market Cap', value: '₹8,780Cr' }, { name: 'ROE', value: '12.60%' }, { name: 'P/E Ratio(TTM)', value: '20.3' }], peRatio: 20.32, pbRatio: 2.67, financialStatement: [{ title: 'Revenue', yearly: { 2024: 100, 2025: 110, 2026: 132 }, quarterly: { "Jun '25": 10, "Sep '25": 11, "Dec '25": 12, "Mar '26": 13, "Jun '26": 15 } }, { title: 'Profit', yearly: { 2025: 10, 2026: 15 }, quarterly: {} }], shareholdingPatternV2: { data: { "Jun '26": { promoters: 40, fii: 12, dii: 20, others: 0, public: 28 }, "Mar '26": { promoters: 41, fii: 11, dii: 19, others: 0, public: 29 } } } } }), '2026-10-25')!;
  assert.equal(f.pe, 20.3); assert.equal(f.roe, 12.6); assert.equal(f.revYoY, 20); assert.equal(f.profitYoY, 50); assert.equal(f.qRevYoY, 50);
  assert.equal(f.pattern.length, 2); assert.equal(f.pattern[1].q, "Jun '26"); assert.equal(f.mcap, '₹8,780Cr');
});
test('parseStockPage returns null without data', () => { assert.equal(parseStockPage('<html></html>', 'x'), null); assert.equal(parseStockPage(page({}), 'x'), null); });
test('parsePledge reads the promoter-group context only', () => {
  const t = (tag: string, ctx: string, v: string, u = 'pure') => `<in-bse-shp:${tag} contextRef="${ctx}" decimals="INF" unitRef="${u}">${v}</in-bse-shp:${tag}>`;
  const C = 'ShareholdingOfPromoterAndPromoterGroup_ContextI';
  const xml = t('NumberOfFullyPaidUpEquityShares', C, '1644830118', 'shares') + t('ShareholdingAsAPercentageOfTotalNumberOfShares', C, '0.24') + t('NumberOfSharesEncumberedUnderPledged', C, '1200509465', 'shares') + t('EncumberedShareUnderPledgedAsPercentageOfTotalNumberOfShares', C, '0.7299') + t('EncumberedShareUnderPledgedAsPercentageOfTotalNumberOfShares', 'Indian_ContextI', '0.1');
  const p = parsePledge(xml, '2026-09-30')!;
  assert.equal(p.promoterPct, 24); assert.equal(p.pledgedOfPromoter, 0.7299); assert.equal(p.pledgedShares, 1200509465);
  assert.equal(parsePledge('<x/>', null), null);
});
