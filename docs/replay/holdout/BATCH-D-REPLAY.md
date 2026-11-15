# Batch D replay (decision D8)

Run 2026-11-15, sessions 2011-01-01 to 2019-12-31. One registered run per book, rules as built, no tuning. Paper only; not a financial adviser.

**Labels on every result.** (1) The 2020 to 2026 price period has been seen in other tests (C-59 to C-62 saw the results-day reactions of 2024 to 2026): not a clean out-of-sample read. (2) Survivor bias: filings exist for 97.6% of liquid names still trading but only 2020 100.0%, 2021 100.0%, 2022 80.0%, 2023 88.9%, 2024 100.0%, 2025 100.0%, 2026 92.9% of liquid names that later vanished (by the year last seen), so names that disappeared are under-represented and results lean favourable. (3) Cash earns nothing here (live books credit the liquid-fund rate); the top-500 list is rebuilt monthly; the comparator is the Nifty 500 for all five (price index, no dividends, so it is slightly harsh on the comparator side).

| Book | Months | Book since start | Nifty 500 since start | Excess | Confidence | Max drawdown | Closed trades | Stop-outs | Avg exposure |
|---|---|---|---|---|---|---|---|---|---|
| M1 Minervini trend template | 94 | 5.5% | 130.9% | -125.4% | 0.02 | -14.9% | 2653 | 1775 | 21.8% |
| M1G M1 + market gate (G) | 94 | 6.8% | 130.9% | -124.1% | 0.03 | -16.3% | 2293 | 1496 | 18.6% |
| M1B M1 + exit buffer (B) | 94 | 4.0% | 130.9% | -126.9% | 0.02 | -17.6% | 2452 | 1891 | 30.1% |
| M1V M1 variant: 4-month rising, RS 80 (V) | 94 | 5.6% | 130.9% | -125.3% | 0.03 | -11.9% | 1932 | 1286 | 15.9% |

## Calendar years (book return, Nifty 500 return, ratio of growth)

**M1 Minervini trend template:** 2011: -1.9% vs 0.0%; 2012: 3.0% vs 10.9%; 2013: -2.9% vs 3.6%; 2014: 8.3% vs 37.8%; 2015: -1.7% vs -0.7%; 2016: -8.6% vs 3.8%; 2017: 24.3% vs 35.9%; 2018: -11.9% vs -3.4%; 2019: -0.6% vs 7.7%

**M1G M1 + market gate (G):** 2011: -1.9% vs 0.0%; 2012: 3.0% vs 10.9%; 2013: -2.2% vs 3.6%; 2014: 8.3% vs 37.8%; 2015: -2.3% vs -0.7%; 2016: -3.3% vs 3.8%; 2017: 23.5% vs 35.9%; 2018: -11.6% vs -3.4%; 2019: -4.7% vs 7.7%

**M1B M1 + exit buffer (B):** 2011: -2.5% vs 0.0%; 2012: 4.4% vs 10.9%; 2013: -6.2% vs 3.6%; 2014: 10.0% vs 37.8%; 2015: -2.7% vs -0.7%; 2016: -11.4% vs 3.8%; 2017: 31.8% vs 35.9%; 2018: -14.8% vs -3.4%; 2019: 0.1% vs 7.7%

**M1V M1 variant: 4-month rising, RS 80 (V):** 2011: -1.0% vs 0.0%; 2012: 2.9% vs 10.9%; 2013: -2.4% vs 3.6%; 2014: 7.9% vs 37.8%; 2015: -0.8% vs -0.7%; 2016: -6.0% vs 3.8%; 2017: 16.9% vs 35.9%; 2018: -9.3% vs -3.4%; 2019: -1.3% vs 7.7%

## Template books

**M1 Minervini trend template:** reviews 114; passing per review average 33, lowest 0, highest 83; names ranked on average 186. Closed trades 2653 (339 a year); stopped out 1775. Average exposure 21.8%.

**M1G M1 + market gate (G):** reviews 114; passing per review average 28, lowest 0, highest 83; names ranked on average 186. Closed trades 2293 (293 a year); stopped out 1496. Average exposure 18.6%.

**M1B M1 + exit buffer (B):** reviews 114; passing per review average 33, lowest 0, highest 83; names ranked on average 186. Closed trades 2452 (313 a year); stopped out 1891. Average exposure 30.1%.

**M1V M1 variant: 4-month rising, RS 80 (V):** reviews 137; passing per review average 20, lowest 0, highest 59; names ranked on average 178. Closed trades 1932 (247 a year); stopped out 1286. Average exposure 15.9%.

## Pre-registered pass rule (docs/MINERVINI_HOLDOUT_PREREG.md, C-217)

Control M1: return 5.5%, drawdown -14.9%, 339 trades a year.

| Candidate | Beats control's return | Second test | Excess over Nifty 500 positive | Verdict |
|---|---|---|---|---|
| M1G M1 + market gate (G) | yes (6.8%) | no (drawdown -16.3%) | no (-124.1%) | dropped |
| M1B M1 + exit buffer (B) | no (4.0%) | yes (313 trades a year) | no (-126.9%) | dropped |
| M1V M1 variant: 4-month rising, RS 80 (V) | yes (5.6%) | yes (drawdown -11.9%) | no (-125.3%) | dropped |

**Implementation check on a holdout, not evidence.** Survivor bias is heavy (names delisted before 2026 are mostly absent), cash earns nothing, a pass is permission to paper-trade forward only.

Forward paper stays the primary evidence. This table shows what the rules would have done, not what they will do.
