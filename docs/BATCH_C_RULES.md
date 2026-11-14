# Batch C: exchange-data strategies, India (v2 draft, 15 Nov 2026)

Status: **18a, 18b, 21 and 20 ADOPTED by the owner 15 Nov 2026 as C-208 to C-211** (decisions C-1 to C-5 all yes, with the four review additions). The collection job is scheduled daily. 19, 22 and 23 are not yet drafted. Paper only. Not a financial adviser. Pasted reviewer text is not approval. Written to `claude/strategy-build-standard.md` (C-158) and C-159, C-173, C-174, C-176, C-177. This is Wave 2 (packages 18 to 23 of `docs/SCOPE.md` section L). The first group is the four whose data was probed on 15 Nov 2026 and is in hand: 18a, 18b, 21, 20. Packages 19, 22 and 23 follow after further probing (end of this page). **v2 (15 Nov 2026) applies the review notes that arrived after v1**: they are proposals until you mark them, except the first, which corrects a conflict with your own earlier decision. Where this page and a C-row differ, the C-row wins.

## What the data allows (probe of 15 Nov 2026, `data/probe-wave2.json`)

| Source | Result | Consequence |
|---|---|---|
| NSE surveillance lists (ASM long-term and short-term, GSM, ESM) | Live JSON works: 76 names on GSM (with stage), 229 on ESM (with stage), ASM in two lists | Today's list only; **no history**. Forward snapshot, no back-test |
| NSE bulk and block deals | Latest-day CSVs work (date, symbol, client name, buy or sell, quantity, weighted price; bulk adds remarks). The dated history endpoint returned a web page, not data | **Forward-only**: a day missed is lost for good; no replay |
| NSE delivery file (`sec_bhavdata_full_<date>.csv`) | Loads for 2021 to 2026 (about 2,000 to 3,500 rows a day); 2016 and 2019 samples returned 404 | Use for 2021 on; the older MTO file (next row) covers earlier years |
| Older delivery file (MTO, probed 15 Nov) | Loads for every sampled year from 2012 to 2021 (about 1,300 to 1,900 rows a day) | The delivery replay window is limited by the stored prices (from 2010), not by the file; the first month meeting the window rule is measured by the loader |
| Listing dates | From the desk's own price history (first session a name trades) | Approximate anchor dates (below) |
| Desk corporate-action store | 2019 on: 233 buybacks, 250 rights, 304 splits, 319 bonuses, 93 demergers by subject text | Usable for package 22 later; demergers need typed records |

New register rows to add on adoption: I14 surveillance lists, I15 bulk and block deals, I16 delivery file, I17 index notices (status Probed until the deeper probe).

## Shared terms (all four)

Universe: the top 500 by 20-session median traded value, as Batch A and B (names outside it never enter). Equal weight, at most 20 names at 5%. Signal on a close, fill at the next open, tier costs, cash at the liquid-fund rate (C-175, C-178). Stops: C-159 short-hold rule (the tighter of 3 x ATR(20) and 8% below entry, trailing on closes, next-open fill; a signal needing a wider stop goes on the stop-too-wide list). Kill line C-174, confidence figure C-177, comparator one named line per book (C-176): the Nifty 500, cap-weighted. Names with a missing figure are not scored, never read as zero. A replay, where one is possible, is run once, labelled **an implementation check, not evidence**, with its window rule fixed before the run.

## 18a. Surveillance flags (ASM, GSM, ESM): information only

**Decision of record.** In Batch A (A7, D6, 13 Nov) you decided flags are information, and that using one to exclude is a later decision tested as a filter with a no-filter twin (as C-165). v1 of this page said the flag excludes names from every paper book; that would change every running book's rule mid-run and contradicts D6. **Corrected: both flags (18a and 18b) are information lines only, with no exclusion anywhere, until you decide otherwise.**

**Question.** Do names under exchange surveillance do worse than the rest?

**Rule.** Every night, snapshot the lists with stage and date (job built, below). A name on a list, or removed from one in the last 20 sessions, is flagged on its card as information.

**Measure first, per list.** Count separately how often a name from ASM long-term, ASM short-term, GSM and ESM sits in the top 500 and in the sleeve's top-200 pool. ESM and GSM names are mostly illiquid and are expected to reach the top 500 rarely. ASM is triggered by sharp price and volume moves, so it lands on liquid names that momentum books pick; an ASM exclusion would partly be an anti-momentum filter and is read that way.

**Judging.** Forward only: from the first snapshot, the next-20-session return of flagged top-500 names against unflagged ones, by list, with counts. No pass or kill line.

## 18b. Anchor lock-in (information, and a one-off study)

**Question.** Is there selling pressure around the 30-day and 90-day anchor lock-in ends?

**Dates.** The lock-in counts from allotment, which is about one to four days before listing (reviewer's note, to check against an issue). The window is therefore centred about two days before listing plus 30 or plus 90 calendar days, with the early side widened (from 7 sessions before to 4 after). The 90-day half applies to issues opened from April 2022 (reviewer's note, to verify against SEBI's circular); before that, all anchor shares unlocked at 30 days. SME listings are reported separately and kept out of the main figure.

**The flag cannot bind.** The universe requires 260 sessions of history (`BASE.minSessions`), and the flag covers names listed in the last 120 calendar days, so such a name is never in the top 500. 18b is therefore a **report only**: no flag is built while that universe rule stands.

**Study (one run, registered before it runs).** An event study over all listings in the stored price history: the mean return in the window around each lock-in end against the same names' average same-length window, and against the Nifty 500. Report count, mean and the share negative, with the main, SME and pre-April-2022 groups separately. Nothing is switched on from it (decision C-2).

## 21. Delivery-percentage accumulation

**Question.** When the share of volume taken into delivery jumps while the price rises, does the stock keep rising?

**Data.** A loader (one workflow, on the GitHub runner) pulls the delivery file for each session and stores delivered quantity, traded quantity and delivery percentage for **every stock** (not only the current top 500: the list changes monthly, and a name that enters later needs its 20-session history; the files are small). It uses the MTO file for years before 2021 and the full bhavcopy file from 2021, records any missing day, and starts from the earliest loadable date.

**Signal (numbers fixed here, changeable only before the first run).** On a close: delivery percentage at least 1.5 times its own 20-session average, close up at least 2% on the day, close above its 50-session average, and the name in the top 500. Rank by the delivery ratio; take the highest.

**Tags on every signal.** Whether the signal day was a results day, a bulk or block deal day, or a derivatives expiry day, because delivery share jumps mechanically on all three. The card and the replay report show results by tag, so what is driving the signal is visible.

**Trade-for-trade names.** A stock in the trade-for-trade series is 100% delivery by definition, so a move into or out of that series would make the ratio fire or fail for no real reason. A signal requires the normal series on the signal day and across the 20-session average.

**Splice check and tag coverage.** Both delivery files load for 2021: compare them on a few shared dates before joining them. The replay report states that the results-day tag exists only from 2018 and the deal-day tag only from the first logged night, so most of the replay carries the expiry tag alone.

**Entry and exit (decision C-3).** Entry at the next open. Hold 20 sessions, then sell at the next open, or earlier on the C-159 stop. At most 20 names; no signal while the book is full (missed signals logged with a no-slot reason, as in A1).

**Cost and stop behaviour, stated before the first signal.** A 20-session hold is about twelve round trips a year per slot, so costs bear heavily, and the tight C-159 stop (the tighter of 3 x ATR(20) and 8%) is expected to fire often after a 2% up day. The card reports the stop-out share and average exposure from the first month, and the replay reports them too.

**Replay.** Once, on the stored prices. Window rule fixed now: from the first month where at least 90% of the top-500 names have a delivery figure on at least 90% of the sessions in that month, to the last stored session. Survivor bias applies (stated on the card).

**Expectation for the card.** Delivery percentage is a crude proxy for informed buying. A weak or no result is a live possibility; the replay is an implementation check.

## 20. Bulk and block deals

**Question.** After a disclosed large purchase by a genuine buyer, does the stock keep rising?

**Data (forward only).** A nightly job reads the day's bulk and block files and appends every row to a stored log (built, below). A missed night cannot be recovered. The job runs in the evening and again the next morning as a retry; a source that fails after retries makes the run show as failed.

**Signal.** A *buy* row in the top 500, value (units times price) at least Rs 10 crore (a setting), not excluded by the buyer rule. **Behaviour is the main filter, as known at entry:** exclude a client who sold the same stock on the signal day or in the 5 sessions before it (round trip), which catches proprietary firms whatever their name. A sale in the 5 sessions after entry cannot be known at entry; it is logged as a tag. A running list is kept: a client seen round-tripping any stock in the log is excluded from then on. **Keywords are a second net:** exclude client names containing SECURITIES, CAPITAL MARKETS, TRADING, BROKING, PROPRIETARY, ARBITRAGE, ALGO, QUANT. The word FINANCE is not used (it would remove funds and insurers). A **positive tag** marks mutual funds, insurers and pension funds, so the card can show results by buyer type. **Promoter holding companies** often carry Trading or Investments in their names, so rows dropped by the keyword net are tagged as possible promoter entities and counted separately on the card (promoter buying is the best-evidenced buyer type). The card shows excluded and kept counts.

**Also logged on every signal.** The gap from the deal price to the next-open fill, and any large sell rows in the same stock the same day (a fund buying from an exiting promoter or private-equity holder is a different event from open-market accumulation).

**Entry and exit.** Entry at the next open after the disclosure. Hold 60 sessions or until the C-159 stop. Equal weight, at most 20 names at 5%.

**Replay.** None (no history). Forward paper only, judged under C-174, C-176 and C-177.

**Expectation for the card.** Indian studies find the return before the disclosure and about zero after. This is the short-horizon version and is expected to fail; the forward result is what settles it.

## Decisions for the owner

| Id | Decision | My proposal |
|---|---|---|
| C-1 | 18a: information only; count the four lists separately | Yes |
| C-2 | 18b: report only (the flag cannot bind under the 260-session universe rule) | Yes |
| C-3 | 21: signal numbers, tags, 20-session hold, window rule, MTO for earlier years | As written |
| C-4 | 20: round trip as the main filter, keywords second, fund tag, Rs 10 crore floor, 60-session hold, forward-only | As written |
| C-5 | Adopt the four and build in order: 18a snapshot and 20 log first (built), then the 21 loader and replay, then the 18b report | Yes |

**Adopted 15 Nov 2026 (owner: "go", C-1 to C-5 yes, schedule started).**

## Build order if adopted

**Built 15 Nov 2026 (collection only, changes no rule):** `scripts/exchange-log.mjs` and workflow `exchange-log.yml` store the surveillance lists (`data/india/surveillance/`) and the bulk and block rows (`data/india/deals/`), with tests. It is dispatch-only; **it is not scheduled until you say start** (the schedule is two lines: 14:00 UTC and a 04:30 UTC retry, every day including weekends, since the exchange's latest-day file stays up until the next trading evening and a weekend run can recover a failed Friday). A manual test run on 15 Nov stored one snapshot (ASM long 134, short 38, GSM 76, ESM 229) and the 13 Nov deals (136 bulk, 26 block rows). Remaining: 1. Surveillance bind-rate count. 2. The deal log keeps growing from the first scheduled night. 3. Delivery loader backfill, then the one replay. 4. Anchor lock-in event study. 5. C-rows, register rows, STATUS and the cards, one paper book per adopted strategy.

## Packages 19, 22 and 23 (not in this draft)

- **19 Index inclusion and exclusion:** the Nifty Indices site and the NSE circulars list are reachable, but how announcements are laid out and how far back they go is not yet known. Needs a second probe.
- **22 Corporate actions:** the desk's store has the events from 2019; each of demergers, buybacks, rights, open offers and splits or bonus needs its own entry and exit rule from you, and demergers need typed records. To be drafted separately.
- **32 Superinvestor follower (long horizon):** a fixed list of investors read from quarterly shareholding filings and held about three years. Not in this batch and not lost: it stays in the Wave 3 list of `SCOPE.md`.
- **23 US 13F and short interest:** FINRA short-interest files load (2025 and Oct 2026 tested); 13F per filer was probed earlier (register U4). To be drafted separately, on the US side.

## Log

- 15 Nov 2026: v1 drafted after the Wave 2 data probe.
- 15 Nov 2026 (later still): four review additions applied as proposals (round trip as known at entry and a running list, promoter-entity tag, trade-for-trade series, splice check and tag coverage; daily schedule including weekends).
- 15 Nov 2026 (later): v2. Flags changed to information only (D6 of Batch A); 18b made a report only; 21 stores every stock, tags signals, uses the MTO file for earlier years, states cost and stop behaviour; 20 uses behaviour as the main filter with a fund tag and logged gap; collection jobs built, not scheduled.
