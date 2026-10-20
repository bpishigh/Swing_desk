# C-68 live exits in the India replays, 20 Oct 2026

Registered in the change log before running. `src/backtest/desk-sim.ts` carries each trade through the live `evaluate()` in `src/engine/exits.ts` night by night (unit tests in `test/desk-sim.test.ts`). The C-64 and C-65 replays had used a hand-written port of the exits that differs from the live function: the port trailed on the 20 EMA from session 1 (live rule 6 applies only after the +2R third is sold, in weeks 1 to 7 by calendar days), ignored rule 8 (results within 2 sessions) and counted sessions differently. Fixed conventions: full size at the trigger, no 40% add, sells at the next close, stops filled at the stop price, realised results dates for rule 8 (disclosed look-ahead). Run: `scripts/replay-ind-setups.mjs --exits=live` and `scripts/replay-ind-hybrid.mjs --exits=live`.

| Class (C-64 trades) | n | Port: mean R, return a trade | Live: mean R, return a trade | Live without rule 8 |
|---|---|---|---|---|
| Valid, all | 40 | +0.36R, +1.50% | +0.47R, +1.92% | +0.82R, +3.91% |
| 20 EMA pullback | 28 | +0.53R, +2.16% | +0.76R, +3.13% | +0.78R, +3.22% |
| 50 SMA pullback | 9 | +0.05R, +0.58% | -0.17R, -0.59% | +1.31R, +7.98% |
| Breakout | 3 | -0.29R | -0.29R | -0.29R |
| Room under 3R | 429 | +0.09R, +0.53% | +0.07R, +0.42% | +0.12R, +0.79% |
| Stop too wide | 732 | +0.05R, +0.47% | +0.12R, +0.99% | +0.16R, +1.40% |

Differences are not significant (monthly-cluster t below 1.1; the valid class is 40 trades). Rule 8 exits 5 of the 40 valid trades; switching it off adds +0.34R a valid trade (t 1.0). That is a sample, not a finding, and rule 8 is a risk control.

Momentum names with ATR stops (C-65 H1, 1,936 trades, net of cost): hold 20 sessions +2.39%; port exits +1.00%; live exits +1.03%. Live minus hold -1.36% (t -2.30); live minus port +0.04% (t -0.05). By window, live minus hold: fit -0.96%, holdout -2.07%, fresh -1.00%. The C-65 reading holds: desk exits give up return on momentum names.

Momentum inside the valid desk trades (C-65 H2, live exits): 22 momentum trades +1.18R against 18 others -0.39R (t 1.9); across all classes +0.22R against +0.04R (t 1.1). Still short of the registered bar.

Live exit reasons on the valid trades: stop 14, trail 9, time stop 7, results 5, failed breakout 3, 60-session cap 2.

Reading: the port was too crude to trust at the margin but did not change the C-64 or C-65 conclusions; both stay Parked and C-66 keeps running. From here desk-exit tests should use `deskSim`, not a port.
