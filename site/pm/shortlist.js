// Recognising a real buy as a Swing trade (design section 3, rule 4). Pure. A nightly shortlist line has a trigger, a limit and a stop; a buy that matches one becomes a Swing lot with that line's stop and setup.
// Three tiers: exact (the entry session, price inside trigger and limit) is Swing automatically; near (a few sessions later, or a price just outside the range) is proposed and the owner confirms or rejects;
// anything else is Legacy. The "near" numbers are the owner-approved working values (settings/allocation.json, swingMatch; Engine Rules C-76). Sessions skip the exchange holidays in data/calendar.
                                                                                                                                                                              
/** nearSessions: how many weekdays after the shortlist night still count (0 = entry session only). nearPricePct: how far outside the trigger-to-limit range, as % of the trigger. volatileExtraPct: extra room above the limit for a close-confirmed entry. */
                                                                                                                                                                                                                        
/** The size of the buy against the account, for the exact-match size check: an exact match this large is only proposed. */
                                                                   
                                                              
/** Tags the paper book puts on a line the desk would not take as listed (stop wider than the setup allows, no room to the overhead level): such a line can only ever be a near match. */
export const BLOCKING_TAGS = ['over cap', 'room fail'];
/** The Engine Rules skip the standing buy order when ATR is above 3% of price: the entry is an after-market limit at the confirming close + 1% on a later session. */
export const isVolatile = (l           )          => typeof l.atrPct === 'number' && l.atrPct > 3;
                                                                                                                     

/** Sessions after `from` up to and including `to` (0 when `to` is not later): weekdays that are not exchange holidays, plus any special weekend or holiday sessions given. Without a holiday list every weekday counts. */
export function sessionsBetween(from        , to        , cal                                            )         {
  const hol = new Set(cal?.holidays ?? []), extra = new Set(cal?.extra ?? []); void extra;
  let n = 0; for (let t = Date.parse(from) + 86400000; t <= Date.parse(to); t += 86400000) { const day = new Date(t).toISOString().slice(0, 10), d = new Date(t).getUTCDay(); if (extra.has(day) || (d !== 0 && d !== 6 && !hol.has(day))) n++; }
  return n;
}
/** Sessions that should have a shortlist file between the first live night and the latest one, but have none (the nightly job failed or never ran that day). */
export function gapNights(checked          , cal                                            )           {
  if (checked.length < 2) return [];
  const have = new Set(checked), sorted = [...checked].sort(), out           = [], hol = new Set(cal?.holidays ?? []), extra = new Set(cal?.extra ?? []); void extra;
  // Special sessions (extra) are not required to have a shortlist: no nightly job runs for them.
  for (let t = Date.parse(sorted[0]) + 86400000; t < Date.parse(sorted[sorted.length - 1]); t += 86400000) { const day = new Date(t).toISOString().slice(0, 10), d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6 && !hol.has(day) && !have.has(day)) out.push(day); }
  return out;
}
/** How far a price sits outside the trigger-to-limit range, as a percentage of the trigger (0 when inside). */
export function outsidePct(line           , price        )         {
  const lo = line.trigger, hi = line.limit; if (!(lo > 0)) return Infinity;
  return price < lo ? ((lo - price) / lo) * 100 : price > hi ? ((price - hi) / lo) * 100 : 0;
}
const num = (x         )              => typeof x === 'number' && Number.isFinite(x) && x >= 0;
export function matchBuy(sym        , date        , price        , lines             , s               , cal      , size          )               {
  if (!s || !num(s.nearSessions) || !num(s.nearPricePct) || !(price > 0)) return null;   // bad settings never match: failing open would tag any buy as Swing
  const extra = num(s.volatileExtraPct) ? s.volatileExtraPct : 0;
  let best                                      = null;
  for (const line of lines) {
    if (line.sym !== sym || line.signalDate >= date) continue;
    const vol = isVolatile(line), blocked = (line.tags ?? []).some((t) => BLOCKING_TAGS.includes(t));
    const sessions = sessionsBetween(line.signalDate, date, cal); if (sessions < 1 || sessions > Math.max(1, s.nearSessions)) continue;
    // A close-confirmed (volatile) entry can fill above the limit; widen the top of the range for it.
    const wide            = vol ? { ...line, limit: line.limit + (line.trigger * extra) / 100 } : line;
    const out = outsidePct(wide, price), tol = 0.005;
    const big = !!size && num(s.maxExactPctOfAccount) && size.accountValue > 0 && size.lotValue > (size.accountValue * s.maxExactPctOfAccount ) / 100;
    const exact = !vol && !blocked && !big && sessions === 1 && out <= tol;
    if (!exact && out > s.nearPricePct) continue;
    const m = { tier: (exact ? 'exact' : 'near')                 , line, sessions, outsidePct: out, rank: [exact ? 0 : 1, sessions, out] }                              ;
    const where = `${sessions} session${sessions > 1 ? 's' : ''} after the ${line.signalDate} shortlist, ${out === 0 ? 'inside' : out.toFixed(1) + '% outside'} its trigger ${line.trigger} to ${vol ? 'close-confirmed ' : ''}limit ${wide.limit.toFixed(2)} range`;
    m.why = exact ? `bought on the entry session at ${price}, inside trigger ${line.trigger} and limit ${line.limit} of the ${line.signalDate} shortlist`
      : `${where}${vol ? ' (volatile stock: entry waits for a confirming close)' : ''}${big ? ' (this one buy is more than ' + s.maxExactPctOfAccount + '% of the account, larger than a Swing position the rules allow, so it needs your yes)' : ''}${blocked ? ' (the desk tagged this line ' + (line.tags ?? []).filter((t) => BLOCKING_TAGS.includes(t)).join(', ') + ')' : ''}`;
    if (!best || m.rank[0] < best.rank[0] || (m.rank[0] === best.rank[0] && (m.rank[1] < best.rank[1] || (m.rank[1] === best.rank[1] && m.rank[2] < best.rank[2])))) best = m;
  }
  if (!best) return null; const { rank, ...rest } = best; return rest;
}
