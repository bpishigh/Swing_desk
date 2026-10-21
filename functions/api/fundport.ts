// On-demand fund portfolio for a fund the account holds (Engine Rules C-78): the page asks for one scheme by ISIN and AMFI code, this reads the fund's public page and returns its equity lines.
// Behind the same Access login as /api/portfolio. Public data only; the request names a fund, never an account, quantity or amount.
import { checkAccess } from '../_lib/access.ts';
import { parsePage, parseEtfPage } from '../../src/pm/holdingsparse.ts';

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const UA = { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json,text/html,*/*' };
export interface FundQuery { isin: string; code: string; name: string }
export type FundPort = { etf: false; asOf: string; code: string; lines: { name: string; weight: number }[] } | { etf: true; asOf: string; code: string; lines: { isin: string; weight: number }[] };
export type Looked = { ok: true; port: FundPort } | { ok: false; reason: string };

export async function lookupFund(q: FundQuery, fetchFn: typeof fetch = fetch, today = new Date().toISOString().slice(0, 10)): Promise<Looked> {
  const get = async (url: string) => { const r = await fetchFn(url, { headers: UA, signal: AbortSignal.timeout(20000) }); return r.ok ? await r.text() : null; };
  try {
    const search = await get(`https://groww.in/v1/api/search/v1/entity?app=false&page=0&q=${encodeURIComponent(q.name.replace(/ - /g, ' ').replace(/direct plan|regular plan|growth option|growth/gi, '').trim())}&size=8`);
    const content = search ? (JSON.parse(search).content ?? []) : [];
    const hit = content.find((x: any) => (x.isin && x.isin === q.isin) || (q.code && String(x.scheme_code) === String(q.code)));
    if (!hit || typeof hit.search_id !== 'string' || !/^[a-z0-9-]+$/.test(hit.search_id)) return { ok: false, reason: 'the fund was not found at the source' };
    const isEtf = hit.entity_type === 'ETF' || /\bETF\b|\bBeES\b/i.test(q.name);
    const html = await get(`https://groww.in/${isEtf ? 'etfs' : 'mutual-funds'}/${hit.search_id}`);
    if (!html) return { ok: false, reason: 'the fund page did not load' };
    if (isEtf) { const p = parseEtfPage(html); return p && p.lines.length ? { ok: true, port: { etf: true, asOf: today, code: q.code, lines: p.lines } } : { ok: false, reason: 'no portfolio on the page' }; }
    const p = parsePage(html);
    if (!p || !p.lines.length || !p.asOf) return { ok: false, reason: 'no portfolio on the page' };
    if (p.code && q.code && String(p.code) !== String(q.code)) return { ok: false, reason: 'the page is another scheme' };   // never return another scheme's portfolio under this fund
    return { ok: true, port: { etf: false, asOf: p.asOf, code: q.code, lines: p.lines.map((l) => ({ name: l.name, weight: l.weight })) } };
  } catch (e: any) { return { ok: false, reason: 'lookup failed: ' + String(e?.message ?? e).slice(0, 80) }; }
}

export async function handle(req: Request, env: any, fetchFn: typeof fetch = fetch): Promise<Response> {
  const who = await checkAccess(req, env, fetchFn); if (!who.ok) return reply(401, { error: 'not signed in', reason: who.reason });
  if (req.method !== 'GET') return reply(405, { error: 'method' });
  const u = new URL(req.url), isin = u.searchParams.get('isin') ?? '', code = u.searchParams.get('code') ?? '', name = (u.searchParams.get('name') ?? '').slice(0, 120);
  if (!/^INF[0-9A-Z]{9}$/.test(isin) || !/^\d{0,8}$/.test(code) || !name) return reply(400, { error: 'bad fund' });
  // one answer per fund per day is kept by the edge cache, so opening the tab again does not read the source again
  const cache = (globalThis as any).caches?.default as Cache | undefined, key = new Request(`https://fundport.invalid/${isin}/${new Date().toISOString().slice(0, 10)}`);
  try { const hit = await cache?.match(key); if (hit) return new Response(hit.body, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); } catch {}
  const r = await lookupFund({ isin, code, name }, fetchFn);
  if (!r.ok) return reply(404, { error: r.reason });
  const res = reply(200, r.port); try { await cache?.put(key, new Response(JSON.stringify(r.port), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=86400' } })); } catch {}
  return res;
}
