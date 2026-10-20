// Portfolio storage in the private repo through the GitHub contents API. Only the folder `portfolio/accounts/` is ever touched.
import { mergeTrades, type Trade } from '../../src/pm/reader.ts';
import type { Decision } from '../../src/pm/resolver.ts';
export interface StoreEnv { GITHUB_TOKEN: string; REPO: string; BRANCH?: string }
export interface Account { label: string; broker: 'groww' | 'zerodha'; owner?: string; decisions?: Record<string, Decision>; verdictLog?: LogEntry[]; settings?: AccountSettings; savedAt: string; trades: Trade[] }
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
/** The account's own allocation inputs (capital, profile, horizon, slab rate, stops, quarter dates): kept with the account so the desk works the same from any browser. Whitelisted and bounded. */
export interface AccountSettings { capital?: number; money?: number; buffer?: number; horizon?: number; slab?: number; profile?: string; off?: string[]; custom?: Record<string, number>; outside?: { name: string; value: number; cls: string }[]; stops?: Record<string, number>; acted?: Record<string, string> }
const nn = (v: unknown, max = 1e11): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
const okKey = (k: string) => /^[A-Za-z0-9 .,&()'_/-]{1,80}$/.test(k);
export function cleanSettings(input: unknown): AccountSettings | string | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'settings must be an object';
  const i = input as Record<string, any>, out: AccountSettings = {};
  for (const f of ['capital', 'money', 'buffer'] as const) if (i[f] !== undefined) { const n = nn(i[f]); if (n === null) return `bad ${f}`; out[f] = n; }
  if (i.horizon !== undefined) { const n = nn(i.horizon, 60); if (n === null) return 'bad horizon'; out.horizon = n; }
  if (i.slab !== undefined) { const n = nn(i.slab, 60); if (n === null) return 'bad slab rate'; out.slab = n; }
  if (i.profile !== undefined) { if (!['Cautious', 'Balanced', 'Aggressive', 'Custom'].includes(i.profile)) return 'bad profile'; out.profile = i.profile; }
  if (i.off !== undefined) { if (!Array.isArray(i.off) || i.off.length > 20 || i.off.some((x: any) => typeof x !== 'string' || !okKey(x))) return 'bad scope'; out.off = i.off; }
  const rec = (v: any, max: number, what: string, check: (x: any) => boolean): Record<string, any> | string => { if (!v || typeof v !== 'object' || Array.isArray(v)) return `bad ${what}`; const e = Object.entries(v); if (e.length > max) return `too many ${what}`; for (const [k, x] of e) if (!okKey(k) || !check(x)) return `bad ${what}`; return v; };
  if (i.custom !== undefined) { const r = rec(i.custom, 20, 'custom weights', (x) => nn(x, 1) !== null); if (typeof r === 'string') return r; out.custom = r as any; }
  if (i.stops !== undefined) { const r = rec(i.stops, 100, 'stops', (x) => nn(x, 1e7) !== null); if (typeof r === 'string') return r; out.stops = r as any; }
  if (i.acted !== undefined) { const r = rec(i.acted, 20, 'dates', (x) => typeof x === 'string' && /^\d{4}-\d\d-\d\d$/.test(x)); if (typeof r === 'string') return r; out.acted = r as any; }
  if (i.outside !== undefined) { if (!Array.isArray(i.outside) || i.outside.length > 10 || i.outside.some((o: any) => !o || typeof o.name !== 'string' || !okKey(o.name) || nn(o.value) === null || typeof o.cls !== 'string' || !okKey(o.cls))) return 'bad outside holdings'; out.outside = i.outside.map((o: any) => ({ name: o.name, value: o.value, cls: o.cls })); }
  return out;
}
/** The owner's answers to estimated items. `clear` removes an answer. Keys are company keys (an ISIN or an uppercased name). */
export function cleanDecisions(input: unknown): Record<string, Decision | 'clear'> | string {
  if (input === undefined) return {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'decisions must be an object';
  const out: Record<string, Decision | 'clear'> = {}; const entries = Object.entries(input as Record<string, any>);
  if (entries.length > 200) return 'too many decisions';
  for (const [k, v] of entries) {
    if (!/^[A-Za-z0-9 .&_()-]{1,60}$/.test(k)) return 'bad decision key';
    if (v === 'clear') { out[k] = 'clear'; continue; }
    if (!v || typeof v !== 'object' || !['confirm', 'reject', 'price'].includes(v.action)) return 'bad decision';
    if (v.action === 'price' && !(typeof v.unitCost === 'number' && Number.isFinite(v.unitCost) && v.unitCost >= 0 && v.unitCost < 1e7)) return 'bad price';
    out[k] = v.action === 'price' ? { action: 'price', unitCost: v.unitCost } : { action: v.action };
  }
  return out;
}
/** One line of the verdict log: what the rule said about a held stock on a day, and the numbers it rested on. Only changes are logged. */
export interface LogEntry { date: string; symbol: string; verdict: 'Exit' | 'Keep'; rule: string; close: number; sma200: number | null; swingLow: number | null; swingDate: string | null; unrealised: number | null }
const LOG_CAP = 5000;
const finite = (v: unknown, lo = -1e12, hi = 1e12) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
export function cleanLog(input: unknown): LogEntry[] | string {
  if (input === undefined) return [];
  if (!Array.isArray(input)) return 'verdictLog must be a list';
  if (input.length > 1000) return 'too many log entries';
  const out: LogEntry[] = [];
  for (const e of input) {
    if (!e || typeof e !== 'object') return 'bad log entry';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || !/^[A-Za-z0-9&._-]{1,30}$/.test(e.symbol)) return 'bad log entry';
    if (e.verdict !== 'Exit' && e.verdict !== 'Keep') return 'bad log verdict';
    if (typeof e.rule !== 'string' || e.rule.length > 80) return 'bad log rule';
    if (!finite(e.close, 0, 1e8) || !(e.sma200 === null || finite(e.sma200, 0, 1e8)) || !(e.swingLow === null || finite(e.swingLow, 0, 1e8)) || !(e.unrealised === null || finite(e.unrealised))) return 'bad log numbers';
    if (!(e.swingDate === null || /^\d{4}-\d{2}-\d{2}$/.test(e.swingDate))) return 'bad log date';
    out.push({ date: e.date, symbol: e.symbol, verdict: e.verdict, rule: e.rule, close: e.close, sma200: e.sma200, swingLow: e.swingLow, swingDate: e.swingDate, unrealised: e.unrealised });
  }
  return out;
}
export function mergeLog(cur: LogEntry[] = [], add: LogEntry[] = []): LogEntry[] {
  const by = new Map<string, LogEntry>(); for (const e of [...cur, ...add]) by.set(e.symbol + '|' + e.date, e);
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol)).slice(-LOG_CAP);
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
    async del(path: string, sha: string, message: string) {
      const r = await fetchFn(`${base}/${path}`, { method: 'DELETE', headers: h, body: JSON.stringify({ message, sha, branch: ref }) });
      if (!r.ok) throw new Error('delete failed ' + r.status);
    },
    async put(path: string, data: Account, sha: string | undefined, message: string) {
      const r = await fetchFn(`${base}/${path}`, { method: 'PUT', headers: h, body: JSON.stringify({ message, content: b64(JSON.stringify(data) + '\n'), branch: ref, ...(sha ? { sha } : {}) }) });
      if (!r.ok) throw new Error('write failed ' + r.status);
    },
  };
}
export const pathFor = (label: string) => `${DIR}/${slug(label)}.json`;

export async function saveAccount(env: StoreEnv, label: string, broker: 'groww' | 'zerodha', incoming: Trade[], fetchFn: typeof fetch = fetch, now = new Date(), owner?: string, decisions: Record<string, Decision | 'clear'> = {}, log: LogEntry[] = [], settings?: AccountSettings) {
  const gh = github(env, fetchFn), path = pathFor(label), cur = await gh.get(path);
  const merged = mergeTrades([cur?.data.trades ?? [], incoming]);
  const dec: Record<string, Decision> = { ...(cur?.data.decisions ?? {}) }; for (const [k, v] of Object.entries(decisions)) { if (v === 'clear') delete dec[k]; else dec[k] = v; }
  const vlog = mergeLog(cur?.data.verdictLog, log);
  const acc: Account = { label: cur?.data.label ?? label, broker, ...(Object.keys(dec).length ? { decisions: dec } : {}), ...(vlog.length ? { verdictLog: vlog } : {}), ...((settings ?? cur?.data.settings) ? { settings: settings ?? cur?.data.settings } : {}), ...((owner ?? cur?.data.owner) ? { owner: owner ?? cur?.data.owner } : {}), savedAt: now.toISOString(), trades: merged.trades };
  await gh.put(path, acc, cur?.sha, `portfolio: update ${slug(label)}`);
  return { trades: merged.trades.length, added: merged.trades.length - (cur?.data.trades.length ?? 0), duplicates: merged.duplicates };
}
export async function loadAccounts(env: StoreEnv, fetchFn: typeof fetch = fetch): Promise<Account[]> {
  const gh = github(env, fetchFn), out: Account[] = [];
  for (const p of await gh.list()) { const f = await gh.get(p); if (f) out.push(f.data); }
  return out;
}

/** The nightly "what changed" summary for the desk's front page (portfolio/book/holdings-latest.json, written by scripts/holding-alerts.mjs). Null when not written yet. */
export async function loadMorning(env: StoreEnv, fetchFn: typeof fetch = fetch): Promise<unknown | null> {
  const f = await github(env, fetchFn).get('portfolio/book/holdings-latest.json');
  return f ? (f.data as any).morning ?? null : null;
}

/** Removes one saved account file. Only `portfolio/accounts/<slug>.json` can be named, because the path is built from a validated label. */
export async function deleteAccount(env: StoreEnv, label: string, fetchFn: typeof fetch = fetch): Promise<{ deleted: boolean }> {
  const gh = github(env, fetchFn), path = pathFor(label), cur = await gh.get(path);
  if (!cur) return { deleted: false };
  await gh.del(path, cur.sha, `portfolio: remove ${slug(label)}`);
  return { deleted: true };
}
/** Renames an account: writes the new file, then removes the old one. A change of letter case alone rewrites the same file. */
export async function renameAccount(env: StoreEnv, label: string, newLabel: string, fetchFn: typeof fetch = fetch, now = new Date()): Promise<{ renamed: boolean; error?: string }> {
  const gh = github(env, fetchFn), from = pathFor(label), to = pathFor(newLabel), cur = await gh.get(from);
  if (!cur) return { renamed: false, error: 'account not found' };
  const acc: Account = { ...cur.data, label: newLabel, savedAt: now.toISOString() };
  if (from === to) { await gh.put(to, acc, cur.sha, `portfolio: rename ${slug(label)}`); return { renamed: true }; }
  if (await gh.get(to)) return { renamed: false, error: 'an account with that name already exists' };
  await gh.put(to, acc, undefined, `portfolio: rename ${slug(label)} to ${slug(newLabel)}`);
  await gh.del(from, cur.sha, `portfolio: remove ${slug(label)} (renamed)`);
  return { renamed: true };
}
