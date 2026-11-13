# Filings Loader: specification

8 Nov 2026. Status: specification, nothing built. Implements the data rules adopted in Engine Rules C-157 and follows `docs/STRATEGY_BUILD_STANDARD.md` (C-158). Sources and their probe results are in `docs/DATA_SOURCES.md` (row ids I1 to I11, U1 to U8 below).

**What it is.** One shared loader that turns exchange filings into dated, point-in-time facts about a company, so every fundamental, ownership and event strategy reads the same numbers the same way. It is a data layer, not a strategy: it has no signals, no paper book and no UI tab of its own. Its only screen is a quiet data-health line (section 8).

**What it is not.** It does not score stocks, choose a basis for any strategy, or fill gaps. Missing stays missing.

## 1. Questions it answers

For a company `e` and a time `t`: what did the market know about `e` at `t`? That means its latest quarterly revenue, profit before tax, profit and EPS as first filed on or before `t`; its shareholding pattern and pledge as last filed on or before `t`; insider and takeover filings in a window ending at `t`; whether a structure event makes growth figures unusable at `t`. Nothing filed after `t` is ever returned.

## 2. Files and layout (one stem: `filings`)

| Piece | Path | Role |
| --- | --- | --- |
| Entity table | `data/india/entities.json` | Stable id per company, with every symbol and name it has used, successor and predecessor links, structure events. Built from I9, I10, I11. |
| Parser (pure) | `src/ingest/filings-parse.ts` | XBRL text in, list of facts out. No network, no clock. |
| Tag maps | `settings/filings-tags.json` | Per format family: which tags mean revenue, profit before tax, profit, EPS. No tag name in code. |
| As-of view (pure) | `src/engine/filings-asof.ts` | Facts in, the as-of view out: original filings only, basis choice, structure-event flag, growth suppression. |
| Fetch job | `scripts/fetch-filings.mjs` | Nightly: new filings since the last run; weekly: gap check. Writes facts, never zeros. |
| Backfill job | `scripts/backfill-filings.mjs` and a manual workflow | Walks the market-wide endpoint period by period (30 Sep 2025 and 31 Mar 2026 style `period_ended` calls). |
| Facts store | `data/india/filings/<entity-id>.json.gz` | One file per entity: results, shareholding, pledge, insider, takeover rows. Compressed, because the repo is public and the store is large. |
| US facts | `data/us/filings/<cik>.json.gz` | Same shape from EDGAR (U1 to U4). |
| Tests | `test/filings-parse.test.ts`, `test/filings-asof.test.ts`, `test/entities.test.ts` | Section 7. |
| Register | `docs/DATA_SOURCES.md` | Row status moves from Probed to Used only when the completeness check passes. |

## 3. Data shape

Every stored fact is one object: `entity`, `kind` (results, shareholding, pledge, insider, takeover), `period` (quarter end), `basis` (consolidated or standalone), `format` (the family), `fields` (revenue, pbt, pat, eps; absent fields are absent, never 0), `asOf` (exchange broadcast time, or SEC `filed`), `fetched` (date), `source` (URL), `revision` (0 for the original filing, then 1, 2, ... for later filings of the same period), `flags` (see 5).

Numbers are stored as filed (rupees, rounded as filed). Units and rounding (the XBRL files round to ten million rupees) are a property of the source and are noted in `docs/DATA_SOURCES.md`.

## 4. Entity key (C-157 rule 4)

1. A company's `entity-id` is created once and never changes. A ticker is only an attribute.
2. Links come from, in order of authority: NSE `symbolchange.csv` and `namechange.csv`; the corporate-action history (demergers, mergers, schemes); the final announcement of a vanished symbol (for example a suspension-of-trading notice) to classify why it vanished.
3. A ticker change or name change keeps the same entity. A demerger or merger creates or retires entities and a link, with the effective date, and sets a structure event (section 5).
4. Where the lists disagree, nothing is merged; the pair is listed for review. A price-continuity guess is never used to link (it produced false pairs in round 5).

## 5. Rules the as-of view enforces (C-157)

- **Basis.** Use consolidated where the company files it, else standalone. Both are stored. The chosen basis for a company changes only with a basis-break flag.
- **Revisions.** The view returns only the original filing (`revision 0`) unless a strategy asks for the revised number, and then it gets the revision's own `asOf`. A restatement is never applied backwards.
- **Structure events.** A demerger, merger, scheme of amalgamation, delisting by scheme, or a company's first consolidated filing sets a basis-break flag from its effective date.
- **Growth suppression.** Year-on-year growth is not computed until the year-ago quarter is also on the new basis: five quarters counting the event quarter. The XBRL files carry no prior-year column, so year-on-year growth always compares two filings.
- **No synthetic history.** A successor or demerged entity has no back-filled past and is not scored until it has enough filings of its own.
- **Missing is missing.** A field that cannot be read is absent and the quarter is counted in the completeness check.

## 6. Tag maps and formats

The current NSE integrated filings (31 Mar 2026, about 5,000 filings) fall into a few format families, named in each file's header comment. Real files for five of them are saved in `fixtures/filings/` (`IFIndAs`, `IFNBFC`, `IFOTB`, `IFBanking`, `IFLI`; consolidated and standalone where available), and a tag census of 633 sampled filings is in `data/filings-tag-census.json`. All use the `in-capmkt` taxonomy. `IFIndAs` is about 92% of the sample. `IFFIndAs`, `FRNBFC` and `FRBanking` appeared in earlier probes but not in this sample: they borrow the map of the family they mirror and are flagged unverified until a fixture exists. Older filings (before the integrated filing) use the `in-bse-fin` taxonomy, and round 3 found revenue and profit tags in only 21 of 49 of the oldest files.

Tag maps (confirmed against the fixtures; in `settings/filings-tags.json`):

| Family | Revenue | Profit before tax | Profit | EPS |
| --- | --- | --- | --- | --- |
| IFIndAs, IFNBFC | `RevenueFromOperations` | `ProfitBeforeTax` | `ProfitLossForPeriod` | `BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations` |
| IFOTB | `RevenueFromOperations` | `ProfitBeforeTax` | `ProfitLossForThePeriod` | same as Ind AS |
| IFBanking | `Income` (total income) | `ProfitLossFromOrdinaryActivitiesBeforeTax` | `ProfitLossForThePeriod` | `BasicEarningsPerShareAfterExtraordinaryItems` |
| IFLI (insurers) | `Income` (total income) | `ProfitLossBeforeTax` | `ProfitLossAfterTaxAndExtraordinaryItems` | none in the file (absent, not zero) |

Two contexts matter in each file: `OneD` (the quarter) and `FourD` (the year to date). The parser stores both and reads the basis (consolidated or standalone) from the file itself. Values are full rupees as filed, rounded to the file's own rounding (lakh or ten million). The parser test fails if a family has no map.

Older filings: the backfill parses back to the oldest taxonomy version that yields all four fields and reports parse coverage per quarter. Tests start at the first quarter where coverage is at least 90% of the liquid universe. Before the Ind AS switch (financial year 2016-17) figures are not comparable, so nothing is read before it (`docs/DATA_SOURCES.md`, the pre-2019 evaluation).

## 7. Tests and completeness

- Parser: one fixture file per family (real files, saved under `fixtures/filings/`), with the expected fields.
- As-of view: a fact filed after `t` is never returned; the basis choice; revision handling; suppression runs exactly five quarters; an entity link across a rename (TATAMOTORS to TMPV) keeps the history, while a demerger does not.
- Entities: ticker change keeps the id; a demerger creates a link and an event; disagreeing lists are flagged, not merged.
- Completeness: for each quarter, the share of the liquid universe with all four fields, the share with a consolidated filing, and the count of structure-event flags. A strategy may read a quarter only if its completeness is at least the floor written in the strategy's own row.
- `scripts/check-no-personal-data.mjs` passes (the facts store has no holdings or capital fields).

## 8. Quiet data-health line

One line on the Reference tab: latest filing broadcast time, latest quarter with completeness at or above 90%, and the count of entity-link disagreements awaiting review. Nothing appears elsewhere; no alert unless a fetch fails twice.

## 9. Build order

1. Parser and tag maps for the families, with fixtures; confirm the "to confirm" cells.
2. Entity table from the symbol-change and name-change lists and the corporate-action history; the review list.
3. As-of view with the C-157 rules and its tests.
4. Backfill for India results and shareholding; completeness report; set the start quarter.
5. Nightly fetch job; data-health line; register rows move to Used.
6. US facts (EDGAR) with the same view.
7. Insider (I7) and takeover (I8) rows, read through the same as-of view.

## 10. Open items

- Fixtures for the alias families `IFFIndAs`, `FRNBFC`, `FRBanking` (not in the 31 Mar 2026 sample); revenue for banks and insurers is total income, which is not comparable with revenue from operations at other companies (strategies must not mix them).
- How far back each taxonomy version parses (backfill).
- Cause classification of vanished symbols from their final announcement (a classifier is not built; the review list handles it).
- Ticker to CIK history for delisted US names (low priority; US prices are survivor-only).

## 11. Change log

- 8 Nov 2026: specification written after probe rounds 1 to 7 and C-157 to C-159.
- 8 Nov 2026: build step 1 done: parser (`src/ingest/filings-parse.ts`), tag maps (`settings/filings-tags.json`), fixtures and tests; section 6 now holds confirmed maps.
- 8 Nov 2026: build step 2 done: entity builder (`src/ingest/entities.ts`, `scripts/build-entities.mjs`), table `data/india/entities.json` (3,902 entities from price-file spans, 767 symbol-change links, 194 demerger and scheme events, 933 vanished, 4 review items) and tests. Not yet linked: a demerged company to its parent (for example TMCV has no link to the Tata Motors entity) and a merger that shows only as a vanished symbol (for example HDFC); both stay unlinked and unscored, as C-157 requires, until the vanished-symbol classifier is built. A new symbol that already traded before its change date is not linked and is listed for review.
- 8 Nov 2026: build step 3 done: the as-of view (`src/engine/filings-asof.ts`, `test/filings-asof.test.ts`): nothing filed after t is returned; original filing unless revisions are asked for (a revision carries its own date); consolidated where filed with a basis-break flag on a first consolidated filing; year-on-year growth suppressed across a basis difference and, after a demerger or scheme, until the year-ago quarter is the event quarter or later (four quarters suppressed, growth returns on the fifth counting the event quarter); missing stays null and a non-positive base gives no growth figure. No data store feeds it yet (steps 4 and 5).
- 12 Nov 2026: build step 4, parser extended and older list added. Files with no family comment (every older `in-bse-fin` file) now get the family from their tags (`inferFamily`: bank, insurer, Ind AS, other-than-Ind-AS; never from the file name); a stated family with no tag map falls back the same way (covers `IFFNonBanking`, `IFGI`-style gaps when the four tags are present) and the result carries `inferred`. Tests run on all 19 real older fixtures. The integrated list holds nothing before Mar 2025, so `scripts/backfill-filings.mjs` now reads the older market-wide list by filing window for earlier quarters. Sample of 150 files for each of Dec 2024, Mar 2022 and Mar 2018: 449 of 450 parsed, revenue, profit before tax and profit present in all. Full backward run (Dec 2024 back to Jun 2016, six quarters per run) in progress; start quarter is set where parse coverage of the liquid universe reaches 90%, to be recorded here when the runs end.
- 13 Nov 2026: backfill finished, 42 quarters (data/india/filings-coverage.json). Every quarter from 31 Mar 2018 to 30 Sep 2026 parsed at 97.9% or better of the filings the NSE lists, except 31 Mar 2019 at 92.8%; none is below the 90% line. The NSE older list holds nothing before 31 Mar 2018 (one stray filing a quarter, 0 parsed), so the **start quarter is 31 Mar 2018** and nothing earlier is used. Coverage is of listed filings; coverage of the liquid universe is still to be measured when a strategy first reads the data.
- 13 Nov 2026: extras added to the parser and the stored filings (`extra.q`, `extra.bs`, `extra.cf`: other income, finance cost, depreciation, exceptional items, profit before exceptional items, paid-up capital, face value; balance-sheet items from the period-end context; cash-flow items from the year-to-date context). Tag map in settings/filings-tags.json under `extras`. Backfill gained `--topup` (re-fetches stored filings to add extras and repair `asOf`); 3,301 filings had no `asOf` because revisions carry `revised_Date`, fixed in the backfill and the top-up. The nightly fundamentals file ignores any filing with no `asOf`. Share counts are checked against profit over EPS (unit slips) and a face value that is not a rupee denomination in use is rejected.
- 14 Nov 2026: build step 6 done for quarterly figures: `src/ingest/edgar-facts.ts` (pure parser, 9 tests), `scripts/backfill-us-facts.mjs`, workflows `backfill-us-facts` and `fetch-us-facts-fixtures`, store `data/us/facts/<TICKER>.json.gz` in the same quarter shape as the India filings so `filings-asof.ts` and `fundamentals-asof.ts` read it unchanged. Limits: ticker is the entity key (survivors only; no ticker-to-CIK history); a quarter with operating income and no interest figure is read as zero interest and marked `interestAssumed`; no exceptional-items line; no restated values (original filing only). Insider (U3) and large holders (U4) are not built.
