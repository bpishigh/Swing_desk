# Fund-score back-test (C-81), run 2026-10-22

Criteria fixed in Engine Rules C-81 before this run. 576 Direct-Growth equity schemes alive today (survivorship bias: closed and merged funds are missing, which flatters every group). Score = unchanged FUND-3 settings using only NAVs up to 1 October of each year; forward return = the next 12 months; excess = fund minus its category median, in percentage points.

| Year | Funds scored | Strong funds | Median excess, Strong | Test A | Weak funds | Median excess, Weak | Test B |
|---|---|---|---|---|---|---|---|
| 2015-10-01 | 0 | 0 | – | not counted | 0 | – | not counted |
| 2016-10-01 | 162 | 32 | 1.67 | pass | 29 | -2.54 | pass |
| 2017-10-01 | 179 | 40 | -1.34 | fail | 37 | 1.65 | fail |
| 2018-10-01 | 192 | 31 | -0.51 | fail | 31 | -0.38 | pass |
| 2019-10-01 | 209 | 46 | 0.00 | fail | 40 | 0.30 | fail |
| 2020-10-01 | 218 | 44 | -2.84 | fail | 45 | 4.53 | fail |
| 2021-10-01 | 237 | 38 | -0.33 | fail | 45 | -0.67 | pass |
| 2022-10-01 | 265 | 48 | 0.90 | pass | 51 | -0.71 | pass |
| 2023-10-01 | 280 | 59 | 4.27 | pass | 55 | -2.73 | pass |
| 2024-10-01 | 314 | 67 | -0.53 | fail | 65 | 0.13 | fail |
| 2025-10-01 | 351 | 55 | 0.09 | pass | 55 | -1.86 | pass |

**Test A (Strong beats the median):** 4 of 10 counted years pass → FAIL (needs 60% and at least 5 years).

**Test B (Weak trails the median):** 6 of 10 counted years pass → PASS.

**Replace verdicts: OFF** (on only if both tests pass). Nothing was tuned.
