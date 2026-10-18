# C-59 India pre-earnings run-up test (18 Oct 2026)
Pre-registered in the Engine Rules change log before any result was read. Script: `scripts/earnings-runup-test.mjs`; output `data/replay/earnings-runup-india.json`; dates `data/india/results-dates.json` (NSE board meetings, 498 of 501 Nifty 500 symbols).

Design: run-up = close(E-11) to close(E-1) minus equal-weight market (same symbols); reaction = E-1 to E+1; drift = E+1 to E+21. Terciles of run-up inside each calendar-month cohort. Adoption: |t|>2, same sign in at least 4 of 5 years, effect >=1 pp, informational tag only.

Data limit: the feed holds results dates from Jan 2024 only (3,904 usable events), so 3 years not 5.

| Test | High minus low | t | Years (2024/25/26) |
|---|---|---|---|
| H1 reaction | +0.22 pp | 0.78 | -0.53 / +1.07 / -0.15 |
| H2 drift, all | +1.66 pp | 2.55 | +2.85 / +1.11 / +1.20 |
| H2 drift, reaction up | +2.03 pp | 2.37 | +4.81 / +0.74 / +1.43 |
| H2 drift, reaction down | +1.96 pp | 3.46 | +4.54 / +1.24 / +0.77 |
| Control (post hoc), non-results dates | -1.64 pp | -1.72 | -3.43 / -0.12 / -1.80 |

Result: H1 fails. H2 meets the numbers on 3 years and is opposite in sign to the non-results control, so it is specific to results. Not adopted; the 5-year consistency rule cannot be met. Parked for owner decision.

## Retest on 7 years (18 Oct 2026, registered before the new result was read)
Results dates pulled back to Oct 2019 with NSE's date-range board-meetings feed (`scripts/fetch-results-dates-hist.mjs`); prices from Jan 2020. 9,732 events, 497 symbols, Jan 2020 to Aug 2026. Year rule scaled to 80% of years with events (at least 5); control must not show the same sign at |t|>2.

| Test | High minus low | t | Years 2020/21/22/23/24/25/26 |
|---|---|---|---|
| H1 reaction | -0.36 pp | -2.00 | -1.56 / -0.81 / -0.48 / +0.28 / -0.53 / +1.07 / -0.15 |
| H2 drift, all | +1.66 pp | 3.83 | +0.04 / +1.53 / +3.11 / +2.39 / +2.85 / +1.11 / +1.20 |
| H2 drift, reaction up | +2.03 pp | 3.74 | -0.01 / +3.12 / +3.31 / +2.08 / +4.81 / +0.74 / +1.43 |
| H2 drift, reaction down | +1.78 pp | 3.53 | +0.71 / +0.92 / +3.08 / +2.36 / +4.54 / +1.24 / +0.77 |
| Control, non-results dates | -0.63 pp | -1.13 | +0.33 / +1.76 / -0.32 / -0.62 / -3.43 / -0.12 / -1.80 |

Result: H1 stays below the 1 pp bar. H2 passes (t 3.83, 7 of 7 years, 1.66 pp) and the control does not show it. Eligible for an informational tag only, if the owner wants it. 2020 is flat. Nothing changed in the scans.
