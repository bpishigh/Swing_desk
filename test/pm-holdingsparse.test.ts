import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, parseEtfPage } from '../src/pm/holdingsparse.ts';
import { schemeBase } from '../src/pm/lookthrough.ts';
const page = (h: unknown[]) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { mfServerSideData: { holdings: h } } } })}</script></html>`;
const row = (company_name: string, corpus_per: number, nature_name = 'EQUITY') => ({ scheme_code: '100001', portfolio_date: '2026-09-29T18:30:00.000Z', company_name, nature_name, corpus_per });
test('parsePage keeps equity lines, adds a repeated company, drops others, and converts the date to India time', () => {
  const p = parsePage(page([row('HDFC Bank Ltd', 7.5), row('HDFC Bank Ltd', 0.5), row('Sample Industries Ltd', 5), row('Treasury Bill', 9, 'DEBT'), row('Zero Ltd', 0)]))!;
  assert.deepEqual(p.lines, [{ name: 'HDFC Bank Ltd', weight: 8 }, { name: 'Sample Industries Ltd', weight: 5 }]);
  assert.equal(p.asOf, '2026-09-30'); assert.equal(p.code, '100001');
});
test('parsePage returns null for a page without data and does not throw on bad JSON', () => {
  assert.equal(parsePage('<html>no data</html>'), null);
  assert.equal(parsePage('<script id="__NEXT_DATA__">{bad</script>'), null);
  assert.deepEqual(parsePage(page([]))?.lines, []);
});
test('schemeBase makes a Regular and a Direct plan of one scheme share a key', () => {
  assert.equal(schemeBase('Epsilon Flexi Cap Fund - Direct Plan - Growth'), schemeBase('Epsilon Flexi Cap Fund - Regular Plan - Growth Option'));
  assert.notEqual(schemeBase('HDFC Nifty 50 Index Fund - Direct Plan - Growth'), schemeBase('HDFC Nifty Next 50 Index Fund - Direct Plan - Growth'));
});
test('derivative and dated lines are dropped; real company names that contain "future" or a month stay', () => {
  const p = parsePage(page([row('Nifty October 2026 Future', 5), row('HDFC Bank Futures', 3), row('PUT NIFTY 27-Oct-2026 24000', 1), row('HDFC Life Insurance Company Ltd.-OCT2026', 2), row('Future Retail Ltd', 1), row('Marico Ltd', 4), row('March Industries Ltd', 2)]))!;
  assert.deepEqual(p.lines.map((l) => l.name).sort(), ['Future Retail Ltd', 'March Industries Ltd', 'Marico Ltd']);
});
test('parseEtfPage keeps equity ISINs with their percent and ignores cash and units', () => {
  const html = `<script id="__NEXT_DATA__">${JSON.stringify({ a: { holdings: [{ isin: 'INE040A01034', holdingSharePercentage: 10.5 }, { isin: 'INE040A01034', holdingSharePercentage: 0.5 }, { isin: 'INF204KB14I2', holdingSharePercentage: 3 }, { isin: 'INE002A01018', holdingSharePercentage: 0 }] } })}</script>`;
  assert.deepEqual(parseEtfPage(html)!.lines, [{ isin: 'INE040A01034', weight: 11 }]);
  assert.equal(parseEtfPage('<html></html>'), null);
});
