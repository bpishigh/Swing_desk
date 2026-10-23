# Fund-score back-test (C-81), run 2026-10-23

Criteria fixed in Engine Rules C-81 before this run. 639 Direct-Growth equity schemes alive today (survivorship bias: closed and merged funds are missing, which flatters every group). Score = unchanged FUND-3 settings using only NAVs up to 1 October of each year; forward return = the next 12 months; excess = fund minus its category median, in percentage points.

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

## Debt funds, risk-aware score (C-82, information only)

331 debt schemes. Cost is left out of this run (no expense ratio at past dates). Test A (Strong beats the group median): 7 of 9 years → PASS. Test B (Weak trails): 8 of 10 years → PASS. Replace is not available for debt funds whatever the result.

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
