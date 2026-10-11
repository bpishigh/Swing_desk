# How a stock is shortlisted: India and US (brief for review)

Status as at 11 Oct 2026, version 3 (sections 6 to 10 revised after two outside reviews the same evening). Source: `docs/ENGINE_RULES.md` (rules) and `src/ingest/us-screen.ts` (the US code). This brief describes what is live, what is manual, and what is proposed. Sections 1 to 3 describe what exists; sections 4 to 8 are proposals and change nothing until the test in section 7 is run and the owner signs off.

## 1. The funnel, both markets

1. **Market regime** (Green, Yellow or Red) from index distribution days, breadth, follow-through day and VIX. It decides which setups are allowed, how many sectors are tradable and how much risk per trade (section 5).
2. **Sector gate and rank.** A sector passes if its 3-month return beats the benchmark's 3-month return and it closes above its 50-day average (in Red, only the 3-month test). Score = 2 x 3-month return + 1-month return. Top 4 pass (top 2 in Yellow). A sector must be in the top 4 on two consecutive weekends for full size; a new leader trades as a pilot only. Above the 200-day average is "confirmed", below is "early" (pilot only). Maximum 2 open positions per industry and 3 per sector.
3. **Stock screen** inside the passing sectors (sections 2 and 3).
4. **Setup and entry check** on each stock that passes (section 5).
5. **Trade checklist** (the 60-second check): RS leader, stop at a chart level and at least 1.5 x ATR away, size from the risk formula, cap 20% of capital, at most 2 new entries a day, highest RS first. One failed item means skip.

## 2. US: live today, run weekly (Saturday)

**Pool.** The top 10 holdings of each ETF in the passing sectors (equities only; a stock under two ETFs is kept once). Data: Tiingo split-adjusted bars; earnings date from StockAnalysis.

| Test | Rule |
|---|---|
| Trend | Close above 50-day and 200-day averages, and 50-day above 200-day |
| Leads its sector | 1-month return at least equal to its sector ETF's |
| Liquidity | Average daily dollar volume of $50 million or more |
| Results | Next results date more than 10 trading days away; unknown is flagged, never passed |
| Setup and room | A setup allowed in this regime is in place, stop width within the setup's limit, and at least 3R of room to the 50-day high |
| Freshness | Data dated before the screen date is excluded |

**Ready** = every test passes. **Watch** = trend, liquidity and results pass but no setup, room, stop width or relative strength. Setups used in the US: base breakout (1), IPO base (1ipo), 20 EMA pullback (2, Green only), 50 SMA pullback (4). The earnings-gap setup (3) is not used in the US.

## 3. India: manual today (Chartink), nothing automated

The sector gate and ranking already run from the official NSE index file. The stock scan is typed in by hand from Chartink using the trend template:

- Close above the 150-day and 200-day averages; 150-day above 200-day; 200-day rising versus a month ago.
- 50-day above the 150-day and 200-day; close above the 50-day.
- At least 30% above the 52-week low and within 25% of the 52-week high.
- Traded value over Rs 10 crore a day; price over Rs 50; market cap over Rs 1,000 crore.

Then the same setup, stop, room (2R, not 3R) and results-date checks as the US. Setup 3 (earnings gap) is allowed in India. India VIX above 20 halves risk per trade. The RS-leader test for India is: top 20% of the Nifty 500 on 3- or 6-month return.

## 4. Proposed in outline (change C-20, not built): one whole-market nightly scan

Apply one trend template to every liquid listed stock each night in both markets, with a relative-strength percentile rank, instead of the US ETF-holdings pool and the manual India scan. Liquidity floors differ by market. The data for India is already stored (daily NSE file with adjusted averages). Purpose: find smaller stocks outside the sector indexes.

## 5. Differences between the two markets today

| | US (live) | India (manual) |
|---|---|---|
| Universe | Top 10 holdings of passing sector ETFs | Whole market, market cap over Rs 1,000 crore |
| Trend tests | Close above 50 and 200; 50 above 200 | The same plus 150-day, 200-day rising, 30% above 52-week low, within 25% of 52-week high |
| High and low used | 50-session | 52-week |
| Relative strength | 1-month return versus sector ETF; RS line versus SPY checked by eye | Top 20% of Nifty 500 on 3 or 6 months |
| Liquidity | $50 million a day | Rs 10 crore a day |
| Room to resistance | 3R | 2R |
| Setups | 1, 1ipo, 2, 4 | 1, 1ipo, 2, 3, 4 |
| Max positions (Green) | 4 | 10 |

## 6. Proposed rule set, version 3 (after reviews 1 and 2)

Principle: buy the strongest stocks in a healthy market. The evidence is strongest for relative-strength momentum and for trading near 52-week highs; both can fail in sharp rebounds after a bear market, which the regime filter limits. Chart-pattern tests are trader practice with little formal evidence, so they are tested before adoption. All thresholds below are **fixed before the replay and not tuned** (section 7).

**The universe, each night, in both markets**
- **India:** the **top 750 NSE cash-segment (EQ series) stocks by trailing six-month median traded value, recomputed monthly from the daily NSE file.** This replaces the index-list idea: the Nifty Total Market index only launched on 13 October 2021 and its press release gives index values, not pre-launch constituent lists (checked 11 Oct), and NSE publishes current constituents, not monthly point-in-time lists. The daily-file universe is point-in-time, survivorship-free and the same rule live and in the replay. **The universe size is pinned at 750** so the top-20% threshold does not move with the liquidity floor.
- **India exclusions:** stocks under ASM or GSM surveillance, in the trade-for-trade segment, or on a **2% or 5% price band** (10% and wider, and no-band, stay). A stop cannot execute through a locked circuit. Listing source named at build. Historical ASM, GSM and band lists may not be reconstructible, in which case the replay universe is wider than the live one and the result is labelled flattered.
- **US:** the liquid universe the data plan allows (fixed at build). **Minimum listing age 65 sessions.**
- **Liquidity:** India Rs 10 crore a day and price over Rs 50; US $10 to 20 million a day and price over $10. One binding rule: **the planned position is at most about 1% of the stock's 20-day average traded value**, stated against the current swing capital so it moves when the Portfolio Manager changes it.

**The screen**
1. **Relative-strength score:** weighted return over the last year, 40, 20, 20, 20 across the four quarters (latest first). Percentile rank on the pinned liquid universe. **Gate and first sort key:** top 20%. The skip-the-last-month variant (12-1) is logged as a diagnostic.
2. **One trend template, 52 weeks, both markets:** close above the 50-, 150- and 200-day averages; 150-day above 200-day; 200-day rising versus a month ago; 50-day above 150-day; at least 30% above the 52-week low; within 25% of the 52-week high. **A filter, not a ranking input.**
3. **Industry strength:** median relative strength of liquid members, **minimum five members**, falling back to the sector score below that. India classification: NSE's basic-industry field. US: a sub-industry map is needed and Tiingo does not supply one; source to be named at build. The sector gate (score 2 x 3-month + 1-month, so one-month momentum is kept at industry level) and the two-week persistence rule stay as the market-level filter.
4. **Base quality at scan time, thresholds frozen:** tight = ATR over 10 sessions below 0.7 of ATR over 50; distance to the pivot within 5%.
5. **Not extended, frozen:** more than 25% above the 50-day average is extended and skipped.
6. **Breakout volume** (at least 150% of the 50-day average) is an **entry-day check**, not a scan test.
7. **Ranked output:** a fixed composite, relative-strength percentile carrying most of the weight, then base tightness, then distance to the pivot; ties by relative strength; weights logged in settings before the replay. **Top 10 shown, at most 3 per industry**, so the list shows the next-best outside a crowded theme.
8. **Shortlist in every regime.** In Red the Watch list is still produced, ready for a follow-through day.

**Rule clarifications**
- **Room, defined mechanically.** Overhead resistance = the **highest high of the prior 250 sessions, if it is above the pivot**; if not, there is none and the test is waived. Room is the distance from entry to that level, at least 3R (US) or 2R (India). The nearest swing-high resistance the trader types into the checklist at entry stays as the discretionary check; the scan uses the mechanical one so two implementations agree. The test therefore bites on stocks that are 10 to 25% below their highs.
- **IPO base (setup 1ipo).** At least **65 sessions since listing** (past the 90-day anchor-investor unlock; SEBI's 2022 rule locks 50% of anchor shares for 30 days and the rest for 90) and a formed base of at least **15 sessions**. Flag the six-month pre-IPO shareholder unlock in India and the typical 180-day insider lock-up in the US.
- **US one-month lead over the sector ETF:** a flag on the shortlist, shown and not buried, never a gate.
- **Kept as they are:** regime filter, results-date test (more than 10 trading days; unknown is flagged, never passed; India dates from NSE board-meeting announcements), stop-width limits, setups per regime, sizing, the daily cap.
- **Left out for now:** earnings-growth and fundamentals screens.

## 7. Test plan, version 3

**What is replayed.** Three versions: **A** today's rules, **codified** (for India, the Chartink template written as code, an approximation of what was done by hand, not an exact replay); **B** relative-strength gate, one template, ranked output, pinned universe (rules 1, 2, 3, 7); **C** B plus base quality and the extension limit (rules 4, 5). No further versions; the thresholds inside them are frozen in section 6.

**Two stages, kept apart.** (1) Pick quality: forward returns of each version's picks at **20 and 60 sessions** against the liquid universe and the index, with no setups, stops or exits. (2) Whole funnel: the same picks through setups, stops and exits with costs (the Portfolio Manager's charges model plus slippage that rises for thinner names).

**Data prerequisites.**
- **Corporate actions for the whole universe**, 2020 to 2025, back-filled before any replay (not just held names): an unadjusted split corrupts the trend template, and the Swing Desk store starts in October 2025.
- **NSE changed the daily-file format in 2024** (date to verify); the loader reads both layouts.
- **US:** testing on current index members is flattered by survivorship unless the vendor keeps delisted tickers (to check with Tiingo); otherwise the US result is labelled flattered. The US judging window is almost all bull market, so it says little about Red and Yellow regimes.

**Pre-registered criterion (version 3, replaces the earlier numbers).**
- **Primary comparison:** the picks B (or C) makes that A does not (the symmetric difference), because A's picks are largely a subset of B's and the shared names contribute nothing to the difference.
- **Metrics:** median, **mean and hit rate** of 20-session excess return over the liquid universe. Momentum's profit sits in the right tail and its losses in rebounds, so the median alone hides both.
- **Out-of-sample test first:** same sign and at least half the in-sample margin in at least 3 of the 5 half-years from 2024-H1 to 2026-H1. The 2020 to 2023 fit window alone proves little.
- **Report a block-bootstrap confidence interval** on the difference, not only pass or fail.
- **The margin is derived, not chosen:** set from the dispersion of A's own picks before the first run. The earlier "1 percentage point" had no stated basis and is withdrawn.
- **Sample size:** no judgement before about 300 non-overlapping picks per version per market; overlapping windows and shared names reduce the effective number.
- **If neither B nor C passes, A stays.**

**Diagnostics, not extra versions:**
- B's rules run on A's US ETF-holdings pool ("B-narrow"). If B-narrow beats A the rules help; if only the wide-universe B does, the gain is the universe, where slippage and lock-ups live.
- B's picks split by whether the last month was their strongest quarter.
- Picks tagged by whether the sector was in the top 4 and whether the pick came through the bottom-up path.
- **Rebound check:** B's and C's results in the 60 sessions after every Red-to-Green transition (March to June 2020, November 2020, April 2025). If they lose to A there, the regime filter, not the screen, needs work.

## 8. Change management

C-20 is split in two:
- **C-20a: whole-market nightly scan infrastructure.** No rule change; a wider candidate list shown alongside today's. Needs the corporate-action back-fill and the daily-file loader. Can be built now.
- **C-20b: the rule changes in section 6.** Adopted only after the section 7 criterion passes.

## 9. Review 1 (11 Oct 2026): answers to the seven questions

1. One template for both markets: yes; the US omissions come from the ETF-holdings pool. 52 weeks in both.
2. Sector first or stock alone: keep the sector gate in B; answer from the replay tags.
3. Relative strength: both gate and first sort key; percentile on the liquid universe only.
4. US one-month lead: replace with the weighted percentile; keep the one-month comparison as a flag.
5. India data: drop market cap; superseded in review 2 by the daily-file top-750 universe.
6. Ranking: a fixed, pre-registered composite; volume as an entry-day check.
7. Liquidity floors: Rs 10 crore and Rs 50 fine for India with the 1% rule; US floor down to $10 to 20 million with a $10 minimum.

## 10. Review 2 (11 Oct 2026): what was accepted and what was not

**Accepted:** the out-of-sample pass criterion and the symmetric-difference comparison; bootstrap intervals; mean and hit rate beside the median; the derived margin; the bhavcopy top-750 universe (the index-list idea fails on history); corporate-action back-fill for the whole universe; the two daily-file layouts; the B-narrow diagnostic; the 65-session IPO minimum (40 sessions fell between the 30- and 90-day unlocks); frozen thresholds in C; the rebound check; the 3-per-industry cap on the top 10; the mechanical room definition; the pinned universe size and the 12-1 diagnostic; the five-member minimum for industry medians; excluding 2% and 5% price bands only; the 300-pick sample size; the 65-session US listing minimum.

**Checked by me:** the Nifty Total Market launch date and its press-release contents (13 October 2021; index values, not earlier constituent lists). **Not checked by me:** the SEBI anchor lock-in rule (cited by the reviewer from law-firm notes), the 2024 daily-file format change, the momentum literature, and the claim that Tiingo's delisted-ticker coverage decides US survivorship.

**One simplification to flag:** the mechanical room test uses the 52-week high as overhead resistance, which is the farthest level, not the nearest swing high. It is reproducible; the trader's own nearest-resistance check at entry covers the nearer levels.

**Still for the owner to sign off:** the derived-margin method for the pass criterion (section 7), the 65-session IPO minimum with the 15-session base, and the lower US floor.
