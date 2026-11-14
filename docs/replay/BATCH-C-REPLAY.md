# Batch C replay (decision D8)

Run 2026-11-14, sessions 2021-01-01 to 2026-11-13. One registered run per book, rules as built, no tuning. Paper only; not a financial adviser.

**Labels on every result.** (1) The 2020 to 2026 price period has been seen in other tests (C-59 to C-62 saw the results-day reactions of 2024 to 2026): not a clean out-of-sample read. (2) Survivor bias: filings exist for 97.6% of liquid names still trading but only 2020 100.0%, 2021 100.0%, 2022 80.0%, 2023 88.9%, 2024 100.0%, 2025 100.0%, 2026 92.9% of liquid names that later vanished (by the year last seen), so names that disappeared are under-represented and results lean favourable. (3) Cash earns nothing here (live books credit the liquid-fund rate); the top-500 list is rebuilt monthly; the comparator is the Nifty 500 for all five (price index, no dividends, so it is slightly harsh on the comparator side).

| Book | Months | Book since start | Nifty 500 since start | Excess | Confidence | Max drawdown | Closed trades | Stop-outs | Avg exposure |
|---|---|---|---|---|---|---|---|---|---|
| C1 Delivery accumulation | 66 | 0.0% | 78.2% | -78.1% | 0.05 | -2.2% | 75 | 43 | 3.9% |

## Calendar years (book return, Nifty 500 return, ratio of growth)

**C1 Delivery accumulation:** 2021: -0.0% vs 13.4%; 2022: -1.1% vs 3.0%; 2023: 2.1% vs 25.8%; 2024: 0.8% vs 15.2%; 2025: -0.3% vs 5.3%; 2026: -1.4% vs 0.0%

## Signals and results by tag

Signals logged: 1296; bought 76; no slot 0; stop too wide 1216; already held 4. Tags: results 32, expiry 85, none 1179. The deal-day tag is not available in the replay (deal logging starts 13 Nov 2026) and weekly expiries are not tagged, only the monthly one.

| Group | Closed trades | Average gross trade return | Stop-out share |
|---|---|---|---|
| all | 75 | 0.5% | 57.3% |
| expiry tag | 8 | 0.9% | 62.5% |
| results tag | 2 | 6.2% | 50.0% |
| no tag | 65 | 0.3% | 56.9% |

Trade return is price return from the fill to the exit before costs (the book table above is after costs). **Window:** started 2021-02-01 (a month counts once 90% of the top 500 have at least 15 delivery readings in the prior 20 sessions). Delivery percent comes from the stored daily files from 2 Jan 2020; the replay starts 2021-01-01. **Implementation check, not evidence.**

Forward paper stays the primary evidence. This table shows what the rules would have done, not what they will do.
