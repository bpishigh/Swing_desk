import test from 'node:test';
import assert from 'node:assert/strict';
import { readNav, handle } from '../functions/api/nav.ts';
import worker from '../worker.ts';

const fake = (body: unknown, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test('NAV history: dated NAVs come back, junk rows are dropped, and a bad code never reaches the source', async () => {
  const d = await readNav('120716', fake({ meta: { x: 1 }, data: [{ date: '27-10-2026', nav: '100.5' }, { date: 'bad', nav: '1' }, { date: '26-10-2026', nav: 99 }] }));
  assert.deepEqual(d, [{ date: '27-10-2026', nav: '100.5' }, { date: '26-10-2026', nav: '99' }]);
  assert.equal(await readNav('../x', fake({ data: [] })), null);
  assert.equal(await readNav('1', fake({ data: [] })), null);
  assert.equal(await readNav('1', fake({}, 404)), null);
  assert.equal(await readNav('1', (async () => { throw new Error('down'); }) as unknown as typeof fetch), null);
});
test('the NAV route needs the login and is routed by the worker', async () => {
  assert.equal((await handle(new Request('https://x/api/nav?code=1'), {})).status, 401);
  const env = { ASSETS: { fetch: async () => new Response('asset') } };
  assert.equal((await worker.fetch(new Request('https://x/api/nav?code=1'), env)).status, 401);
});
