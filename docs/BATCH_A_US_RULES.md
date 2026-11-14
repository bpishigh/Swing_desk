# Batch A, US versions: rules (DRAFT for owner approval, 14 Nov 2026; six reviewer-derived changes applied 14 Nov at the owner's "all")

Status: DRAFT. The books are built and registered as paper books but **start only after the owner marks this page Adopted** (C-179: a US result alone adopts nothing; the US is a confirmation market for the India rules in `docs/BATCH_A_RULES.md`). Paper only. Not a financial adviser. Pasted reviewer text is not approval.

## What is the same as India

The five rules (A1 post-earnings drift, A2 value-lite, A3 quality-lite, A5 fallen and rebuilding, A6 consistent compounder lite), every threshold, the monthly review with the top-40 stay rule, the stop-out rule (slot stays in cash until a later review), the 25% long-hold stop and the short-hold stop for A1, equal weight, at most 20 names at 5%, signal on a close and fill at the next open (C-139), the monthly scorecard, kill line and confidence figure (C-174, C-177). The company-figures table is the same code (`src/engine/fundamentals-asof.ts`); only the input differs.

## What differs, and why

| Item | India | US | Why |
|---|---|---|---|
| Universe | top 500 by 20-session median traded value | the 500 highest by 20-session median dollar volume among common stocks and ADRs that pass the US sleeve list (close at least $5, 260 sessions, median dollar volume at least $20 million) | C-179 item 2 floor; 500 to match the India fundamentals books |
| Source of figures | NSE results XBRL | SEC EDGAR company facts (`data/us/facts`, parser `src/ingest/edgar-facts.ts`) | C-157 step 6 |
| Quarter | filed quarters | filed 10-Q quarters; the fourth quarter is the 10-K year less the nine months (never filed on its own) | US companies file the fourth quarter only inside the 10-K |
| As-of date | broadcast time | the **filing date of the 10-Q or 10-K**, the earliest filing that reported the value (never a restatement) | the facts carry filing dates, not the earnings press release; the earnings release (8-K item 2.02) is filed on the same day or **days to weeks before** the 10-Q or 10-K, so A1's drift is measured from a later start than the market first knew. Every A1 signal gets its gap logged (`data/us/eightk-gap.json`, filled nightly on the runner) and closed trades are reported split by gap (3 days or less, longer, not found); descriptive only, no rule reads it |
| Shares | paid-up capital over face value | shares outstanding on the filing cover, face value 1 | no face value in US filings |
| Interest | finance costs | interest expense under any of seven tags; a quarter with none under any tag stays missing (never zero), so interest cover is not scored and A3, A5 and A6 leave the name out; the count of such names is shown on the cards | measured 14 Nov 2026: reading a missing figure as zero put 335 of 554 names at no debt, including AEP |
| Exceptional items | tagged | none (no separate line) so the "exceptional above 25% of PBT" guards never trigger. Instead profit is **income from continuing operations**: net income less the discontinued-operations line, and EPS from the continuing-operations tag when the company reports one (otherwise the total). No impairment guard (the tags are inconsistent; a guess would drop good names) | US filings have no such line; the continuing-operations figure removes sold-business gains from yield and from the surprise score, but impairments and one-time gains inside continuing operations still pass |
| Financial names | bank, insurer, NBFC formats | SIC groups 60 to 64 and 67 | same skip rules |
| Splits | rolled forward | bars are split-adjusted to today while the cover share count is not: a name with a split-like one-day move since its latest filing gets no market cap or yield (reason shown), as the books block such names anyway (C-179 item 9c) | no raw US prices stored |
| Costs | India tiers | US tiers (C-179 item 3) | |
| Cash | liquid fund rate | 3-month Treasury yield (C-179 item 7) | |
| Comparator | Nifty 500 (A2: the UTI Value 50 fund) | **SPY** for A1, A3, A5, A6; **VLUE** (iShares MSCI USA Value Factor) for A2; price only (no dividends, so value ETFs look slightly worse than they are) | a value book against the plain index mixes a style bet with the rule; C-137 item 8 for SPY |
| Reference lines on every Batch A card (India and US) | none | **equal-weight top 500** (the book's own universe, rebuilt monthly, price only, no costs; forward only from the first night the book runs), **VLUE and QUAL** price-only lines on the US cards (QUAL is the quality comparator line for A3 and A6; shown on all five, comparator only for A2) | reported so a gap to a cap-weighted comparator is not read as a failed rule; the kill line still reads against the registered comparator, and whether it should read against the equal-weight line is a separate owner decision |
| Stop-out industry | segments.json industry | SIC two-digit group | same field as C-180 |
| Pledge flag | from the stock-facts file | none | no US source |
| A1 share rule | skip if the share count moved more than 2% either way | skip only if it rose more than 2% | see Known limits |
| Replay | one registered run per book | **none** | the desk's US price history holds only names still trading (survivor-only), so a replay would flatter every book; forward paper is the evidence |

Both comparisons apply here too: the yardstick (SPY or VLUE) and the equal-weight line are shown together on each card; the kill line reads the yardstick.

## Known limits

- **A1 share rule differs from India:** a US name is skipped only when its cover share count rose more than 2% from the year-ago quarter (new issuance); a fall (buybacks) does not skip it. Measured 13 Nov: 107 names scored against 69 under India's two-sided rule. Cover counts differ from weighted counts by a few percent, so the two-sided rule drops too many US names. This is the one place the US A1 is not the India A1, so a US result confirms the signal, not that exact rule.
- Names with no interest-expense figure (195 non-financial names of the 500, 13 Nov) are left out of A3, A5 and A6; the count is shown on those cards.
- The continuing-operations change needs a full refetch of the facts (workflow `backfill-us-facts`, not the incremental run) before it shows in the table.
- A name whose facts sit under a former registrant number has a short record and is left unranked (Exxon, as of the 13 Nov test).
- US prices before the books start are not part of any test here.

## Decision

Mark this page Adopted to start the five US books (the first signal comes on the first session close after the owner's date), or ask for changes. Until then the books are listed as paper-only, waiting.
