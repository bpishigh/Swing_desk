# Minervini-exact trend template book (package 15b): proposal

Status: **proposed 15 Nov 2026 at the owner's choice ("add a Minervini-exact version as a new, separate book"); not built, not adopted.** Pasted reviewer text is not approval. Paper only. Not a financial adviser. Written to `claude/strategy-build-standard.md`. India first; a US version only after this one has a forward record.

## Why a separate book
C-165 uses the trend template as a filter on the momentum sleeve (price rules only, closes, no relative-strength leg), and the US scan uses a top-20% relative-strength cut with a 1-month rising 200-day average. Neither is Minervini's published template, so neither can say whether his template works. This book is the template as published, and nothing else, so its record is the template's record.

## The eight tests, as published (all must pass, on closes)
1. Close above the 150-day and 200-day averages.
2. 150-day average above the 200-day.
3. 200-day average rising for at least 4 months (today's value above its value 84 sessions ago; he gives 1 month as the minimum and 4 to 5 as the ideal; the ideal is used).
4. 50-day average above both the 150-day and the 200-day.
5. Close above the 50-day average.
6. Close at least 30% above the 52-week low.
7. Close within 25% of the 52-week high.
8. Relative-strength rank of at least 70: 12-month return skipping the latest month, ranked as a percentile within the top 500 (his ideal is 80 to 90; 70 is the stated minimum).

## Book rules (proposed defaults, for the owner to confirm)
- **Universe:** top 500 by 20-session median traded value, as Batches A to C. Needs 260 sessions of history.
- **Review:** first session of each month. Take the passers, rank by relative strength, hold the top 20; held names stay while they still pass all eight tests (no top-40 buffer: the template is the rule).
- **Entry and exit:** signal on the close, fill at the next open, tier costs, cash at the liquid-fund rate. Exit at a monthly review when a name fails any test, or on the 25% long-hold stop (as the Batch B books). A stop-out leaves the slot in cash until the next review.
- **Equal weight, at most 20 names at 5%.** Fewer passers means cash; the card shows how many pass each month.
- **Comparator:** Nifty 500, cap-weighted (C-176). Kill line C-174, confidence figure C-177.
- **What it is not:** no breakout trigger, no volatility-contraction test, no stop at 7 to 8% below entry. Those are Minervini's entry and risk rules, not his template. The volatility contraction pattern is package 36 and is tested separately.

## Replay
One run on the stored prices, labelled an implementation check, not evidence (2020 to 2026 prices have been seen in other tests; survivor bias applies). Window: from the first month where every top-500 name has 260 sessions of history. Forward paper is the evidence.

## Decisions for the owner
| # | Decision | Proposed |
|---|---|---|
| M-1 | Rising 200-day: 1 month or 4 months | 4 months |
| M-2 | RS floor: 70 (minimum) or 80 (his ideal range starts) | 70 |
| M-3 | Exit: fail-any-test at monthly review plus 25% stop, or a tighter stop | Monthly review plus 25% stop |
| M-4 | Hold size: top 20 by RS, or every passer capped at 20 | Top 20 by RS |
| M-5 | Start the forward book after one replay | Yes |
