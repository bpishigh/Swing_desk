# C-64 India setups and exits replay (18 Oct 2026)
Registered in the change log before running. Script `scripts/replay-ind-setups.mjs`; outputs `data/replay/ind-setups.json`, `ind-setups-trades.json`.
Frozen India scan code, as-of data, light fixed to green, 1,364 nights (Jan 2021 to Sep 2026). Every qualified, non-extended name in a top group is traded on each desk geometry present, with the scan's trigger and stop; the desk's exit rules run at daily-close resolution; tiered cost.

| Class | Candidates | Filled trades | Mean R | Return per trade |
|---|---|---|---|---|
| Valid (width and room pass) | 123 | 40 | +0.36 | +1.50% |
| Stop wider than cap (up to 1.5x) | 1,772 | 732 | +0.05 | +0.47% |
| Room under 3R | 933 | 429 | +0.09 | +0.53% |

Valid by setup: breakout 3 trades -0.29R; 20 EMA pullback 28 trades +0.53R (wins 36%); 50 SMA pullback 9 trades +0.05R. Valid trades by year 2021 to 2026: 3, 4, 16, 6, 7, 4.
Exits (paired, valid trades): no variant meets the bar. No 20 EMA trail +0.38R (t 1.25); no thirds +0.12R; fixed 20 sessions -0.14R; dropping the failed-breakout exit hurts breakouts (-0.44R). 
Reading: the filters leave about 7 valid trades a year (about +1.3% a year at 0.5% risk). The wide-stop and low-room trades earn almost nothing after costs, so loosening the filters would not help. Frequency and selection limit returns, not the exits. Cap and room rule are formally supported but on 40 trades.
