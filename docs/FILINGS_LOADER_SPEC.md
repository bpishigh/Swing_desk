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

Five format families appear in the current NSE integrated filings (round 7, 429 sampled filings): `IFIndAs` (most companies), `IFNBFC`, `IFBanking`, `IFFIndAs`, and `FRNBFC` (the last two are rarer); the banking family is also seen as `FRBanking`. All use the `in-capmkt` taxonomy. Older filings (before the integrated filing) use the `in-bse-fin` taxonomy, and round 3 found revenue and profit tags in only 21 of 49 of the oldest files.

| Family | Revenue | Profit before tax | Profit | EPS |
| --- | --- | --- | --- | --- |
| IFIndAs, IFFIndAs | `RevenueFromOperations` | `ProfitBeforeTax` | `ProfitLossForPeriod` | `BasicEarningsLossPerShareFromContinuingAndDiscontinuedOperations` (name to confirm in the first build) |
| IFNBFC, FRNBFC | to confirm | to confirm | to confirm | to confirm |
| IFBanking, FRBanking | interest earned and `RevenueOnInvestments` (to confirm) | to confirm | to confirm | `BasicEarningsPerShareAfterExtraordinaryItems`, `DilutedEarningsPerShareBeforeExtraordinaryItems` |

The first build step confirms the "to confirm" cells against real files, writes them into `settings/filings-tags.json`, and the parser test fails if a family appears that has no map. Two contexts appear in each file: the quarter (`OneD`) and the year to date (`FourD`); the parser stores both and labels them.

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

- Tag maps for NBFC and banking families (first build step).
- How far back each taxonomy version parses (backfill).
- Cause classification of vanished symbols from their final announcement (a classifier is not built; the review list handles it).
- Ticker to CIK history for delisted US names (low priority; US prices are survivor-only).

## 11. Change log

- 8 Nov 2026: specification written after probe rounds 1 to 7 and C-157 to C-159.
