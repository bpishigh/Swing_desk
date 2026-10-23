# Fund-score back-test (C-81), run 2026-10-23

Criteria fixed in Engine Rules C-81 before this run. about 308 Direct-Growth plain-equity schemes alive today (the 694 printed in the first version of this report was the count of all series fetched in the run, which included debt and index funds; correction made 23 Oct 2026), each grouped with its category as of today (so a category that did not exist earlier, such as Flexi Cap before late 2020, is regrouped back in time; survivorship bias: closed and merged funds are missing, which flatters every group). An earlier run on 576 schemes that included sector and hybrid funds was cancelled and the sample narrowed to plain equity before the first valid run; that narrowing was made after seeing the early run (Test A 4 of 10, Test B 6 of 10), so it is a choice made with the results in view. Score = unchanged FUND-3 settings using only NAVs up to 1 October of each year; forward return = the next 12 months; excess = fund minus its category median, in percentage points.

| Year | Funds scored | Strong funds | Median excess, Strong | Test A | Weak funds | Median excess, Weak | Test B |
|---|---|---|---|---|---|---|---|
| 2015-10-01 | 0 | 0 | – | not counted | 0 | – | not counted |
| 2016-10-01 | 115 | 24 | 1.92 | pass | 21 | -2.91 | pass |
| 2017-10-01 | 121 | 28 | -0.40 | fail | 24 | 1.69 | fail |
| 2018-10-01 | 126 | 20 | -0.51 | fail | 21 | 0.65 | fail |
| 2019-10-01 | 128 | 30 | 0.64 | pass | 25 | -2.44 | pass |
| 2020-10-01 | 133 | 30 | -1.41 | fail | 30 | 6.58 | fail |
| 2021-10-01 | 142 | 24 | -0.51 | fail | 27 | -0.31 | pass |
| 2022-10-01 | 158 | 29 | 1.09 | pass | 29 | -0.49 | pass |
| 2023-10-01 | 170 | 34 | 2.52 | pass | 33 | -2.50 | pass |
| 2024-10-01 | 192 | 43 | -0.57 | fail | 36 | -0.10 | pass |
| 2025-10-01 | 213 | 36 | 0.21 | pass | 33 | -1.44 | pass |

**Test A (Strong beats the median):** 5 of 10 counted years pass → FAIL (needs 60% and at least 5 years).

**Test B (Weak trails the median):** 7 of 10 counted years pass → PASS.

**Replace verdicts: OFF** (on only if both tests pass). Nothing was tuned.

## Index and cash tests (C-85)

Test D (below the segment index funds' 3-year median, then trail them next year): 2 of 8 counted years → FAIL or not testable (rule off). Test E (below the liquid funds' 3-year median, then trail cash): 2 of 3 counted years → FAIL or not testable (rule off).

| Year | Funds below index | Median excess vs index | Funds below cash | Median excess vs cash |
|---|---|---|---|---|
| 2015-10-01 | 0 | – | 0 | – |
| 2016-10-01 | 2 | -4.36 | 0 | – |
| 2017-10-01 | 5 | -7.38 | 5 | -0.99 |
| 2018-10-01 | 77 | -0.79 | 11 | -8.34 |
| 2019-10-01 | 103 | 1.96 | 49 | -2.00 |
| 2020-10-01 | 103 | 9.29 | 107 | 59.91 |
| 2021-10-01 | 31 | 2.83 | 0 | – |
| 2022-10-01 | 30 | 0.30 | 0 | – |
| 2023-10-01 | 30 | 8.00 | 0 | – |
| 2024-10-01 | 24 | -0.46 | 0 | – |
| 2025-10-01 | 44 | 3.63 | 0 | – |

## Near the bottom quarter (C-83)

Test C: funds scoring from 25 up to 35 trail their category median: 5 of 10 counted years → FAIL (band unchanged).

| Year | Funds 25 to 35 | Median excess |
|---|---|---|
| 2015-10-01 | 0 | – |
| 2016-10-01 | 13 | 1.61 |
| 2017-10-01 | 13 | 1.70 |
| 2018-10-01 | 10 | -0.49 |
| 2019-10-01 | 18 | -1.71 |
| 2020-10-01 | 11 | 2.29 |
| 2021-10-01 | 13 | -0.20 |
| 2022-10-01 | 22 | -3.63 |
| 2023-10-01 | 23 | 2.17 |
| 2024-10-01 | 23 | 0.47 |
| 2025-10-01 | 25 | -0.78 |

## Debt funds, risk-aware score (C-82, information only)

353 debt schemes. Cost is left out of this run (no expense ratio at past dates). Test A (Strong beats the group median): 7 of 9 years → PASS. Test B (Weak trails): 8 of 10 years → PASS. Replace is not available for debt funds whatever the result.

| Year | Strong funds | Median excess, Strong | Weak funds | Median excess, Weak |
|---|---|---|---|---|
| 2015-10-01 | 0 | – | 0 | – |
| 2016-10-01 | 8 | 0.48 | 15 | -0.16 |
| 2017-10-01 | 10 | 0.30 | 10 | -0.41 |
| 2018-10-01 | 24 | -0.54 | 26 | -0.32 |
| 2019-10-01 | 20 | 0.13 | 32 | -0.59 |
| 2020-10-01 | 21 | 0.00 | 27 | 0.25 |
| 2021-10-01 | 15 | 0.28 | 26 | 0.20 |
| 2022-10-01 | 23 | 0.04 | 20 | -0.20 |
| 2023-10-01 | 23 | 0.07 | 34 | -0.14 |
| 2024-10-01 | 32 | 0.07 | 46 | -0.08 |
| 2025-10-01 | 26 | 0.39 | 27 | -0.27 |
