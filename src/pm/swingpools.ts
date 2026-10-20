// Two swing pools with a household layer (Portfolio Manager phase 7, design section 5): part 1. Pure.
// Swing capital per account is derived from the account's own capital and own risk profile (its direct-equity target x its capital), never typed and never a share of a household pool.
// The owner stated on 20 Oct 2026 that no money moved between the two accounts and that new cash comes from the bank at the time of a trade, so every account's capital is recorded as own income
// and the cash cap of the design does not apply (there is no idle cash to be capped by); both are settings, so either can change.
export interface PoolAccount { label: string; owner: string; value: number; swingValue: number; swingNames: string[]; capitalSource?: 'own' | 'transferred' }
export interface PoolRow { label: string; owner: string; swingCapital: number; swingValue: number; room: number; positions: number }
export interface PoolSettings { maxPositions: number; cashFunded: boolean }

/** Each account keeps its own money: its swing capital is its own swing target x its own capital (both from the account's own inputs), never a share of a household pool. */
export function derivePools(accts: PoolAccount[], swingCapital: Record<string, number>): PoolRow[] {
  return accts.map((a) => { const cap = Math.max(0, swingCapital[a.label] ?? 0); return { label: a.label, owner: a.owner, swingCapital: cap, swingValue: a.swingValue, room: cap - a.swingValue, positions: a.swingNames.length }; });
}
/** Household constraints: one stock in one account, and the position cap across both. */
export function householdChecks(accts: PoolAccount[], s: PoolSettings): { positions: number; overCap: boolean; duplicates: { name: string; accounts: string[] }[] } {
  const by = new Map<string, string[]>(); for (const a of accts) for (const n of new Set(a.swingNames)) by.set(n, [...(by.get(n) ?? []), a.label]);
  return { positions: by.size, overCap: by.size > s.maxPositions, duplicates: [...by].filter(([, l]) => l.length > 1).map(([name, accounts]) => ({ name, accounts })) };
}
export interface Route { account: string | null; steps: string[] }
/** Where a new swing trade in `name` goes. Order: the account already holding it; cash (skipped when the bank funds each trade); tax (only for own-income capital and when the rule row is well confirmed);
 * the account with fewer open positions; then the one with more room. `stcgYtd` is each owner's net short-term gain so far this financial year: negative means losses that can absorb a gain. */
export function routeTrade(accts: PoolAccount[], rows: PoolRow[], name: string, ctx: { s: PoolSettings; stcgYtd: Record<string, number>; taxRowConfident: boolean; cash?: Record<string, number>; tradeValue?: number }): Route {
  const steps: string[] = [];
  const holder = accts.filter((a) => a.swingNames.includes(name));
  if (holder.length === 1) return { account: holder[0].label, steps: ['already held in this account: one stock stays in one account'] };
  if (holder.length > 1) return { account: null, steps: [`held in ${holder.map((h) => h.label).join(' and ')}: resolve the duplicate first`] };
  let cands = accts.map((a) => ({ a, r: rows.find((r) => r.label === a.label)! })).filter((x) => x.r);
  if (ctx.s.cashFunded && ctx.cash && ctx.tradeValue) { const withCash = cands.filter((x) => (ctx.cash![x.a.label] ?? 0) >= ctx.tradeValue!); if (withCash.length) { cands = withCash; steps.push('only these accounts hold the cash'); } }
  else steps.push('cash step skipped: each trade is funded from the bank');
  const room = cands.filter((x) => x.r.room > 0); if (!room.length) return { account: null, steps: [...steps, 'no account has swing capital left'] };
  cands = room;
  const own = cands.every((x) => (x.a.capitalSource ?? 'own') === 'own');
  if (cands.length > 1 && own && ctx.taxRowConfident) {
    const t = cands.map((x) => ({ x, v: ctx.stcgYtd[x.a.owner] ?? 0 })).sort((p, q) => p.v - q.v);
    if (t[0].v < 0 && t[0].v < t[1].v) { steps.push(`tax: ${t[0].x.a.owner} has ${Math.round(-t[0].v).toLocaleString('en-IN')} of short-term losses this year to absorb a gain`); return { account: t[0].x.a.label, steps }; }
    steps.push('tax: no account has short-term losses to absorb a gain, so tax does not decide');
  } else if (cands.length > 1) steps.push('tax step skipped: capital is not all recorded as own income, or the tax rule is not confirmed');
  cands.sort((p, q) => p.r.positions - q.r.positions || q.r.room - p.r.room);
  steps.push(cands.length > 1 && cands[0].r.positions < cands[1].r.positions ? 'fewer open swing positions' : cands.length > 1 ? 'equal positions: more room' : 'only account with room');
  return { account: cands[0].a.label, steps };
}
