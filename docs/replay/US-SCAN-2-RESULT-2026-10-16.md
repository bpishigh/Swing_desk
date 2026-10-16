# US-SCAN-2 replay result (C-52), run 16 Oct 2026

Run as pre-registered (docs/replay/US-SCAN-2-PREREG.md, commit 146e4c7). Script: scripts/replay-us-scan2.mjs. Outputs: data/replay/us-scan2-*.json. Same 229 nights (16 Oct 2025 to 15 Sep 2026); tiered cost; regime light replayed with the live rules (53 Green, 163 Yellow, 13 Red nights; breadth rebuilt from the stored bars and within 0.8 points on average of the stored live breadth on the 32 days both exist).

## Formal status
The pre-registered test was NOT executable again. Criterion 1 failed (52 picks with a setup, 150 needed) and criterion 7 failed (19 stage-2 trades, 150 needed). Removing the tight-base gate lifted Ready names from 11 to 43 (gate change alone) or 52 (all three changes), still far short. The numbers below are exploratory.

## Criteria, v2 (all three changes), judged set = names with a setup
1. At least 150 picks: FAIL (52).
2. Leak test: PASS (10 of 10 nights identical).
3. Edge over SPY after tiered cost: FAIL. Mean +0.51%, 90% interval -2.3% to +3.5%. Without Metal mining (45 picks): -1.07%, interval -3.0% to +0.75%.
4. Positive in both halves: FAIL. Earlier +4.5%, later -2.0%.
5. Beats random control: FAIL. +0.51% against a 95th percentile of +1.96%.
6. No group above 25% of picks: PASS (largest 17%).
7. Stage 2 (exit rules in R): FAIL. 19 trades, mean -0.19 R, interval -0.52 to +0.15. Win rate 37%. Exits: 11 failed breakouts, 3 stops, 3 trail, 2 time stops.

## Each change alone (top-10 list and Ready names, mean 20-session excess, 90% interval)
| Version | Ready picks | Ready mean | Top-10 picks | Top-10 mean |
| --- | --- | --- | --- | --- |
| US-SCAN-1, tiered cost | 11 | +0.76% | 330 | +0.66% (-1.8 to +3.2) |
| Gate only | 43 | +1.45% | 345 | +0.62% |
| Regime only | 22 | +3.61% | 388 | +1.12% |
| Cap only | 11 | +0.76% | 330 | +0.66% |
| All three (v2) | 52 | +0.51% | 401 | +1.01% (-1.5 to +3.5) |
Every interval includes zero. The cap alone changes nothing for Ready names (they never reach 4 per group in 20 sessions); it is applied to Ready names only.

## Other reported items
- Top-10 list, v2: top group by pick return is Semiconductors and components (118 picks, +2.3%) then Metal mining (76, +3.6%); without Semiconductors the other 283 picks average +0.45%.
- SPY above its 200-day average at entry: Ready 50 picks +0.45%, top-10 371 picks +1.53%. Below: 2 and 30 picks (too few; the top-10 below-200 picks average -5.4%).
- 12-1 month momentum diagnostic, Ready names: above the median +0.54% (22), below -0.05% (26).
- Regime: 13 Red nights and 53 Green nights in the year, so the fixed-Yellow runs of C-51 were a mixture.
- NOT run: the weekly-screen comparison on the same window. Its past holdings are not stored, so it would only be today's 38 names, which flatters that screen; no clean version exists.

## What it says
Removing the gate was not enough: Ready names are still rare because a setup also needs a price within 5% of the pivot (setup 1), a pullback to the average (2, 4), a stop inside the width limits and 3R of room. Only 19 of 52 Ready names got a fill on the next session, and 11 of those 19 failed back below the pivot within three sessions. The edge that exists is still concentrated (Metal mining, Semiconductors) and fades in the later half. No tuning on this data. The replay cannot support US-SCAN-2 and cannot reject the scan as a watch list.

## Limits
Delisted names are missing (flatters results); one year; stage 2 fills at the stop and next close without opens, rules 8 and 9 not modelled; fewer than 150 picks so no interval here is tight.

## Addendum: where candidates drop out of the setup layer (16 Oct 2026, after the external review)
Counts only, no returns (scripts/funnel-waterfall-us.mjs, outputs data/replay/us-funnel-waterfall-*.json). Candidate-nights summed over 228 nights, Yellow light, stocks that passed steps 1 to 5 (7,891), each counted once at the first test it fails:

| Outcome | US-SCAN-1 (gate on) | Gate off |
| --- | --- | --- |
| Extended (more than 25% above the 50-day) | 2,293 | 2,293 |
| No setup geometry (not within 5% of the pivot, no pullback to the 20 EMA or 50-day) | 4,190 | 2,511 |
| Stop wider than the setup's limit (6 to 8%) | 1,341 | 2,890 |
| Fails the 3R room test | 32 | 36 |
| Gets a setup | 35 | 161 |

The room test is not the choke: at 2R it frees about 10 more candidate-nights out of 7,891. The tests that remove candidates are extension, setup geometry and, with the gate off, the stop-width limit (1.5 ATR on momentum leaders is often wider than 6 to 8%). The setup order checks width before room, so room is only ever tested on candidates that already passed width; even so, a 2R room rule would change almost nothing here. No rule changed. Whether the stop-width limits suit stocks this volatile is a rule question for the owner and the reviewer, not something to tune on this year.

Fill model: stage 2 already filled at the trigger when the next session's high reached it, within the limit. Only stage 1 enters at the next close, by design, to measure pick quality without a fill model. The stage-2 fills use highs and lows only (no opens), so a gap above the limit is approximated by the limit test against the day's low.
