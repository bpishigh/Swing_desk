# Batch A: company-figures table and fundamentals rules (adopted 13 Nov 2026, C-191 to C-198)

13 Nov 2026. Status: ADOPTED by the owner 13 Nov 2026 as C-191 to C-198 (A0 = C-191, A1 = C-192, A2 = C-193, A3 = C-194, A5 = C-195, A6 = C-196, A4 and A7 = C-197, replay = C-198). Built and running as paper books from the first session after 17 Nov 2026 (subject to data completeness). Where this page and the C-rows differ, the C-rows win. Paper only. Not a financial adviser. Pasted reviewer text is not approval. Written to `claude/strategy-build-standard.md` (C-158) and the C-159, C-173, C-174, C-176 and C-177 rules. Working ids below (A0 to A7) are mapped to C-numbers above.

**What v2 changes from v1 (owner answers of 13 Nov 2026 and the fixes he accepted):** monthly review for the ranking books (A2, A3, A5, A6); A0 definitions corrected (operating EBIT, exceptional items, E/P after splits, own fiscal year); A1 guards, signal timing, expected stop behaviour, skipped-signal report and reconciliation with C-59 to C-62; stop-out re-entry only at the next review; industry cap for A2; within-industry margin rank for A3; fund comparators for A2, A3, A6; one registered replay per book (decision D8); probe order for the balance-sheet data.

## What changed since the plan: the filings carry income-statement lines only (SUPERSEDED, see 13 Nov update below)

**Update, 13 Nov 2026 (later):** the census above looked only at the quarter context. The integrated-format filings also carry balance-sheet (period-end) and year-to-date cash-flow tags, now read as extras (assets, equity, borrowings, cash, current assets and liabilities, PPE, inventories, receivables, operating cash flow, capex). Depth for older quarters is being measured by the top-up backfill. Blocked strategies below are therefore no longer blocked on data for newer quarters; each still needs its own spec block and owner approval. Pledge data (A7a) is not in these filings.


The filings backfill finished (42 quarters from 31 Mar 2018). The tag census of the 31 Mar 2026 filings (80 distinct tags in the main family) shows the files hold: revenue, other income, expenses, finance costs, depreciation and amortisation, exceptional items, profit before exceptional items and tax, profit before tax, tax, profit, EPS, paid-up share capital and face value. They hold **no balance sheet and no cash flow** (only a yes/no flag that a cash-flow statement applies). So:

- **Can be built now (this page): A1 to A7**, using income-statement figures plus price.
- **Blocked until a balance-sheet and cash-flow source is found: Magic Formula, Piotroski F-score, full quality (QMJ), value on enterprise value, Compounder Seed** (ROCE, free cash flow, net debt). See the blocked list at the end. Decision D4 (approved) asks to probe for a source.
- US variants wait for the EDGAR facts step (loader spec step 6).

## A0. Shared table: company figures as of a date (the "fundamentals feature table")

Not a strategy: no book, no UI tab, one quiet data-health line already exists on Reference.

**Question it answers.** For a company and a signal date t, which income-statement figures and ratios did the market know at t, on one consistent basis, with every unusable case marked missing?

**Files (stem `fundamentals`).** Pure module `src/engine/fundamentals-asof.ts` (built on `filings-asof.ts`, no file or clock access); nightly job `scripts/build-fundamentals.mjs` writes `data/india/fundamentals/latest.json` for the eligible names on the latest signal date; tests `test/fundamentals-asof.test.ts`; DATA_SOURCES rows for filings (already registered) and the unadjusted close.

**Fields per name at t** (each carries `asOf` and basis; missing is null, never zero):

| Field | Definition |
|---|---|
| Quarter figures | revenue, other income, finance costs, depreciation, exceptional items, profit before exceptional items and tax (PBT-pre), profit before tax (PBT), profit (PAT), EPS, for the last 12 stored quarters, original filings only (C-157) |
| Fiscal-year figures | each company's own fourth quarter's year-to-date column (not March for everyone, not a sum of quarters) |
| TTM (trailing twelve months) | sum of the latest 4 consecutive quarters on one basis; null if a quarter is missing or the basis changed |
| Operating EBIT | PBT-pre plus finance costs minus other income (so treasury and investment income do not inflate it); null for financials, see below |
| Margins | operating EBIT margin and PBT-pre margin, TTM |
| Interest cover | TTM operating EBIT over TTM finance costs, capped at 20; zero finance cost reads as 20 |
| Growth | TTM revenue and TTM PBT-pre against the same TTM one year earlier (needs 8 quarters); 3-year revenue CAGR (needs 16); suppressed after a structure event per C-157. Growth and margins use figures before exceptional items |
| Shares | paid-up capital over face value as last filed, rolled forward by the ratio of any split or bonus effective since that filing (from corporate-action history); flagged when it moves more than 2% between filings for any other reason |
| Market cap and E/P | unadjusted close at t times rolled-forward shares; E/P is TTM PAT over market cap. PAT does not change with a split, so no split nulls are needed. E/P is null when exceptional items exceed 25% of TTM PBT (a one-off would make the name look cheap or dear) |
| Financial flag | set for bank, insurer and NBFC families: revenue is total income and finance cost is an operating cost, so revenue, operating EBIT and interest cover are not comparable; strategies that use them skip financial names |

**Start.** TTM from the 4th stored quarter (results filed early 2019), growth from the 8th (early 2020), 3-year CAGR from the 16th (early 2022). Strategies read a quarter only if at least 90% of the eligible names have the fields it needs (loader spec section 7); the count of names left unranked is shown beside every list.

**Not decided here.** Nothing is scored. The table never fills gaps.

## Shared terms for A1 to A6

Same as `claude/first-wave-rules-draft.md` unless a block says otherwise: signal on a close, fill at the next open (C-139), tiered costs, equal weight, at most 20 names at 5% each, cash credited at the liquid-fund rate (C-175), monthly scorecard with confidence figure (C-177), kill line (C-174), four reported benchmark lines (Nifty 200, Nifty 500, the monthly twin, the Momentum 30 fund). Books start on the first signal close after the owner freezes the block.

- **Universe (D1, yes).** The 500 highest names by 20-session median traded value (price at least Rs 20, at least 260 sessions, median traded value at least Rs 5 crore).
- **Comparator for pass and kill (C-176, D2 amended).** A1 and A5: the Nifty 500 (A1 also reports its average exposure). A2: the Nifty 500 Value 50 index fund. A3 and A6: the Nifty 200 Quality 30 index fund. The fund in each case is chosen by the C-159 replacement test (total TER no higher than the self-run cost, assets at least Rs 500 crore, record at least 3 years, tracking difference no worse than -1.0% a year over 3 years). As of 13 Nov the desk's fund file shows only one Value 50 fund with a 3-year record (UTI) and Quality 30 funds that are listed for cost but not scored; assets and tracking difference have not been checked. If no fund passes, the comparator falls back to the Nifty 500 and the scorecard says so. The stopped parent stays a reported line.
- **Review (monthly).** Ranking books (A2, A3, A5, A6) review on the first session of each month. A held name stays while it is still in the top 40 of its ranking (or still passes its screen), which keeps turnover low. Fundamentals change only after results, so most months change little.
- **Long-hold stop.** 25% trailing on closes, sold at the next open, 5% per name cap (C-159). **After a stop-out** the name is re-entered only at a later monthly review where it qualifies again, and its slot stays in cash until that review (it is not refilled mid-month). This clarifies the C-159 wording "re-entry on the next valid signal" for ranking books; it needs the owner's yes at adoption.
- **Industry labels** come from `data/india/segments.json`.

## Books

### A1. Post-earnings drift (India)
Question: do stocks with a large positive earnings surprise keep drifting up for about 60 sessions? Surprise (SUE): this quarter's EPS minus the EPS four quarters earlier, divided by the standard deviation of that difference over the previous 8 quarters (at least 6 values needed, so first scores about 2021). Guards: same basis; no structure-event flag; share count within 2% of the year-ago quarter; insurers have no EPS and are not scored; skip the quarter if exceptional items exceed 25% of its PBT or of the year-ago quarter's PBT; the EPS change must be at least 0.5% of the close (so a very steady company cannot score on a trivial change). Signal: SUE at least 2.0 and TTM PAT positive. **Timing:** the signal is the close of the session date on which the filing was broadcast (a filing broadcast after the close signals at that night's run and fills at the next open; a filing broadcast during the day also signals at that day's close). More signals than free slots: highest SUE first, and the number skipped for lack of a slot is shown on the scorecard (results cluster in a few weeks, so the 20 slots will fill early in each season). Hold 60 sessions, then exit at the open. Up to 20 names at 5%. Stop: short-hold rule (tighter of 3 x ATR(20) and 8%; wider signals go on the stop-too-wide list). **Expected stop behaviour, stated before the first signal:** the drift being tested is a few percent over 60 sessions, and a trailing stop near 5% on a stock that has just gapped will fire often, so many names are expected to be stopped out early and the book is closer to a short-lived momentum trade with a tight stop than to a 60-session hold; that is an expectation to check, not a result. Results-day volume against its 20-session average and the results-day reaction against the market are logged on every signal, not gated.

**Reconciliation with C-59 to C-62.** Those rows tested price behaviour around results (run-up into results, reaction-day filters), never EPS surprise, so A1 neither repeats nor contradicts a registered result. What they found is a prior: the top run-up third showed about +0.45 points over the market after costs in 20 sessions (C-59), flat or negative in 2025 and 2026; the only filter that added anything was a strong reaction on the results day (C-60, C-62, narrowly failed); volume, delivery, trend and range filters did not help. A1 should therefore be expected to be weak, and the logged reaction is the one split worth reading later. C-61 (forward test of run-up plus reaction, running since 19 Oct 2026) can hold the same names; the two books are reported separately and their overlap is shown.

Evidence: borrowed, strong in US data (Ball and Brown 1968; Bernard and Thomas 1989), India unknown; surprise is measured against the company's own history, not analyst consensus, which the desk does not have. Variants: 20-session hold; require a reaction of at least +4% on the results day. Rejects it: kill line, or the owner at a monthly read.

### A2. Value-lite: cheapest earnings yield (India)
Question: does holding the cheapest names on earnings yield beat the index? Rank by E/P (A0), highest first, among names with positive TTM PAT and a non-null E/P. Hold the 20 cheapest, **at most 5 per industry** (skip down the ranking past a full industry), monthly review with the top-40 stay rule, long-hold stop with the stop-out rule above. Financials are included (E/P is meaningful for banks). Expected: the list leans to cyclicals and low-growth names even with the cap; value traps are a known risk and the stop is the only guard. Comparator: the Nifty 500 Value 50 fund (see shared terms). Borrowed evidence: value premium (Asness, Moskowitz and Pedersen 2013; IIMA factor library about 6% a year in India); this is one measure, not the full B/M, EBIT/EV and cash-flow-yield family. Variants: operating EBIT over market cap on non-financials; top 30 names at 3.3%. Rejects it: kill line, or the owner.

### A3. Quality-lite: profitability and stability (India)
Question: do the most profitable, steadiest, least indebted-looking companies beat the index? Universe: non-financial eligible names. Score: equal-weighted percentile ranks of (1) TTM operating EBIT margin, **ranked within industry where the industry has at least 5 eligible names, otherwise across the whole list** (so margin does not just pick high-margin industries), (2) stability: lowest standard deviation of quarterly operating EBIT margin over 12 quarters (at least 10 needed), (3) TTM interest cover, (4) 3-year revenue CAGR. A name needs all four. Hold the top 20, monthly review with the top-40 stay rule, long-hold stop. This is **half of a full quality score**: it has no return on capital, no gross profit over assets, no cash earnings, no debt level, because those need balance-sheet data. Interest cover is a stand-in for leverage. Comparator: the Nifty 200 Quality 30 fund (a full-factor fund, so the lite version faces a harder test than it is built for). Borrowed evidence: Asness, Frazzini and Pedersen 2019 and Novy-Marx 2013 for the full factor; IIMA 2022 reports QMJ alpha in India; George and Kayal 2026 find it negative after COVID; the Nifty200 Quality 30 index lagged Nifty 200 over five years to Aug 2026. The lite version is not the tested factor. Variants: drop growth; top 30 at 3.3%. Rejects it: kill line, or the owner. When balance-sheet data arrives, a full version is a new block, not a silent change.

### A4. Graham-lite screen (India), logged, not a book
Passers: TTM P/E at most 15 (E/P at least 6.7%), positive PAT in every fiscal year stored (FY2019 on, at most 8 years; Graham's 10 is impossible), non-null E/P, non-financial. P/B, current ratio and size tests are dropped (no balance sheet); a dividend-every-year test is added only if the corporate-action history proves to carry dividends (to confirm). Output: the nightly list of passers with their P/E, written to the fundamentals file; no paper book, no UI tab, no start. Evidence C (Lutey and Mukherjee 2023), overlaps A2 heavily. The owner may promote it to a book at any monthly read.

### A5. Fallen and rebuilding (India), Candidate B
Question: do stocks that fell hard, are now profitable, growing and near their highs keep compounding? Conditions on the signal date: maximum peak-to-trough fall of at least 50% inside the last 1,260 sessions; TTM PAT positive; TTM revenue growth above 15% against the year-earlier TTM; close at least 75% of the 52-week high; TTM interest cover at least 3 (stand-in for low leverage); non-financial. Rank passers by TTM revenue growth; hold up to 20 at 5%. Monthly review with the top-40 stay rule (a held name stays while it still passes; there is no fixed one-year hold), long-hold stop with the stop-out rule. Comparator: the Nifty 500. Weakest evidence in the universe document (side cohort only; no Indian study); the leverage proxy is weaker than a debt ratio. Variants: growth threshold 25%; drop the interest-cover condition. Rejects it: kill line, or the owner.

### A6. Consistent compounder, lite (India)
Question: do companies that held profitability and growth in each of the last four years keep outperforming? All must hold: operating EBIT margin at least 10% in each of the last 4 fiscal years (each company's own year); revenue higher than the year before in each; PAT positive in each; TTM interest cover at least 4; non-financial. These thresholds are written once here and not tuned. Rank passers by 3-year revenue CAGR; hold up to 20 at 5%, monthly review with the top-40 stay rule, long-hold stop. First scores about 2022 (needs FY data). A low-debt condition beyond interest cover and a cash-conversion condition need balance-sheet and cash-flow data and are not applied. Comparator: the Nifty 200 Quality 30 fund. Evidence C (vendor studies such as Marcellus, directional only). Variants: margin floor 15%; top 30 at 3.3%. Rejects it: kill line, or the owner.

### A7. Forensic and dilution flags (India), flags only
Written nightly for every eligible name as information; no book, no filter on any book, no start. Flags: (a) promoter pledge above 5% of promoter holding, or rising over 4 quarters (from the shareholding filings; field availability to confirm); (b) dilution: share count up more than 5% over 4 quarters after removing split and bonus effects; (c) exceptional items above 25% of TTM PBT; (d) profit without sales: TTM PAT up more than 20% while TTM revenue fell. Not built: auditor events (no source), profit against cash flow, Beneish and Altman (need balance-sheet data). Using a flag to exclude names from a book is a separate, later owner decision, taken as a filter with a no-filter twin as C-165 did. Evidence: pledge exclusion A/B in several Indian panels; dilution and accruals A in US data; thresholds here are set in writing, not tuned.

## Replay (decision D8, owner yes)

The filings from 2018 have not been used to select any of these rules, so they are not spent data. One registered run per book (A1, A2, A3, A5, A6), on 2021 to 2026 (A1 from its first SUE scores; A3 and A6 from 2022 when 3-year and four-year history exist), with the rules as written in this page after adoption, no tuning, built on `scripts/backtest-template.mjs` and the same engine functions as the live job. Report in `docs/replay/`, one Test Register row per run. Labelled on every result: (1) the 2020 to 2026 price period has been seen in other tests (C-59 to C-62 saw the results-day reactions of 2024 to 2026), so the result is not a clean out-of-sample read; (2) the backfill may lack filings for companies delisted since, so the replay can be survivor-biased. Before any run, the survivorship gap is measured: of the names in the daily price files that later vanished, the share that have filings in the store, by year. If that share is low in a year, that year is reported separately. Forward paper stays the primary evidence; the replay shows what the rules would have done and how thin the forward reads will be.

## Blocked: needs a balance-sheet and cash-flow source (decision D4, approved)

| Strategy | Missing figures |
|---|---|
| Magic Formula | enterprise value (debt, cash), return on capital (fixed assets, working capital) |
| Piotroski F-score | total assets, operating cash flow, current ratio, gross margin |
| Full quality (QMJ) | equity, assets, debt, cash earnings, gross profit |
| Value on EBIT/EV, cash-flow yield | debt, cash, operating and free cash flow |
| Compounder Seed | ROCE, free cash flow, net debt over EBITDA, free-float market cap |
| US versions of all | EDGAR facts (loader step 6) |

Probe order: listed companies file a statement of assets and liabilities and a cash-flow statement with the September and March results, so the probe first checks the other tag families and attachments in the filings for those two quarters (31 Mar and 30 Sep), then BSE equivalents, then annual-report XBRL. One-off and read-only. Open: which exist, how far back they go, and whether they can be read as of the filing date.

## Decisions (owner answers of 13 Nov 2026)

| Id | Decision | Answer |
|---|---|---|
| D1 | Universe for A1 to A6 | Top 500 by 20-session median traded value |
| D2 | Comparator for pass and kill | A1, A5: Nifty 500. A2: Value 50 fund. A3, A6: Quality 30 fund, chosen by the replacement test, Nifty 500 if none passes |
| D3 | Holding for A5 and A6 | No fixed hold: monthly review with the top-40 stay rule (owner chose monthly review over one-year cohorts) |
| D4 | Probe for balance-sheet and cash-flow data | Yes, March and September filings first |
| D5 | A1 surprise threshold and hold | SUE at least 2.0, 60 sessions, with the guards in A1 |
| D6 | A4 log only, A7 flags only | Yes |
| D7 | Start | At freeze for A2, A3, A5, A6; A1 after the C-59 to C-62 reconciliation above is accepted. **A1 reconciliation accepted by the owner, 13 Nov 2026.** |
| D8 | Replay | One registered run per book, labelled |
| D9 | Review frequency | Monthly (owner, 13 Nov) |
| D10 | After a stop-out | Re-entry only at a later monthly review; slot stays cash until then (**owner yes, 13 Nov 2026**) |

These are answers to a draft. A block is Adopted only when the owner marks it so.

## Build order after sign-off

1. A0 table and tests, then the nightly file. 2. Survivorship measure, then the replays. 3. A1, A2, A3, A5, A6 as small signal modules on the shared paper-book runner (one settings entry each), then A4 and A7 as file output. 4. Registry entries, UI through the existing views, documents per the standard. Each block gets its own monthly scorecard; the number of books and variants tried is recorded.

## Log

- 13 Nov 2026: v1 drafted after the filings backfill finished and the tag census showed income-statement figures only.
- 13 Nov 2026: v2: monthly review, reviewer fixes accepted by the owner, fund comparators, replay, A1 reconciliation with C-59 to C-62.
- 13 Nov 2026 (late): owner accepted the A1 reconciliation and said yes to the stop-out rule (D10). A0 table, A1, A2, A3, A5, A6 built and registered as paper books starting after 17 Nov. Share counts are checked against profit over EPS to catch unit errors; known miss: names whose EPS mixes pre- and post-split quarters (e.g. BAJAJFINSV).

- 13 Nov 2026 (docs): adopted; C-191 to C-198 written; pledge level added to the A7 flags from the monthly stock-facts job; Quality 30 funds checked and all fail the replacement test (comparator for A3 and A6 is the Nifty 500); UTI Value 50 passes size and record, tracking difference unverified.

## Two comparisons on every Batch A card (owner, 14 Nov 2026)

Each card reports the book against its registered yardstick **and** against the equal-weight top-500 line (same universe, monthly rebuild, price only, no costs; forward only). Both are shown side by side. The kill line is unchanged and reads the yardstick. A miss against the yardstick that still beats the equal-weight line reads as weighting, not the rule; a miss against both reads as the rule. Whether the kill line itself should change is left to a later owner decision once the equal-weight line has a few months of history.
