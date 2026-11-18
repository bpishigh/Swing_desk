# Strong quarterly results, days after the filing — registered 18 Nov 2026, before any run

The month-end quintile test (C-242) found no results factor, but it does not use timing. This tests the filing itself as an event: strong results, bought at the next open after the filing, held for a fixed window. Paper only; not financial advice.

## Event
Each original quarterly filing with a timestamp (data/india/filings) is an event on its filing date A. Metrics from the filing and the year-ago quarter as in docs/replay/GROWTH-FUNDAMENTALS-PREREG.md (consolidated if filed by A, else standalone): revenue growth year on year, profit after tax growth year on year (year-ago profit positive), previous quarter's revenue growth.
- Signal event: revenue growth at least 20%, profit growth at least 50%, and revenue growth higher than the previous quarter's. Fixed, no tuning.
- Control events: every other filing with all three metrics available.
- Both need 20-session average traded value of at least Rs 2 crore on A.
- Entry: the next session open after A's date. Outcome: close 60 sessions after entry (also 120 and 250 sessions), minus 1.3% cost, against the Nifty 500 (BSE 500 spliced for early years) over the same dates. Report net excess return, win rate, mean and median by year.

## Samples
- Discovery: filings dated 2018-06-01 to 2021-12-31. Validation: 2022-01-01 to 2025-12-31 (opened once, 60- and 120-session outcomes; 250-session outcomes where complete).
- Disclosure: the filing list holds only companies listed today (survivors) and the 2020–23 window is a broad small-cap boom; both lift every group, so the test is signal events against control events, not against zero.

## Bars
- Discovery: at least 300 signal events; mean net excess at 60 sessions at least +3 points; above the control events by at least 3 points; positive in at least 3 of 4 years.
- Validation: at least 300 signal events; mean net excess at least +2 points and above control by at least 2 points at 60 sessions; positive in at least 3 of 4 years.
- Pass leads to a portfolio replay on the usual bar; fail closes results timing on this data. No amendments after seeing numbers.
