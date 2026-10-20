// Tonight's Swing Desk orders sized and routed by account (Portfolio Manager phase 7, design sections 2 and 5). Pure.
// The nightly shortlist is public and identifier-free (trigger, stop, setup). This module runs in the browser after sign-in, where each account's own swing capital and open positions are known,
// so holdings never reach the repository. Each line shows which constraint bound the size in each account: one R of risk, the 20% position cap, the open-risk limit, the position count, or a block.
import { ntCalc } from '../engine/sizing.ts';
import { SETUPS, LIMITS, type Light, type SetupId } from '../engine/setups.ts';
import { routeTrade, type PoolAccount, type PoolRow, type PoolSettings } from './swingpools.ts';

export interface Cand { sym: string; name?: string; setup: SetupId; trigger: number; stop: number; atr?: number; close?: number }
export interface OrderAcct extends PoolAccount {
  /** Money at risk now: sum of quantity x (cost - stop) over open Swing lots; null when any open Swing position has no stop recorded (the figure is then a floor, not the whole). */
  openRisk: number; stopsMissing: string[];
  /** Names a new Swing buy is blocked for in this account (a short-term Legacy lot in the same stock). */
  blocked: string[];
  /** Value already held in each Swing name in this account (for the 20% position cap on an add). */
  heldValue?: Record<string, number>;
}
export interface Ctx { light: Light | null; vix?: number | null; s: PoolSettings; stcgYtd: Record<string, number>; taxRowConfident: boolean }
export interface AcctLine { label: string; qty: number; first: number; oneR: number; value: number; binding: string; ok: boolean; note?: string }
export interface OrderLine { sym: string; name: string; setup: string; entry: number; stop: number; rps: number; perAccount: AcctLine[]; account: string | null; steps: string[]; verdict: string }
export interface OrdersOut { light: Light | null; risk: number; cap: number; maxPos: number; why: string[]; householdOpenRisk: number; householdCapRs: number; householdPositions: number; lines: OrderLine[]; notes: string[] }

/** Today's risk per trade, open-risk cap and position count from the rules table; India VIX above 20 halves risk. The "proven Green" 1% and the risk-halving rules need the trade journal, which is not here, so they are not applied. */
export function limitsFor(light: Light | null, vix?: number | null): { risk: number; cap: number; maxPos: number; setups: SetupId[]; why: string[] } | null {
  if (!light) return null; const L = LIMITS.india[light], why: string[] = []; let risk = L.risk;
  if (typeof vix === 'number' && Number.isFinite(vix) && vix > 20) { risk /= 2; why.push(`India VIX ${vix} above 20 halves risk`); }
  return { risk, cap: L.cap, maxPos: L.maxPos, setups: L.setups, why };
}

export function sizeOrders(cands: Cand[], accts: OrderAcct[], rows: PoolRow[], ctx: Ctx): OrdersOut {
  const lim = limitsFor(ctx.light, ctx.vix), notes: string[] = [];
  const hhCap = accts.reduce((t, a) => t + (rows.find((r) => r.label === a.label)?.swingCapital ?? 0), 0);
  const hhNames = new Set(accts.flatMap((a) => a.swingNames));
  const out: OrdersOut = { light: ctx.light, risk: lim?.risk ?? 0, cap: lim?.cap ?? 0, maxPos: Math.min(lim?.maxPos ?? 0, ctx.s.maxPositions), why: lim?.why ?? [], householdOpenRisk: accts.reduce((t, a) => t + a.openRisk, 0), householdCapRs: lim ? (hhCap * lim.cap) / 100 : 0, householdPositions: hhNames.size, lines: [], notes };
  if (!lim) { notes.push('No market light is saved for today, so nothing is sized.'); return out; }
  if (accts.some((a) => a.stopsMissing.length)) notes.push('Open Swing positions without a stop recorded: ' + accts.flatMap((a) => a.stopsMissing.map((n) => `${n} (${a.label})`)).join(', ') + '. Open risk is understated until a stop is entered for each.');
  notes.push('Sizing uses the rules table and the nightly plan only. Sector-based pilot sizing, the proven-Green 1% and the risk-halving rules need the trade journal and are not applied here; the shortlist on the Swing Desk shows those.');
  let addedRisk = 0, addedNames = 0; const taken = new Set<string>();
  // Running state per account, updated after every placed line so later lines in the same night see it.
  const st = new Map(accts.map((a) => [a.label, { risk: a.openRisk, names: new Set(a.swingNames), held: { ...(a.heldValue ?? {}) } as Record<string, number>, added: 0 }]));
  for (const c of cands) {
    const sp = SETUPS[c.setup]; if (!sp || !(c.trigger > 0) || !(c.stop > 0)) continue;
    const basis = c.trigger / (1 + sp.trig / 100), name = c.name ?? c.sym, per: AcctLine[] = [];
    const setupOk = lim.setups.includes(c.setup);
    let rps = 0;
    for (const a of accts) {
      const r = rows.find((x) => x.label === a.label), capital = r?.swingCapital ?? 0, cur = st.get(a.label)!;
      const nt = ntCalc({ setup: c.setup, basis, chartStop: c.stop, atr: c.atr, close: c.close, capital, light: ctx.light, riskBase: lim.risk });
      if (!nt.entry || !nt.rps || nt.rps <= 0) { per.push({ label: a.label, qty: 0, first: 0, oneR: 0, value: 0, binding: 'no price levels', ok: false }); continue; }
      rps = nt.rps;
      const capRs = (capital * lim.cap) / 100, headroom = Math.max(0, capRs - cur.risk), byRisk = Math.floor(headroom / nt.rps);
      const hhHead = Math.max(0, out.householdCapRs - out.householdOpenRisk - addedRisk), byHh = Math.floor(hhHead / nt.rps);
      const byOne = Math.floor((nt.oneR ?? 0) / nt.rps), byPos = Math.max(0, Math.floor((capital * 0.2 - (cur.held[name] ?? 0)) / nt.entry));
      const opts: [number, string][] = [[byOne, 'one R of risk'], [byPos, '20% position cap'], [byRisk, 'open-risk limit of this account'], [byHh, 'open-risk limit of the household']];
      const [qty, binding] = opts.reduce((m, o) => (o[0] < m[0] ? o : m));
      let note: string | undefined, ok = qty > 0;
      if (capital <= 0) { ok = false; note = 'no swing capital in this account'; }
      else if (a.blocked.includes(name)) { ok = false; note = 'blocked: a short-term lot of this stock sits in Legacy here'; }
      else if (!setupOk) { ok = false; note = `${sp.short} is not allowed on a ${ctx.light} light`; }
      else if (!cur.names.has(name) && out.householdPositions + addedNames >= out.maxPos) { ok = false; note = `household position count ${out.householdPositions + addedNames} is at the limit of ${out.maxPos}`; }
      else if (qty <= 0) note = `${binding} leaves no room`;
      per.push({ label: a.label, qty: ok ? qty : 0, first: ok ? Math.floor(qty * 0.6) : 0, oneR: nt.oneR ?? 0, value: ok ? qty * nt.entry : 0, binding: ok ? binding : (note ?? binding), ok, note });
    }
    const rowsEl = rows.map((r) => { const l = per.find((p) => p.label === r.label), c = st.get(r.label)!; return { ...r, positions: c.names.size, room: l?.ok ? r.room - c.added : 0 }; });
    const acctsNow = accts.map((a) => ({ ...a, swingNames: [...st.get(a.label)!.names] }));
    const route = routeTrade(acctsNow, rowsEl, name, { s: ctx.s, stcgYtd: ctx.stcgYtd, taxRowConfident: ctx.taxRowConfident });
    const pick = route.account ? per.find((p) => p.label === route.account) : undefined;
    let verdict = 'Not placed';
    if (pick?.ok) { verdict = `${route.account}: buy ${pick.qty} (first ${pick.first}), limited by ${pick.binding}`; addedRisk += pick.qty * rps; if (!hhNames.has(name) && !taken.has(name)) { addedNames++; taken.add(name); }
      const c = st.get(route.account!)!; c.risk += pick.qty * rps; c.names.add(name); c.held[name] = (c.held[name] ?? 0) + pick.value; c.added += pick.value; }
    else if (route.account && pick && !pick.ok) verdict = `${route.account} holds it but cannot add: ${pick.note ?? pick.binding}`;
    else if (!setupOk) verdict = `No order: ${sp.short} is not allowed on a ${ctx.light} light`;
    else verdict = 'No account can take it: ' + (per.map((p) => `${p.label}: ${p.note ?? p.binding}`).join('; ') || route.steps.join('; '));
    out.lines.push({ sym: c.sym, name, setup: sp.short, entry: Math.round(c.trigger * 100) / 100, stop: c.stop, rps, perAccount: per, account: pick?.ok ? route.account : null, steps: route.steps, verdict });
  }
  return out;
}

/** Open risk and missing stops for one account from its open Swing lots. A stop typed for a name wins; otherwise the stop of the shortlist line the lot was recognised from is used. */
export function openRiskOf(lots: { name: string; book: string; qty: number; unitCost: number; stop?: number }[], stops: Record<string, number> = {}): { openRisk: number; stopsMissing: string[] } {
  let risk = 0; const missing = new Set<string>();
  for (const l of lots) {
    if (l.book !== 'Swing') continue;
    const st = stops[l.name] > 0 ? stops[l.name] : l.stop;
    if (!(st && st > 0)) { missing.add(l.name); continue; }
    risk += l.qty * Math.max(0, l.unitCost - st);
  }
  return { openRisk: risk, stopsMissing: [...missing] };
}
