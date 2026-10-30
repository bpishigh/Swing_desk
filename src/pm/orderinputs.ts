// Tonight's Swing orders for the household, assembled from the saved accounts (Engine Rules C-111, Portfolio Manager phase 9). Pure.
// This is the code that used to sit inside site/upload.html (poolsCard, ordersCard, householdJournal, calcAccount). It now lives here so the Portfolio page and the nightly script
// (scripts/sized-shortlist.mjs) run the same lines and cannot disagree. No rule changes: sizing is still sizeOrders (src/pm/swingorders.ts), pools still derivePools (src/pm/swingpools.ts).
// Reports are the output of runPipeline; they are typed loosely here because the page and the script both pass them straight through.
import { allocate, currentByClass, TARGET_CLASSES } from './allocation.ts';
import { derivePools } from './swingpools.ts';
import { journalReport } from './swingjournal.ts';
import { openRiskOf, sizeOrders, type Cand, type OrderAcct, type OrdersOut, type OrderLine } from './swingorders.ts';
import { isLong } from './rebalance.ts';
import { fy } from './tax.ts';

export const ownerOf = (a: { owner?: string }): string => a.owner || 'Unassigned';
export const normName = (n: unknown): string => String(n ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(limited|ltd)\b/g, '').replace(/\s+/g, ' ').trim();

/** Holdings of several reports merged by kind and name, largest first. */
export function mergeHoldings(reports: any[]): any[] {
  const by = new Map<string, any>();
  for (const r of reports) for (const h of r.holdings) {
    const k = h.kind + '|' + h.name;
    const e = by.get(k) ?? by.set(k, { name: h.name, symbol: h.symbol, isin: h.isin, kind: h.kind, book: h.book, assetClass: h.assetClass ?? null, category: h.category, locked: 0, qty: 0, cost: 0, value: 0, anyNull: false }).get(k);
    e.qty += h.qty; e.cost += h.cost; e.locked += h.locked ?? 0; if (h.value === null) e.anyNull = true; else e.value += h.value;
  }
  return [...by.values()].map((e) => ({ ...e, value: e.anyNull ? null : e.value })).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
}

/** One account's allocation: its capital (typed, or what it holds), profile, horizon and the targets that follow (the swing capital is the direct-equity target). `A` is the account's saved settings. */
export function acctAllocation(C: any, report: any, A: any) {
  const hs = mergeHoldings([report]);
  const outside = (A.outside ?? []).filter((o: any) => o.value > 0);   // typed by the owner: EPF and the like
  const held = [...hs.map((h) => ({ name: h.name, value: h.value, cls: h.assetClass ?? null, category: h.category, kind: h.kind })), ...outside.map((o: any) => ({ name: o.name, value: o.value, cls: o.cls, kind: 'Outside' }))];
  const lockedElss = hs.reduce((t, h) => t + (h.locked ?? 0), 0), cur = currentByClass(C, held as any);
  const capital = A.capital > 0 ? A.capital : Math.round(cur.total + cur.unclassified), profile = A.profile ?? 'Balanced', horizon = A.horizon ?? 10, off = new Set<string>(A.off ?? []);
  const res = allocate(C, { capital, profile, horizonYears: horizon, buffer: A.buffer, inScope: TARGET_CLASSES.filter((c) => !off.has(c)), custom: A.custom } as any) as any;
  return { hs, held, lockedElss, cur, capital, profile, horizon, off, res };
}

/** The journal of recognised Swing trades across the household (C-77) and what blocks the Journal Test while questions are open. `xs` entries: { a: { label, key, report }, res }. */
export function householdJournal(xs: any[]) {
  const ok = xs.filter((x) => x.res.ok && x.res.rows.some((r: any) => r.cls === 'direct_equity'));
  const start = ok.reduce((t, x) => t + x.res.rows.find((r: any) => r.cls === 'direct_equity').amount, 0);
  const trades = ok.flatMap((x) => (x.a.report.journal ?? []).map((t: any) => ({ ...t, acct: x.a.label, acctKey: x.a.key })));
  const rep = journalReport(trades, start), blocked: string[] = [];
  if (ok.some((x) => (x.a.report.saleProposals ?? []).length)) blocked.push('sales waiting for your answer');
  if (ok.some((x) => (x.a.report.swingProposals ?? []).length)) blocked.push('near-match buys waiting for your answer');
  if (ok.some((x) => (x.a.report.resolver?.unexplained ?? []).length)) blocked.push('sells the statements cannot explain');
  if (ok.some((x) => (x.a.report.journalSkipped ?? []).length)) blocked.push('trades left out after a split or demerger');
  if (trades.some((t: any) => t.closed && t.r === null)) blocked.push('a closed trade with no usable stop');
  if (blocked.length) rep.provenGreen = false;
  return { rep, ok, blocked };
}

/** Accounts that take part in the swing pools: the allocation worked out and it has a direct-equity target. */
export const poolAccounts = (xs: any[]): any[] => xs.filter((x) => x.res.ok && x.res.rows.some((r: any) => r.cls === 'direct_equity'));

/** The pools: each account's swing capital (own direct-equity target), value in swing, room and positions, plus each owner's short-term gains this financial year (for the routing tax step). `P` = settings.swingPools. */
export function poolInputs(ok: any[], P: any, today: string) {
  const nowFy = fy(today), cap: Record<string, number> = {};
  const accts = ok.map((x) => {
    cap[x.a.label] = x.res.rows.find((r: any) => r.cls === 'direct_equity').amount; const r = x.a.report;
    return { label: x.a.label, owner: ownerOf(x.a), value: x.cur.total, swingValue: r.books?.Swing?.value ?? 0, swingNames: (r.openLots ?? []).filter((l: any) => l.book === 'Swing').map((l: any) => l.name), capitalSource: P.capitalSource };
  });
  const rows = derivePools(accts, cap), stcg: Record<string, number> = {};
  for (const x of ok) { const y = x.a.report.tax.find((t: any) => t.fy === nowFy); stcg[ownerOf(x.a)] = (stcg[ownerOf(x.a)] ?? 0) + (y ? y.equity.stcg : 0); }
  return { accts, cap, rows, stcg };
}

/** Tonight's candidates, in the order the plan lists them: the scan's Ready list first, then the paper book's new orders for tonight. */
export function candidatesFrom(scan: any, paper: any, names: Record<string, string> = {}): Cand[] {
  const cands: Cand[] = [], seen = new Set<string>();
  for (const c of scan?.ready ?? []) if (c.setup && !seen.has(c.sym)) { seen.add(c.sym); cands.push({ sym: c.sym, name: names[c.sym], setup: c.setup.id, trigger: c.setup.trigger, stop: c.setup.stop, atr: c.diag?.atr14 ?? undefined, close: c.close }); }
  for (const o of paper?.newOrdersTonight ?? []) if (!seen.has(o.sym)) { seen.add(o.sym); cands.push({ sym: o.sym, name: names[o.sym], setup: o.setup, trigger: o.trigger, stop: o.stop }); }
  return cands;
}
/** Company names the dashboard shows (build-site.mjs): only for the symbols on the scan's Ready and Watch lists and the paper book's live and recent lists, not for tonight's new orders. Kept the same so a name matches an account's own name the same way on the page and at night. */
export function dashNames(scan: any, paper: any, namesIndia: Record<string, string> = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const x of [...(scan?.ready ?? []), ...(scan?.watch ?? []), ...(paper?.live ?? []), ...(paper?.recent ?? [])]) { const n = namesIndia[x.sym]; if (n && !out[x.sym]) out[x.sym] = n; }
  return out;
}

export interface OrderRunCtx { light: any; vix?: number | null; P: any; taxRules: any; taxRowConfident: boolean; today: string }
/** Sizes and routes the candidates across the household. `ok` = poolAccounts(...), `pool` = poolInputs(...). */
export function orderRun(ok: any[], pool: { accts: any[]; rows: any[]; stcg: Record<string, number> }, cands: Cand[], ctx: OrderRunCtx): { out: OrdersOut; oa: OrderAcct[]; journal: ReturnType<typeof householdJournal>['rep'] } {
  const oa: OrderAcct[] = ok.map((x, i) => {
    const lots = x.a.report.openLots ?? [], r = openRiskOf(lots, x.A?.stops ?? {}), swingNames: string[] = pool.accts[i].swingNames;
    const blocked = lots.filter((l: any) => l.book === 'Legacy' && isLong(ctx.taxRules, l, ctx.today) === false).map((l: any) => l.name);
    const heldValue: Record<string, number> = {}; for (const l of lots) if (l.book === 'Swing') heldValue[l.name] = (heldValue[l.name] ?? 0) + l.qty * l.price;
    return { ...pool.accts[i], ...r, blocked, swingNames, heldValue };
  });
  // use the account's own name for a stock when it holds it, so "already held" and blocks match
  const own = new Map<string, string>(); for (const a of oa) for (const n of [...a.swingNames, ...a.blocked]) own.set(normName(n), n);
  const named = cands.map((c) => { const k = normName(c.name ?? c.sym); return { ...c, name: own.has(k) ? own.get(k) : (c.name ?? c.sym) }; });
  const jr = householdJournal(ok).rep;
  const out = sizeOrders(named, oa, pool.rows, { light: ctx.light, vix: ctx.vix, s: ctx.P, stcgYtd: pool.stcg, taxRowConfident: ctx.taxRowConfident, provenGreen: jr.provenGreen, halving: jr.halving });
  return { out, oa, journal: jr };
}

// ---- The nightly overlay (private repo only): the sized lines plus which accounts' ledgers are too old to size from.
export interface StaleAcct { label: string; savedAt: string; ageDays: number }
export interface Overlay {
  asOf: string; light: string | null; vix: number | null; ledgerMaxAgeDays: number; stale: StaleAcct[]; banner: string | null;
  risk: number; cap: number; maxPos: number; why: string[]; householdOpenRisk: number; householdCapRs: number; householdPositions: number; accounts: string[]; notes: string[]; lines: OrderLine[];
}
const dayDiff = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86400000);
/** Accounts whose last save is more than `maxAgeDays` days before `asOf` (design section 1.1: a stale ledger is never used silently). */
export function staleAccounts(accts: { label: string; savedAt?: string }[], asOf: string, maxAgeDays: number): StaleAcct[] {
  return accts.flatMap((a) => {
    if (!a.savedAt) return [{ label: a.label, savedAt: '', ageDays: Infinity }];
    const age = dayDiff(a.savedAt, asOf); return age > maxAgeDays ? [{ label: a.label, savedAt: a.savedAt.slice(0, 10), ageDays: age }] : [];
  });
}
/** The overlay file. A stale account's quantities are blanked with the reason, a line routed to it is not placed, and the file carries a banner; the other accounts keep their sizes. */
export function buildOverlay(p: { asOf: string; light: string | null; vix: number | null; out: OrdersOut; stale: StaleAcct[]; maxAgeDays: number; accounts: string[] }): Overlay {
  const staleBy = new Map(p.stale.map((s) => [s.label, s])), why = (s: StaleAcct) => (s.savedAt ? `ledger last saved ${s.savedAt}, ${s.ageDays} days ago (limit ${p.maxAgeDays}): not sized` : 'ledger has no save date: not sized');
  const lines: OrderLine[] = p.out.lines.map((l) => {
    const perAccount = l.perAccount.map((a) => { const s = staleBy.get(a.label); return s ? { ...a, qty: 0, first: 0, value: 0, ok: false, binding: why(s), note: why(s) } : a; });
    const routed = l.account ? staleBy.get(l.account) : undefined;
    if (routed) return { ...l, perAccount, account: null, verdict: `Not sized: ${l.account}: ${why(routed)}` };
    // a line nobody can take: say why again from the (now blanked) per-account reasons, so a stale account is named and not shown under the reason it would have had
    const verdict = !l.account && l.verdict.startsWith('No account can take it: ') && perAccount.some((a, i) => a !== l.perAccount[i]) ? 'No account can take it: ' + perAccount.map((a) => `${a.label}: ${a.note ?? a.binding}`).join('; ') : l.verdict;
    return { ...l, perAccount, verdict };
  });
  const banner = p.stale.length ? `Not sized for ${p.stale.map((s) => s.label).join(', ')}: ${p.stale.map(why).join('; ')}. Upload the account again to size it. Household limits for the other accounts still count that account's last known positions.` : null;
  const o = p.out;
  return { asOf: p.asOf, light: o.light, vix: p.vix, ledgerMaxAgeDays: p.maxAgeDays, stale: p.stale.map((s) => ({ ...s, ageDays: Number.isFinite(s.ageDays) ? s.ageDays : -1 })), banner,
    risk: o.risk, cap: o.cap, maxPos: o.maxPos, why: o.why, householdOpenRisk: Math.round(o.householdOpenRisk), householdCapRs: Math.round(o.householdCapRs), householdPositions: o.householdPositions, accounts: p.accounts, notes: o.notes, lines };
}

/** The Telegram text for the overlay, or null when there is nothing to say (no lines, no banner and a market light is saved). Placed lines first with the account, quantity, price and the limit that bound; then the lines nobody can take, each with its first reason. */
export function sizedMessage(ov: Overlay, maxLines = 12): string | null {
  if (!ov.lines.length && !ov.banner && ov.light) return null;   // a missing market light is worth saying, nothing else is if there are no lines
  const placed = ov.lines.filter((l) => l.account), rest = ov.lines.filter((l) => !l.account);
  const acct = (l: OrderLine) => l.perAccount.find((p) => p.label === l.account)!;
  const out: string[] = [`Swing orders ${ov.asOf} (${ov.light ?? 'no'} light${ov.risk ? `, risk ${ov.risk}% per trade` : ''}):`];
  if (ov.banner) out.push(ov.banner);
  if (!ov.lines.length) out.push(ov.notes.find((n) => /No market light/.test(n)) ?? 'No orders in tonight\'s plan.');
  for (const l of placed.slice(0, maxLines)) { const a = acct(l); out.push(`${l.name} (${l.setup}): ${l.account} buy ${a.qty}, first ${a.first}, at ${l.entry}, stop ${l.stop}. Limited by ${a.binding}.`); }
  const room = Math.max(0, maxLines - placed.length);
  // the reason once when every account gives the same one, else each account's own
  const why = (l: OrderLine) => { const r = l.perAccount.map((p) => p.note ?? p.binding), u = [...new Set(r)]; const t = !l.perAccount.length ? l.verdict : u.length === 1 ? u[0] : l.perAccount.map((p, i) => `${p.label}: ${r[i]}`).join('; '); return t.length > 160 ? t.slice(0, 157) + '...' : t; };
  for (const l of rest.slice(0, room)) out.push(`Not placed, ${l.name} (${l.setup}): ${why(l)}`);
  const more = placed.length + rest.length - Math.min(placed.length, maxLines) - Math.min(rest.length, room);
  if (more > 0) out.push(`+${more} more on the Scans tab.`);
  out.push('A suggestion, never an order.');
  return out.join('\n');
}
