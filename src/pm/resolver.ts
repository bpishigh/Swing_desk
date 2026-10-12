// Break resolver (design section 7.3). Nothing is guessed. Dated, sourced exchange records are applied; candidates for what the
// records cannot say (IPO allotments, rights) are accepted automatically only if they close the break to the unit and rest on a
// sourced, non-estimated record; anything else is proposed (one confirmation) or queued as unexplained (one tap, answer kept in overrides).
import { replay, keyOf, type Break, type CorpEvent, type Replay } from './ledger.ts';
import type { Trade } from './reader.ts';

export interface GrantCandidate { kind: 'ipo' | 'rights'; key: string; date: string; unitCost: number; lotSize?: number; windowDays: number; source: string; estimate?: boolean; instrument?: string }
export interface Catalogue { facts: CorpEvent[]; candidates: GrantCandidate[] }
export interface Proposal { break: Break; event: CorpEvent; why: string; status: 'applied' | 'proposed' }
export interface Resolution { replay: Replay; applied: Proposal[]; proposed: Proposal[]; unexplained: Break[]; facts: string[] }

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const remaining = (r: Replay, k: string) => r.breaks.filter((b) => b.key === k).reduce((a, b) => a + b.qty, 0);

export function resolve(trades: Trade[], cat: Catalogue, overrides: CorpEvent[] = [], longAfterDays: number | null = 365): Resolution {
  // Facts and typed overrides first: splits, bonuses, renames, demergers with a published cost percent are dated records, not guesses.
  let events: CorpEvent[] = [...cat.facts, ...overrides];
  let rep = replay(trades, longAfterDays, events);
  const applied: Proposal[] = [], proposed: Proposal[] = [], unexplained: Break[] = [];
  const firstTrade = new Map<string, string>();
  for (const t of [...trades].sort((a, b) => a.date.localeCompare(b.date))) if (!firstTrade.has(keyOf(t))) firstTrade.set(keyOf(t), t.date);
  const done = new Set<string>();
  for (const brk of rep.breaks) {
    const id = `${brk.key}|${brk.date}|${brk.qty}`; if (done.has(id)) continue; done.add(id);
    const first = firstTrade.get(brk.key) ?? brk.date;
    let resolved = false;
    for (const c of cat.candidates.filter((x) => x.key === brk.key)) {
      const lead = dayDiff(c.date, first);
      if (lead < -2 || lead > c.windowDays) continue;                                  // the first trade must sit near the record
      if (c.lotSize && Math.round(brk.qty) % c.lotSize !== 0) continue;                  // IPO: a whole number of lots
      const ev: CorpEvent = { type: 'grant', key: c.key, date: c.date, qty: brk.qty, unitCost: c.unitCost, source: c.source, estimate: c.estimate, instrument: c.instrument };
      const trial = replay(trades, longAfterDays, [...events, ev]);
      if (remaining(trial, brk.key) > 1e-9) continue;                                    // must close the break to the unit
      const p: Proposal = { break: brk, event: ev, why: `${c.kind} record ${c.source}: ${brk.qty} units at ${c.unitCost}`, status: 'applied' };
      if (c.estimate || !c.source) { p.status = 'proposed'; proposed.push(p); } else applied.push(p);
      events = [...events, ev]; rep = trial; resolved = true; break;                     // proposed events are still shown in the provisional replay
    }
    if (!resolved) unexplained.push(brk);
  }
  const final = replay(trades, longAfterDays, events);
  return { replay: final, applied, proposed, unexplained: unexplained.filter((b) => remaining(final, b.key) > 0), facts: final.applied };
}
