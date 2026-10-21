import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupFund, handle } from '../functions/api/fundport.ts';
import worker from '../worker.ts';

const nd = (o: unknown) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(o)}</script></html>`;
const mf = nd({ p: { holdings: [{ scheme_code: '100002', portfolio_date: '2026-09-29T18:30:00.000Z', company_name: 'HDFC Bank Ltd', nature_name: 'EQUITY', corpus_per: 7.5 }] } });
const etf = nd({ p: { holdings: [{ isin: 'INE040A01034', holdingSharePercentage: 10 }] } });
const fake = (search: unknown, pages: Record<string, string>) => (async (url: string) => {
  if (String(url).includes('/search/')) return new Response(JSON.stringify({ content: search }), { status: 200 });
  const p = Object.entries(pages).find(([k]) => String(url).endsWith(k)); return p ? new Response(p[1], { status: 200 }) : new Response('no', { status: 404 });
}) as unknown as typeof fetch;

test('a mutual fund is found by AMFI code or ISIN and its equity lines come back', async () => {
  const r = await lookupFund({ isin: 'INF000P01027', code: '100002', name: 'Epsilon Flexi Cap Fund - Regular Plan - Growth' }, fake([{ scheme_code: '100002', search_id: 'ppfas', entity_type: 'MF' }], { '/mutual-funds/ppfas': mf }), '2026-10-21');
  assert.ok(r.ok); if (r.ok && !r.port.etf) { assert.equal(r.port.asOf, '2026-09-30'); assert.equal(r.port.lines[0].name, 'HDFC Bank Ltd'); }
});
test('an ETF is read from its ETF page; a wrong scheme, a missing fund and a bad page are refused, never guessed', async () => {
  const e = await lookupFund({ isin: 'INF204KB14I2', code: '', name: 'Nippon India ETF Nifty 50 BeES' }, fake([{ isin: 'INF204KB14I2', search_id: 'nip', entity_type: 'ETF' }], { '/etfs/nip': etf }));
  assert.ok(e.ok && e.port.etf && e.port.lines[0].isin === 'INE040A01034');
  const wrong = await lookupFund({ isin: 'INF000P01027', code: '999999', name: 'X Fund' }, fake([{ isin: 'INF000P01027', search_id: 'a', entity_type: 'MF' }], { '/mutual-funds/a': mf }));
  assert.deepEqual(wrong, { ok: false, reason: 'the page is another scheme' });
  assert.equal((await lookupFund({ isin: 'INF000000001', code: '1', name: 'Nothing' }, fake([], {}))).ok, false);
  assert.equal((await lookupFund({ isin: 'INF000P01027', code: '1', name: 'X' }, (async () => { throw new Error('blocked'); }) as unknown as typeof fetch)).ok, false);
  assert.equal((await lookupFund({ isin: 'INF000P01027', code: '100002', name: 'X' }, fake([{ scheme_code: '100002', search_id: '../evil' }], {}))).ok, false);   // a search id with odd characters is never put into a URL
});
test('the endpoint is behind the login, takes only a fund, and is routed by the worker', async () => {
  assert.equal((await handle(new Request('https://x/api/fundport?isin=INF000P01027&code=1&name=X'), {})).status, 401);
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  assert.equal((await worker.fetch(new Request('https://x/api/fundport'), env)).status, 401);
});
