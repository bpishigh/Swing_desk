# How a stock is shortlisted: India and US (brief for review)

Status as at 11 Oct 2026, version 2 (sections 6 to 8 revised after the first outside review the same evening). Source: `docs/ENGINE_RULES.md` (rules) and `src/ingest/us-screen.ts` (the US code). This brief describes what is live, what is manual, and what is proposed. Sections 1 to 3 describe what exists; sections 4 to 8 are proposals and change nothing until the test in section 7 is run and the owner signs off.

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

## 6. Proposed rule set, version 2 (after review 1)

Principle: buy the strongest stocks in a healthy market. The evidence is strongest for relative-strength momentum and for trading near 52-week highs; both can fail in sharp rebounds after a bear market, which the regime filter limits. Chart-pattern tests are trader practice with little formal evidence, so they are tested before adoption.

**The universe, each night, in both markets**
- **India:** the Nifty Total Market index (about 750 names, a published constituent list) or Nifty 500 plus Microcap 250, instead of a market-cap test (NSE's daily file has none). Cash-segment EQ series only. **Excluded:** stocks under ASM or GSM surveillance, in the trade-for-trade segment, or on a 5% price band, because a stop cannot execute through a locked circuit. Listing source for the exclusions to be named at build. To be verified: that the constituent lists are available point-in-time back to 2020.
- **US:** the liquid universe the data plan allows (to be fixed at build), not just ETF holdings.
- **Liquidity:** India Rs 10 crore a day and price over Rs 50; US a floor of $10 to 20 million a day and price over $10 (down from $50 million, which excludes the smaller names C-20 wants). Both are backed by one rule: **the planned position is at most about 1% of the stock's 20-day average traded value**, stated against the current swing capital so it moves when the Portfolio Manager changes it.

**The screen**
1. **Relative-strength score:** weighted return over the last year, 40, 20, 20, 20 across the four quarters (latest first). Percentile rank on the **liquid universe only**, so a thin stock's spike does not move the thresholds. **Gate and first sort key:** top 20%.
2. **One trend template, 52 weeks, both markets:** close above the 50-, 150- and 200-day averages; 150-day above 200-day; 200-day rising versus a month ago; 50-day above 150-day; at least 30% above the 52-week low; within 25% of the 52-week high.
3. **Industry strength:** rank industries by the **median** relative strength of members that pass the liquidity floor (not an average over all members, which illiquid microcaps would dominate). India classification: NSE's basic-industry field. US: a sub-industry map is needed and Tiingo does not supply one; source to be named at build. The sector gate and two-week persistence rule stay as the market-level filter until the industry ranking is tested.
4. **Base quality at scan time:** range narrowing as a ratio (ATR over 10 sessions divided by ATR over 50 sessions; the cut-off is set by the test) and distance to the pivot within 5%. **Breakout volume (at least 150% of the 50-day average) is an entry-day check on the trade checklist, not a scan test**, because the breakout has not happened at scan time.
5. **Not extended:** skip a stock too far above its 50-day average (limit set by the test).
6. **Ranked output:** a fixed, pre-registered composite, relative-strength percentile carrying most of the weight, then base tightness, then distance to the pivot; ties by relative strength. Weights fixed before the replay and logged in settings. Top 10 shown.
7. **Shortlist in every regime.** In Red the top 20% are the stocks that fell least; no entries are allowed, but the Watch list is produced so it is ready for a follow-through day.

**Rule clarifications (these fix ambiguities in today's text)**
- **Room.** "At least 3R (US) or 2R (India) of room" means distance from entry to the **nearest overhead resistance above the pivot**. It is **waived when the entry is at a 52-week or all-time high**, where there is no overhead supply. As written today ("room to the 50-day high") a base breakout, which triggers at the pivot, cannot pass.
- **IPO base (setup 1ipo).** To stop the rule itself preventing the "hot listing" mistake: proposed minimum **40 sessions since listing and a formed base of at least 15 sessions**; numbers pre-registered with the owner before use.
- **The US one-month lead over the sector ETF** stops being a gate. The one-month comparison stays as a flag on the shortlist ("lagging its sector"), never a gate, because one-month returns are where short-term reversal is strongest.
- **Kept as they are:** regime filter, results-date test (more than 10 trading days; unknown is flagged, never passed; India dates from the NSE board-meeting announcements), stop-width limits, setups per regime, sizing, the daily cap.
- **Left out for now:** earnings-growth and fundamentals screens.

## 7. Test plan, version 2

**What is replayed.** Three versions: **A** today's rules, **codified** (for India, A is the Chartink template written as code and is an approximation of what was actually done by hand, not an exact replay); **B** relative-strength gate, one template, ranked output (rules 1, 2, 3, 6); **C** B plus base quality and the extension limit (rules 4 and 5). No further versions.

**Two stages, kept apart.**
1. **Pick quality:** forward returns of each version's picks at **20 and 60 sessions**, against the liquid universe and the index. No setups, stops or exits, because exit rules can mask or manufacture a difference in pick quality.
2. **Whole funnel:** the same picks run through setups, stops and exits, with costs. Costs use the Portfolio Manager's charges model plus a slippage assumption that rises for thinner names, since the widened universe is where slippage lives.

**Pre-registered pass criterion (proposal, owner to sign off before the replay).** The metric that decides is **median 20-session excess return over the liquid universe**. B or C must beat A by at least **1 percentage point**, and do so in at least **4 of 6 half-year sub-periods** within 2020 to 2023 (fit) and hold up in 2024 to 2026 (judge). If neither passes, A stays. The numbers are written down before the first run.

**Diagnostics, not extra versions** (they cost nothing in overfitting):
- Split B's picks by whether the last month was their strongest quarter; if they underperform, the fix is a pre-registered variant later, not a tweak now.
- Tag every pick with whether its sector was in the top 4 and whether it came through the bottom-up path, and compare the two groups. If outside-sector leaders do as well, widening the bottom-up path from pilot to full size becomes a later change.

**Data.**
- **India:** NSE's daily file is point-in-time and includes names that later delisted, so it is survivorship-free once symbol changes are mapped. We hold about a year (from Oct 2025); the archive is loaded back to 2020 once, with splits and bonuses adjusted. The 2024 to 2026 judging window holds one correction (late 2024 to early 2025).
- **US:** testing on current index members is flattered by survivorship. The honest fix is a vendor that keeps delisted tickers; otherwise the US result is labelled flattered. The US judging window is almost entirely a bull market, so it says little about Red and Yellow regimes.

## 8. Change management

C-20 is split in two so the risky part waits for the test:
- **C-20a: whole-market nightly scan infrastructure.** No rule change; a wider candidate list shown alongside today's. Can be built now.
- **C-20b: the rule changes in section 6.** Adopted only after section 7 passes.

## 9. Review 1 (11 Oct 2026): answers to the seven questions

1. **One template for both markets:** yes. The US omissions are an artefact of the ETF-holdings pool, where every name already passes them; with a wider universe they do the work. 52 weeks in both.
2. **Sector first or stock alone:** keep the sector gate in B; answer from the replay by tagging picks (section 7 diagnostics), not by design.
3. **Relative strength:** both a gate and the first sort key; percentile on the liquid universe only.
4. **US one-month lead:** replace with the same weighted relative-strength percentile; keep the one-month comparison as a flag only.
5. **India data:** drop market cap; use a published index universe (Nifty Total Market, about 750 names, or Nifty 500 plus Microcap 250) for both the market-cap question and survivorship; the traded-value floor plus the 1% rule handle liquidity; results dates from NSE board-meeting announcements.
6. **Ranking inside the shortlist:** a fixed, pre-registered composite (relative strength, then tightness, then distance to pivot), volume as an entry-day check.
7. **Liquidity floors:** Rs 10 crore and Rs 50 are fine for India once the 1% rule exists (it binds first above about Rs 10 lakh); the US $50 million floor can come down to $10 to 20 million with a $10 minimum price; state floors against current swing capital.

Open for the owner: sign-off on the pass criterion (section 7), the IPO-base numbers (section 6) and the lower US floor.
