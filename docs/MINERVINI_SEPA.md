# Minervini SEPA book (package 36b): proposal v3

Status: **v3, 15 Nov 2026. Flat-base part adopted and built as C-218 (bd-m2-sepaflat, forward from 17 Nov 2026); contraction bases parked.** The owner's goal is a book run exactly as Minervini publishes, no differences. v3 takes its rule wording from the owner's source sheet (his own reading of *Trade Like a Stock Market Wizard*, 2013, and *Think & Trade Like a Champion*, 2017). The sheet is marked "Not an approval", and so is this page: nothing starts until the owner says "go".

Where the two books differ, the later book is used and the earlier one is noted. Anything the books do not state as a number is a desk figure and is labelled on the card.

## 1. Rules taken from the books

| Area | Rule used | Book |
|---|---|---|
| Trend template | Eight tests as in C-216. Low test: 25% above the 52-week low (Book 2), C-216 uses 30% (Book 1). | B1 ch. 5, B2 sec. 6 |
| Earnings | Latest quarter up at least 25% year on year (floor 20% to 25% in the books; 25% used), and the two quarters before it also growing | B1 ch. 7 |
| Acceleration (earnings, sales, margins) | **Logged as a flag, not a gate** | B1 ch. 7, 8 |
| Base length | 3 to 65 weeks (15 to 325 sessions) | B1 ch. 10 |
| Contractions | 2 to 6, each shallower than the one before | B1 ch. 10, B2 sec. 6 |
| Base depth | Up to 40%; 60% or more excluded (40% used as the cap) | B1 ch. 10, B2 sec. 7 |
| Depth against the market | Exclude a base deeper than three times the index's own decline (published: two or three times) | B1 ch. 10 |
| Prior advance | Up at least 30% before the base | B2 sec. 6 |
| Final contraction | At most 8% (his worked examples run 2% to 8%) | both |
| Flat base | 10% to 15% deep, valid without contractions; 4 to 7 weeks (20 to 35 sessions) | B1 ch. 10 |
| Volume | Dried up in the last contraction (published); breakout on rising volume (published, no number) | both |
| Maximum stop | 10% below entry (Book 2 states 10%; a lower average loss of 5% to 6% is the aim) | B1 ch. 12, B2 sec. 2, 8 |
| Risk per trade | 1.25% to 2.5% of the account (1.25% proposed) | B2 sec. 8 |
| Position size | Up to 25% of the account | B1 ch. 12, B2 sec. 8 |
| Names | 4 to 8 (10 to 12 for large accounts) | B2 sec. 8 |
| Never average down | Followed | B2 sec. 5 |
| Profit rule | Sell half at twice the stop distance; stop on the rest to breakeven | B2 sec. 9 |
| 50-day rule | Once the rising 50-day average reaches the entry price it becomes the stop | B2 sec. 9 |
| Weakness exit | Sell on the largest one-day fall since entry | B1 ch. 12, B2 sec. 9 |
| Market gate | **None.** Neither book gives a numeric market rule, so v2's 50-day gate is removed. | B1 ch. 9, B2 sec. 5, 10 |

Return on equity and institutional holding stay out: neither book has them.

## 2. Desk figures (not published; labelled on the card)

Swing filter 2% (the books' final contractions run from 2% to 8%, so a 5% filter cannot see them); each contraction at most 75% of the one before ("about half" in the books); the market-decline floor of 5% in the depth test; breakout volume at least 150% of the 50-session average; pivot at most 5% above on the signal day ("a few points"); the 25% earnings figure is the low end of his published 20% to 25%.

## 3. Cannot be coded (listed on the card)

Comparing candidates with his profile of past winners; the manual review; earnings surprises and estimate revisions (no free data); reading the base by eye; judging intraday volume pace; selling into strength by feel; acting on warning signs by judgment; news. Inventory build-ups and "one-time" charges need line items the filings store does not hold reliably, so they are also left out.

## 4. Mechanics and issues that remain (unchanged from v2, named so they are not lost)

- **Sizing and cash.** Position = risk (1.25% of the book) divided by stop width, capped at 25%. A 10% stop gives 12.5%; eight at that size is 100%, so the book holds up to eight and a signal that finds no cash is skipped and logged.
- **Two exceptions to standing rules, needing the owner's explicit yes:** (1) a position above the 5% per-name cap (up to 25%); (2) a stop set by the setup (up to 10%) replacing the C-159 short-hold stop for this book.
- **Intraday stop.** His stop is a resting order. The book would check the stored daily low and sell at the stop, or at the open when the open gaps below it. This needs an optional intraday-stop path in the book engine (default unchanged). Without it the stop is checked on the close and losses will often exceed the stop.
- **Half sale and the 50-day stop** need partial-sale support in the book engine, which does not exist yet.
- **Reading the result.** A book that is mostly cash trails the Nifty 500 in any rising half-year, so the standard kill line would fire on cash. This book is read on net return per trade and against the index scaled to its average exposure, alongside the usual line. Expectation on the card before the first signal: few trades, and a weak or empty record is a likely outcome and is a result.

## 5. Count-only run (done once, no returns read)

The price chain was run over all stored history (2012 to date, one run) to count valid signals per year. See `docs/replay/SEPA-COUNT.md` for the table. The earnings screen is not applied, so the figures are an upper bound; the sheet's own figure is that about 95% of template passers fail it.

**Result (counts only):** contraction (VCP-style) bases give 0 to 7 breakout name-days a year in every year 2012 to 2026, so that layer is effectively empty with the desk's 2% swing filter (most bases split into seven or more swings). Flat bases give 107 to 475 breakout name-days a year (45 to 245 distinct names), 35 to 184 names a year with the 150% volume condition. A name can count on more than one day, and the earnings screen would cut these sharply. So a flat-base-only book is readable; a book that needs two or more contractions is not. This is a count, not a performance read.

**Flat-base count (owner "go" 15 Nov 2026; `docs/replay/SEPA-FLAT-COUNT.md`).** Definition fixed before the run: 20 to 35 sessions, depth at most 15%, volume dry-up before and 150% on the signal day, first signal per base, six slots, ties broken by highest RS rank. Taken trades per year (calendar counting only, no returns): price chain only 21 to 38 every year 2012 to 2025; with the earnings floor (2021 on) 17, 22, 22, 31, 25 in 2021 to 2025 (average 23.4 at 25%, 24.0 at 20%), 28 in part-year 2026. Pre-set line (20 a year): met in 4 of 5 full years with earnings (2021 gave 17 and 18), no year under 10. Earnings figures exist for 52% to 85% of primary signals; a missing figure is not a fail. Caveat: the slot calendar uses an assumed exit (10% stop, 50-day rule, 250-session cap), so the taken counts move with exits and are not a result.

**Contraction counter test:** not run. None of the five worked examples has stored price data (the US history starts in October 2016; VIVO, MIK and FSII are delisted; NFLX 2009 and MELI 2007 predate it). The pre-set pass rule stands; daily price files for NFLX (2009) and MELI (2007) are needed.

## 6. Order of work after the owner's "go"

1. Owner reads the count and decides (S-5 below).
2. Only if the count is workable: a nightly per-rule pass or fail log for every template passer (each template test, each contraction test, volume, earnings), then a registered replay, then a forward book beside the screen book (C-216).

## Decisions for the owner

| # | Decision | Proposed |
|---|---|---|
| S-1 | Rule wording is the source sheet as summarised in section 1 (later book where they differ) | Yes |
| S-2 | Yes to the two exceptions: position up to 25%; setup stop up to 10% replacing C-159 | Yes |
| S-3 | The desk figures in section 2 stay as written | Yes |
| S-4 | Engine additions: intraday stop path and partial sale | Yes, only after S-5 |
| S-5 | Proceed to a book only if the count shows enough signals a year to read | Decide on the count |
| S-6 | Nightly per-rule pass or fail log | Yes |
