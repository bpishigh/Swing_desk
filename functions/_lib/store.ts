// Portfolio storage in the private repo through the GitHub contents API. Only the folder `portfolio/accounts/` is ever touched.
import { mergeTrades, type Trade } from '../../src/pm/reader.ts';
export interface StoreEnv { GITHUB_TOKEN: string; REPO: string; BRANCH?: string }
export interface Account { label: string; broker: 'groww' | 'zerodha'; owner?: string; savedAt: string; trades: Trade[] }
const DIR = 'portfolio/accounts';
const LABEL = /^[A-Za-z0-9][A-Za-z0-9 _.-]{0,39}$/;
const DATE = /^\d{4}-\d\d-\d\d$/;
const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const str = (x: unknown, max = 120) => typeof x === 'string' && x.length <= max;

/** Rebuilds each trade from a whitelist of fields, so anything else the page sent (client codes, names, PAN) is dropped and never stored. */
export function cleanTrades(input: unknown): Trade[] | string {
  if (!Array.isArray(input)) return 'trades must be a list';
  if (input.length > 20000) return 'too many trades in one request';
  const out: Trade[] = [];
  for (const [i, t] of input.entries()) {
    if (!t || typeof t !== 'object') return `trade ${i}: not an object`;
    const x = t as Record<string, unknown>;
    if (!str(x.instrument) || !str(x.isin, 20) || (x.side !== 'buy' && x.side !== 'sell') || !num(x.qty) || !num(x.price) || !num(x.value)) return `trade ${i}: bad fields`;
    if (typeof x.date !== 'string' || !DATE.test(x.date) || !str(x.time, 12) || !str(x.exchange, 12) || !str(x.orderId, 40) || !str(x.tradeId, 40)) return `trade ${i}: bad fields`;
    if (x.kind !== 'stock' && x.kind !== 'fund' && x.kind !== 'unknown') return `trade ${i}: bad kind`;
    const o: Trade = { instrument: x.instrument as string, isin: x.isin as string, side: x.side, qty: x.qty as number, price: x.price as number, value: x.value as number, date: x.date, time: x.time as string, exchange: x.exchange as string, orderId: x.orderId as string, tradeId: x.tradeId as string, kind: x.kind };
    if (x.symbol !== undefined) { if (!str(x.symbol, 40)) return `trade ${i}: bad symbol`; o.symbol = x.symbol as string; }
    out.push(o);
  }
  return out;
}
export const validOwner = (o: unknown): o is string | undefined => o === undefined || validLabel(o);
export const validLabel = (l: unknown): l is string => typeof l === 'string' && LABEL.test(l);
const slug = (l: string) => l.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const b64 = (s: string) => { const b = new TextEncoder().encode(s); let r = ''; for (const c of b) r += String.fromCharCode(c); return btoa(r); };
const unb64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

export function github(env: StoreEnv, fetchFn: typeof fetch = fetch) {
  const base = `https://api.github.com/repos/${env.REPO}/contents`;
  const h = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'repo-desk-portfolio', 'X-GitHub-Api-Version': '2022-11-28' };
  const ref = env.BRANCH ?? 'main';
  return {
    async get(path: string): Promise<{ sha: string; data: Account } | null> {
      const r = await fetchFn(`${base}/${path}?ref=${ref}`, { headers: h }); if (r.status === 404) return null; if (!r.ok) throw new Error('read failed ' + r.status);
      const j = await r.json() as any; return { sha: j.sha, data: JSON.parse(unb64(j.content)) };
    },
    async list(): Promise<string[]> {
      const r = await fetchFn(`${base}/${DIR}?ref=${ref}`, { headers: h }); if (r.status === 404) return []; if (!r.ok) throw new Error('list failed ' + r.status);
      return ((await r.json() as any[]) ?? []).filter((f) => f.type === 'file' && f.name.endsWith('.json')).map((f) => f.path);
    },
    async put(path: string, data: Account, sha: string | undefined, message: string) {
      const r = await fetchFn(`${base}/${path}`, { method: 'PUT', headers: h, body: JSON.stringify({ message, content: b64(JSON.stringify(data) + '\n'), branch: ref, ...(sha ? { sha } : {}) }) });
      if (!r.ok) throw new Error('write failed ' + r.status);
    },
  };
}
export const pathFor = (label: string) => `${DIR}/${slug(label)}.json`;

export async function saveAccount(env: StoreEnv, label: string, broker: 'groww' | 'zerodha', incoming: Trade[], fetchFn: typeof fetch = fetch, now = new Date(), owner?: string) {
  const gh = github(env, fetchFn), path = pathFor(label), cur = await gh.get(path);
  const merged = mergeTrades([cur?.data.trades ?? [], incoming]);
  const acc: Account = { label: cur?.data.label ?? label, broker, ...((owner ?? cur?.data.owner) ? { owner: owner ?? cur?.data.owner } : {}), savedAt: now.toISOString(), trades: merged.trades };
  await gh.put(path, acc, cur?.sha, `portfolio: update ${slug(label)}`);
  return { trades: merged.trades.length, added: merged.trades.length - (cur?.data.trades.length ?? 0), duplicates: merged.duplicates };
}
export async function loadAccounts(env: StoreEnv, fetchFn: typeof fetch = fetch): Promise<Account[]> {
  const gh = github(env, fetchFn), out: Account[] = [];
  for (const p of await gh.list()) { const f = await gh.get(p); if (f) out.push(f.data); }
  return out;
}
