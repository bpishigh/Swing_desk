// Trim (design section 4, "the ten-name target"). Among direct stocks that pass the exit test, the top TARGET_NAMES by three-month
// strength stay Keep and the rest are Trim, but only when they have been on the same side of the line at two weekly checks in a row,
// so rank noise causes no churn. At most MAX_TRIMS names are marked for trimming at a time, lowest rank first. Pure; a verdict, not an order.
import { adjustSeries,                                                         } from './verdict.js';
import { RS_SESSIONS } from './context.js';

export const TARGET_NAMES = 10, MAX_TRIMS = 2, WEEK_SESSIONS = 5;

                                                             
                                                                                                                                                                                                 

/** Three-month return at the session `back` sessions before the last one, on adjusted closes; null when the history is too short. */
export function ret63Back(closes                   , back        )                {
  const n = closes.length - 1 - back, a = closes[n], b = closes[n - RS_SESSIONS];
  return a != null && b != null && b > 0 ? a / b - 1 : null;
}

function ranks(items                                                        )                      {
  const ok = items.filter((x) => x.r !== null).sort((a, b) => (b.r          ) - (a.r          ) || b.weight - a.weight);
  return new Map(ok.map((x, i) => [x.symbol, i + 1]));
}

/** `cands` are the household's Legacy direct stocks that currently pass the exit test. */
export function trimTiers(cands             , hist              , feed                 , demergers                = [], target = TARGET_NAMES, maxTrims = MAX_TRIMS)               {
  const rows = cands.map((c) => {
    const raw = hist.px[c.symbol] ?? [], adj = adjustSeries(hist.dates, raw, feed.filter((r) => r.symbol === c.symbol), hist.dates[0], demergers).series;
    return { ...c, now: ret63Back(adj, 0), before: ret63Back(adj, WEEK_SESSIONS) };
  });
  const now = ranks(rows.map((r) => ({ symbol: r.symbol, weight: r.weight, r: r.now }))), before = ranks(rows.map((r) => ({ symbol: r.symbol, weight: r.weight, r: r.before })));
  const of = now.size;
  const out               = rows.map((r) => {
    const rk = now.get(r.symbol) ?? null, pr = before.get(r.symbol) ?? null, base = { symbol: r.symbol, rank: rk, priorRank: pr, of, ret63: r.now };
    if (of <= target) return { ...base, tier: 'keep'         , why: `${of} stocks pass the exit test, within the target of ${target}.` };
    if (rk === null || pr === null) return { ...base, tier: 'unsettled'         , why: 'Not enough price history to rank this stock twice.' };
    const outNow = rk > target, outBefore = pr > Math.min(target, before.size);
    if (outNow && outBefore) return { ...base, tier: 'trim'         , why: `Ranked ${rk} of ${of} by three-month strength, and below the top ${target} at two weekly checks in a row (${pr} a week ago).` };
    if (!outNow && !outBefore) return { ...base, tier: 'keep'         , why: `Ranked ${rk} of ${of}, inside the top ${target} at both weekly checks.` };
    return { ...base, tier: 'unsettled'         , why: `Ranked ${rk} now and ${pr} a week ago: on different sides of the top-${target} line, so no change until two weekly checks agree.` };
  });
  const trims = out.filter((o) => o.tier === 'trim').sort((a, b) => (b.rank          ) - (a.rank          ));
  trims.forEach((o, i) => { if (i >= maxTrims) { o.tier = 'trim-queued'; o.why += ` Queued: at most ${maxTrims} names are trimmed at a time, lowest rank first.`; } });
  return out;
}
