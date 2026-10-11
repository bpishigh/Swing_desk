# How a stock is shortlisted: India and US (brief for review)

Status as at 11 Oct 2026 (sections 6 and 7 added the same evening). Source: `docs/ENGINE_RULES.md` (rules) and `src/ingest/us-screen.ts` (the US code). This brief describes what is live, what is manual, and what is proposed. Nothing here is a new rule except section 4.

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

## 6. Proposed rule set (for review; replaces section 4's outline)

Principle: buy the strongest stocks in a healthy market. The evidence is strongest for relative-strength momentum and for trading near 52-week highs; both can fail in sharp rebounds after a bear market, which the regime filter is there to limit. Chart-pattern tests (tight bases, volume dry-up) are trader practice with little formal evidence, so they are tested before they are adopted.

**Same logic in India and the US, applied to every liquid stock each night:**
1. **Relative-strength score.** Weighted return over the last year, leaning on the last 3 months (weights about 40, 20, 20, 20 across the four quarters). Rank by percentile across the liquid universe. Gate: top 20%.
2. **One full trend template:** close above the 50-, 150- and 200-day averages; 150-day above 200-day; 200-day rising versus a month ago; 50-day above 150-day; at least 30% above the 52-week low; within 25% of the 52-week high. 52 weeks in both markets (the US currently uses 50 sessions).
3. **Industry-group strength.** Score each industry by the average relative strength of its members; replace the US "top 10 holdings of 4 ETFs" pool and India's coarse sector indices. Keep the sector gate and persistence rule as a market-level filter until the industry ranking is tested.
4. **Base quality (tested first, adopted only if it helps):** daily range narrowing over the last 10 to 15 sessions; price within 5% of the pivot; breakout volume at least 150% of the 50-day average.
5. **Not extended:** skip a stock too far above its 50-day average (limit set by test).
6. **Liquidity scaled to the trade:** planned position at most about 1% of the stock's 20-day average traded value, plus the existing floors.
7. **Ranked output:** show the top 10 ranked by relative strength, base tightness, volume and distance from the pivot, not an unordered list.
8. **Kept as they are:** regime filter, results-date test (more than 10 trading days), stop-width limits, room (3R US, 2R India), the setups per regime, sizing and the daily entry cap.
9. **Left out for now:** earnings-growth and fundamentals screens (a second data source and system; add later if wanted).

## 7. Test plan (before any rule is adopted)

Replay each version on past data and compare the forward returns, hit rate and R-multiples of its picks against the whole market. Three versions: **A** today's rules; **B** relative-strength gate plus the full template plus ranked output (1, 2, 3, 7); **C** B plus base quality and the extension limit (4, 5). Fit on 2020 to 2023 and judge on 2024 to 2026 so the rules are not tuned to the past; no more than these three versions, to limit overfitting.

Data limits: India stores about a year of daily files (from Oct 2025); NSE's archive would be loaded back to 2020 once, with splits and bonuses adjusted. US: testing on current index members flatters results because stocks that later left are missing; the history available depends on the data plan.

## 8. Questions for the reviewer

1. Should the two markets share one trend template? The US screen skips the 150-day, rising 200-day and 52-week proximity tests that India uses, and uses 50-session highs and lows instead of 52 weeks.
2. Should a stock be allowed only inside a top-4 sector, or may a stock outside the sector indexes qualify on its own? Engine Rules say sector first, but C-20 aims to find stocks outside the indexes. A "bottom-up leader" path (3 or more stocks of one industry passing) already exists as pilot size only.
3. Is the relative-strength rank a gate (top 20%) or just a sort order? In the US it is checked by eye today.
4. Is a 1-month lead over the sector ETF the right US test, or should it be 3-month and 6-month relative strength as in India?
5. Data for the India build: NSE's daily file has no market cap and no results dates. Market cap would be approximated (price times shares from another source) or replaced by a traded-value floor; results dates need the NSE board-meeting calendar. Which is acceptable?
6. Ranking inside a sector: by relative-strength percentile, by distance from the pivot, or by volume dry-up? Today there is no ranking beyond "highest RS first" at the daily entry cap.
7. Are the liquidity floors (Rs 10 crore, $50 million) and the minimum price (Rs 50) right for the position sizes in use?
