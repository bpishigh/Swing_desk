# Batch B: balance-sheet and cash-flow books, India (DRAFT for owner approval, 14 Nov 2026)

Status: **DRAFT.** Nothing here is built as a book and nothing starts until the owner marks a block Adopted. C-numbers are assigned on adoption (next free: C-205). Paper only. Not a financial adviser. Pasted reviewer text is not approval. Written to the build standard (`claude/strategy-build-standard.md`, C-158) and the C-159, C-173, C-174, C-176 and C-177 rules.

## Why these three, and what is left out

Batch A used income-statement figures only. The A0 table now also holds balance-sheet and cash-flow extras, so the strategies that were blocked on data for newer quarters can be specified. Three are drafted:

- **B1 Magic Formula** (Greenblatt): cheap on EBIT over enterprise value and high on return on capital.
- **B2 Piotroski F-score**: nine yes/no tests of improving financial health, applied to cheap-on-book names.
- **B3 Full quality**: a composite of profitability, cash quality, safety and stability. It also answers the open question of how much the lite quality book (A3) misses.

**Not drafted, with reasons.**
- *Value on EBIT/EV or cash-flow yield.* The EBIT/EV yield is already half of B1, and A2 already covers cheapness. A separate book would mostly repeat them.
- *Compounder Seed.* It needs free-float market cap, which the desk does not hold. Free cash flow is available (capex is present for 395 of 403 non-financial names) but the rule cannot be written without the float figure.
- *US versions.* Measured on the 13 Nov US table, of 416 non-financial names only 221 have operating EBIT and 134 have a return on capital, so Magic Formula would rank a third of the universe. B2 and B3 could be tried in the US later (balance sheets exist for 377), but the US is a confirmation market (C-179) and I would not build any US Batch B before an India result exists.

## What is the same as Batch A (shared terms)

Universe: the top 500 by 20-session median traded value. Non-financial names only (the A0 financial flag). Equal weight, at most 20 names at 5%. Signal on a close, fill at the next open (C-139). Monthly review with the top-40 stay rule; 25% long-hold stop; after a stop-out the slot stays in cash until a later monthly review. India costs (tiers) and the cash rate as the other books. Comparator for pass and kill: **Nifty 500** (the Quality 30 fund failed the replacement test, so the Nifty 500 is the fallback under D2). The verdict reads the yardstick only; the equal-weight line on each card is for diagnosis. A name with any needed figure missing is **not scored** (never read as zero) and the count of such names is shown on the card. One registered replay per book, labelled as in Batch A (seen price period, survivor bias, zero cash, monthly top-500 rebuild); balance-sheet depth before about 2023 is thinner, so the replay window is set by what the measured depth supports and stated on the result, not promised here.

## B1. Magic Formula

**Question.** Does buying the names that are both cheap on operating profit over enterprise value and earn a high return on capital beat the Nifty 500?

**Figures (all from the A0 table, India).**
- Earnings yield = TTM operating EBIT / enterprise value, where enterprise value = market cap + borrowings - cash (latest balance sheet).
- Return on capital = TTM operating EBIT / (net working capital without cash and short debt + fixed assets), as built in A0.
- Skip a name if EBIT is not positive, the enterprise value is not positive, or the return-on-capital base is not positive.

**Rule.** Rank the eligible names on earnings yield (1 = highest) and on return on capital (1 = highest). Combined rank = the sum. Lowest sum first; ties go to higher traded value. Hold the top 20 at 5%. Monthly review with the top-40 stay rule.

**Measured (13 Nov 2026 India table):** 391 of 403 non-financial names have an enterprise value and 393 a return-on-capital figure.

**Expected before the first signal:** a book heavy in capital-light and in cyclical names; it will often look like the A2 value book with a quality tilt. Overlap with A2 and A3 is reported on the first read, not gated.

**Variant (not run):** exclude utilities. Decision B1-1 below.

## B2. Piotroski F-score

**Question.** Among cheap-on-book names, do those with improving financial health do better than the Nifty 500?

**Candidates.** Non-financial names with positive equity. Book-to-market = equity / market cap. Take the highest 30% by book-to-market (about 120 names).

**The nine tests (1 point each).** Each uses the latest balance sheet against the one a year earlier (A0 `bs` and `bsPrev`), TTM profit against the TTM a year earlier, and the latest fiscal year's operating cash flow:
1. Profitability: TTM PAT / total assets > 0.
2. Cash flow: latest fiscal-year operating cash flow > 0.
3. Improving return: TTM PAT / assets now > the same a year earlier.
4. Accruals: fiscal-year operating cash flow > fiscal-year PAT.
5. Leverage: borrowings / assets now < a year earlier.
6. Liquidity: current assets / current liabilities now > a year earlier.
7. No dilution: shares not more than 2% above the year-ago (split-rolled) count.
8. Margin: TTM operating EBIT margin now > a year earlier. **Substitution:** the original test uses gross margin; the filings carry no cost of goods sold, so operating margin stands in. Decision B2-1.
9. Turnover: TTM revenue / assets now > a year earlier.

A name missing any figure for any test is not scored.

**Rule.** Among candidates, buy those scoring 8 or 9, highest score first, then highest book-to-market; fewer than 20 qualifying names means fewer positions and the rest in cash. Monthly review: a held name stays while its score is 6 or more and it remains in the cheapest 40% by book-to-market. 8-or-9 and 30% are the figures in Piotroski's paper, used as written.

**Known limit.** The tests mix bases: balance sheets are as of the latest and the year-earlier balance-sheet date, profit is trailing twelve months, cash flow is the fiscal year. This is stated on the card.

**Measured (13 Nov 2026):** balance sheets with the needed lines exist for 402 of 403 non-financial names, a year-earlier balance sheet for 399, fiscal-year operating cash flow for 395, and a year-ago share count for 383. The count with all nine tests computable is measured on the first table build and shown on the card.

## B3. Full quality

**Question.** Does a quality ranking that uses cash and the balance sheet, not margins alone, do better than the lite version (A3) and the Nifty 500?

**Five measures (non-financial names, all five required).**
1. Return on capital (as B1).
2. TTM operating EBIT margin.
3. Cash quality = latest fiscal-year operating cash flow / total assets.
4. Safety = net debt / TTM operating EBIT (net cash counts as best; EBIT not positive means not scored).
5. Stability = the lower standard deviation of quarterly operating EBIT margin over the last 12 stored quarters (needs at least 8).

**Rule.** Convert each measure to a percentile rank within the eligible names (higher is better, stability and safety reversed). Score = the average of the five percentiles. Hold the top 20 at 5%. Monthly review with the top-40 stay rule.

**Comparison with A3, descriptive.** On the first read, the rank correlation between B3 and A3 over the names both score, and the overlap of the two holdings. This answers how much the lite book misses. It is a report, not a gate.

**Known limit.** The five measures and equal weights are my proposal, not a published formula (QMJ needs gross profit, which is not held). It is the most owner-dependent block here. Decision B3-1.

## Decisions for the owner

| Id | Decision | My suggestion |
|---|---|---|
| B-1 | Which blocks to adopt: any of B1, B2, B3 | B1 and B3 first; B2 after, because it needs the most care with mixed bases |
| B-2 | India only for now (no US Batch B) | Yes |
| B1-1 | Exclude utilities from Magic Formula (Greenblatt does) | Yes if the industry map names them; the count is shown |
| B2-1 | Operating margin in place of gross margin for test 8 | Yes, labelled on the card |
| B3-1 | The five measures and equal weights for full quality | Accept as written, or name the changes |
| B-3 | Start date | After the replays are read and the data is checked, as Batch A did |
| B-4 | Replay | One registered run per book, labelled; no tuning |

These are proposals. A block is Adopted only when the owner marks it so. Each adopted book adds to the count of rules tried (counted once across both markets, C-179), recorded on adoption.

## Build order after sign-off

1. Pure signal modules for each adopted block in `src/engine/` with unit tests. 2. One settings entry each in `settings/first-wave-books.json`; registry and card through the existing views. 3. One registered replay per book. 4. C-rows and Test Register rows. Nothing is built before adoption.

## Log

- 14 Nov 2026: drafted after the owner asked to proceed with the strategies not yet started. Data coverage measured on the 13 Nov tables (India and US); nothing built.
