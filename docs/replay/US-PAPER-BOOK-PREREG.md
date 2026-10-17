# US paper book: streams and read rules (C-53), written 16 Oct 2026 before any paper position

Status: DRAFT v2 for owner confirmation (17 Oct 2026), after the external review of the C-52 diagnostics. Nothing is logging yet; logging starts the first night after "CONFIRMED" below and the engine is committed. Source: docs/replay/US-SCAN-2-RESULT-2026-10-16.md.

## Purpose
Measure on real forward fills three questions the one-year replay cannot answer, one change at a time: does a stop sized in ATR instead of a 6 to 8% cap change the result (the width question), does a mechanical entry do as well as the pattern trigger (the entry question), and does the scan have positive expectancy in R after cost at all. Nothing here changes a live rule or places a real order.

## Candidates
The nightly top-10 list of US-SCAN-1 (Ready and Watch, composite order, 3 per industry), frozen. Names more than 25% above the 50-day are skipped in every stream (the extension rule stays). Setup allowances follow the regime light of the night (US Yellow: 1, 1ipo and 4; Green and Red: 1, 1ipo, 2 and 4) in every stream. Setup 3 is not in the scan and is not modelled.

## Shapes (the same in every stream)
- Breakout (setup 1, or 1ipo on the IPO path): price within 5% of the 50-session high; for stocks on the main path also a tight base (ATR10/ATR50 below 0.7), as in US-SCAN-1.
- 20 EMA pullback (setup 2, where allowed): close at or above the 20 EMA, a low in the last 5 sessions at or below it, close above the 50-day.
- 50-day pullback (setup 4): close at or above the 50-day, a low in the last 5 sessions at or below it.
The first shape that matches in the order 1, 2, 4 is used.

## Three streams, a chain: each changes one thing from the one before
1. **Official.** The Ready list as live: buy at trigger (basis plus 0.5% for setup 1, 0.2% for 2 and 4) with the limit (1%), one session to fill (fills at the trigger if the next session's high reaches it and its low is at or under the limit). Stop at the chart level widened to 1.5 ATR14; the setup's stop-width cap (8% setup 1, 10% 1ipo, 7% setup 2, 6% setup 4) and the 3R room test (to the 250-session high, waived when none) applied.
2. **Cap-waived** (changes only the stop rule). Same shapes, triggers, limits and fills, on the whole top-10 list. Stop: the official stop (chart level, at least 1.5 ATR14 away); if that is farther than 2.5 ATR14 from the trigger, the stop is 2.5 ATR14 below the trigger and the trade is tagged "inside base". A trade whose stop would be wider than 12% of the trigger is skipped. The percent cap and the room test are not applied; trades are tagged "over cap" and "room fail" where the official rule would have skipped them.
3. **Comparator** (changes only the entry rule on top of stream 2). Same shapes, same stop rule and tags as stream 2, same candidates. Entry at the next session's close if tonight is a signal night: breakout shape, first close above the highest high of the previous 20 sessions (the previous close was not); pullback shapes, first close back above the 20-day average (setup 2) or the 50-day average (setup 4) after a close below it in the last 5 sessions. The stop is placed with the stream-2 rule from tonight's close and re-measured at the actual entry; skipped if the stop is then wider than 12%.
Cap-waived against official answers the width question; comparator against cap-waived answers the entry question.

## Exits (all streams)
The exit rules at daily-close resolution: the stop fills at the stop; rule 3 (failed breakout within 3 sessions), 4 (time stop, 10 sessions without a close at +1R), 5 (sell a third at +2R, stop to entry), 6 (trail: first close below the 20 EMA in weeks 1 to 7, a weekly close below the 10-week average from week 8) and 7 (sell a third at 20% above the 20 EMA) act at the next session's close; rule 9 (regime light drops: stops on trades below +1R move to the higher of the day's low and the 10 EMA, never above the close); rule 8 is not modelled because no results dates are held, and every trade says so. A trade closes at the latest after 60 sessions.

## What every trade records
Stream, setup, group, regime at entry, signal date, entry date, trigger, fill, stop in percent and in ATR14 units, ATR14 as a percent of price, room in R, tags (over cap, room fail, inside base), the 20-day dollar volume and the cost tier (0.20% round trip from $100M a day, 0.35% from $25M, 0.60% from $10M), exit date, exit reason (stop, stop at entry, failed breakout, time stop, trail, extended third, max hold) and the result in R after cost. No portfolio limits or sizing are applied: every trade stands alone in R.

## Read rules (fixed now)
- Top-10 forward log: read at 300 non-overlapping picks or 12 months, whichever is later, as already decided.
- The three trade streams are read at 12 months from the first logged night regardless of count, with each stream's trade count reported (the official stream may never reach 300, and that is itself a result). A first look at 150 trades in a stream is allowed and judged on nothing.
- Official: expectancy in R after cost above zero, 90% block-bootstrap interval (blocks of 5 entry nights, 5,000 resamples) excluding zero.
- Width: cap-waived against official, and the over-cap trades of stream 2 on their own, same interval rule on the difference or the trades.
- Entry: comparator against cap-waived on trades that share a candidate, same interval rule; if the mechanical entry does as well, the pattern trigger is cost without benefit and the scan becomes a watch list with one mechanical entry.
- Reported, not judged: results by regime at entry, by ATR-percent tercile (the question whether the edge lives in the calmer half of the universe is asked at read time, never made a rule now), by group, setup, tag and cost tier, win rate, exit reasons, and the read without any group above 25% of a stream's trades.

## Known items recorded now
- The India engine uses the same 1.5 ATR floor and the same style of chart-level stops, in a market at least as volatile; the same tension (percentage caps against a very volatile universe) will appear when the India scan is built.
- A backtester module (one implementation shared with the engine, as-of data, run manifests committed before each run, fit and holdout windows, standard outputs and sensitivity curves) is planned after the India history load; see docs/SCOPE.md. It is for pre-registered tests and plateau checks, not for searching parameters.

## Limits
Fills from highs and lows only (no opens), so gaps past the limit are approximated; no earnings dates; no portfolio limits; shadow streams are not live rules; the stock list is whatever the nightly feed carried, so the paper book has no survivorship bias.

CONFIRMED: (pending owner)
