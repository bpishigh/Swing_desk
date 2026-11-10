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
- **Cash.** The part of a US book not in stocks is credited at a short-term US Treasury rate. The price-only benchmark bars cannot supply it (a T-bill ETF's price barely moves; its return is its dividends). Proposed source: the daily 3-month Treasury bill rate from FRED (series DTB3), with the US Treasury's own daily bill-rate table as fallback. Neither has been reached from the GitHub runner yet, so a one-off probe comes first; until a source is confirmed the cash earns zero and the card says so. Owner decision: confirm this source, or name another.
- **Comparator per book (same table as India):** the stopped US parent for C-161, C-162, C-164, C-165 filter and C-168 (paired monthly excess); the stopped US parent for C-167 (return per unit of volatility); MTUM for C-163 and C-172 (excess return, with average exposure reported); the Treasury bill rate for C-166 (net return above cash per round trip).
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

- 11 Nov 2026: created. Reason: the India first wave was drafted with India-only terms and nobody chose to leave out the US.
