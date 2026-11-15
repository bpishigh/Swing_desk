# bd-m2-sepaflat: tighter-stop holdout, pre-registered (not yet run)

Status: **written 15 Nov 2026, before any run. Not run until the owner says "go".** Paper only, not a financial adviser.

## Why
The C-219 replay and its diagnostic (docs/replay/sepaflat/DIAGNOSTIC.md) show the book's 10% stop cap binds on most trades (median loss -10.0%), while his books give an average loss of 5% to 7% and a 10% maximum. The adopted book (C-218) is not changed by this page.

## The one change
**T7:** the stop is the base low but no more than **7%** below the fill (adopted book: 10%). 7% is the top of his published 6% to 7% average loss (Book 1), chosen from the books, not from the replay's losses. No other value is tried.

## Runs (one each, fixed now)
- **Control T10:** the adopted rules with the earnings test switched off (earnings figures do not exist before 2021).
- **Candidate T7:** the same, with the 7% cap.
- Window 2 Jan 2012 to 31 Dec 2019 (the 2010 to 2011 files give the first 345 sessions of history); price data loaded with `--pre`. Everything else as in C-218: six names, 1.25% risk, 25% cap, half sale, 50-day rule, largest-fall exit, tier costs, next-open fills.
- Both books started on the same first session and read by the same replay code.

## Pass rule (all four, fixed before the run)
1. T7's net return per trade (after tier costs, full exits) is higher than T10's.
2. T7's book return over the window is higher than T10's.
3. T7's maximum drawdown is no worse than T10's by more than 2 points.
4. T7 has at least 20 full exits a year on average.

Any failure drops T7 for good. A pass is permission to run a labelled twin book forward beside bd-m2-sepaflat; it does not change C-218 and is not evidence of an edge.

## Known limits (printed with the result)
Survivor bias (names delisted before 2026 are mostly absent); cash earns nothing in the replay; one market era; the price-only books are not the live book (no earnings screen), so a pass speaks to the stop, not to the book. A tighter stop means more stop-outs by design, so rule 1 is read on net return per trade, not on the stop-out count.

## Not tested here
An entry-distance test on the next open (the diagnostic shows a median 3.2% above the base top) is a second hypothesis and would be registered separately, one change per test.

## Needs building before the run
A price-only switch in `sepaFlat` (earnings test off) and a stop-cap setting for the replay book; both default to the adopted values, so C-218 is unchanged.
