# IND-BASE-1: the simple momentum baseline on six years of India history (C-54), written 17 Oct 2026 before any run

Status: DRAFT for owner confirmation (17 Oct 2026). Nothing has been run. Numbers marked (analyst) become fixed when this file is committed with "CONFIRMED" below; any change after a run voids the run. Source: the external review of 17 Oct 2026 (test the design against its simplest evidenced version, add a holding-period curve, India first).

## Why
The US replays covered one year and could not tell a rule from luck. India has six years of daily history in the repo (Jan 2020 to Oct 2025, two full cycles) and an as-of data view that applies corporate actions only as they were known. The first question is not about the Swing Desk's pattern layer; it is whether plain relative-strength momentum, with an index filter, earns anything on this data after cost. That is the yardstick the full funnel must later beat. The India scan is not built, so the funnel comparison is a later test (it needs its own entry in this log once the scan exists).

## What is tested
1. **Baseline.** Each month, rank the eligible stocks on 12-1 momentum and hold the top decile, equal weight, in cash when the index is below its 200-day average.
2. **Holding curve.** For the same monthly top-decile picks, the net return and the excess over the eligible universe at 20, 60 and 120 sessions after entry.

## Definitions (all fixed now; no parameter is searched, sweep size 0)
- **Data.** data/india/bhav-hist and data/india/bhav through the as-of view (src/backtest/india-asof.ts), series EQ and BE, delisted stocks included as listed on each night. Index: Nifty 500 close from data/india/idx-hist.
- **Eligible on a signal night.** Close at least Rs 20 (analyst); median traded value (close x volume) of the last 20 sessions at least Rs 5 crore (analyst); at least 260 sessions of history in the as-of view; then the 500 largest by that 20-session median traded value (analyst).
- **12-1 momentum.** Adjusted close 21 sessions ago divided by adjusted close 252 sessions ago, minus 1. Top decile of the eligible list by that figure (about 50 names).
- **Timing.** Signal at the close of the first session of each month; entry at the next session's close; hold to the entry close of the next month's signal. A name still in the top decile is held through, with no trade.
- **Regime.** If the Nifty 500 close on the signal night is below its own 200-session average, no entries that month and existing positions are sold at the next session's close.
- **Cost, round trip, by 20-session median traded value** (analyst; includes statutory charges and spread): Rs 100 crore or more 0.35%; Rs 25 crore or more 0.50%; below that 0.80%. Charged on each trade, half on entry and half on exit.
- **Benchmarks.** (a) Nifty 500 price index, buy and hold; (b) the whole eligible list, equal weight, same monthly rebalance and same costs, in the same regime rule (isolates the momentum effect from the universe).
- **Windows.** Fit: first signal Jan 2021 to Dec 2023. Holdout: Jan 2024 to Oct 2025. The holdout result is computed in the same run but written to a separate file that is not opened until the reveal is logged here; one reveal for this hypothesis.
- **Uncertainty.** Block bootstrap of the monthly net excess, 3-month blocks, 5,000 resamples, seed 20261018 (analyst), 90% interval.
- **Integrity checks (must pass or the run is void).** The as-of leak check (scripts/check-india-asof.mjs) passes; a seeded 10-night check shows the signal list rebuilt from data truncated at the night equals the list used in the run.

## Pass criteria (decided on the fit window, confirmed once on the holdout)
- **P1, momentum is present.** Mean monthly net excess of the top decile over benchmark (b) is above zero, with the bootstrap 90% interval's lower bound above zero, in the fit window; and the holdout mean is above zero.
- **P2, it beats the index.** Net excess over Nifty 500 (a) is above zero in the fit window and in the holdout, compounded.
- **P3, not a few months.** The fit-window mean excess stays above zero after the three best months are dropped.
- **P4, every calendar year reported.** Net excess by calendar year is printed; no criterion, but a single year that carries the whole result is stated as such.
- **Outcomes.** Pass: P1, P2 and P3 all hold. Fail: mean excess below zero in both windows. Anything else: inconclusive, reported as "cannot tell", with no adoption. Passing does not adopt anything; it sets the yardstick the Swing Desk funnel has to beat.

## Holding-curve rule (reported, one decision attached)
The 20, 60 and 120-session annualised net excess over the eligible universe is printed with intervals. If the 20-session figure is less than 75% of the best of the three, the horizon question goes to the owner as a finding ("swing" may be the wrong horizon for this signal); nothing changes automatically.

## Reported alongside, never used to choose
Sensitivity to the skip month (0 or 1 month), the cut (top 5%, 10% or 20%) and the index filter (on or off), shown as a plateau check. A parameter taken from this table carries sweep size 9 and does not become a rule from this test.

## Known limits
Survivorship is handled (delisted names are in); adjustment is as-of but 336 unresolved breaks in thin stocks and demergers drop history, which slightly favours liquid, clean names. No dividends in the price return (the benchmarks have none either). Costs are assumed, not measured. Six years is two cycles, not a long sample; this test can fail a rule more reliably than it can prove one.

CONFIRMED: (pending owner)
