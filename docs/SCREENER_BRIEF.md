# How a stock is shortlisted: India and US (brief for review)

Status as at 11 Oct 2026, version 5 (after four outside reviews the same day). Source: `docs/ENGINE_RULES.md` (rules) and `src/ingest/us-screen.ts` (the US code). Sections 1 to 3 describe what exists; sections 4 to 9 are proposals and change nothing until the test in section 7 is run and the owner signs off. Review history and probe results are in the appendices.

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


## 6. Proposed rule set (version 5, after reviews 1 to 4)

Principle: buy the strongest stocks in a healthy market. The evidence is strongest for relative-strength momentum and for trading near 52-week highs; both can fail in sharp rebounds after a bear market, which the regime filter limits. Chart-pattern tests are trader practice with little formal evidence, so they are tested before adoption. All thresholds below are **fixed before the replay and not tuned** (section 7).

**The universe, each night, in both markets**
- **India:** the **top 750 NSE cash-segment (EQ series) stocks by trailing six-month median traded value, recomputed monthly from the daily NSE file.** This replaces the index-list idea: the Nifty Total Market index only launched on 13 October 2021 and its press release gives index values, not pre-launch constituent lists (checked 11 Oct), and NSE publishes current constituents, not monthly point-in-time lists. The daily-file universe is point-in-time, survivorship-free and the same rule live and in the replay. **The universe size is pinned at 750** so the top-20% threshold does not move. **The rank defines the universe; there is no separate rupee floor** (a floor could shrink the universe and move the threshold). The replay reports the traded value of the 750th name each month. A stock with at least 65 sessions of history enters the ranking using its median over the history available, so a recent listing is not shut out by the six-month window.
- **India exclusions:** stocks under ASM or GSM surveillance, in the trade-for-trade segment, or on a **2% or 5% price band** (10% and wider, and no-band, stay). A stop cannot execute through a locked circuit. Listing source named at build. Historical ASM, GSM and band lists may not be reconstructible, in which case the replay universe is wider than the live one and the result is labelled flattered.
- **US:** the **top 1,500 common stocks by 20-day dollar volume, universe size pinned at 1,500** (so the top-20% threshold does not float), with a **$10 million a day floor as a safety net, a single number, and a $10 minimum price**. Minimum listing age 65 sessions. **Source: Massive (formerly Polygon) grouped daily, free plan, no cost (section 9).** Common stocks are selected with Massive's tickers reference endpoint (type field), refreshed monthly and stored with its as-of date, so a past universe is built from the list as it stood (reviewer's claim that this endpoint is free on our plan is unverified; checked at build). **Histories are keyed on the composite FIGI, or broken at the delisting date, so a reissued ticker never splices two companies into one series.**
- **Liquidity:** India price over Rs 50 (no separate traded-value floor); US as above. One binding rule: **the planned position is at most about 1% of the stock's 20-day average traded value**, stated against the current swing capital so it moves when the Portfolio Manager changes it.

**The screen**
1. **Relative-strength score:** weighted return over the last year, 40, 20, 20, 20 across the four quarters (latest first). Percentile rank on the pinned liquid universe. **Gate and first sort key:** top 20%. The skip-the-last-month variant (12-1) is logged as a diagnostic.
2. **One trend template, 52 weeks, both markets:** close above the 50-, 150- and 200-day averages; 150-day above 200-day; 200-day rising versus a month ago; 50-day above 150-day; at least 30% above the 52-week low; within 25% of the 52-week high. **A filter, not a ranking input.**
3. **Industry strength:** median relative strength of liquid members, **minimum five members**, falling back to the sector score below that. India classification: NSE's basic-industry field. US: a sub-industry map is needed and the price source does not supply one; source to be named at build. The sector gate (score 2 x 3-month + 1-month, so one-month momentum is kept at industry level) and the two-week persistence rule stay as the market-level filter.
4. **Base quality at scan time, thresholds frozen:** tight = ATR over 10 sessions below 0.7 of ATR over 50; distance to the pivot within 5%.
5. **Not extended, frozen:** more than 25% above the 50-day average is extended and skipped.
6. **Breakout volume** (at least 150% of the 50-day average) is an **entry-day check**, not a scan test.
7. **Ranked output:** a fixed composite, relative-strength percentile carrying most of the weight, then base tightness, then distance to the pivot; ties by relative strength; weights logged in settings before the replay. **Top 10 shown, at most 3 per industry**, so the list shows the next-best outside a crowded theme.
8. **Shortlist in every regime.** In Red the Watch list is still produced, ready for a follow-through day.

**Rule clarifications**
- **Room, defined mechanically.** Overhead resistance = the **highest high of the prior 250 sessions, if it is above the pivot**; if not, there is none and the test is waived. Room is the distance from entry to that level, at least 3R (US) or 2R (India). **The replay reports how many template passers that are not at highs this test removes;** if it removes most of them, the test is doing the template's job twice and the pre-registered fix is 2R in both markets (an owner decision, since the US 3R reflects the tax drag), not a looser resistance definition. The nearest swing-high resistance the trader types into the checklist at entry stays as the discretionary check; the scan uses the mechanical one so two implementations agree. The test therefore bites on stocks that are 10 to 25% below their highs.
- **IPO base (setup 1ipo).** The anchor lock-in runs from the allotment date and SEBI's 2022 rule locks 50% of anchor shares for 30 days and the rest for 90, so the rule is **at least 95 calendar days since allotment**. Our data holds the listing date, not the allotment date, so it is applied as **at least 100 calendar days since listing** (about 69 sessions), which clears the 90-day unlock under both the T+3 and the older T+6 listing timetables. A **formed base** is at least **15 sessions**, **depth no more than 25% from the base high**, and the **pivot within 5% of the base high** (so 15 sessions of decline does not qualify). Flag the six-month pre-IPO shareholder unlock in India and the typical 180-day insider lock-up in the US. The US general minimum listing age stays at 65 sessions.
- **US one-month lead over the sector ETF:** a flag on the shortlist, shown and not buried, never a gate.
- **Kept as they are:** regime filter, results-date test (more than 10 trading days; unknown is flagged, never passed; India dates from NSE board-meeting announcements), stop-width limits, setups per regime, sizing, the daily cap.
- **Left out for now:** earnings-growth and fundamentals screens.


## 7. Test plan (version 5)

**What is replayed.** Three versions: **A** today's rules, **codified** (for India, the Chartink template written as code, an approximation of what was done by hand, not an exact replay); **B** relative-strength gate, one template, ranked output, pinned universe (rules 1, 2, 3, 7); **C** B plus base quality and the extension limit (rules 4, 5). No further versions; the thresholds inside them are frozen in section 6. **Tested hierarchically: B is compared with A first; C is evaluated only if B passes, and the question C answers is whether base quality and the extension limit add to B.** This keeps the false-pass rate at the stated level (two parallel 90% tests would give roughly one in five).

**Two stages, kept apart.** (1) Pick quality: forward returns of each version's picks at **20 and 60 sessions** against the liquid universe and the index, with no setups, stops or exits. (2) Whole funnel: the same picks through setups, stops and exits with costs (the Portfolio Manager's charges model plus slippage that rises for thinner names).

**Data prerequisites.**
- **Corporate actions for the whole universe**, 2020 to 2025, back-filled before any replay (not just held names): an unadjusted split corrupts the trend template, and the Swing Desk store starts in October 2025.
- **NSE changed the daily-file format in 2024** (date to verify); the loader reads both layouts.
- **US:** Massive keeps delisted names on past dates (probe, appendix B), so the US replay is not survivorship-biased on that evidence; it covers about two years only (section 9). **One US price source for screen, stops and engine** (decision below), or a daily reconciliation with a stated tolerance; two closes for one stock on days the vendors disagree are not allowed.
- **India data load is weeks of work, not a switch.** NSE's archive is free but hostile to automation (cookies, headers, rate limits, blocks): a throttled, resumable job for 2020 to 2025, expected to be re-run. The corporate-action history (NSE corporate-actions CSV) is the larger piece. The India test is possible at no cost; it is **not ready**.

**Pre-registered criterion (version 4).** Two conditions, each with an external anchor, so nobody picks a number.
- **Primary comparison:** the picks B (or C) makes that A does not (the symmetric difference), out of sample (2024 to 2026), because A's picks are largely a subset of B's and the shared names contribute nothing to the difference.
- **Statistical condition:** the **block-bootstrap 90% interval on the mean 20-session excess return** of those picks (over the liquid universe) **excludes zero**.
- **Economic condition:** the point estimate **exceeds the extra cost of trading the difference**. When the daily entry cap binds, the symmetric-difference picks are trades B makes instead of A's trades, so the bar is the cost *difference* (charges model plus slippage for the thinner tier, less the cost of the A trade displaced), not the full round trip. When the cap does not bind (the extra picks are additional trades), the full round trip of the median pick applies. Which case holds is stated in the replay report.
- **Also reported:** median and hit rate; the sign of the difference in each half-year from 2024-H1 to 2026-H1 as a consistency report. "3 of 5 half-years" is dropped as a pass condition, because five coin flips give three the same sign more often than not; if a per-period condition is wanted, 4 of 5 is the weakest that means anything.
- **Sample size:** no judgement before about 300 non-overlapping picks per version per market; overlapping windows and shared names reduce the effective number.
- **Forward test read date, fixed now.** The forward log (section 9) is read once, after **300 non-overlapping picks per version or twelve months of logging, whichever is later**, with the section 7 criterion. At the US weekly cadence (a handful of names) this is likely more than a year; nobody reads it earlier because it looks good. C's candidates are logged beside A's and B's from the same night.
- **If neither B nor C passes, A stays.** The 2020 to 2023 window is for fitting and diagnostics only.

**Diagnostics, not extra versions:**
- B's rules run on A's US ETF-holdings pool ("B-narrow"). If B-narrow beats A the rules help; if only the wide-universe B does, the gain is the universe, where slippage and lock-ups live.
- B's picks split by whether the last month was their strongest quarter.
- Picks tagged by whether the sector was in the top 4 and whether the pick came through the bottom-up path.
- **Rebound check:** B's and C's results in the 60 sessions after every Red-to-Green transition (March to June 2020, November 2020, April 2025). If they lose to A there, the regime filter, not the screen, needs work.


## 8. Change management

C-20 is split in two:
- **C-20a: whole-market nightly scan infrastructure.** No rule change; a wider candidate list shown alongside today's. Needs the corporate-action back-fill and the daily-file loader. Can be built now.
- **C-20b: the rule changes in section 6.** Adopted only after the section 7 criterion passes.
- **Order of work:** (0) back-fill the free Massive window (section 9), before anything else; (1) C-20a infrastructure; (2) replay; (3) sign-off on C-20b.

## 9. Data plan and no-spend evidence standard (owner decision, 11 Oct 2026: no paid plans, no money spent)

**US source: Massive free plan, grouped daily endpoint.** One call returns every US stock for one date; the free plan serves about two years and the window rolls forward every day. The existing `POLYGON_KEY` secret works (appendix B). Tiingo's free plan (500 symbols a month) cannot supply a whole-market history; no paid plan is bought.

**Back-fill now (time-sensitive).** Every day not fetched is lost for good once it leaves the two-year window. About 500 grouped-day calls at 5 a minute is under two hours of workflow time, roughly 110 Actions minutes (the dashboard projects 1,243 of 2,000 for the month against a 1,400 target, so this one-off sits close to the target). Run first, store the result, then the nightly call extends it.

**Storage: all common stocks, every day, 4 to 5 fields.** Close, high, low, volume, dollar volume or VWAP, for about 11,000 rows a day, gzipped to well under 100 KB a day: a year is under 30 MB and the repo can hold it. The top-1,500 ranking needs 20-day volume for every candidate before the cut, and a stock that enters the universe next month needs its history today. A 3,000-name cut would throw away the names C-20 exists to find. Raw files (1.3 MB a day) are not stored.

**Evidence standard.**
- **India:** the full section 7 test, at no cost, once the NSE load is done.
- **US:** the free window (about Nov 2024 to now: one correction, otherwise bull market) cannot meet the sample-size and regime requirements. The US replay is a **consistency check, not a decision test**: B or C is adopted for the US only if it passes in India and the US replay shows the same sign and does not contradict it. The B-narrow diagnostic still runs over the free two years.
- **Forward test (free):** from the day the nightly scan runs, every night's shortlist (ticker, rank, trigger) is stored in the repo and scored on 20- and 60-session forward returns as they mature, with A, B and C logged side by side. Read date fixed in section 7. This is the real US decision.
- **Nightly US scan:** one call a day on the existing key; Actions minutes are measured before it is switched on.

**Owner sign-offs outstanding.** (1) The no-spend evidence standard above. (2) Sections 6 and 7 as modified. (3) The nightly US job on the free key. (4) Starting the back-fill now. Nothing else is built until these are answered.

---

# Appendix A. Review history (11 Oct 2026; decisions are in sections 6 to 9)

## A1. Review 1 (11 Oct 2026): answers to the seven questions

1. One template for both markets: yes; the US omissions come from the ETF-holdings pool. 52 weeks in both.
2. Sector first or stock alone: keep the sector gate in B; answer from the replay tags.
3. Relative strength: both gate and first sort key; percentile on the liquid universe only.
4. US one-month lead: replace with the weighted percentile; keep the one-month comparison as a flag.
5. India data: drop market cap; superseded in review 2 by the daily-file top-750 universe.
6. Ranking: a fixed, pre-registered composite; volume as an entry-day check.
7. Liquidity floors: Rs 10 crore and Rs 50 fine for India with the 1% rule; US floor down to $10 to 20 million with a $10 minimum.

## A2. Review 2 (11 Oct 2026): what was accepted and what was not

**Accepted:** the out-of-sample pass criterion and the symmetric-difference comparison; bootstrap intervals; mean and hit rate beside the median; the derived margin; the bhavcopy top-750 universe (the index-list idea fails on history); corporate-action back-fill for the whole universe; the two daily-file layouts; the B-narrow diagnostic; the 65-session IPO minimum (40 sessions fell between the 30- and 90-day unlocks); frozen thresholds in C; the rebound check; the 3-per-industry cap on the top 10; the mechanical room definition; the pinned universe size and the 12-1 diagnostic; the five-member minimum for industry medians; excluding 2% and 5% price bands only; the 300-pick sample size; the 65-session US listing minimum.

**Checked by me:** the Nifty Total Market launch date and its press-release contents (13 October 2021; index values, not earlier constituent lists). **Not checked by me:** the SEBI anchor lock-in rule (cited by the reviewer from law-firm notes), the 2024 daily-file format change, the momentum literature, and the claim that Tiingo's delisted-ticker coverage decides US survivorship.

**One simplification to flag:** the mechanical room test uses the 52-week high as overhead resistance, which is the farthest level, not the nearest swing high. It is reproducible; the trader's own nearest-resistance check at entry covers the nearer levels.

**Still for the owner to sign off:** see section 11.

## A3. Review 3 (11 Oct 2026): the three sign-offs, each with one modification

The reviewer's recommendation was to sign off all three, but none as written. The modified versions are in sections 6 and 7.

1. **The pass margin.** Principle kept (derived, not chosen); the method changed, because "set from the dispersion of A's own picks" was still a free choice. It is replaced by a bootstrap condition and an economic condition anchored to trading cost (section 7). "3 of 5 half-years" is dropped as a pass condition.
2. **The IPO minimum.** The 65 sessions and the 15-session base stand, restated in calendar days from allotment (at least 95) because that is what the rule protects against; applied as at least 100 days from listing, since our data has the listing date. The base is defined by depth (at most 25%) and pivot position (within 5% of the base high). **A departure from the reviewer's wording:** the reviewer wrote 95 days from allotment; I apply 100 days from listing because the allotment date is not in our data, and say so.
3. **The US liquidity floor.** $10 million, one number (not a range, which becomes a tuning knob), with the US universe pinned at the top 1,500 by 20-day dollar volume so the percentile does not float.

**Four conflicts found in version 3 and fixed:**
- The six-month median traded value kept every recent IPO out of the universe while setup 1ipo needs one. Fixed: a stock enters once it has 65 sessions, using its history so far.
- A Rs 10 crore floor and a pinned 750 could disagree. Fixed: the rank defines the India universe and the floor is dropped; the 750th name's traded value is reported monthly.
- The mechanical room test would pass mainly at new highs. A diagnostic and a pre-registered fallback (2R in both markets) were added.
- Items marked "not checked": the anchor lock-in is in SEBI's ICDR (Amendment) Regulations 2022, effective 1 April 2022, amending Schedule XIII; the reviewer's law-firm notes summarise it and the gazette is the primary source. The 2024 daily-file format change (NSE's move to the common UDiFF file, per the reviewer's recollection) stays marked "to verify" until the loader is written against a real file from each side of the change.

**For the owner:** approve sections 6 and 7 as modified, or say what to change. Nothing is built until you do. Open check: whether the data plan can supply 1,500 US tickers a day.

## A4. Review 4 (11 Oct 2026): accepted

All points accepted and folded into sections 6 to 9:
- Back-fill the free Massive window first; store all common stocks per day, 4 to 5 fields.
- Common-stock filter from the tickers reference endpoint with an as-of date; break histories at ticker reuse (FIGI or delisting date).
- Section 6 US universe rewritten from Tiingo to 1,500 on Massive; one US price source or a daily reconciliation tolerance.
- Test B before C (hierarchical), so the error rate holds without a wider interval.
- Economic condition on the cost difference, not the absolute cost. **Nuance added:** the difference applies when the daily cap binds; otherwise the full round trip.
- Forward-test read date pre-registered (300 non-overlapping picks per version or twelve months, whichever is later).
- India data load stated as weeks of work; section 7 heading corrected; document restructured into decisions plus appendices.
- Reviewer's assessments kept: US evidence standard honest; three delisted names say "not obviously survivorship-biased", not "clean"; adjusted flag sufficient for the template and RS score; IPO rule in calendar days is robust.
- **Not verified by me:** that the tickers reference endpoint is free on our plan.

# Appendix B. Probe results and data-plan facts

**Data plan facts (11 Oct):** Tiingo Starter (free) 50 requests an hour, 1,000 a day, 500 unique symbols a month, 1 GB bandwidth; Power $30 a month, 10,000 an hour, 100,000 a day, 110,247 symbols a month, 40 GB; both with 30+ years of end-of-day history. The existing US jobs (about 40 screen stocks, sector ETFs, daily tickers) already use part of the free 500-symbol monthly allowance. Source: Tiingo's pricing page, read 11 Oct; the live key's own plan and usage were not visible to me.

**Alternative US sources (checked 11 Oct from the vendors' pricing and documentation pages):**
- **Massive (formerly Polygon), grouped daily endpoint:** one request returns open, high, low, close, volume and VWAP for **all US stocks on one date**, with an `adjusted` switch for splits. Free Basic plan: 5 calls a minute, 2 years of history, end-of-day data. Starter $29 a month: unlimited calls, 5 years of history. Developer $79 a month: 10 years. Records exist back to 2003 but each plan limits how far back it serves. A past date returns whoever traded that day, so it is point-in-time by construction; delisted-ticker coverage is **not stated on the page (to verify)**, as is how split adjustment behaves for old dates. The free plan is enough for the nightly scan (one call a day; about 260 calls to build a year of history); the full 2020 to 2026 test needs the $79 Developer plan for one month (the 5-year Starter plan reaches only back to late 2021).
- **EODHD, bulk end-of-day API:** one exchange for one date per request, flat 100 calls; also splits and dividends in bulk. The free plan has no bulk (20 calls a day). The $19.99 plan has 100,000 calls a day, but the page lists bulk only under higher plans, so whether $19.99 includes it is **unclear (to verify with support)**; delisted coverage is not stated.
- **Tiingo** has no bulk end-of-day file (per-ticker only).

**The Massive key is already in use (confirmed 11 Oct from the stored probe log, `data/source-test/log.ndjson`, run 10 Oct).** The repo's `POLYGON_KEY` secret exists and works on the current plan: the grouped daily call for 9 Oct 2026 returned 12,598 US rows in one request (status 200, 0.5 seconds, 1.3 MB, unadjusted), and its SPY close (778.57) matched Tiingo's exactly. A 400-day SPY history call returned 276 sessions. Not yet tested: the 2-year history limit on the free plan in practice, the delisted-ticker coverage of past dates, and the adjusted-price behaviour for old dates (the probe used unadjusted prices).

**Massive probe results (run 11 Oct 2026, `data/source-test/massive-probe.json`; script `probes/probe-massive.mjs`, workflow `probe-massive`):**
1. **History depth on the free plan: about two years, as advertised.** Grouped daily bars were served for 10 Oct 2025, 11 Apr 2025 and 8 Nov 2024 (10,676 rows) and refused (HTTP 403, "past historical entitlements") for 11 Sep 2024, 12 Oct 2023, 12 Oct 2021 and 16 Mar 2020. So the free plan cannot serve the 2020 to 2023 fitting window.
2. **Delisted names are present on past dates.** WBA, JNPR and ANSS (all delisted in 2025) appear on 4 Mar 2025 and are absent on 9 Oct 2026, while AAPL appears on both. Past dates are point-in-time, so the US replay is not survivorship-biased on this evidence (three names checked, not a full audit).
3. **Split adjustment works on old dates.** For ORLY (15-for-1, effective 10 Jun 2025), the 6 Jun 2025 close is 1,377.72 raw and 91.848 adjusted, a ratio of exactly 15; the splits endpoint returns the same split. Dividend adjustment was not tested.
4. **A grouped day holds about 11,000 to 12,600 rows**, including ETFs and other non-common securities; the universe step must filter to common stocks (and ETFs where wanted) before ranking.
5. **Still needed for the full test:** the Developer plan ($79 for one month, 10 years of history) for 2020 to 2023; the free plan covers late 2024 onward.
