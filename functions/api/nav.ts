// NAV history for one scheme, fetched by the server because the free NAV service (api.mfapi.in) no longer lets a browser page read it directly (no CORS header).
// Behind the same Access login as /api/portfolio. Public data only: the request names a scheme code, never an account, quantity or amount.
import { checkAccess } from '../_lib/access.ts';

const reply = (status: number, body: unknown, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });

/** The dated NAVs of a scheme, newest first as the source gives them. null when the source does not answer or the answer has no NAVs. */
export async function readNav(code: string, fetchFn: typeof fetch = fetch): Promise<{ date: string; nav: string }[] | null> {
  if (!/^\d{1,8}$/.test(code)) return null;
  try {
    const r = await fetchFn(`https://api.mfapi.in/mf/${code}`, { headers: { 'user-agent': 'Mozilla/5.0', accept: 'application/json' }, signal: AbortSignal.timeout(25000) });
    if (!r.ok) return null;
    const j = await r.json() as { data?: { date?: unknown; nav?: unknown }[] };
    const data = (j.data ?? []).filter((x) => typeof x.date === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(x.date) && x.nav !== undefined).map((x) => ({ date: x.date as string, nav: String(x.nav) }));
    return data.length ? data : null;
  } catch { return null; }
}

export async function handle(req: Request, env: any, fetchFn: typeof fetch = fetch): Promise<Response> {
  const who = await checkAccess(req, env, fetchFn); if (!who.ok) return reply(401, { error: 'not signed in', reason: who.reason });
  if (req.method !== 'GET') return reply(405, { error: 'method' });
  const code = new URL(req.url).searchParams.get('code') ?? '';
  if (!/^\d{1,8}$/.test(code)) return reply(400, { error: 'bad scheme code' });
  // one answer per scheme per day is kept by the edge cache, so reloading the page does not read the source again
  const cache = (globalThis as any).caches?.default as Cache | undefined, key = new Request(`https://nav.invalid/${code}/${new Date().toISOString().slice(0, 10)}`);
  try { const hit = await cache?.match(key); if (hit) return new Response(hit.body, { status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); } catch {}
  const data = await readNav(code, fetchFn);
  if (!data) return reply(404, { error: 'no NAV history for this scheme' });
  const res = reply(200, { data }); try { await cache?.put(key, new Response(JSON.stringify({ data }), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=43200' } })); } catch {}
  return res;
}
