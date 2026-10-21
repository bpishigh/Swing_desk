// Cloudflare Pages Function behind Cloudflare Access. GET returns the saved accounts; POST merges new clean transactions into one account.
// Needs Pages secrets: GITHUB_TOKEN (fine-grained, contents read/write on the private data repo only), REPO ("owner/name" of the private data repo), TEAM_DOMAIN, POLICY_AUD, ALLOWED_EMAILS.
import { checkAccess } from '../_lib/access.ts';
import { cleanTrades, loadAccounts, loadMorning, saveAccount, validLabel, validOwner, cleanDecisions, cleanLog, cleanSettings, NoSuchAccount, deleteAccount, renameAccount } from '../_lib/store.ts';

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function handle(req: Request, env: any, fetchFn: typeof fetch = fetch): Promise<Response> {
  const who = await checkAccess(req, env, fetchFn); if (!who.ok) return reply(401, { error: 'not signed in', reason: who.reason });
  if (req.method === 'GET' && new URL(req.url).searchParams.get('view') === 'morning') { try { return reply(200, { morning: await loadMorning(env, fetchFn) }); } catch (e: any) { return reply(502, { error: e.message }); } }
  if (req.method === 'GET') { try { return reply(200, { accounts: await loadAccounts(env, fetchFn) }); } catch (e: any) { return reply(502, { error: e.message }); } }
  if (req.method === 'POST') {
    if ((req.headers.get('content-type') ?? '').split(';')[0] !== 'application/json') return reply(415, { error: 'json only' });
    const text = await req.text(); if (text.length > 8_000_000) return reply(413, { error: 'too large' });
    let b: any; try { b = JSON.parse(text); } catch { return reply(400, { error: 'bad json' }); }
    if (!b || typeof b !== 'object' || Array.isArray(b)) return reply(400, { error: 'bad json' });
    if (!validLabel(b.label)) return reply(400, { error: 'bad account name' });
    if (!validOwner(b.owner)) return reply(400, { error: 'bad owner name' });
    const decisions = cleanDecisions(b.decisions); if (typeof decisions === 'string') return reply(400, { error: decisions });
    const vlog = cleanLog(b.verdictLog); if (typeof vlog === 'string') return reply(400, { error: vlog });
    const settings = cleanSettings(b.settings); if (typeof settings === 'string') return reply(400, { error: settings });
    if (b.broker !== 'groww' && b.broker !== 'zerodha') return reply(400, { error: 'bad broker' });
    const trades = cleanTrades(b.trades); if (typeof trades === 'string') return reply(400, { error: trades });
    try { return reply(200, await saveAccount(env, b.label, b.broker, trades, fetchFn, new Date(), b.owner, decisions, vlog, settings)); } catch (e: any) { return reply(e instanceof NoSuchAccount ? 404 : 502, { error: e.message }); }
  }
  if (req.method === 'DELETE' || req.method === 'PATCH') {
    let b: any; try { b = await req.json(); } catch { return reply(400, { error: 'bad json' }); }
    if (!validLabel(b?.label)) return reply(400, { error: 'bad account name' });
    try {
      if (req.method === 'DELETE') return reply(200, await deleteAccount(env, b.label, fetchFn));
      if (!validLabel(b.newLabel)) return reply(400, { error: 'bad new name' });
      const r = await renameAccount(env, b.label, b.newLabel, fetchFn); return reply(r.renamed ? 200 : 409, r);
    } catch (e: any) { return reply(502, { error: e.message }); }
  }
  return reply(405, { error: 'method' });
}
export const onRequest = (ctx: { request: Request; env: any }) => handle(ctx.request, ctx.env);
