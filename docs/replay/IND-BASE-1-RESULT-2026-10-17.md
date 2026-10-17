# IND-BASE-1 result, fit window (C-54), 17 Oct 2026

Pre-registration: docs/replay/IND-BASE-1-PREREG.md (confirmed 17 Oct 2026 before any run). Run: scripts/backtest-ind-base1.mjs on commit of this file. The holdout (Jan 2024 to Sep 2025 returns) was computed in the same run, written to data/replay/ind-base1-holdout.json and not read before this fit result was committed. Integrity checks passed: the as-of leak check (10 nights) and the seeded 10-night signal rebuild from truncated data (identical lists, picks and regime). A first run that never invested (the regime flag was read from the wrong list, found because the filter-off variant did invest) was discarded before any result was read; it changed nothing in the pre-registration.

## Fit window: signals Jan 2021 to Dec 2023 (36 months, 29 invested, 7 in cash)
| | Strategy (top decile, filter on) | Eligible list, same rule | Nifty 500 |
|---|---|---|---|
| Compounded | +150.9% | +74.8% | +66.1% |
| 2021 | +77.8% | +42.7% | +31.0% |
| 2022 | -10.1% | -9.3% | +1.6% |
| 2023 | +57.0% | +35.0% | +24.8% |

Mean monthly net return 2.77%. Mean monthly excess over the eligible list 1.10%, bootstrap 90% interval 0.12% to 2.08%. Excess over Nifty 500, compounded, +84.9 points. Mean excess after dropping the three best months 0.59%.

**P1, P2, P3 all hold in the fit window. At double cost they still hold** (mean excess 0.98%, interval 0.01% to 1.95%, +64.4 points over Nifty 500, 0.48% after dropping three months), but the double-cost lower bound is barely above zero.

## Reported, not used to choose (one at a time, fit window)
Mean excess over the eligible list / compounded return: no skip month 0.89% / +132%; top 5% 1.33% / +170%; top 20% 0.68% / +118%; filter off 1.18% / +202%. The result is positive in every variant; the filter-off run has the highest return because 2022 and early 2023 were weak but not a collapse in this universe.

## Holding curve, fit window (invested months, picks against the eligible list, net of a round trip, annualised excess with 90% interval)
20 sessions +17.6% (4.8% to 30.6%); 60 sessions +14.8% (2.6% to 27.2%); 120 sessions +12.3% (3.5% to 20.5%). The 20-session figure is the highest, so the horizon flag does not fire. The three are not independent (overlapping picks).

## What was checked in the data
The largest name-months are real, well-known moves (TTML, NDTV, JWL, ADANITRANS), none coincides with a resolved split or bonus, and the worst are the Adani collapse, so losses are not being hidden. Median name-month gross return 1.4% against a mean of 3.7%: the mean is carried by a skewed tail. Many winners trade only Rs 7 to 20 crore a day, where the 0.80% cost tier and real fills matter most. 6 positions lost their price before exit (valued at the last close); 10 names had no entry price and were skipped; no unresolved demerger inside a hold. Two ETF-like symbols among 2,832 picks.

## Not yet decided
The holdout. The pass rule needs the holdout mean excess above zero for P1 and P2.
