# US-SCAN-2: changes and test criteria (C-52), written 16 Oct 2026 before any run

Status: CONFIRMED 16 Oct 2026 by the owner. Nothing has been built or run at the time of this commit. Numbers marked (analyst) become fixed when this file is committed with "CONFIRMED" below; any change after a run voids the run. Source of the three changes: external review of 16 Oct 2026 of the C-51 replay result.

## Why
The C-51 replay could not run its pre-registered test: Ready names appeared 11 times in 229 nights (the tight-base gate almost never passes). On the top-10 fallback, 76 of 330 picks came from Metal mining at +3.7%; the other 254 averaged -0.33%. So the first version found one group's rally and nothing else. This year has now been seen, so US-SCAN-2 is a reasoned set of changes, not a fit, and the forward log decides regardless.

## The three changes (everything else stays as US-SCAN-1: universe, RS 40/20/20/20, template, group rule, weights 60/25/15, setups, hysteresis)
1. **Tightness leaves the gate and stays in the score.** ATR10/ATR50 below 0.7 is no longer required. The 25% tightness weight stays and orders candidates. (The structural base test, a 15-session pause no more than 20% deep, is NOT added: one change, not both.) The 5% pivot limit still decides whether a trigger exists.
2. **Regime light from history.** The live regime rules (src/engine/regime.ts) are run unchanged over the stored history, so each night uses the light that was known that night. Where VIX history cannot be fetched, the light is run without it and labelled.
3. **Rolling group cap.** No more than 4 new picks from one group in any 20 sessions (analyst), on top of the 3 per industry per night. Excess candidates are skipped in composite order.

## Replay
Same 229 nights, same pick rules as C-51 (entry next close, 20-session hold, non-overlapping). Two changes to the measurement, not the rules: (a) cost by 20-day dollar volume, round trip: 0.20% at $100M or more, 0.35% from $25M to $100M, 0.60% from $10M to $25M (analyst); (b) every result is also shown excluding the single group with the most pick return in that run.
Stage 2 (second test): the same picks run through trigger fills, the 1.5-ATR stop, the time stop and the trail from the exit rules, measured in R after the tiered cost. Fills assumed at the trigger when the next session's high reaches it, at the limit at worst.

## Pass criteria (the judged set is the names with a setup, "Ready" under change 1)
1. At least 150 non-overlapping picks. If fewer, the test is "not executable" and nothing else is claimed.
2. Leak test as in C-51 (10 seeded nights, seed 20261016).
3. Edge: 90% block-bootstrap interval of mean 20-session excess over SPY, after tiered cost, excludes zero on the whole set AND on the set without its top group.
4. Stability: positive in both halves of the period.
5. Control: above the 95th percentile of 200 matched random controls (same cost rule, seed 20261016).
6. Concentration: no group above 25% of picks.
7. Stage 2: at least 150 trades, mean R after tiered cost above zero, 90% interval excluding zero.

## Reported, not judged
Each change alone (three ablations), per-group share of picks, 12-1 diagnostic beside 40/20/20/20, SPY above and below its 200-day average, picks per night, hit rate, worst pick, and the same measure for the weekly screen's 38 names (today's holdings over past dates, so it flatters that screen; a rough guide only).

## Decision rule
All seven pass: US-SCAN-2 becomes the frozen configuration and a new forward clock starts; the forward log and a paper book (at least 150 closed trades, positive R after tiered cost) still decide any live use. Any fails: record which, change nothing on this data, and take the next step with the owner.

## Known limits
Same as C-51: today's stock list leaves out delisted names (true numbers are lower), one year is one market, no earnings-date check. This year has been seen, which is why criterion 3 requires the result without its top group.

CONFIRMED: owner, 16 Oct 2026 (cap of 4 and the cost tiers stand as the analyst's figures).
