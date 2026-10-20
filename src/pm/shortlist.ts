// Recognising a real buy as a Swing trade (design section 3, rule 4). Pure. A nightly shortlist line has a trigger, a limit and a stop; a buy that matches one becomes a Swing lot with that line's stop and setup.
// Three tiers: exact (the entry session, price inside trigger and limit) is Swing automatically; near (a few sessions later, or a price just outside the range) is proposed and the owner confirms or rejects;
// anything else is Legacy. The "near" numbers are PROVISIONAL (settings/allocation.json, swingMatch) until the Engine Rules log carries them as approved. Sessions are counted as weekdays: exchange holidays are not known here.
export interface ShortLine { sym: string; setup: string; trigger: number; limit: number; stop: number; signalDate: string }
export interface MatchSettings { nearSessions: number; nearPricePct: number }
export interface Match { tier: 'exact' | 'near'; line: ShortLine; sessions: number; outsidePct: number; why: string }

/** Weekdays after `from` up to and including `to` (0 when `to` is not later). */
export function sessionsBetween(from: string, to: string): number {
  let n = 0; for (let t = Date.parse(from) + 86400000; t <= Date.parse(to); t += 86400000) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n++; }
  return n;
}
/** How far a price sits outside the trigger-to-limit range, as a percentage of the trigger (0 when inside). */
export function outsidePct(line: ShortLine, price: number): number {
  const lo = line.trigger, hi = line.limit; if (!(lo > 0)) return Infinity;
  return price < lo ? ((lo - price) / lo) * 100 : price > hi ? ((price - hi) / lo) * 100 : 0;
}
export function matchBuy(sym: string, date: string, price: number, lines: ShortLine[], s: MatchSettings): Match | null {
  let best: (Match & { rank: number[] }) | null = null;
  for (const line of lines) {
    if (line.sym !== sym || line.signalDate >= date) continue;
    const sessions = sessionsBetween(line.signalDate, date); if (sessions < 1 || sessions > Math.max(1, s.nearSessions)) continue;
    const out = outsidePct(line, price), tol = 0.005;
    const exact = sessions === 1 && out <= tol;
    if (!exact && out > s.nearPricePct) continue;
    const m = { tier: (exact ? 'exact' : 'near') as Match['tier'], line, sessions, outsidePct: out, rank: [exact ? 0 : 1, sessions, out] } as Match & { rank: number[] };
    m.why = exact ? `bought on the entry session at ${price}, inside trigger ${line.trigger} and limit ${line.limit} of the ${line.signalDate} shortlist`
      : `${sessions} session${sessions > 1 ? 's' : ''} after the ${line.signalDate} shortlist, ${out === 0 ? 'inside' : out.toFixed(1) + '% outside'} its trigger ${line.trigger} to limit ${line.limit} range`;
    if (!best || m.rank[0] < best.rank[0] || (m.rank[0] === best.rank[0] && (m.rank[1] < best.rank[1] || (m.rank[1] === best.rank[1] && m.rank[2] < best.rank[2])))) best = m;
  }
  if (!best) return null; const { rank, ...rest } = best; return rest;
}
