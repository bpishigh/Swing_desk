# Minervini-exact trend template book (package 15b): proposal

Status: **v2, 15 Nov 2026 (applies an outside review pasted by the owner; every change below is a proposal until the owner marks it, pasted reviewer text is not approval).** Proposed 15 Nov 2026 at the owner's choice ("add a Minervini-exact version as a new, separate book"); not built, not adopted.** Pasted reviewer text is not approval. Paper only. Not a financial adviser. Written to `claude/strategy-build-standard.md`. India first; a US version only after this one has a forward record.

## Why a separate book
C-165 uses the trend template as a filter on the momentum sleeve (price rules only, closes, no relative-strength leg), and the US scan uses a top-20% relative-strength cut with a 1-month rising 200-day average. Neither is Minervini's published template, so neither can say whether his template works. This book is the template as published, and nothing else, so its record is the template's record.

## The eight tests, as published (all must pass, on closes)
1. Close above the 150-day and 200-day averages.
2. 150-day average above the 200-day.
3. 200-day average rising for at least 1 month (today's value above its value 21 sessions ago). His stated minimum; the ideal (4 months) is the pre-written variant below.
4. 50-day average above both the 150-day and the 200-day.
5. Close above the 50-day average.
6. Close at least 30% above the 52-week low.
7. Close within 25% of the 52-week high. Tests 6 and 7 use intraday lows and highs (Minervini's convention); the stored daily files carry high and low for the whole history, so this is not a departure.
8. Relative-strength rank of at least 70 (his stated minimum). The measure is the weighted four-quarter return the US scan already uses (the IBD-style weighting, latest quarter heaviest), ranked as a percentile across all stored stocks that meet the price and history floors, not within the top 500. The ideal (80) is the pre-written variant.

**Variant, registered now, not run unless the owner asks:** 200-day rising 4 months and RS at least 80. Both ideals together, one variant, no other combinations.

## Book rules (proposed defaults, for the owner to confirm)
- **Universe:** top 500 by 20-session median traded value, as Batches A to C. Needs 260 sessions of history.
- **Review:** first session of each month. Held names stay while they still pass all eight tests (no buffer: the template is the rule).
- **Which passers (the design choice that decides what the book measures).** Ranking passers by relative strength would make test 8 never bind (the 20 strongest passers all rank far above 70), so the holdings would be momentum's and the record momentum's, close to the weekly 12-1 book and the C-165 book. Proposed instead: hold up to 20 passers chosen by **traded value, largest first** (a neutral rule that does not pick on strength). The book engine holds at most 20 names at 5%, so "every passer" would need a variable-weight engine change; that is the alternative (A below). If the owner prefers the strongest 20, the card says it is a momentum book with a template filter and it is read as a pair against the weekly 12-1 book.
- **Entry and exit:** signal on the close, fill at the next open, tier costs, cash at the liquid-fund rate. Exit at a monthly review when a name fails any test, or on the 25% long-hold stop (as the Batch B books). A stop-out leaves the slot in cash until the next review.
- **Equal weight, at most 20 names at 5%.** Fewer passers means cash; the card shows how many pass each month and the average exposure every month.
- **Stated before the first signal:** (1) turnover: with no buffer, a name that dips under its 50-day average on a review day is sold and often bought back later; the card shows expected and actual turnover and cost. (2) Cash in weak markets: when few names pass the book sits in cash and behaves like a breadth switch, so it will lag in a sharp rebound and the Nifty 500 kill line will read that lag as failure; exposure is reported monthly so the lag can be read for what it is.
- **Comparator:** Nifty 500, cap-weighted (C-176). Kill line C-174, confidence figure C-177.
- **What it is not:** no breakout trigger, no volatility-contraction test, no stop at 7 to 8% below entry. Those are Minervini's entry and risk rules, not his template. The volatility contraction pattern is package 36 and is tested separately.

## Replay
One run on the stored prices, labelled an implementation check, not evidence (2020 to 2026 prices have been seen in other tests; survivor bias applies). Window: from the first month where every top-500 name has 260 sessions of history. Forward paper is the evidence.

## Decisions for the owner
| # | Decision | Proposed |
|---|---|---|
| M-1 | Rising 200-day: 1 month (published minimum) or 4 months | 1 month; 4 months as the variant |
| M-2 | RS floor and measure: 70 on the four-quarter weighted return across all stored stocks | 70; 80 as the variant |
| M-3 | Exit: fail-any-test at monthly review plus 25% stop, or a tighter stop | Monthly review plus 25% stop |
| M-4 | Which passers: (A) every passer at equal weight (needs a variable-weight engine change), (B) up to 20 passers by traded value, largest first, (C) strongest 20 by RS, labelled a momentum book | B |
| M-5 | Start the forward book after one replay | Yes |
