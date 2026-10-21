import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../functions/api/portfolio.ts';
import { resetAccessCache } from '../functions/_lib/access.ts';
import { cleanTrades } from '../functions/_lib/store.ts';

const ENV = { TEAM_DOMAIN: 'team.cloudflareaccess.com', POLICY_AUD: 'aud123', ALLOWED_EMAILS: 'Owner@Example.com, partner@example.com', GITHUB_TOKEN: 'tok', REPO: 'o/r' };
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const trade = (id: string) => ({ instrument: 'ABC LTD', symbol: 'ABC', isin: 'INE000A01011', side: 'buy', qty: 10, price: 100, value: 1000, date: '2024-01-10', time: '10:00', exchange: 'NSE', orderId: id, tradeId: id, kind: 'stock' });

async function setup(over: Record<string, unknown> = {}) {
  resetAccessCache();
  const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1' };
  const claims = { iss: `https://${ENV.TEAM_DOMAIN}`, aud: [ENV.POLICY_AUD], exp: Math.floor(Date.now() / 1000) + 600, email: 'owner@example.com', ...over };
  const body = enc({ alg: 'RS256', kid: 'k1' }) + '.' + enc(claims);
  const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(body))).toString('base64url');
  const store = new Map<string, { sha: string; content: string }>(); const calls: string[] = [];
  const fetchFn = (async (url: any, init: any = {}) => {
    const u = String(url); calls.push((init.method ?? 'GET') + ' ' + u);
    if (u.endsWith('/cdn-cgi/access/certs')) return new Response(JSON.stringify({ keys: [jwk] }));
    const m = /contents\/(portfolio\/accounts(?:\/[^?]*)?)/.exec(u); if (!m) return new Response('no', { status: 500 });
    if (init.method === 'DELETE') { const had = store.delete(m[1]); return new Response('{}', { status: had ? 200 : 404 }); }
    if (init.method === 'PUT') { store.set(m[1], { sha: 's' + store.size + 1, content: JSON.parse(init.body).content }); return new Response('{}'); }
    if (m[1] === 'portfolio/accounts') return new Response(JSON.stringify([...store.keys()].map((p) => ({ type: 'file', name: p.split('/').pop(), path: p }))));
    const f = store.get(m[1]); return f ? new Response(JSON.stringify({ sha: f.sha, content: f.content })) : new Response('{}', { status: 404 });
  }) as typeof fetch;
  const req = (method: string, payload?: unknown, token = body + '.' + sig) => new Request('https://x/api/portfolio', { method, headers: { 'content-type': 'application/json', 'Cf-Access-Jwt-Assertion': token }, body: payload === undefined ? undefined : JSON.stringify(payload) });
  return { fetchFn, req, store, calls, body, sig };
}

test('function: no token, bad signature, wrong audience, expired token and unlisted e-mail are all refused', async () => {
  const s = await setup();
  assert.equal((await handle(new Request('https://x/api/portfolio'), ENV, s.fetchFn)).status, 401);
  assert.equal((await handle(s.req('GET', undefined, s.body + '.' + s.sig.slice(0, -4) + 'AAAA'), ENV, s.fetchFn)).status, 401);
  assert.equal((await handle((await setup({ aud: ['other'] })).req('GET'), ENV, (await setup()).fetchFn)).status, 401);
  const e = await setup({ exp: Math.floor(Date.now() / 1000) - 5 }); assert.equal((await handle(e.req('GET'), ENV, e.fetchFn)).status, 401);
  const m = await setup({ email: 'stranger@example.com' }); assert.equal((await handle(m.req('GET'), ENV, m.fetchFn)).status, 401);
  assert.equal(s.calls.filter((c) => c.includes('api.github.com')).length, 0, 'no GitHub call before the login check passes');
});

test('function: save merges by trade id, drops extra fields, and a later read returns the account', async () => {
  const s = await setup();
  const withJunk = { ...trade('1'), clientCode: 'AB1234', pan: 'ABCDE1234F', owner: 'Someone' };
  const r1 = await handle(s.req('POST', { label: 'Test Zerodha', broker: 'zerodha', trades: [withJunk, trade('2')] }), ENV, s.fetchFn);
  assert.equal(r1.status, 200); assert.equal((await r1.json() as any).trades, 2);
  const r2 = await handle(s.req('POST', { label: 'Test Zerodha', broker: 'zerodha', trades: [trade('2'), trade('3')] }), ENV, s.fetchFn);
  assert.deepEqual(await r2.json(), { trades: 3, added: 1, duplicates: 1 });
  const stored = [...s.store.values()].map((f) => Buffer.from(f.content, 'base64').toString());
  assert.equal(stored.length, 1); assert.ok(!/AB1234|ABCDE1234F|Someone/.test(stored[0]));
  assert.deepEqual([...s.store.keys()], ['portfolio/accounts/test-zerodha.json']);
  const g = await (await handle(s.req('GET'), ENV, s.fetchFn)).json() as any;
  assert.equal(g.accounts.length, 1); assert.equal(g.accounts[0].trades.length, 3);
});

test('function: bad labels, brokers, dates and numbers are rejected before any write', async () => {
  const s = await setup();
  for (const b of [{ label: '../x', broker: 'groww', trades: [] }, { label: 'ok', broker: 'other', trades: [] }, { label: 'ok', broker: 'groww', trades: [{ ...trade('1'), date: '10/01/2024' }] }, { label: 'ok', broker: 'groww', trades: [{ ...trade('1'), qty: 'ten' }] }, { label: 'ok', broker: 'groww', trades: 'x' }])
    assert.equal((await handle(s.req('POST', b), ENV, s.fetchFn)).status, 400);
  assert.equal(s.store.size, 0);
  assert.equal(typeof cleanTrades([trade('1')]), 'object');
});

test('function: a refusal says which check failed, without revealing any secret value', async () => {
  const s = await setup();
  const none = await (await handle(new Request('https://x/api/portfolio'), ENV, s.fetchFn)).json() as any;
  assert.match(none.reason, /no Access login token/);
  const aud = await setup({ aud: ['other'] }); const a = await (await handle(aud.req('GET'), ENV, aud.fetchFn)).json() as any;
  assert.match(a.reason, /POLICY_AUD/); assert.ok(!JSON.stringify(a).includes('aud123'));
  const iss = await setup({ iss: 'https://wrong.example.com' }); assert.match(((await (await handle(iss.req('GET'), ENV, iss.fetchFn)).json()) as any).reason, /TEAM_DOMAIN/);
  const mail = await setup({ email: 'stranger@example.com' }); assert.match(((await (await handle(mail.req('GET'), ENV, mail.fetchFn)).json()) as any).reason, /ALLOWED_EMAILS/);
  assert.match(((await (await handle(s.req('GET'), { ...ENV, POLICY_AUD: '' }, s.fetchFn)).json()) as any).reason, /variables missing: POLICY_AUD/);
});

test('function: an owner is stored with the account, kept on later saves, and a bad owner is refused', async () => {
  const s = await setup();
  await handle(s.req('POST', { label: 'Asha Zerodha', broker: 'zerodha', owner: 'Asha', trades: [trade('1')] }), ENV, s.fetchFn);
  await handle(s.req('POST', { label: 'asha zerodha', broker: 'zerodha', trades: [trade('2')] }), ENV, s.fetchFn);   // different case, no owner: same file, owner kept
  assert.equal(s.store.size, 1);
  const g = await (await handle(s.req('GET'), ENV, s.fetchFn)).json() as any;
  assert.equal(g.accounts[0].owner, 'Asha'); assert.equal(g.accounts[0].label, 'Asha Zerodha'); assert.equal(g.accounts[0].trades.length, 2);
  assert.equal((await handle(s.req('POST', { label: 'ok', broker: 'groww', owner: '../x', trades: [] }), ENV, s.fetchFn)).status, 400);
});

test('function: decisions are stored with the account, merged, cleared, and bad ones refused', async () => {
  const s = await setup();
  const post = (b: unknown) => handle(s.req('POST', b), ENV, s.fetchFn);
  assert.equal((await post({ label: 'Acc', broker: 'zerodha', trades: [trade('1')], decisions: { LIC: { action: 'price', unitCost: 949 }, EST: { action: 'reject' } } })).status, 200);
  assert.equal((await post({ label: 'Acc', broker: 'zerodha', trades: [], decisions: { EST: 'clear', MIS: { action: 'confirm' } } })).status, 200);
  const g = await (await handle(s.req('GET'), ENV, s.fetchFn)).json() as any;
  assert.deepEqual(g.accounts[0].decisions, { LIC: { action: 'price', unitCost: 949 }, MIS: { action: 'confirm' } });
  for (const bad of [{ X: { action: 'sell' } }, { X: { action: 'price', unitCost: -1 } }, { '../x': { action: 'confirm' } }, [1]]) assert.equal((await post({ label: 'Acc', broker: 'zerodha', trades: [], decisions: bad })).status, 400);
});

test('function: the verdict log is stored with the account, merged by symbol and day, and bad entries refused', async () => {
  const s = await setup();
  const post = (b: unknown) => handle(s.req('POST', b), ENV, s.fetchFn);
  const e = (symbol: string, date: string, verdict: string, close = 100) => ({ date, symbol, verdict, rule: 'exit test', close, sma200: 110, swingLow: null, swingDate: null, unrealised: -500 });
  assert.equal((await post({ label: 'Acc', broker: 'zerodha', trades: [trade('1')], verdictLog: [e('AAA', '2026-10-13', 'Keep'), e('BBB', '2026-10-13', 'Exit')] })).status, 200);
  assert.equal((await post({ label: 'Acc', broker: 'zerodha', trades: [], verdictLog: [e('AAA', '2026-10-14', 'Exit'), e('BBB', '2026-10-13', 'Exit', 99)] })).status, 200);
  const g = await (await handle(s.req('GET'), ENV, s.fetchFn)).json() as any;
  const log = g.accounts[0].verdictLog; assert.equal(log.length, 3);
  assert.deepEqual(log.map((x: any) => x.symbol + x.verdict + x.close), ['AAAKeep100', 'BBBExit99', 'AAAExit100']);
  for (const bad of [[{ ...e('A', '2026-10-13', 'Keep'), verdict: 'Buy' }], [{ ...e('A', '13-10-2026', 'Keep') }], [{ ...e('../x', '2026-10-13', 'Keep') }], [{ ...e('A', '2026-10-13', 'Keep'), close: 'x' }], 'nope'])
    assert.equal((await post({ label: 'Acc', broker: 'zerodha', trades: [], verdictLog: bad })).status, 400);
});

test('function: an account can be renamed (case change keeps the file) or deleted, and refused without a login', async () => {
  const s = await setup();
  const call = (method: string, b: unknown) => handle(s.req(method, b), ENV, s.fetchFn);
  await call('POST', { label: 'Old Name', broker: 'groww', owner: 'Asha', trades: [trade('1')] });
  await call('POST', { label: 'Other', broker: 'groww', trades: [trade('2')] });
  assert.equal((await call('PATCH', { label: 'Old Name', newLabel: 'Other' })).status, 409);
  assert.equal((await call('PATCH', { label: 'Old Name', newLabel: 'old name' })).status, 200); assert.equal(s.store.size, 2);
  assert.equal((await call('PATCH', { label: 'old name', newLabel: 'Brand New' })).status, 200);
  assert.deepEqual([...s.store.keys()].sort(), ['portfolio/accounts/brand-new.json', 'portfolio/accounts/other.json']);
  const g = await (await handle(s.req('GET'), ENV, s.fetchFn)).json() as any; const moved = g.accounts.find((a: any) => a.label === 'Brand New'); assert.equal(moved.owner, 'Asha'); assert.equal(moved.trades.length, 1);
  assert.equal((await call('DELETE', { label: 'Brand New' })).status, 200); assert.equal(s.store.size, 1);
  assert.equal((await call('DELETE', { label: '../x' })).status, 400);
  assert.equal((await handle(new Request('https://x/api/portfolio', { method: 'DELETE', body: '{"label":"Other"}' }), ENV, s.fetchFn)).status, 401);
  assert.equal(s.store.size, 1);
});

test('function: allocation inputs are saved as a patch: merged per key, null deletes, an empty patch changes nothing, bad ones are refused', async () => {
  const s = await setup();
  const cfg = { capital: 600000, profile: 'Cautious', horizon: 3, slab: 30, stops: { 'ABC LTD': 95.5 }, acted: { index: '2026-10-20' }, outside: [{ name: 'EPF', value: 250000, cls: 'debt' }], off: ['silver'], swing: { 'INE000A01011|2026-10-13': 'yes' } };
  assert.equal((await handle(s.req('POST', { label: 'Asha Zerodha', broker: 'zerodha', owner: 'Asha', trades: [trade('1')], settings: cfg }), ENV, s.fetchFn)).status, 200);
  await handle(s.req('POST', { label: 'Asha Zerodha', broker: 'zerodha', trades: [trade('2')] }), ENV, s.fetchFn);   // a later upload without settings keeps them
  const get = async () => ((await (await handle(s.req('GET'), ENV, s.fetchFn)).json()) as any).accounts[0].settings;
  assert.deepEqual(await get(), cfg);
  // another device changes only the horizon and adds one stop; nothing else is touched
  await handle(s.req('POST', { label: 'Asha Zerodha', broker: 'zerodha', trades: [], settings: { horizon: 7, stops: { 'XYZ LTD': 50 } } }), ENV, s.fetchFn);
  let g = await get(); assert.equal(g.horizon, 7); assert.equal(g.capital, 600000); assert.deepEqual(g.stops, { 'ABC LTD': 95.5, 'XYZ LTD': 50 });
  await handle(s.req('POST', { label: 'Asha Zerodha', broker: 'zerodha', trades: [], settings: { slab: null, stops: { 'ABC LTD': null } } }), ENV, s.fetchFn);
  g = await get(); assert.equal(g.slab, undefined); assert.deepEqual(g.stops, { 'XYZ LTD': 50 });
  await handle(s.req('POST', { label: 'Asha Zerodha', broker: 'zerodha', trades: [], settings: {} }), ENV, s.fetchFn);   // empty patch: no change (a rename bug once sent {} and wiped everything)
  assert.equal((await get()).capital, 600000);
  const bad = [{ capital: -1 }, { profile: 'Wild' }, { slab: 'x' }, { slab: 61 }, { horizon: 99 }, JSON.parse('{"stops":{"__proto__":1}}'), { stops: { x: -5 } }, { acted: { index: 'yesterday' } }, { acted: { index: '2026-13-45' } }, { swing: { a: 'maybe' } }, { outside: [{ name: 'EPF', value: 1 }] }, { custom: { index: 5 } }, []];
  for (const b of bad) assert.equal((await handle(s.req('POST', { label: 'Asha Zerodha', broker: 'zerodha', trades: [], settings: b }), ENV, s.fetchFn)).status, 400, JSON.stringify(b));
  assert.equal((await handle(s.req('POST', null as any), ENV, s.fetchFn)).status, 400);   // a null body is a 400, not a crash
});
test('function: a settings-only or decisions-only post cannot create an account (no ghosts), and a lost race is retried', async () => {
  const s = await setup();
  assert.equal((await handle(s.req('POST', { label: 'Ghost', broker: 'groww', trades: [], settings: { capital: 5 } }), ENV, s.fetchFn)).status, 404);
  assert.equal(s.store.size, 0);
  // the first write to the file loses a race (409); the save reads again and succeeds
  await handle(s.req('POST', { label: 'Race', broker: 'groww', trades: [trade('1')] }), ENV, s.fetchFn);
  let failed = 0; const racing = (async (url: any, init: any = {}) => { if (init.method === 'PUT' && !failed++) return new Response('{}', { status: 409 }); return s.fetchFn(url, init); }) as typeof fetch;
  assert.equal((await handle(s.req('POST', { label: 'Race', broker: 'groww', trades: [], settings: { capital: 9 } }), ENV, racing)).status, 200);
  assert.equal((((await (await handle(s.req('GET'), ENV, s.fetchFn)).json()) as any).accounts[0].settings).capital, 9);
});

test('rules view: household records come from the private repo; a missing file gives an empty list', async () => {
  const { loadRules } = await import('../functions/_lib/store.ts');
  const files: Record<string, unknown> = { 'portfolio/rules/ipos.json': { records: [{ symbol: 'ABC' }] }, 'portfolio/rules/demergers.json': { records: [{ parent: 'P' }, { parent: 'Q' }] } };
  const fetchFn = (async (url: any) => {
    const m = /contents\/(portfolio\/rules\/[^?]+)/.exec(String(url)); const f = m ? files[m[1]] : undefined;
    return f ? new Response(JSON.stringify({ sha: 's', content: Buffer.from(JSON.stringify(f)).toString('base64') })) : new Response('{}', { status: 404 });
  }) as typeof fetch;
  const r = await loadRules({ GITHUB_TOKEN: 't', REPO: 'o/r' }, fetchFn);
  assert.equal(r.ipos.length, 1); assert.equal(r.demergers.length, 2); assert.deepEqual(r.fundOverrides, []);
});
