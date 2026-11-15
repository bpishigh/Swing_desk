# Minervini-style SEPA book (package 36b): proposal v2

Status: **v2, 15 Nov 2026. Proposal only: not built, not registered, not adopted.** v1 was called "as published"; an outside review pasted by the owner (not an approval) pointed out that several v1 figures look like O'Neil's rules or a secondary site's reading. I could not check them against his books from here (only secondary summaries are reachable), so every figure that cannot be sourced to his books is removed or marked, and the book is called **Minervini-style**, not "exact". Paper only. Not a financial adviser.

## What stays in, and how sure the source is
| Rule | Source status |
|---|---|
| Trend template, eight tests (the C-216 screen) | His published template; already in `docs/MINERVINI_BOOK.md` |
| Stop at most about 8% below entry | Matches every summary read and the review's recollection |
| Risk 1.25% of the book per trade (published range 1 to 2%) | Matches; exact figure to confirm |
| Position cap 25% of the book | Matches the review's recollection; to confirm |
| 4 to 8 names (as many as cash allows) | Matches; sources also say 15 to 20, so the lower range is used |
| Breakout above the pivot on clearly higher volume | Stated qualitatively; the number below is a desk figure |
| Base made of successively shallower contractions with volume drying up | His pattern; the algorithm below is a desk definition |

**Removed because no source in his books could be found:** return on equity above 17% (O'Neil's CAN SLIM figure), institutional holding 20% to 80%, the 25% earnings-growth floor (he stresses accelerating earnings; no number confirmed), and "sell half at +8%". The profit rule is left out: he teaches taking gains at a multiple of the risk and moving the stop to breakeven, which needs his exact wording; until then exits are the stop and the single stage-3 test below. Earnings acceleration is **not coded** (listed below).

**Desk definitions, not published (labelled as such on the card):** the 150% breakout volume, the contraction algorithm, the 50-day market gate, the stage-3 exit test.

## Mechanics (corrected)
- **Sizing and cash.** Position = 1.25% of the book divided by the stop width, capped at 25% (an 8% stop gives 15.6%). Eight positions at 15.6% would be 125% of the book, so without leverage the book holds **six at full size**, more only when stops are tighter. A signal that finds too little cash is **skipped and logged ("no cash")**; the book never borrows.
- **Two exceptions to standing rules, needing the owner's explicit yes on this page:** (1) a position above the 5% per-name cap (up to 25%); (2) a fixed 8% stop replacing the C-159 short-hold stop for this book.
- **The stop.** His is a resting order that fills during the day. Proposed: check the stop against the stored daily low; if the low reaches the stop, sell at the stop price, or at the open when the open gaps below it. This needs an optional intraday-stop path in the book engine (default unchanged). If not built, the book checks closes and sells at the next open, losses will often exceed 8%, and that is listed as a difference.
- **The contraction algorithm (desk definition, decided before any count).** Base window: the 120 sessions ending tonight. Swings: a zigzag on highs and lows with a 5% reversal. Contractions: each decline from a swing high to the next swing low. Valid base: at least two contractions, each shallower than the one before and at most 70% of it, the last at most 10% deep, the base high at least 25 sessions old, and average volume over the last contraction below the 50-session average. Pivot: the high of the last swing high. Entry signal: a close above the pivot and no more than 5% above it, on volume at least 150% of the 50-session average, for a name that passes the template (all eight tests) that night. Fill at the next open (his entry is intraday; the gap above the pivot is logged on every signal).
- **Exit (stage-3 test).** A close below the 50-day average on volume above the 50-session average; or the stop.
- **Market gate.** No new entries when the Nifty 500 closes below its own 50-day average.
- **Daily signals;** no monthly review.

## Not coded (the differences that remain, listed on the card)
Choosing the best few by chart quality and group leadership; earnings acceleration and other fundamentals (no confirmed numbers); news and catalysts; intraday entry; adding to winners and selling into strength by feel; judging bases by eye (cup, flat base, handle).

## Before anything is built (in this order)
1. **Source check.** The owner supplies the rule wording from his own copy of the books (or says to keep "Minervini-style" and the labels above). Any rule not found comes out.
2. **Count only.** Run the signal chain once over stored history and report the number of valid signals a year, as a count, with no returns read. This layer has failed on count before: the setup layer gave 35 valid trades in nine years in C-118(b) (3 to 10 a year) and 19 trades in US-SCAN-2 (C-52, not testable). If the count is a handful a year, the book cannot be read in any useful time and is not built.
3. **Log, not just count.** Every night, record pass or fail on each rule (each template test, each contraction test, volume, gate) for every template passer. Without it, a comparison against the screen book changes eight things at once and cannot say which rule did the work.
4. Only then a registered replay and a forward book, next to the screen book (C-216).

## Reading the result
- **Kill line.** A book that is mostly cash will trail the Nifty 500 by more than 5 points in any rising half-year, so the standard kill line would fire on cash. This book is read on **net return per trade** and against the **index scaled to the book's average exposure**, alongside the usual line.
- **Expectation on the card (before the first signal):** the register's own results predict few trades and no edge from this layer. A weak or empty record is the likely outcome and is a result.

## Decisions for the owner
| # | Decision | Proposed |
|---|---|---|
| S-1 | Do the source check (owner's wording) or keep the name Minervini-style with the labels | Minervini-style until checked |
| S-2 | Yes to the two exceptions: position up to 25%; 8% stop replacing C-159 | Yes |
| S-3 | The desk contraction algorithm and volume figure as written above | Yes |
| S-4 | Intraday stop path in the engine (stop checked on the daily low) | Yes |
| S-5 | Count-only run first, and no build if signals are a handful a year | Yes |
| S-6 | Nightly pass or fail log per rule for every template passer | Yes |
