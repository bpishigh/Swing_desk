# Growth factors with quarterly results — registered 18 Nov 2026, before any run

Correction first: earlier today I wrote that India has no earnings history to backtest. That was wrong. `data/india/filings` holds quarterly results from the NSE filing list for periods 2016-06 to 2026-09, each with its filing timestamp, so a point-in-time test is possible from the 2017-06 quarter (year-on-year needs a year of history). Paper only; not financial advice.

## Setup (same as docs/replay/GROWTH-FACTORS-PREREG.md except where stated)
- Universe, outcomes (3x, 5x within 756 sessions; 12-month forward return), month-end quintiles and the 13 price/volume factors are as before.
- Five results factors added (family now 18; delivery % still excluded): revenue growth year on year in the latest quarter; profit after tax growth year on year (only where the year-ago profit is positive); revenue growth acceleration (this quarter's growth minus the previous quarter's growth); change in pre-tax margin against the year-ago quarter; profit growth acceleration (both quarters with positive bases).
- Point in time: a quarter counts only if its filing timestamp is on or before the month-end. Consolidated figures if filed by then, otherwise standalone. The latest quarter must be at most 150 days old at the month-end. Original filings are used, not later revisions.
- Samples: discovery month-ends 2018-01 to 2020-12 (36 months); validation month-ends 2021-01 to 2023-11 (35 months), opened once. Only one regime pair is available, so base rates are high in validation (broad small-cap boom) and lift is judged against the same-period all-stock rate.

## Reading rule (no amendments after seeing results)
- A factor is useful if its favourable quintile has a 3x rate at least 1.5x the all-stock rate and the opposite quintile at most 1.0x, and the favourable direction holds in at least 2 of the 3 discovery years.
- Carry at most the 3 useful factors with the largest lift into one combined rule (favourable quintile of all three on the month-end). Discovery bar: lift at least 2x with at least 150 stock-months. If fewer than 2 factors are useful, nothing is carried and the study closes.
- Validation (once): lift at least 1.5x, 12-month median above the all-stock median by at least 5 points, at least 150 stock-months, lift above 1 in at least 2 of 3 validation years.
- Pass leads to a registered portfolio replay on the same bar as before (beat Nifty 500 CAGR, drawdown at most 35%); fail closes results-based factors on this data.
