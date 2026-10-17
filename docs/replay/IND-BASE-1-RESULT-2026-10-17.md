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

## Holdout reveal (one reveal, 17 Oct 2026, committed after the fit result): signals Jan 2024 to Sep 2025, 21 months
| | Strategy | Eligible list, same rule | Nifty 500 |
|---|---|---|---|
| Compounded | +10.1% | +12.1% | +18.6% |
| 2024 | +37.8% | +25.4% | +17.5% |
| 2025 (to Sep) | -20.2% | -10.6% | +0.9% |

Mean monthly net return 0.71%. Mean monthly excess over the eligible list +0.04% (essentially zero). Excess over Nifty 500, compounded, -8.5 points.

Holding curve, holdout, annualised excess over the eligible list with 90% interval: 20 sessions +4.0% (-10.2% to +17.6%); 60 sessions +2.6% (-7.5% to +12.7%); 120 sessions +1.8% (-4.7% to +9.0%). Every interval includes zero.

## Against the pre-registered rule
- **P1** (mean excess above zero with a positive lower bound in the fit window, and holdout mean above zero): holds on the letter (holdout +0.04%), with no practical margin. At double cost it fails (holdout mean below zero).
- **P2** (beats Nifty 500 in both windows): holds in the fit window, **fails in the holdout** (-8.5 points).
- **P3** (survives dropping the best three months): holds.
- **P5** (double cost): P1 fails in the holdout, so even a pass would have been labelled cost-sensitive.
- **Outcome: inconclusive ("cannot tell"). Not a Pass, because P2 fails. Not a Fail, because the fit-window excess is positive.** Nothing is adopted.

## Reading it
Momentum with an index filter beat both benchmarks decisively in 2021 to 2023 and gave all of it back in the holdout: in 2025 the top decile fell 20% while the index was flat and the whole eligible list fell 11%. In 2024 and 2025 large caps led and the broad list itself trailed Nifty 500 (+12.1% against +18.6%), so the small and mid-cap tilt that carried the fit window reversed. The index filter did not help in 2025: the index stayed above its 200-day average while momentum names fell. The baseline is therefore real in some regimes and not a free lunch; it is cyclical with the small-cap cycle. Six years and one reversal is not enough to say whether the holdout is noise or a regime change; the 21-month interval on every holding horizon includes zero.

## What it means for the next steps
The yardstick the funnel has to beat is not a stable one. A longer history with more cycles is now the most useful single addition (NSE's older files back to about 2010, which adds 2013 to 2019 including the 2015 to 2016 and 2018 corrections), before any funnel comparison.
