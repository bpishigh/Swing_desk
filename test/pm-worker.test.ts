import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.ts';

test('worker: only /api/portfolio goes to the handler (and is refused without a login); everything else is served as static assets', async () => {
  const env = { ASSETS: { fetch: async (r: Request) => new Response('asset ' + new URL(r.url).pathname) } };
  const page = await worker.fetch(new Request('https://x/upload.html'), env);
  assert.equal(await page.text(), 'asset /upload.html');
  const api = await worker.fetch(new Request('https://x/api/portfolio'), env);
  assert.equal(api.status, 401);
  const other = await worker.fetch(new Request('https://x/api/other'), env);
  assert.equal(await other.text(), 'asset /api/other');
});
