# Fund-score back-test (C-81), run 2026-10-24

Criteria fixed in Engine Rules C-81 before this run. 319 Direct-Growth plain-equity schemes alive today, each grouped with its category as of today (so a category that did not exist earlier, such as Flexi Cap before late 2020, is regrouped back in time; survivorship bias: closed and merged funds are missing, which flatters every group). An earlier run on 576 schemes that included sector and hybrid funds was cancelled and the sample narrowed to plain equity before the first valid run; that narrowing was made after seeing the early run (Test A 4 of 10, Test B 6 of 10), so it is a choice made with the results in view. Score = unchanged FUND-3 settings using only NAVs up to 1 October of each year; forward return = the next 12 months; excess = fund minus its category median, in percentage points.

| Year | Funds scored | Strong funds | Median excess, Strong | Test A | Weak funds | Median excess, Weak | Test B |
|---|---|---|---|---|---|---|---|
| 2015-10-01 | 0 | 0 | – | not counted | 0 | – | not counted |
| 2016-10-01 | 119 | 25 | 2.22 | pass | 21 | -2.91 | pass |
| 2017-10-01 | 125 | 30 | -0.42 | fail | 24 | 1.59 | fail |
| 2018-10-01 | 130 | 19 | 0.00 | fail | 22 | 0.14 | fail |
| 2019-10-01 | 132 | 30 | 0.43 | pass | 26 | -2.20 | pass |
| 2020-10-01 | 137 | 31 | -1.94 | fail | 30 | 6.18 | fail |
| 2021-10-01 | 146 | 25 | -0.55 | fail | 27 | 0.00 | fail |
| 2022-10-01 | 163 | 29 | 1.09 | pass | 31 | -0.49 | pass |
| 2023-10-01 | 175 | 35 | 2.65 | pass | 33 | -2.12 | pass |
| 2024-10-01 | 198 | 44 | -0.52 | fail | 40 | -0.12 | pass |
| 2025-10-01 | 219 | 38 | 0.18 | pass | 37 | -1.86 | pass |

**Test A (Strong beats the median):** 5 of 10 counted years pass → FAIL (needs 60% and at least 5 years).

**Test B (Weak trails the median):** 6 of 10 counted years pass → PASS.

**Replace verdicts: OFF** (on only if both tests pass). Nothing was tuned.

## Index and cash tests (C-85)

Test D (below the segment index funds' 3-year median, then trail them next year): 2 of 8 counted years → FAIL or not testable (rule off). Test E (below the liquid funds' 3-year median, then trail cash): 2 of 3 counted years → FAIL or not testable (rule off).

| Year | Funds below index | Median excess vs index | Funds below cash | Median excess vs cash |
|---|---|---|---|---|
| 2015-10-01 | 0 | – | 0 | – |
| 2016-10-01 | 2 | -4.36 | 0 | – |
| 2017-10-01 | 5 | -7.38 | 5 | -0.99 |
| 2018-10-01 | 78 | -0.58 | 11 | -8.34 |
| 2019-10-01 | 104 | 1.90 | 49 | -2.00 |
| 2020-10-01 | 105 | 9.29 | 109 | 59.91 |
| 2021-10-01 | 31 | 2.83 | 0 | – |
| 2022-10-01 | 30 | 0.30 | 0 | – |
| 2023-10-01 | 30 | 7.99 | 0 | – |
| 2024-10-01 | 25 | -0.15 | 0 | – |
| 2025-10-01 | 44 | 3.63 | 0 | – |

## Near the bottom quarter (C-83)

Test C: funds scoring from 25 up to 35 trail their category median: 6 of 10 counted years → PASS (those funds read Watch).

| Year | Funds 25 to 35 | Median excess |
|---|---|---|
| 2015-10-01 | 0 | – |
| 2016-10-01 | 14 | 1.60 |
| 2017-10-01 | 15 | 1.43 |
| 2018-10-01 | 12 | -0.99 |
| 2019-10-01 | 18 | -0.58 |
| 2020-10-01 | 14 | -0.25 |
| 2021-10-01 | 13 | -0.40 |
| 2022-10-01 | 21 | -2.24 |
| 2023-10-01 | 24 | 1.28 |
| 2024-10-01 | 22 | 0.47 |
| 2025-10-01 | 24 | -0.39 |

## Debt funds, risk-aware score (C-82, information only)

354 debt schemes. Cost is left out of this run (no expense ratio at past dates). Test A (Strong beats the group median): 7 of 9 years → PASS. Test B (Weak trails): 8 of 10 years → PASS. Replace is not available for debt funds whatever the result.

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
