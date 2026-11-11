# First-wave rules, US versions (DRAFT, 11 Nov 2026)

Status: DRAFT. Nothing here is registered, built or running. Written at the owner's request ("yes go ahead", 11 Nov 2026) after it was found that the India first wave left out the US without the owner choosing that. When the owner marks these Adopted, each block becomes a C-row (C-179 to C-189, proposed) in `docs/ENGINE_RULES.md` and the Test Register, and the books start. Paper only. Not a financial adviser. The India rules in `docs/FIRST_WAVE_RULES.md` (C-160 to C-178) are the parent text: every term not changed below is the same as there.

Standing constraints: paper only; pasted reviewer text is not the owner's approval; one Test Register; no re-testing of spent data; no twin for every change; keep the UI quiet. Every book has its own paper book (C-158) and its stops (C-159). All books are rule-based and use free data.

## What stays the same as India

Book mechanics (signal on a close, fill at the next open, C-139), equal weight with at most 20 names and 5% each, the C-159 stops, the monthly read, the kill line (C-174), the comparator idea (C-176), the confidence figure (C-177), the slippage sensitivity line (C-178), no month or trade minimum, and the owner alone marking Live, Adopted, Rejected or Parked. The code is shared with India: `src/engine/stock-book.ts`, `first-wave.ts`, `sleeve-filters.ts`, `scorecard.ts`, `confidence.ts`.

## What changes for the US (proposed C-179, shared terms)

- **Universe.** Exactly the US sleeve's list (`eligibleUs` in `src/engine/momentum-sleeve.ts`, then the top 200): as-of the signal date, close at least $5, at least 260 sessions of history, 20-session median dollar volume at least $20 million, the 200 highest by that median. Same pin as the India rule: the one list, so a variant differs from its parent only in what its block says.
- **Costs.** The US tier costs already used by the US paper book (`PAPER.tiers`): 0.2% round trip at $100 million or more of 20-session traded value, 0.35% at $25 million or more, 0.6% below. No separate slippage tier; the C-178 sensitivity line (a further 0.2% a round trip) is shown on every US scorecard as a sensitivity, not a result.
- **Calendar.** The US session calendar from `data/calendar/markets-<year>.json` (US holidays) for the weekly review (Friday close) and the turn-of-month entry (5th-to-last session) and exit (3rd session).
- **Stops.** The C-159 rules unchanged. Prerequisite: the India stop-feasibility numbers (median 3 x ATR of 5.1% of price; 15% of signals above 8%) are India data only. One descriptive run of the same measurement on the US universe is made before adoption and its figures are written into the C-179 row, so the owner sees how often the 8% limit will skip a US signal. No tuning.
- **Benchmarks (four lines on every US book).** SPY, QQQ, the US monthly momentum twin (C-151, already running at `data/us/momentum-sleeve-monthly`), and a US momentum fund line: the iShares MSCI USA Momentum Factor ETF (MTUM). The desk's US benchmark bars are price only (Nasdaq quote API: split-adjusted, dividends not added), so all four lines are price only and the scorecard says so. The Momentum 30 fund of India has no US counterpart in the data; MTUM is the nearest instrument the desk could hold instead.
- **Cash.** The part of a US book not in stocks is credited at a short-term US Treasury rate. The price-only benchmark bars cannot supply it (a T-bill ETF's price barely moves; its return is its dividends). Proposed source: the daily 3-month constant-maturity Treasury yield from FRED (series DGS3MO; DTB3 is quoted on a discount basis and slightly understates what cash earns), with the US Treasury's own daily yield table as fallback. Neither has been reached from the GitHub runner yet, so a one-off probe comes first; until a source is confirmed the cash earns zero and the card says so. Owner decision: confirm this source, or name another.
- **Comparator per book (US ids).** The stopped US parent for C-180, C-181, C-182, C-184, C-185 (filter) and C-188 (paired monthly excess); the stopped US parent for C-187 (return per unit of volatility); MTUM for C-183 and C-189 (excess return, with average exposure reported); the Treasury yield for C-186 (net return above cash per round trip). C-180 was left out of this list in the first version by mistake.
- **Stopped US parent (C-173 for the US).** The US monthly-review sleeve with the C-159 long-hold stop (25% trailing, 5% per name): `scripts/momentum-sleeve-us.mjs` with `MOM_STOP=0.25 MOM_REVIEW=monthly`. The US sleeve and its monthly twin already run; this combination does not yet and is the first thing to start, because five books are read against it.
- **Evidence status.** The US replay of the sleeve (C-131) failed and was flattered by a store that holds only companies listed today. Nothing below is tested on US history; the owner has chosen forward paper testing as the evidence. A forward test does not have that flaw: it trades only what is listed on the day. The US trend template did not confirm in the C-135 replay (+0.24% a month, interval touching zero), which is stated in the C-165 US block.
- **Not done for the US.** C-169 (equity and gold trend) is parked and has no US version. Studies C-170 and C-171 are not repeated for the US here (they need delisted names the US store does not hold).

## Books (proposed ids; each is the India block with the US terms above)

| Proposed id | India parent | US book | US-specific note |
|---|---|---|---|
| C-180 | C-160 | Industry momentum | Industries from the SIC codes the US scan already holds (`data/us/` SIC file), grouped at the 2-digit major group; at least 5 eligible names per group, else the group is skipped |
| C-181 | C-161 | 52-week-high proximity | none |
| C-182 | C-162 | Low-turnover momentum (stand-in) | the same 60-session dollar-volume stand-in; US shares-outstanding data is not in the loader |
| C-183 | C-163 | Donchian 55 breakout | stop-too-wide share measured first (see Stops) |
| C-184 | C-164 | Weekly 12-1 momentum | Friday review; a holiday Friday skips that week |
| C-185 | C-165 | Trend-template filter on the stopped US parent | the US pool will often be larger than India's 43 names; its size is shown on the card |
| C-186 | C-166 | Turn-of-month | cost expectation restated with US tiers: 12 round trips a year at 0.2% is about 2.4% a year before slippage |
| C-187 | C-167 | Volatility-targeted sleeve | 15% target, as India |
| C-188 | C-168 | MAX exclusion | as India |
| C-189 | C-172 | Pullback in an uptrend | as India |

Variants and what rejects each book are the same as in the India blocks; the kill line and the confidence figure are the only judging rules, with the owner deciding at any monthly read.

## Facts checked on 11 Nov 2026 (descriptive, no tuning)

- The US universe is built only from common stocks and ADRs (ticker types CS and ADRC in the latest tickers file); ETFs and leveraged products are not in it.
- Stock bars and benchmark bars are both from Nasdaq's quote data (split-adjusted by Nasdaq, dividends not added), per `scripts/us-hist-lib.mjs` and `scripts/backfill-us-bench.mjs`. Daily tail files are appended as published; a split that happens after the base files were cut is the one point not yet checked.
- SIC coverage is complete for the current top 200 (0 missing). Grouped at the 2-digit major group they fall into 38 groups; 13 have at least 5 names (161 of the 200 names). The largest are group 73 business services (37 names, which mixes software, advertising and staffing), 36 electronics (28), 35 machinery (19), 28 chemicals and drugs (14). So C-180 can run, but "top 4 groups" would pick roughly 100 names and group 73 is not one industry.

## Open points raised in a review on 11 Nov 2026 (NOT adopted; the owner decides each)

1. **What the US books are for.** Proposal: India is the decision market; the US books confirm or contradict the India result for the same rule; a US pass alone adopts nothing; an India pass with the US pointing the other way is marked unconfirmed; the number of rules tried is counted across both markets; US champions only, no shadow variants (no variants are run in India either). The owner has not yet said yes.
2. **Spin-offs, special dividends, mergers.** Bars are split-adjusted only, so a spin-off or special dividend looks like a price fall and can trip the 25% stop. A convention is needed before any US book starts (for example: list every stop-out from a one-day fall of 15% or more as a gap event for the owner, and credit a confirmed special dividend or spin-off distribution to the book). A name that stops trading because it was acquired is closed at its last close. The same last-close rule is not yet in the India books and should be added there too.
3. **Own costs.** The tiers are market costs; the owner's own brokerage and currency conversion are not in them, and each US card should say so.
4. **C-186.** The US evidence for turn-of-month is for the index. A book of the 20 most traded US names is close to the index anyway. A review suggested holding SPY instead; that would be an index-fund book, which the owner has excluded from the strategy books (C-169 parked, 10 Nov 2026), so it is not proposed here. Options: keep the 20-name book, or drop C-186 for the US.
5. **Judging rules.** C-177 has no month or trade minimum by the owner's decision (10 Nov 2026). It does build in sample size: the confidence figure starts from a prior centred on no edge and shrinks toward it when there are few months, shows 50% below 3 months, and shows a 90% range for the yearly edge on the card. The 12-month, 60-trade gate was replaced.
6. **Hold C-186 and C-187** until the cash source is confirmed by the probe, because at zero cash both trail by construction.

## What the owner is asked to decide

1. Adopt the US versions as written (C-179 to C-189), or amend.
2. The cash source for the US (FRED DTB3 with the Treasury's own table as fallback, subject to the probe), or another.
3. MTUM as the US momentum-fund line and comparator, or another instrument.

## Build plan once adopted

1. Probe workflow for the Treasury bill rate and MTUM bars (one run, descriptive); US stop-feasibility run (one run).
2. Start the stopped US parent (one workflow line).
3. Add a `market` setting to `scripts/paper-books.mjs` and `settings/first-wave-books.json` (US data loading as in `momentum-sleeve-us.mjs`, US tiers, US calendar, US benchmark files), then US books in the same order as India: C-181, C-184, C-183, C-186, then the parent-based books.
4. US tabs in Scans and Paper test, on the same views as India's; the all-books table shows the market.

## Log

- 11 Nov 2026: comparator list restated with US ids (C-180 added); cash series changed to DGS3MO; facts checked and review points listed as open (not adopted).
- 11 Nov 2026: created. Reason: the India first wave was drafted with India-only terms and nobody chose to leave out the US.
