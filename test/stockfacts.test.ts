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

import { debtMix } from '../src/pm/holdingsparse.ts';
test('debtMix splits a debt fund into government, cash, paper and company debt', () => {
  const r = (company_name: string, instrument_name: string, nature_name: string, corpus_per: number) => ({ company_name, instrument_name, nature_name, corpus_per, portfolio_date: '2026-09-29T18:30:00.000Z' });
  const m = debtMix([r('GOVERNMENT OF INDIA 6.94 GOI 2036', 'GOI Securities', 'DEBT', 40), r('Repo', 'Repo', 'CASH', 10), r('Bank X CD', 'Certificate of Deposit', 'DEBT', 15), r('ABC Finance Ltd 9.25 NCD 02JN28 FVRS1LAC', 'Non Convertible Debenture', 'DEBT', 30), r('Some Co', 'Equity', 'EQUITY', 5)])!;
  assert.equal(m.gov, 40); assert.equal(m.cash, 10); assert.equal(m.paper, 15); assert.equal(m.corp, 30); assert.equal(m.other, 5); assert.equal(m.top[0].name, 'ABC Finance Ltd'); assert.equal(m.asOf, '2026-09-30');
  assert.equal(debtMix([r('A', 'Equity', 'EQUITY', 60), r('B', 'Equity', 'EQUITY', 30), r('C', 'Equity', 'EQUITY', 10)]), null);
});

import { parseDebtPage, debtKey, creditSplit } from '../src/pm/debtstats.ts';
test('parseDebtPage reads yield, maturity, duration and the credit table', () => {
  const lab = (l: string, v: string) => `<div style="p"><div style="x">${l}</div><div class="black w-600" style="y">${v}</div></div>`;
  const row = (r: string, f: string, c: string) => `<tr><td style="a">${r}</td><td style="b"><div><span>${f}<!-- -->%</span><div></div></div></td><td style="c"><div><span>${c}<!-- -->%</span></div></td></tr>`;
  const html = `<title>Axis Liquid Fund Holdings - Full Portfolio (October 2026)</title><nav>Credit Quality Profile</nav>` + lab('Yield to Maturity', '6.37%') + lab('Modified Duration', '0.14 yrs') + lab('Avg. Maturity', '0.14 yrs') + lab('No. of Securities', '133') + `<h1>Debt Holdings — Credit Quality Profile</h1><table><thead><tr><th>Rating</th></tr></thead><tbody>${row('A1+', '86.52', '70.46')}${row('SOV', '9.84', '16.86')}${row('AA', '1.0', '0.11')}</tbody></table>`;
  const d = parseDebtPage(html)!;
  assert.equal(d.ytm, 6.37); assert.equal(d.modDur, 0.14); assert.equal(d.avgMat, 0.14); assert.equal(d.nSec, 133); assert.equal(d.asOf, 'October 2026');
  assert.deepEqual(d.credit.map((c) => c.r), ['A1+', 'SOV', 'AA']); assert.equal(d.credit[0].fund, 86.52); assert.equal(d.credit[0].cat, 70.46);
  const s = creditSplit(d.credit); assert.equal(s.safe, 96.4); assert.equal(s.lower, 1);
  assert.equal(parseDebtPage('<html></html>'), null);
});
test('debtKey lines a fund name up with a sharpely slug', () => {
  assert.equal(debtKey('Axis Liquid Fund - Direct Plan - Growth'), debtKey('axis-liquid-direct-fundgrowth'));
  assert.equal(debtKey('ICICI Prudential Corporate Bond Fund - Direct Plan - Growth'), debtKey('icici-prudential-corporate-bond-fund-direct-plangrowth'));
});
import { parseIntlPage, intlKey } from '../src/pm/intlfacts.ts';
import { intlTiles } from '../src/pm/fundcard.ts';
test('parseIntlPage reads size, cost, exit load and benchmark', () => {
  const html = '{\\"feesAndCommissionsSpecification\\":\\"Expense ratio 0.19% p.a.; Exit load 1% if redeemed within 15 days; Lock-in: No lock-in.\\",\\"additionalProperty\\":[{\\"@type\\":\\"PropertyValue\\",\\"name\\":\\"AUM\\",\\"value\\":\\"8,031.84\\"},{\\"name\\":\\"Expense Ratio\\",\\"value\\":\\"0.19\\"},{\\"name\\":\\"Risk Level\\",\\"value\\":\\"Very High\\"},{\\"name\\":\\"Benchmark\\",\\"value\\":\\"Nasdaq 100 Total Return Index\\"}]}';
  const f = parseIntlPage(html)!; assert.equal(f.aum, 8031.84); assert.equal(f.ter, 0.19); assert.equal(f.bench, 'Nasdaq 100 Total Return Index'); assert.equal(f.exit, '1% if redeemed within 15 days'); assert.equal(f.risk, 'Very High');
  assert.equal(parseIntlPage('<html></html>'), null);
  assert.equal(intlTiles(f).length, 4); assert.deepEqual(intlTiles(null), []);
});
test('intlKey lines up a scheme name with a page slug', () => { assert.equal(intlKey('Motilal Oswal Nasdaq 100 Fund of Fund - Direct Plan - Growth'), intlKey('motilal-oswal-nasdaq-100-fof-directgrowth')); });
