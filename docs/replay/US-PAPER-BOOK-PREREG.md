# US paper book: streams and read rules (C-53), written 16 Oct 2026 before any paper trade

Status: DRAFT for owner confirmation. Nothing is logged yet. Source: the external review of 16 Oct 2026 of the C-52 result, plus the stop-width and room diagnostics in docs/replay/US-SCAN-2-RESULT-2026-10-16.md.

## Purpose
Measure, on real forward fills, three questions the one-year replay cannot answer: do the pattern setups earn their place (comparator), is the 6 to 8% stop cap the constraint (cap-waived), and does the scan produce positive expectancy in R after cost (official). Nothing here changes a live rule or places a real order.

## Candidates and clocks
- Candidates: the nightly top-10 list of US-SCAN-1 (Ready and Watch, composite order, 3 per industry), unchanged and frozen. The forward-test read point is counted on this list, with Ready as a tagged subset.
- The paper book starts logging the first night after this file is CONFIRMED and the engine is committed. Orders are created from the night's scan and handled on following sessions' bars. Settings changes restart the clock as before.

## Three streams, all logged from night one
1. **Official.** Exactly the US-SCAN-1 setups on the Ready list: pending buy at the trigger with the limit, one session to fill (fills if the next session's high reaches the trigger and its low is at or under the limit, at the trigger price), the setup's stop widened to 1.5 ATR14, the stop-width cap of the setup (6 to 8%) and the 3R room test applied, as live.
2. **Comparator (shadow).** Same candidates, different entry. Breakout shapes: first close above the highest high of the previous 20 sessions. Pullback shapes: first close back above the 20-day average after a close below it within the last 5 sessions. Entry at the next session's close. Stop placement as the official setup (chart level widened to 1.5 ATR14); the stop-width cap and room test are NOT applied and the trade is tagged over cap or room fail where the official rule would have skipped it.
3. **Cap-waived (shadow).** The official pattern setups and triggers, with the stop set in ATR terms: the nearer of the chart level and trigger minus 2.5 ATR14, never nearer than 1.5 ATR14; a trade whose stop would be wider than 12% of the trigger is skipped (backstop). The 6 to 8% cap is not applied and the trade is tagged over cap where it would have been skipped. The 3R room test is not enforced; room in R is recorded on every trade.

All streams use the same exit rules at daily-close resolution (stop fills at the stop; rules 3, 4, 5, 6, 7 act on the next close; rule 9 acts when the regime light drops; rule 8 not modelled because no results dates are held, every trade says so). Each trade records: stream, setup, group, regime at entry, signal and entry dates, trigger, fill, stop width in percent and ATR, room in R, tags, cost at the liquidity tier (0.20% from $100M a day, 0.35% from $25M, 0.60% from $10M), exit reason and result in R after cost. No portfolio limits are applied; every trade stands alone in R.

## Read rules (fixed now)
- Read at 300 closed trades in the official plus comparator streams (counted on the top-10 list) or 12 months, whichever is later; a first look at 150, judged on nothing.
- Official: expectancy in R after cost above zero with the 90% block-bootstrap interval excluding zero.
- Comparator against official: difference in expectancy in R on the same candidates, same interval rule; if the simple entry does as well, the pattern setups are cost without benefit and the scan becomes a watch list with one mechanical entry.
- Cap-waived against official, trade by trade, answers the width question: expectancy in R of the over-cap trades on their own, same interval rule.
- Reported, not judged: results by regime at entry, group share, setup, cost tier, win rate, fill versus trigger.
- A group may not exceed 25% of a stream's trades in a read (reported; if breached the read is also given without that group).

## Limits
Fills from highs and lows only (no opens), so gaps past the limit are approximated; no earnings dates; no portfolio limits; shadow streams are not live rules. Today's list leaves out delisted names in replays; the paper book has no such bias.

CONFIRMED: (pending owner)
