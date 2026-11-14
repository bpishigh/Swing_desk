# Batch B: balance-sheet and cash-flow books, India (v2, 14 Nov 2026)

Status: **B1 Magic Formula ADOPTED by the owner 14 Nov 2026 as C-205**, on the terms below. **B2 Piotroski and B3 Full quality are revised drafts** (the owner's changes of 14 Nov applied) and are not adopted until the owner marks them. Paper only. Not a financial adviser. Pasted reviewer text is not approval. Written to `claude/strategy-build-standard.md` (C-158) and C-159, C-173, C-174, C-176, C-177. India only; the books start after their replays are read (the owner's rule). Where this page and the C-rows differ, the C-rows win.

**What v2 changes from v1 (owner answers of 14 Nov):** B1 adopted with liquid investments counted as cash, lease liabilities stated as a known limit, working capital floored at zero, utilities excluded. B2 moved to the fiscal year for all nine tests, with the count of 8-or-9 scorers measured and the card expectation stated. B3 rebuilt as A3 with three named changes so the pair comparison is clean. Replay window rule fixed in advance. Parser depth checked.

## What is left out

- **Compounder Seed:** parked by the owner. My earlier reason (no free-float figure) was weak, because promoter holding from the shareholding filings gives a usable free-float estimate (DATA_SOURCES row I5). It stays parked pending the read of the base-rate studies C-170 and C-171 (both were run once on 12 Nov; report `docs/replay/C170-C171-REPORT.md`).
- **Value on EBIT/EV or cash-flow yield:** agreed as written: EBIT/EV is half of B1 and A2 covers cheapness.
- **US versions of Batch B:** agreed as written. Measured on the 13 Nov US table, of 416 non-financial names 221 have operating EBIT and 134 a return on capital. The US is a confirmation market (C-179) and no US Batch B is built before an India result.

## Shared terms (all Batch B books)

Universe: the top 500 by 20-session median traded value; non-financial names only (the A0 financial flag). Equal weight, at most 20 names at 5%. Signal on a close, fill at the next open. Monthly review with the top-40 stay rule; 25% long-hold stop; after a stop-out the slot stays in cash until a later monthly review. India costs and cash rate as the other books. **Pass and kill read the Nifty 500** (cap-weighted, held as the owner would hold it); the equal-weight top-500 line on each card is for diagnosis only and carries no ahead-or-behind figure. Names missing a needed figure are not scored (never read as zero) and the count of unranked names is shown on the card. Hold-out of the replay and start: one registered replay per book, labelled **an implementation check, not evidence** (a window from late 2022 is about four years in one market phase), then the books start.

**Replay window rule (fixed now, before any replay is run).** A month enters a book's replay only if at least 90% of the eligible non-financial names in that month's top 500 carry every figure that book needs (the same 90% rule as Batch A, loader spec section 7). The window starts at the first such month and ends at the last stored session. The start is whatever that rule gives; it is not chosen from results.

**Comparator note.** The Nifty 200 Quality 30 fund fails the desk's replacement test (C-159: total cost no higher than the self-run cost, assets at least Rs 500 crore, a record of at least three years, tracking difference no worse than -1.0% a year over three years). The funds checked on 13 Nov fail it (see STATUS), so the Nifty 500 is the comparator under D2's fallback.

## What the data allows (checked 14 Nov 2026)

- **Balance sheets exist only from the September 2022 results.** For 31 Mar 2022 and earlier, the stored filings carry cash-flow figures but no balance sheet. A tag probe of the older quarterly files for Sep 2021 (49 files, `data/probe-bs-tags.json`) found no balance-sheet tags at all, and the half-yearly list (`data/probe-bs-halfyear.json`) holds only the annual files, which also carry no balance sheet. **So the gap is the source, not our parser.** The window cannot be doubled by fixing the parser. A different source (annual-report XBRL) is not probed and not assumed.
- From Sep 2022 on, about 99% of the March and September filings carry the balance sheet and cash flow (for example 3,154 of 3,227 at Mar 2023, 4,940 of 4,970 at Mar 2026).
- Consequence: B1 and B3 can score from about December 2022 (the first filings with a balance sheet). B2 on a fiscal-year basis needs two consecutive fiscal-year balance sheets (Mar 2023 and Mar 2024) and so scores from about mid-2024: a window of about two and a half years, which is thin and labelled so.
- **Current investments:** the tag `CurrentInvestments` is present in 49 of 50 sampled filings (Sep 2025 and Mar 2026), with `BankBalanceOtherThanCashAndCashEquivalents` alongside. Until 14 Nov the table counted only cash and cash equivalents. Built 14 Nov (A0): cash for net debt, enterprise value and working capital is now cash and cash equivalents plus bank balances other than cash equivalents plus current investments. The tag does not separate liquid funds from bonds or equity holdings in current investments, so some of that line is not truly liquid; stated as a limit. Stored balance sheets carry the new lines only after a re-read (`--rebs`, running for the March and September periods Sep 2022 to Sep 2026); a balance sheet not yet re-read is marked `cash only` and B1 does not score that name.
- **Lease liabilities:** none of the 50 sampled filings carries a lease-liability tag (the tags checked were all balance-sheet lines matching Lease, Invest, Cash, Bank, Borrow, Deposit, Equity, Assets). Enterprise value therefore excludes leases. Known limit, written on the card: retailers, restaurants, airlines and similar names look cheaper and more capital-light than they are.

## B1. Magic Formula (ADOPTED, C-205)

**Question.** Does buying names that are both cheap on operating profit over enterprise value and earn a high return on capital beat the Nifty 500?

**Figures (A0 table, India).**
- Earnings yield = TTM operating EBIT / enterprise value, where enterprise value = market cap + borrowings - (cash and cash equivalents + other bank balances + current investments).
- Return on capital = TTM operating EBIT / (net working capital + fixed assets), where net working capital = current assets excluding that same cash-like pool, less current liabilities excluding short-term borrowings, **floored at zero** (so a name with negative working capital still scores on its fixed assets, the usual reading of Greenblatt). The name is skipped only if the capital base is still not positive.
- Skipped: financial names; the industry labelled Power in the desk's industry map (utilities; gas distribution sits under Oil Gas and Consumable Fuels and is not excluded, a limit); operating EBIT or enterprise value not positive; a balance sheet not yet re-read with the new lines.

**Rule.** Rank the eligible names on earnings yield and on return on capital (1 = highest). Combined rank = the sum. Lowest first; ties go to higher traded value. Hold the top 20 at 5%; monthly review with the top-40 stay rule.

**Known limits, printed on the card.** No lease liabilities in the filings. Current investments are not all liquid. Utilities are matched by the desk's industry label, not a full classification. Overlap with A2 and A3 is reported at the first read, not gated.

**Built 14 Nov 2026** (`src/engine/batch-b.ts`, `test/batch-b.test.ts`; book `bb-b1-magic` in `settings/first-wave-books.json`). The start date is a placeholder (`2099-12-31`) until the replay is read; then the owner's rule applies and the real date is set.

## B2. Piotroski F-score (revised draft, not adopted)

**Question.** Among cheap-on-book names, do those with improving financial health do better than the Nifty 500?

**All nine tests use fiscal-year figures,** as in Piotroski's paper: the latest fiscal-year-end balance sheet against the one a year earlier, and the latest fiscal year against the year before. This removes the mixed-bases limit of v1. The score changes once a year (when the fiscal-year results are filed); membership still moves monthly because book-to-market moves with price.

**Candidates.** Non-financial names with positive equity. Book-to-market = fiscal-year-end equity / current market cap. Take the highest 30% by book-to-market.

**The nine tests (1 point each).**
1. ROA > 0: fiscal-year profit / fiscal-year-end total assets. (The paper divides by beginning-of-year assets, which would need a third balance sheet and would push the first score later still.)
2. Operating cash flow > 0.
3. ROA higher than the year before.
4. Operating cash flow > profit.
5. Borrowings / assets lower than the year before.
6. Current ratio higher than the year before.
7. No new shares: fiscal-year-end shares not more than 2% above the prior year-end, after removing split and bonus effects with the corporate-action history. (The count below used paid-up capital as a proxy.)
8. Operating EBIT margin higher than the year before. **Substitution:** the paper uses gross margin; the filings carry no cost of goods sold. Labelled on the card (B2-1, yes).
9. Revenue / total assets higher than the year before.

A name missing any figure is not scored.

**Count of scorers, measured 14 Nov 2026** (descriptive, on the 13 Nov table; not a performance test). Of 403 non-financial names, 360 are scorable on the fiscal-year basis. Across the whole list: score 9 for 19 names, 8 or more for 58, 7 or more for 116. Within the cheapest 30% by book-to-market (104 of 347 names with equity and market cap): **score 9 for 5, 8 or more for 14, 7 or more for 35, 6 or more for 53.** The same whole-list count of 8 or more was 50 in Aug 2024 (226 scorable) and 59 in Aug 2025 (329 scorable).

**So the paper rule (8 or 9) gives about 14 names now, not 20.** That is above ten, so the owner's switch condition (usually under ten) is not met; but 14 names at 5% is about 70% invested with the rest in cash, and a part-cash book trails the Nifty 500 in any rising market, as the turn-of-month book did. Two options, decision **B2-2** below: (a) the paper rule as written, fewer than 20 names, with average exposure reported on the card as for A1; (b) a departure from the paper, written now: hold the top 20 by score among names scoring 7 or more (35 qualify), then highest book-to-market, recorded as a departure.

**Expectation for the card.** The published effect is concentrated in small, thinly followed value stocks. This universe, the 500 most traded names, is the opposite. A weak or no result is the expected one. The replay is an implementation check, and the live read is the evidence.

**Window.** First scorable about mid-2024 (see above): about two and a half years, labelled so.

## B3. Full quality (revised draft, not adopted)

**Question.** What does the lite quality book (A3) miss? B3 is A3 with three named changes, so the pair read is clean.

**B3 = A3 with exactly three changes.** A3 scores equal-weighted percentile ranks of (1) TTM operating EBIT margin, ranked within industry where the industry has at least 5 eligible names and otherwise across the list, (2) stability (lowest standard deviation of quarterly operating EBIT margin over 12 quarters, at least 10 needed), (3) TTM interest cover, (4) 3-year revenue CAGR. B3:
- **keeps** margin (same industry treatment), stability and 3-year revenue CAGR unchanged;
- **replaces** interest cover with **net debt over TTM operating EBIT** (borrowings less the cash-like pool, over EBIT; net cash counts as best; EBIT not positive means not scored);
- **adds** return on capital (as B1, including the floor and the cash-like pool) and **cash quality** (latest fiscal-year operating cash flow / total assets, close to the cash-based operating profitability that Ball and co-authors, 2016, support).

Six measures, equal weight, all six required; percentile ranks across the eligible list except margin, which uses A3's within-industry treatment. Hold the top 20 at 5%, monthly review with the top-40 stay rule, same stops, same universe and the same non-financial filter as A3.

**Comparators.** B3 is read **against A3 as a pair** for the question "what does lite miss" (the monthly return difference B3 minus A3, with the holdings overlap and the rank correlation over the names both score, descriptive only), and **against the Nifty 500 for pass and kill**.

**Window.** First scorable about December 2022 under the 90% rule; the 12-quarter stability measure needs quarters that exist from 2019.

## Decisions for the owner

| Id | Decision | Status |
|---|---|---|
| B1 | Adopt Magic Formula with the four conditions above | **Adopted 14 Nov 2026 (C-205)** |
| B2-1 | Operating margin in place of gross margin | Yes (14 Nov) |
| B2-2 | Rule when fewer than 20 names score 8 or 9: (a) paper rule, about 14 names, exposure reported; (b) floor of 7, top 20 | **Open.** The measured count is 14, so (a) follows the owner's stated condition; (b) avoids the cash drag. Choose before B2 is adopted |
| B2 | Adopt Piotroski (fiscal-year basis) | Open |
| B3 | Adopt full quality as A3 plus three changes, read as a pair with A3 and against the Nifty 500 | Open |
| B-4 | Replay: one run per book, 90% window rule, labelled an implementation check | Fixed 14 Nov |

These are proposals until the owner marks a block Adopted.

## Build order

1. Done 14 Nov: A0 liquid-investment cash and the working-capital floor (unit tests), `--rebs` re-read of stored balance sheets (running), B1 signal module, tests and paper book. 2. Next: replay support for the B books with the 90% window rule, then one registered replay per adopted book once the re-read is complete. 3. B2 and B3 signal modules only after the owner marks them. 4. C-rows and register rows on each adoption.

## Log

- 14 Nov 2026: v1 drafted (three books, India only).
- 14 Nov 2026 (later): v2 after the owner's answers. B1 adopted as C-205. Probes: current investments and bank deposits are in the filings and now counted as cash; no lease line; the pre-Oct-2022 gap is the source. Piotroski scorer counts measured. B3 reduced to A3 plus three changes.
