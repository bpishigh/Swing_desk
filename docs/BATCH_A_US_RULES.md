# Batch A, US versions: rules (DRAFT for owner approval, 14 Nov 2026)

Status: DRAFT. The books are built and registered as paper books but **start only after the owner marks this page Adopted** (C-179: a US result alone adopts nothing; the US is a confirmation market for the India rules in `docs/BATCH_A_RULES.md`). Paper only. Not a financial adviser. Pasted reviewer text is not approval.

## What is the same as India

The five rules (A1 post-earnings drift, A2 value-lite, A3 quality-lite, A5 fallen and rebuilding, A6 consistent compounder lite), every threshold, the monthly review with the top-40 stay rule, the stop-out rule (slot stays in cash until a later review), the 25% long-hold stop and the short-hold stop for A1, equal weight, at most 20 names at 5%, signal on a close and fill at the next open (C-139), the monthly scorecard, kill line and confidence figure (C-174, C-177). The company-figures table is the same code (`src/engine/fundamentals-asof.ts`); only the input differs.

## What differs, and why

| Item | India | US | Why |
|---|---|---|---|
| Universe | top 500 by 20-session median traded value | the 500 highest by 20-session median dollar volume among common stocks and ADRs that pass the US sleeve list (close at least $5, 260 sessions, median dollar volume at least $20 million) | C-179 item 2 floor; 500 to match the India fundamentals books |
| Source of figures | NSE results XBRL | SEC EDGAR company facts (`data/us/facts`, parser `src/ingest/edgar-facts.ts`) | C-157 step 6 |
| Quarter | filed quarters | filed 10-Q quarters; the fourth quarter is the 10-K year less the nine months (never filed on its own) | US companies file the fourth quarter only inside the 10-K |
| As-of date | broadcast time | the **filing date of the 10-Q or 10-K**, the earliest filing that reported the value (never a restatement) | the facts carry filing dates, not the earnings press release; the press release (8-K) is usually the same day to a few days earlier, so A1's drift is measured from a slightly later start than the market first knew |
| Shares | paid-up capital over face value | shares outstanding on the filing cover, face value 1 | no face value in US filings |
| Interest | finance costs | interest expense under any of seven tags; a quarter with none under any tag stays missing (never zero), so interest cover is not scored and A3, A5 and A6 leave the name out; the count of such names is shown on the cards | measured 14 Nov 2026: reading a missing figure as zero put 335 of 554 names at no debt, including AEP |
| Exceptional items | tagged | none (no separate line) so the "exceptional above 25% of PBT" guards never trigger | US filings have no such line; this makes A1 and A2 slightly more exposed to one-offs than India |
| Financial names | bank, insurer, NBFC formats | SIC groups 60 to 64 and 67 | same skip rules |
| Splits | rolled forward | bars are split-adjusted to today while the cover share count is not: a name with a split-like one-day move since its latest filing gets no market cap or yield (reason shown), as the books block such names anyway (C-179 item 9c) | no raw US prices stored |
| Costs | India tiers | US tiers (C-179 item 3) | |
| Cash | liquid fund rate | 3-month Treasury yield (C-179 item 7) | |
| Comparator | Nifty 500 (A2: the UTI Value 50 fund) | **SPY** for all five, price only (no dividends) | the desk has no US value or quality fund series; SPY is the plain US index (C-137 item 8) |
| Stop-out industry | segments.json industry | SIC two-digit group | same field as C-180 |
| Pledge flag | from the stock-facts file | none | no US source |
| Replay | one registered run per book | **none** | the desk's US price history holds only names still trading (survivor-only), so a replay would flatter every book; forward paper is the evidence |

## Known limits

- Share counts from a cover can differ from the quarter's weighted count by 1 to 3% (buybacks), so A1's rule that the share count be within 2% of the year-ago quarter will drop more US names than India names; the nightly coverage line shows how many names have a surprise score.
- A name whose facts sit under a former registrant number has a short record and is left unranked (Exxon, as of the 13 Nov test).
- US prices before the books start are not part of any test here.

## Decision

Mark this page Adopted to start the five US books (the first signal comes on the first session close after the owner's date), or ask for changes. Until then the books are listed as paper-only, waiting.
