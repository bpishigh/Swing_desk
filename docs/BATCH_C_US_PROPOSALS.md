# Batch C, US versions: proposals (16 Nov 2026)

Status: **proposal only. Nothing here is adopted or built.** Written on the owner's request of 16 Nov 2026 for US versions of every India strategy. Paper only; not a financial adviser. Each section says what the India book does, what the US lacks, the closest honest substitute, what it would cost to build, and a recommendation. The owner decides each one separately (decisions at the end).

Shared terms are those of Batch C India (`docs/BATCH_C_RULES.md`): top 500 by dollar volume, equal weight, at most 20 names at 5%, signal on the close and fill at the next open, US tier costs, cash at the 3-month Treasury yield, comparator SPY, kill line C-174, confidence C-177. A name with a missing figure is not scored. US books are a confirmation market (C-179): a US result alone adopts nothing.

## 1. Delivery accumulation (India package 21)

**India rule.** Delivery percentage at least 1.5 times its own 20-session average, close up at least 2%, close above the 50-session average; hold 20 sessions; stop 3 x ATR(20) capped at 15%.

**What the US lacks.** There is no delivered-share figure: US exchanges publish traded volume only. The signal cannot be copied.

**Nearest substitute: accumulation by volume and close.** A "high-volume up day that closes near its high", the price-and-volume footprint of buying pressure:
- volume at least 1.5 times its 20-session average, close up at least 2%, close in the top 25% of the day's range (desk figure), close above the 50-session average;
- rank by volume ratio; hold 20 sessions; same 15% stop cap.

**Honest limits.** This is a different idea (volume breakout), not delivery. It overlaps with the existing 52-week-high and Donchian books and may add little. Volume on US stocks is split across venues and dominated by short-term trading, so the buying-pressure reading is weaker than delivery is in India.

**Cost.** Small: price data already stored (`data/us/grouped` has volume and high/low); one new signal in `src/engine/batch-c.ts`, no new data.

**Recommendation.** Build only if the owner wants it as a volume-breakout book, and label it "US volume accumulation (not delivery)". Otherwise skip.

## 2. Bulk and block deals (India package 20)

**India rule.** A disclosed large buy (at least Rs 10 crore) by a genuine buyer (round-trip and keyword exclusions); hold 60 sessions; forward paper only.

**What the US lacks.** There is no daily list of block trades with the buyer's name. The closest public disclosures:
- **Form 4 (insider transactions):** open-market purchases by officers, directors and 10% holders, filed within two business days. Insider buying is among the best-evidenced buyer types in the literature, and it matches the India "promoter buying" tag.
- **Schedule 13D / 13G (large holders):** a 5% stake, filed within days (13D) or later (13G). Slower and sparser.

**Nearest substitute: insider open-market buying.** On a Form 4 with transaction code P (open-market purchase) in a top-500 name:
- buyer is an officer or director; value at least $250,000 (a setting); exclude plan purchases and filings amending an earlier one;
- cluster rule logged, not gated: number of distinct insiders buying in the last 30 days;
- entry at the next open after the filing is public; hold 60 sessions; same stop rule as the India book.

**Honest limits.** The date the trade happened differs from the date it became public (up to two business days); the book can only act on the filing date, so the move is partly gone. This is a different buyer type from India's block-deal funds. Studies find insider-buying drift mostly in small caps, and the top-500 filter may remove most of the signal.

**Cost.** Medium: a nightly loader for SEC Form 4 filings (SEC's EDGAR is reachable on the runner; the filings index is public), a parser for the transaction table, a stored log, then the book. Forward only, as India is, unless the loader backfills (Form 4 history is on EDGAR, so a replay window could be added later; that would be a separate decision).

**Recommendation.** Worth building as a forward book; it is the closest in spirit to the India book and the data is free and official. Name it "US insider buying (Form 4)".

## 3. Run-up before results (India C-61 and C-215)

**India rule.** The stock ran up into results by more than a frozen cut (+2.26% over the market, the two-thirds point of India results events) and the reaction day is at least +2% over the market; buy at the next open, hold 20 sessions.

**What the US lacks.** Two things:
- **A forward earnings calendar.** The desk holds the *gap* between an 8-K and a 10-Q for past filings (`data/us/eightk-gap.json`) but no list of upcoming report dates. The run-up is measured up to the results date, so the date must be known in advance or reconstructed afterwards.
- **A frozen cut of its own.** India's +2.26% is the two-thirds point of Indian results events and cannot be reused. A US cut must come from US results events, fixed before any outcome is read.

**Two routes.**
- **A. Reconstruct the date afterwards** from 8-K Item 2.02 filings (earnings releases). The run-up window is then the sessions before the release date and the reaction day is the first session after it. No forward calendar needed; the book acts on the reaction day close, as India's does. The 8-K history is on EDGAR, so past events (and the frozen cut) can be built from stored filings.
- **B. Forward calendar from a free source** (for example Nasdaq's earnings calendar). Not needed for this signal and adds a source to maintain.

**Recommended route: A.** It needs only EDGAR 8-K Item 2.02 dates and prices already stored.

**Order of work.**
1. Loader: list of 8-K Item 2.02 filings per top-500 name with filing date and time (before open or after close decides which session is the reaction day).
2. Count only: the number of events a year and the distribution of run-up and reaction, with no returns read, then freeze the US cut (the two-thirds point of US run-ups) and write it down.
3. Then, only if the owner says go, the paper book with the India terms (hold 20 sessions, 25% stop, at most 20 names).

**Honest limits.** Release time matters: a release after the close puts the reaction on the next session, one before the open on the same session; getting this wrong shifts every event by a day. The India test was a forward test with its pass rule (60 matured signals, margins over the unfiltered group); a US version should carry the same rule.

**Cost.** Medium-large: loader plus a count run, then the book.

**Recommendation.** Do step 1 and 2 (loader and count) first, since step 3 depends on what the count shows.

## Decisions for the owner

| # | Decision | Proposed |
|---|---|---|
| U-1 | Volume-based accumulation book to stand in for delivery, labelled as a different idea | Skip unless wanted |
| U-2 | Insider buying (Form 4) book as the bulk and block substitute, forward only | Yes |
| U-3 | Run-up book via 8-K Item 2.02 dates: loader and count first, frozen US cut, then the book | Yes, steps 1 and 2 only |
| U-4 | US Batch B (Magic Formula, Piotroski, full quality) once the US data re-pull is read | Decide on the coverage figure |

Nothing here is an approval; the owner's own "go" per row starts work.
