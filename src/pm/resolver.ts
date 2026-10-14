// Break resolver (design section 7.3). Nothing is guessed. Dated, sourced exchange records are applied; candidates for what the
// records cannot say (IPO allotments, rights) are accepted automatically only if they close the break to the unit and rest on a
// sourced, non-estimated record; anything else is proposed (one confirmation) or queued as unexplained (one tap, answer kept in overrides).
import { replay, keyOf, type Break, type CorpEvent, type Replay } from './ledger.ts';
import type { Trade } from './reader.ts';

export interface GrantCandidate { kind: 'ipo' | 'rights'; key: string; date: string; unitCost: number; lotSize?: number; windowDays: number; source: string; estimate?: boolean; instrument?: string }
export interface Catalogue { facts: CorpEvent[]; candidates: GrantCandidate[] }
export interface Proposal { break: Break; event: CorpEvent; why: string; status: 'applied' | 'proposed' }
export interface Resolution { events: CorpEvent[]; replay: Replay; applied: Proposal[]; proposed: Proposal[]; unexplained: Break[]; facts: string[] }

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const remaining = (r: Replay, k: string) => r.breaks.filter((b) => b.key === k).reduce((a, b) => a + b.qty, 0);

export function resolve(trades: Trade[], cat: Catalogue, overrides: CorpEvent[] = [], longAfterDays: number | null = 365, decisions: Record<string, Decision> = {}): Resolution {
  // Facts and typed overrides first: splits, bonuses, renames, demergers with a published cost percent are dated records, not guesses.
  let events: CorpEvent[] = [...cat.facts, ...overrides];
  const base = replay(trades, longAfterDays, events);
  const applied: Proposal[] = [], proposed: Proposal[] = [];
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  // Breaks are handled per company: a shortfall may arrive as several sells (ABC: 5 and 10 against a lot of 15).
  const byKey = new Map<string, Break[]>();
  for (const b of base.breaks) (byKey.get(b.key) ?? byKey.set(b.key, []).get(b.key)!).push(b);
  for (const [key, brks] of byKey) {
    const dec = decisions[key];
    if (dec?.action === 'reject') continue;                                              // the owner says this item is wrong: its sells stay unexplained
    const total = brks.reduce((a, b) => a + b.qty, 0), firstBreak = brks[0];
    const first = sorted.find((t) => keyOf(t) === key)?.date ?? firstBreak.date;
    let resolved = false;
    for (const c of cat.candidates.filter((x) => x.key === key)) {
      const lead = dayDiff(c.date, first);
      if (lead < -2) continue;                                                          // the allotment must precede the first trade
      if (c.lotSize && Math.round(total) % c.lotSize !== 0) continue;                    // IPO: a whole number of lots
      const priced = dec?.action === 'price' && typeof dec.unitCost === 'number' && Number.isFinite(dec.unitCost) && dec.unitCost >= 0;
      const ev: CorpEvent = { type: 'grant', key, date: c.date, qty: total, unitCost: priced ? dec!.unitCost! : c.unitCost, source: c.source + (dec ? (priced ? ' (price entered by the owner)' : ' (confirmed by the owner)') : ''), estimate: dec ? false : c.estimate, instrument: c.instrument };
      const trial = replay(trades, longAfterDays, [...events, ev]);
      if (remaining(trial, key) > 1e-9) continue;                                         // must close the break to the unit
      const p: Proposal = { break: firstBreak, event: ev, why: `${c.kind} record ${ev.source}: ${total} units at ${ev.unitCost}`, status: dec || (!c.estimate && c.source) ? 'applied' : 'proposed' };
      (p.status === 'applied' ? applied : proposed).push(p);
      events = [...events, ev]; resolved = true; break;                                  // proposed events still show in the provisional replay
    }
    if (resolved) continue;
    // Rights entitlement (-RE symbols): credited free to holders of the parent, nil cost. The ratio is not in the feed for every issue,
    // so the quantity cannot always be checked: proposed for one confirmation, never applied silently.
    const sym = firstBreak.instrument.toUpperCase();
    if (/-RE\d?$/.test(sym)) {
      const parent = sym.replace(/-RE\d?$/, '');
      const heldParent = sorted.some((t) => (t.symbol ?? t.instrument).toUpperCase().startsWith(parent) && t.side === 'buy' && t.date < firstBreak.date);
      if (heldParent) {
        const priced = dec?.action === 'price' && typeof dec.unitCost === 'number' && Number.isFinite(dec.unitCost) && dec.unitCost >= 0;
        const ev: CorpEvent = { type: 'grant', key, date: sorted.find((t) => keyOf(t) === key)!.date, qty: total, unitCost: priced ? dec!.unitCost! : 0, source: `rights entitlement credited to holders of ${parent}; ${priced ? 'cost entered by the owner' : 'nil cost'} (quantity not checked against the issue ratio)`, estimate: dec ? false : true };
        (dec ? applied : proposed).push({ break: firstBreak, event: ev, why: `${sym} is a rights entitlement and ${parent} was held`, status: dec ? 'applied' : 'proposed' });
        events = [...events, ev];
      }
    }
  }
  const final = replay(trades, longAfterDays, events);
  const open = new Set(proposed.map((p) => p.event.type === 'grant' ? p.event.key : ''));
  return { events, replay: final, applied, proposed, unexplained: final.breaks.filter((b) => !open.has(b.key) || remaining(final, b.key) > 0), facts: final.applied };
}
