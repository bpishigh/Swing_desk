# Batch D replay (decision D8)

Run 2026-11-15, sessions 2012-01-02 to 2019-12-31. One registered run per book, rules as built, no tuning. Paper only; not a financial adviser.

**Labels on every result.** (1) The 2020 to 2026 price period has been seen in other tests (C-59 to C-62 saw the results-day reactions of 2024 to 2026): not a clean out-of-sample read. (2) Survivor bias: filings exist for 97.6% of liquid names still trading but only 2020 100.0%, 2021 100.0%, 2022 80.0%, 2023 88.9%, 2024 100.0%, 2025 100.0%, 2026 92.9% of liquid names that later vanished (by the year last seen), so names that disappeared are under-represented and results lean favourable. (3) Cash earns nothing here (live books credit the liquid-fund rate); the top-500 list is rebuilt monthly; the comparator is the Nifty 500 for all five (price index, no dividends, so it is slightly harsh on the comparator side).

| Book | Months | Book since start | Nifty 500 since start | Excess | Confidence | Max drawdown | Closed trades | Stop-outs | Avg exposure |
|---|---|---|---|---|---|---|---|---|---|
| T10 Flat-base control, price-only, 10% stop (T10) | 94 | -75.7% | 130.9% | -206.6% | 0.00 | -76.3% | 345 | 297 | 36.2% |
| T7 Flat-base candidate, price-only, 7% stop (T7) | 94 | -83.3% | 130.9% | -214.3% | 0.00 | -83.4% | 369 | 316 | 39.1% |

## Calendar years (book return, Nifty 500 return, ratio of growth)

**T10 Flat-base control, price-only, 10% stop (T10):** 2012: -15.3% vs 10.9%; 2013: -16.3% vs 3.6%; 2014: -17.5% vs 37.8%; 2015: -23.4% vs -0.7%; 2016: -23.3% vs 3.8%; 2017: 9.4% vs 35.9%; 2018: -15.0% vs -3.4%; 2019: -23.9% vs 7.7%

**T7 Flat-base candidate, price-only, 7% stop (T7):** 2012: -20.2% vs 10.9%; 2013: -17.1% vs 3.6%; 2014: -23.0% vs 37.8%; 2015: -21.6% vs -0.7%; 2016: -27.3% vs 3.8%; 2017: -3.9% vs 35.9%; 2018: -16.9% vs -3.4%; 2019: -28.2% vs 7.7%

## Template books

**T10 Flat-base control, price-only, 10% stop (T10):** reviews 0; passing per review average 0, lowest n/a, highest n/a; names ranked on average 0. Closed trades 345 (44 a year); stopped out 297. Average exposure 36.2%.

**T7 Flat-base candidate, price-only, 7% stop (T7):** reviews 0; passing per review average 0, lowest n/a, highest n/a; names ranked on average 0. Closed trades 369 (47 a year); stopped out 316. Average exposure 39.1%.

## Pre-registered pass rule (docs/SEPA_STOP_PREREG.md)

| | Net return per full exit | Book return | Max drawdown | Full exits | Per year |
|---|---|---|---|---|---|
| T10 control | -3.8% | -75.7% | -76.3% | 297 | 38 |
| T7 candidate | -3.0% | -83.3% | -83.4% | 316 | 40 |

1. Net return per trade higher: yes. 2. Book return higher: no. 3. Drawdown no worse by more than 2 points: no. 4. At least 20 full exits a year: yes. **Verdict: FAIL (T7 dropped).**

**Implementation check on a holdout, not evidence.** Survivor bias is heavy (names delisted before 2026 are mostly absent), cash earns nothing, a pass is permission to paper-trade forward only.

Forward paper stays the primary evidence. This table shows what the rules would have done, not what they will do.
