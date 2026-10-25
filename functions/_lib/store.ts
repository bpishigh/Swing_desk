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
    if (x.symbol !== undefined) { if (str(x.symbol, 40)) o.symbol = x.symbol as string; } // a fund order has no ticker: the reader copies the scheme name into symbol, which can be long, so it is dropped (the name and ISIN identify the fund)
    out.push(o);
  }
  return out;
}
/** The account's own allocation inputs (capital, profile, horizon, slab rate, stops, quarter dates, owner answers): kept with the account so the desk works the same from any browser.
 * A POST carries a PATCH: only the keys that changed. A key set to null is deleted; inside the four maps (custom, stops, acted, swing) a key set to null is deleted, other keys are merged. Whitelisted and bounded. */
export interface AccountSettings { capital?: number; money?: number; buffer?: number; horizon?: number; slab?: number; profile?: string; off?: string[]; custom?: Record<string, number>; outside?: { name: string; value: number; cls: string }[]; stops?: Record<string, number>; acted?: Record<string, string>; swing?: Record<string, 'yes' | 'no'> }
export type SettingsPatch = { [K in keyof AccountSettings]?: AccountSettings[K] | null | Record<string, any> };
const MAPS = ['custom', 'stops', 'acted', 'swing'] as const;
const nn = (v: unknown, max = 1e11): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
const BANNED = new Set(['__proto__', 'constructor', 'prototype']);
const okKey = (k: string) => /^[A-Za-z0-9 .,&()'_/-]{1,80}$/.test(k) && !BANNED.has(k);
/** Keys of stops and swing answers are an ISIN or a broker instrument name plus a date: any printable text, bounded. */
const mapKey = (k: string) => /^[^\x00-\x1f]{1,200}$/.test(k) && !BANNED.has(k);
const realDate = (x: unknown) => typeof x === 'string' && /^\d{4}-\d\d-\d\d$/.test(x) && (() => { const t = Date.parse(x + 'T00:00:00Z'); return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === x; })();
export function cleanSettings(input: unknown): SettingsPatch | string | undefined {
  if (input === undefined) return undefined;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 'settings must be an object';
  const i = input as Record<string, any>, out: Record<string, any> = {};
  for (const f of ['capital', 'money', 'buffer'] as const) if (i[f] !== undefined) { if (i[f] === null) { out[f] = null; continue; } const n = nn(i[f]); if (n === null) return `bad ${f}`; out[f] = n; }
  for (const [f, max] of [['horizon', 60], ['slab', 60]] as const) if (i[f] !== undefined) { if (i[f] === null) { out[f] = null; continue; } const n = nn(i[f], max); if (n === null) return `bad ${f}`; out[f] = n; }
  if (i.profile !== undefined) { if (i.profile === null) out.profile = null; else { if (!['Cautious', 'Balanced', 'Aggressive', 'Custom'].includes(i.profile)) return 'bad profile'; out.profile = i.profile; } }
  if (i.off !== undefined) { if (i.off === null) out.off = null; else { if (!Array.isArray(i.off) || i.off.length > 20 || i.off.some((x: any) => typeof x !== 'string' || !okKey(x))) return 'bad scope'; out.off = i.off; } }
  const spec: Record<string, [number, (k: string) => boolean, (v: any) => boolean]> = {
    custom: [20, okKey, (v) => nn(v, 1) !== null], stops: [100, mapKey, (v) => nn(v, 1e7) !== null], acted: [20, okKey, realDate], swing: [2000, mapKey, (v) => v === 'yes' || v === 'no'] };
  for (const m of MAPS) if (i[m] !== undefined) {
    if (i[m] === null) { out[m] = null; continue; }
    if (typeof i[m] !== 'object' || Array.isArray(i[m])) return `bad ${m}`;
    const e = Object.entries(i[m]); if (e.length > spec[m][0]) return `too many ${m}`;
    const o: Record<string, any> = {}; for (const [k, v] of e) { if (!spec[m][1](k) || !(v === null || spec[m][2](v))) return `bad ${m}`; o[k] = v; } out[m] = o;
  }
  if (i.outside !== undefined) { if (i.outside === null) out.outside = null; else { if (!Array.isArray(i.outside) || i.outside.length > 10 || i.outside.some((o: any) => !o || typeof o.name !== 'string' || !okKey(o.name) || nn(o.value) === null || typeof o.cls !== 'string' || !okKey(o.cls))) return 'bad outside holdings'; out.outside = i.outside.map((o: any) => ({ name: o.name, value: o.value, cls: o.cls })); } }
  return out as SettingsPatch;
}
/** Applies a patch to the stored settings (see above). An empty patch changes nothing. The merged result is re-checked against the same bounds. */
export function mergeSettings(cur: AccountSettings | undefined, patch: SettingsPatch | undefined): AccountSettings | undefined {
  if (!patch || !Object.keys(patch).length) return cur;
  const out: Record<string, any> = { ...(cur ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) { delete out[k]; continue; }
    if ((MAPS as readonly string[]).includes(k)) { const m: Record<string, any> = { ...(out[k] ?? {}) }; for (const [mk, mv] of Object.entries(v as Record<string, any>)) { if (mv === null) delete m[mk]; else m[mk] = mv; } if (Object.keys(m).length) out[k] = m; else delete out[k]; }
    else out[k] = v;
  }
  return Object.keys(out).length ? (out as AccountSettings) : undefined;
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

export async function saveAccount(env: StoreEnv, label: string, broker: 'groww' | 'zerodha', incoming: Trade[], fetchFn: typeof fetch = fetch, now = new Date(), owner?: string, decisions: Record<string, Decision | 'clear'> = {}, log: LogEntry[] = [], settings?: SettingsPatch) {
  for (let attempt = 0; ; attempt++) {
    try { return await saveOnce(env, label, broker, incoming, fetchFn, now, owner, decisions, log, settings); }
    catch (e: any) { if (attempt < 3 && /write failed 409/.test(String(e?.message))) continue; throw e; }   // another save landed first: read again and re-apply
  }
}
export class NoSuchAccount extends Error {}
async function saveOnce(env: StoreEnv, label: string, broker: 'groww' | 'zerodha', incoming: Trade[], fetchFn: typeof fetch, now: Date, owner: string | undefined, decisions: Record<string, Decision | 'clear'>, log: LogEntry[], settings?: SettingsPatch) {
  const gh = github(env, fetchFn), path = pathFor(label), cur = await gh.get(path);
  if (!cur && incoming.length === 0) throw new NoSuchAccount('no such account: only an upload creates one');
  const merged = mergeTrades([cur?.data.trades ?? [], incoming]);
  const dec: Record<string, Decision> = { ...(cur?.data.decisions ?? {}) }; for (const [k, v] of Object.entries(decisions)) { if (v === 'clear') delete dec[k]; else dec[k] = v; }
  const vlog = mergeLog(cur?.data.verdictLog, log);
  const acc: Account = { label: cur?.data.label ?? label, broker, ...(Object.keys(dec).length ? { decisions: dec } : {}), ...(vlog.length ? { verdictLog: vlog } : {}), ...(mergeSettings(cur?.data.settings, settings) ? { settings: mergeSettings(cur?.data.settings, settings) } : {}), ...((owner ?? cur?.data.owner) ? { owner: owner ?? cur?.data.owner } : {}), savedAt: now.toISOString(), trades: merged.trades };
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

/** Household-specific rule records (IPO allotments, demergers, typed fund matches, exit loads of the funds held) kept in the private data repo under portfolio/rules/, so they are never in the public code repo.
 * A missing file gives an empty list; the page then simply has fewer typed records to apply. */
export async function loadRules(env: StoreEnv, fetchFn: typeof fetch = fetch): Promise<{ ipos: unknown[]; demergers: unknown[]; fundOverrides: unknown[]; exitLoads: unknown[] }> {
  const gh = github(env, fetchFn); const rec = async (n: string) => { const f = await gh.get(`portfolio/rules/${n}.json`); const r = f ? (f.data as any)?.records : null; return Array.isArray(r) ? r : []; };
  const [ipos, demergers, fundOverrides, exitLoads] = await Promise.all([rec('ipos'), rec('demergers'), rec('fund-overrides'), rec('exit-loads')]);
  return { ipos, demergers, fundOverrides, exitLoads };
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

/** Moves every transaction of the named holdings from one account to another (a wrong account or owner on a holding). Writes the target first, then removes them from the source,
 * so a failure in between leaves a duplicate that the next merge ignores, never a loss. A decision the source holds for a moved holding goes with it. A new target takes the source's broker and owner unless `owner` is given. */
export async function moveHolding(env: StoreEnv, from: string, to: string, keys: string[], owner: string | undefined, fetchFn: typeof fetch = fetch, now = new Date()): Promise<{ moved: number; error?: string }> {
  if (pathFor(from) === pathFor(to)) return { moved: 0, error: 'the two accounts are the same' };
  const gh = github(env, fetchFn), src = await gh.get(pathFor(from)); if (!src) return { moved: 0, error: 'account not found' };
  const want = new Set(keys), key = (t: Trade) => t.isin || t.instrument.toUpperCase();
  const sel = src.data.trades.filter((t) => want.has(key(t))), rest = src.data.trades.filter((t) => !want.has(key(t)));
  if (!sel.length) return { moved: 0, error: 'no matching transactions in that account' };
  const dec: Record<string, Decision | 'clear'> = {}; for (const k of keys) { const d = src.data.decisions?.[k]; if (d) dec[k] = d; }
  await saveAccount(env, to, src.data.broker, sel, fetchFn, now, owner ?? (await gh.get(pathFor(to)))?.data.owner ?? src.data.owner, dec);
  for (let attempt = 0; ; attempt++) {
    const cur = await gh.get(pathFor(from)); if (!cur) break;
    const left = cur.data.trades.filter((t) => !want.has(key(t))), decs = { ...(cur.data.decisions ?? {}) }; for (const k of keys) delete decs[k];
    const acc: Account = { ...cur.data, trades: left, savedAt: now.toISOString() }; if (Object.keys(decs).length) acc.decisions = decs; else delete acc.decisions;
    try { await gh.put(pathFor(from), acc, cur.sha, `portfolio: move ${keys.length} holding(s) from ${slug(from)} to ${slug(to)}`); break; } catch (e: any) { if (attempt < 3 && /write failed 409/.test(String(e?.message))) continue; throw e; }
  }
  void rest; return { moved: sel.length };
}
