# Batch C: exchange-data strategies, India (v1 draft, 15 Nov 2026)

Status: **DRAFT for the owner. Nothing here is adopted and no code is written.** Paper only. Not a financial adviser. Pasted reviewer text is not approval. Written to `claude/strategy-build-standard.md` (C-158) and C-159, C-173, C-174, C-176, C-177. This is Wave 2 (packages 18 to 23 of `docs/SCOPE.md` section L). The first group is the four whose data was probed on 15 Nov 2026 and is in hand: 18a, 18b, 21, 20. Packages 19, 22 and 23 follow after further probing (end of this page). Where this page and a C-row differ, the C-row wins.

## What the data allows (probe of 15 Nov 2026, `data/probe-wave2.json`)

| Source | Result | Consequence |
|---|---|---|
| NSE surveillance lists (ASM long-term and short-term, GSM, ESM) | Live JSON works: 76 names on GSM (with stage), 229 on ESM (with stage), ASM in two lists | Today's list only; **no history**. Forward snapshot, no back-test |
| NSE bulk and block deals | Latest-day CSVs work (date, symbol, client name, buy or sell, quantity, weighted price; bulk adds remarks). The dated history endpoint returned a web page, not data | **Forward-only**: a day missed is lost for good; no replay |
| NSE delivery file (`sec_bhavdata_full_<date>.csv`) | Loads for 2021 to 2026 (about 2,000 to 3,500 rows a day); 2016 and 2019 samples returned 404 | Replayable over about five years; the first loadable date is measured by the loader |
| Listing dates | From the desk's own price history (first session a name trades) | Approximate anchor dates (below) |
| Desk corporate-action store | 2019 on: 233 buybacks, 250 rights, 304 splits, 319 bonuses, 93 demergers by subject text | Usable for package 22 later; demergers need typed records |

New register rows to add on adoption: I14 surveillance lists, I15 bulk and block deals, I16 delivery file, I17 index notices (status Probed until the deeper probe).

## Shared terms (all four)

Universe: the top 500 by 20-session median traded value, as Batch A and B (names outside it never enter). Equal weight, at most 20 names at 5%. Signal on a close, fill at the next open, tier costs, cash at the liquid-fund rate (C-175, C-178). Stops: C-159 short-hold rule (the tighter of 3 x ATR(20) and 8% below entry, trailing on closes, next-open fill; a signal needing a wider stop goes on the stop-too-wide list). Kill line C-174, confidence figure C-177, comparator one named line per book (C-176): the Nifty 500, cap-weighted. Names with a missing figure are not scored, never read as zero. A replay, where one is possible, is run once, labelled **an implementation check, not evidence**, with its window rule fixed before the run.

## 18a. Surveillance flags (ASM, GSM, ESM)

**Question.** Do names under exchange surveillance do worse than the rest, so that excluding them from new entries pays?

**Rule.** Every night, snapshot the three lists with their stage and the date. A name on any list, or removed from one in the last 20 sessions, is *flagged*. The flag excludes the name from new entries in every paper book (information and exclusion, not a new book).

**First step, measure before building anything more.** Count how many flagged names ever sit in the top 500 and in the sleeve's top-200 pool. Surveillance names are mostly illiquid, so the exclusion may rarely bind. If fewer than about one name a month would have been caught, the flag stays as an information line on the card and in the snapshot file, and no book is built (decision C-1).

**Judging.** Forward only: from the first snapshot, compare the next-20-session return of flagged names that are in the top 500 against unflagged ones, with the count. No pass or kill line until there are enough names to say anything; the card shows the count.

## 18b. Anchor lock-in flag

**Question.** Is there selling pressure around the 30-day and 90-day anchor-investor lock-in ends, so that a new entry near them does worse?

**Dates.** Anchor allotment is a few days before listing and the file carries no allotment date, so the lock-in ends are approximated as 30 and 90 calendar days after the listing date (the first session the name trades), stated on the card as approximate.

**Rule.** A name listed in the last 120 calendar days is *flagged* from 5 sessions before to 5 sessions after each approximate lock-in end. The flag excludes new entries in every paper book, as 18a.

**Study (one run, registered before it runs).** An event study over all listings in the stored price history: mean return in the 11-session window around each lock-in end against the same names' average 11-session return, and against the Nifty 500. Report count, mean and the share negative. The flag is switched on only if the mean is below the Nifty 500's by more than the round-trip cost and the count is at least 30 (decision C-2); otherwise it stays information only.

## 21. Delivery-percentage accumulation

**Question.** When the share of volume taken into delivery jumps while the price rises, does the stock keep rising?

**Data.** A loader (one workflow, on the GitHub runner) pulls the delivery file for each session and stores, for the stocks in the top 500 only, delivered quantity, traded quantity and delivery percentage, one file per year. It starts from the earliest loadable date and records any missing day.

**Signal (numbers fixed here, changeable only before the first run).** On a close: delivery percentage at least 1.5 times its own 20-session average, close up at least 2% on the day, close above its 50-session average, and traded value inside the top 500. Rank by the delivery ratio; take the highest.

**Entry and exit (decision C-3: needs your word).** Entry at the next open. Hold 20 sessions, then sell at the next open, or earlier on the C-159 stop. At most 20 names; no signal while the book is full (the missed signals are logged with a no-slot reason, as in A1).

**Replay.** Once, over the loadable window, on the stored prices. Window rule fixed now: from the first month where at least 90% of the top-500 names have a delivery figure on at least 90% of the sessions in that month, to the last stored session. Survivor bias applies (stated on the card).

**Expectation for the card.** Delivery percentage is a crude proxy for informed buying. Weak or no result is a live possibility; the replay is an implementation check.

## 20. Bulk and block deals

**Question.** After a disclosed large purchase by a genuine buyer, does the stock keep rising?

**Data (forward only).** A nightly job reads the day's bulk and block CSVs after the exchange publishes them and appends every row to a stored log. It must run every night: a missed night cannot be recovered. First evidence therefore takes months.

**Signal.** A *buy* row in the top 500 where the client is not excluded by the genuine-buyer rule, the value (quantity times price) is at least Rs 10 crore (a setting), and the same client did not also sell the same stock the same day (round-trip filter). Genuine-buyer rule, written now (decision C-4, needs your word): exclude client names containing any of SECURITIES, CAPITAL MARKETS, TRADING, BROKING, FINANCE, PROPRIETARY, ARBITRAGE, ALGO, QUANT, and any name that appears as both buyer and seller of the same stock within 5 sessions. This is a keyword rule and will misfile some names; the card shows the excluded and kept counts so the rule can be judged.

**Entry and exit.** Entry at the next open after the disclosure. Hold 60 sessions or until the C-159 stop. Equal weight, at most 20 names at 5%.

**Replay.** None (no history). Forward paper only, judged under C-174, C-176 and C-177; the confidence figure starts at 50% and moves with results.

## Decisions for the owner

| Id | Decision | My proposal |
|---|---|---|
| C-1 | 18a: if the flag would rarely bind, keep it as information and build no book | Yes |
| C-2 | 18b: event study first; switch the flag on only if the effect clears the round-trip cost on at least 30 events | Yes |
| C-3 | 21: signal numbers (1.5 times, 2%, 50-session average), 20-session hold, window rule | As written |
| C-4 | 20: genuine-buyer keyword rule, Rs 10 crore floor, 60-session hold, forward-only | As written |
| C-5 | Adopt these four as C-row ids and build in the order 18a snapshot, 21 loader and replay, 18b study, 20 log | Yes |

These are proposals until you mark each Adopted.

## Build order if adopted

1. Surveillance snapshot job (nightly, appends a dated file) and the bind-rate count. 2. Bulk and block log job, started first because it cannot be replayed (every night without it is lost). 3. Delivery loader backfill, then the one replay. 4. Anchor lock-in event study. 5. C-rows, register rows, STATUS and the cards, one paper book per adopted strategy.

## Packages 19, 22 and 23 (not in this draft)

- **19 Index inclusion and exclusion:** the Nifty Indices site and the NSE circulars list are reachable, but how announcements are laid out and how far back they go is not yet known. Needs a second probe.
- **22 Corporate actions:** the desk's store has the events from 2019; each of demergers, buybacks, rights, open offers and splits or bonus needs its own entry and exit rule from you, and demergers need typed records. To be drafted separately.
- **23 US 13F and short interest:** FINRA short-interest files load (2025 and Oct 2026 tested); 13F per filer was probed earlier (register U4). To be drafted separately, on the US side.

## Log

- 15 Nov 2026: v1 drafted after the Wave 2 data probe.
