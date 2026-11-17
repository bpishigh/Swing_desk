# Batch C, US versions: proposals (16 Nov 2026)

Status: **v3, 17 Nov 2026: U-2 and U-3 counts run (section 6); nothing else adopted or built.** (v2, 16 Nov: proposal.) v2 adds an outside reviewer's points (pasted by the owner, marked not an approval), the two Batch C books v1 left out (18a, 18b), and the reading rule for event books. Written on the owner's request of 16 Nov 2026 for US versions of every India strategy. Paper only; not a financial adviser. Each section says what the India book does, what the US lacks, the closest honest substitute, what it would cost to build, and a recommendation. The owner decides each one separately (decisions at the end).

Shared terms are those of Batch C India (`docs/BATCH_C_RULES.md`): top 500 by dollar volume, equal weight, at most 20 names at 5%, signal on the close and fill at the next open, US tier costs, cash at the 3-month Treasury yield, comparator SPY, kill line C-174, confidence C-177. A name with a missing figure is not scored. US books are a confirmation market (C-179): a US result alone adopts nothing.

## 0. Rules that apply to every US Batch C book (v2)

- **Stops.** The standing short-hold stop is C-159: the tighter of 3 x ATR(20) and 8% below entry, trailing on closes. India delivery accumulation carries a recorded exception (3 x ATR(20) capped at 15%, C-213). A US book uses C-159 unless a row is cited for an exception; v1's "15% cap" and "25% long-hold stop" are withdrawn until the owner chooses. Where a US book follows an India book with a different stop, the card says so.
- **Reading event books.** They sit mostly in cash and will trail SPY in any rising half-year, so the standard kill line would fire on cash. They are read on net return per trade and against SPY held at the book's average invested fraction (the rule proposed for the SEPA book), beside the usual line.
- **Comparators.** SPY, plus an equal-weight line of the top 500 (as Batch A US), because these are equal-weight books.
- **Pairing.** Each US book is the confirmation market for one named India book only (C-179); a US result confirms nothing about a different idea.

## 1. Delivery accumulation (India package 21)

**India rule.** Delivery percentage at least 1.5 times its own 20-session average, close up at least 2%, close above the 50-session average; hold 20 sessions; stop 3 x ATR(20) capped at 15%.

**What the US lacks.** There is no delivered-share figure: US exchanges publish traded volume only. The signal cannot be copied.

**Nearest substitute: accumulation by volume and close.** A "high-volume up day that closes near its high", the price-and-volume footprint of buying pressure:
- volume at least 1.5 times its 20-session average, close up at least 2%, close in the top 25% of the day's range (desk figure), close above the 50-session average;
- rank by volume ratio; hold 20 sessions; same 15% stop cap.

**Honest limits.** This is a different idea (volume breakout), not delivery. It overlaps with the existing 52-week-high and Donchian books and may add little. Volume on US stocks is split across venues and dominated by short-term trading, so the buying-pressure reading is weaker than delivery is in India.

**Cost.** Small: price data already stored (`data/us/grouped` has volume and high/low); one new signal in `src/engine/batch-c.ts`, no new data.

**Recommendation.** Skip. It is a new idea, not a US copy of delivery; under C-179 it would confirm nothing about the India book and adds to the count of rules tried. If skipped, the register records "delivery accumulation: no US equivalent (no delivered-share figure)".

## 2. Insider buying (US stand-in for the India promoter and insider buying stream; not a copy of package 20)

**India rule.** A disclosed large buy (at least Rs 10 crore) by a genuine buyer (round-trip and keyword exclusions); hold 60 sessions; forward paper only.

**What the US lacks.** There is no daily list of block trades with the buyer's name. The closest public disclosures:
- **Form 4 (insider transactions):** open-market purchases by officers, directors and 10% holders, filed within two business days. Insider buying is among the best-evidenced buyer types in the literature, and it matches the India "promoter buying" tag.
- **Schedule 13D / 13G (large holders):** a 5% stake, filed within days (13D) or later (13G). Slower and sparser.

**Nearest substitute: insider open-market buying.** On a Form 4 with transaction code P (open-market purchase) in a top-500 name:
- non-derivative table only; exclude purchases in offerings and placements and filings that amend an earlier one;
- buyer is an officer or director; one insider's lines in a filing are added up before the $250,000 floor (a setting);
- the filing's acceptance time decides the signal day: one accepted after the close counts for the next session (late-evening filings carry the next day's date);
- logged, not gated: the buyer's role (chief executive or finance chief against other directors), the lag between trade and filing, the number of distinct insiders buying in the last 30 days;
- entry at the next open after the signal day; hold 60 sessions; C-159 stop unless the owner picks an exception.

**Pairing.** This confirms the India promoter and insider buying stream, not bulk and block deals (package 20); it must not be presented as confirming package 20.

**Count before any build.** Large open-market buys by officers of top-500 companies are rare, and the studies place the effect in small caps. Form 4 history is free on EDGAR, so first count qualifying events a year, for the top 500 and for the wider US eligible list side by side, counts only.

**Honest limits.** The date the trade happened differs from the date it became public (up to two business days); the book can only act on the filing date, so the move is partly gone. This is a different buyer type from India's block-deal funds. Studies find insider-buying drift mostly in small caps, and the top-500 filter may remove most of the signal.

**Cost.** Medium: a nightly loader for SEC Form 4 filings (SEC's EDGAR is reachable on the runner; the filings index is public), a parser for the transaction table, a stored log, then the book. Forward only, as India is, unless the loader backfills (Form 4 history is on EDGAR, so a replay window could be added later; that would be a separate decision).

**Recommendation.** Count first; build as a forward book only if the count gives enough events a year to read. Name it "US insider buying (Form 4)".

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

**Checks at the count stage (before the cut is frozen).**
- Report how often the assigned reaction day is the highest-volume day within two sessions either side (catches 8-Ks filed after the press release).
- A quarter can have two Item 2.02 filings (an early announcement and the full release): say which one counts (proposed: the first).
- ADRs file 6-Ks, which carry no item numbers, so they drop out; report the coverage.
- Log the overlap with the earnings-surprise book (A1 US), since a strong reaction day is close to that signal.
- The India test (C-61) is a forward test whose pass rule has not yet been judged (C-215 is a book beside it). A US version confirms an unproven idea; the count is cheap either way.

**Honest limits.** Release time matters: a release after the close puts the reaction on the next session, one before the open on the same session; getting this wrong shifts every event by a day. The India test was a forward test with its pass rule (60 matured signals, margins over the unfiltered group); a US version should carry the same rule.

**Cost.** Medium-large: loader plus a count run, then the book.

**Recommendation.** Do step 1 and 2 (loader and count) first, since step 3 depends on what the count shows.

## 4. Surveillance lists (India 18a: ASM, GSM, ESM)

India's lists are exchange-imposed trading restrictions on stocks with unusual price or volume behaviour; the desk uses them as information only. **No close US equivalent exists.** The nearest public items are trading halts and SEC trading suspensions, which are rare and event-driven, and the Nasdaq and NYSE delinquency notices (late filings, bid-price or equity deficiencies), which warn of delisting risk. None is a graded watch list. Recommendation: record "no US equivalent" in the register; optionally show Nasdaq deficiency notices as an information tag, which needs its own source and is not proposed now.

## 5. Anchor lock-in (India 18b) and IPO lock-up expiry

The US analogue is IPO lock-up expiry: insiders are barred from selling for a stated period (commonly 180 days) after the IPO, and the end date is written in the prospectus on EDGAR. Studies (US) report weak price pressure around expiry. The dates sit in free-text prospectus language, which is hard to parse; early-release terms, staged expiries and price-triggered releases make a clean date list costly. India's anchor lock-in was an information item and a one-off study (18b), so the US version would be the same: **a one-off count study, not a book.** Proposed first step: count how many US IPOs of the last five years have a lock-up date that a simple parser can read from the prospectus, with no returns read. Build nothing until that count is seen.

## Decisions for the owner

| # | Decision | Proposed |
|---|---|---|
| U-1 | Volume-based accumulation book to stand in for delivery | Skip; record "no US equivalent" |
| U-2 | Insider buying (Form 4): count of events first, then a forward book if readable; paired with the India insider stream | Yes, count only |
| U-3 | Run-up book via 8-K Item 2.02 dates: loader and count first, frozen US cut, then the book | Yes, steps 1 and 2 only |
| U-4 | US Batch B (Magic Formula, Piotroski, full quality) once the US data re-pull is read | Decide on the coverage figure (bar written 16 Nov after the first read of the re-pull, which gave Magic Formula 38% and 16 Piotroski names at 8 or above; so it was not set blind. Proposed bar for the second read: at least 60% of non-financial names scored, and at least 10 names at the top score for Piotroski) |
| U-5 | Surveillance lists: no US equivalent | Record, build nothing |
| U-6 | IPO lock-up expiry: a one-off count study of parseable dates, no book | Count only, and only if wanted |
| U-7 | Stops and reading rule for US event books per section 0 | Yes |

Nothing here is an approval; the owner's own "go" per row starts work.

## 6. Count results, 17 Nov 2026 (U-2 and U-3 steps 1 and 2; counts only, no book returns read)

**U-2, Form 4 insider buying** (`scripts/count-us-form4.py`, `data/us/count-form4.json`; SEC insider data sets 2021 Q1 to 2026 Q3; code P, non-derivative, officer or director, one insider's lines per filing summed, at least $250,000, form 4 only, filing date; offering purchases cannot be told apart in this data set). Current top-500 list: 148, 350, 157, 108, 186 qualifying filings in 2021 to 2025 (52 in 2026 to Q3), from 65 to 115 issuers a year; chief executive or finance chief in 27 to 130 of them; median lag trade to filing 1 to 2 days. Wider US eligible list (5,699 names): 1,061 to 1,514 filings and 501 to 734 issuers a year. Enough events to read in both; 2022 is a spike. Top-500 median purchase $0.5m to $1.0m.

**U-3, 8-K Item 2.02** (`scripts/count-us-8k.mjs`, `data/us/count-8k.json`, event list `data/us/eightk-202.json`; top-500 current list, first release per quarter kept, from 2021, prices to 16 Oct 2026). 9,686 events, 1,400 to 1,780 a year; 33 names have none (ADRs file 6-K); 1,085 second releases within 45 days dropped. Timing: 4,980 before the open, 4,432 after the close, 274 during the session. Reaction session is the highest-volume session within two sessions either side in 77% of events. Run-up over SPY (20 sessions): 33rd, 50th and 67th percentiles -2.95%, +0.05%, +3.23%; reaction over SPY: -2.06%, +0.16%, +2.50%. Events with run-up at or above the 67th percentile: 3,202; of those with reaction of at least +2%: 1,141 (about 195 a year). **Limits:** 403 names have 990 or more filings, so the submissions list may be missing their oldest 8-Ks (early years slightly thin); the current top-500 list carries survivorship bias; overlap with the surprise book (A1 US) not yet logged. **Proposed frozen US cut (owner to confirm; nothing read after this):** run-up at least +3.23% over SPY, reaction at least +2% over SPY; later US events would be judged with the India pass rule. Not frozen until the owner says go.
