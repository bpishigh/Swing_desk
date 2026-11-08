# Test register: what we tested, what happened, what we learned

One page that lists every test we have run on the Swing Desk and Portfolio Manager rules, in plain words, so nothing is repeated by accident. The full record of each test is its row in the Engine Rules change log (docs/ENGINE_RULES.md); the reports are in docs/replay/. Built 1 Nov 2026; brought up to date through C-129 and its addendum on 1 Nov 2026.

## Start here

- **No stock rule we tested has passed its pre-registered test against the index in both India and the US.** That includes the desk's swing setups, momentum picking, holding picks longer, a cash switch, and a published weekly momentum book. One idea (C-129, below) came out ahead of the index in direction but failed on significance.
- **The swing setups show no edge.** Changing their stop limits (C-126) or limiting them to strong-momentum stocks (C-127) did not help.
- **Momentum picking is the only thing with a small edge**, and only against its own list of stocks, not against the index. India: about +0.5% a month more than that list, but the range of doubt just touches zero. The US result is larger but flattered by survivor bias.
- **India 2021 to 2025 looks good in several tests.** It is one strong market, and not a judged period.
- **The market light and the sector ranking have now been tested on their own, and neither shows an edge (C-133, C-134, C-136).** Green months did not come before better index returns than other months in India or the US, nor in the 2006-2009 window; the top-four sectors did worse than the average sector in both markets. The stop widening and room rule (C-125, C-126) also had no support. The trend template (C-135) is the one original rule with a clear result: in India, stocks passing it beat those failing it by about 1.2% a month, in 8 of 9 years, but the US did not confirm it and it is a stock-picking effect, not a tested way to trade.
- **Fund tests**: the fund score works as a warning and a cost filter, not as a buy signal.
- **The momentum factor looks positive in direction but is unconfirmed (C-129).** A sleeve built to NSE's Nifty200 Momentum 30 outline made +213% against the Nifty 200's +129% in India 2011-2019 (13.8% a year against 9.8%), and +182% against +102% in 2021-25 (reported only). It still failed its own rule: the monthly edge (+0.32%) was too noisy to confirm, and it beat the index in only 4 of 9 years. 2017 carries the result: without it the lead is about 1.8 points a year, not 3.9. Trading costs take about 0.73% a year, and tax is not counted. The test was too small to detect an edge of this size (it could only see 0.46% a month or more). Compared with NSE's own index series, it tracks well (monthly correlation 0.915, target 0.9), so it is a fair copy of the strategy with a mid-cap tilt (traded value stands in for market size). NSE's series made more over 2011-2019 (+318% against our +213%), but its pre-2020 history is NSE's own back-calculation and not a live record.
- **The rules running on the desk today are in a weaker position than momentum.** The setups, the stop caps and the room test have no edge in any judged test, and the market light and sector ranking, tested on their own on 1 Nov 2026, showed none either. They still scan, give signals and run in paper tests. Momentum has weak positive evidence. Neither is proven, so owner's direction on 1 Nov is to run both and judge both the same way (see section 5).
- **Momentum has had a weak two years.** NSE's Nifty200 Momentum 30 index is down 17.2% over two years against 3.8% for the Nifty 500, and 24% below its Sep 2024 peak. Since Jan 2021 it is +116% (14.4% a year) against +94% (12.2% a year), about 2 points a year, price only. Several momentum ETFs have fallen significantly over the same stretch. The evidence is best described as weak and mixed.
- **For holding the factor, an index fund beats self-running it.** The direct plan of Kotak's Nifty 200 Momentum 30 fund charges 0.20% (base) with tracking error 0.20%; our sleeve costs about 0.73% a year in trading, deviates from the index by about 4 points a year, and passes short-term tax on. The sleeve is a research tool and a paper book, not a way to hold the factor.
- **What is still open**: the US without survivor bias, India's sector ranking and trend template before 2010 (no data stored), and forward paper trading on new data.

## Plain words

- **Index**: the Nifty 500 in India, the S&P 500 fund SPY in the US, held and not traded.
- **Excess**: how much better or worse a pick did than a comparison group over the same time.
- **R**: the amount risked on one trade (the distance from entry to stop). +0.5R means the average trade made half of what it risked.
- **90% interval**: the range the true average is likely to sit in. If it includes zero, we cannot say there is an edge.
- **Survivor bias**: the US stock list contains only companies that still trade today, which flatters rules that buy past winners.
- **Judged vs reported**: a judged period decides pass or fail. A reported period is shown for information and never counts.
- **Fit rule and holdout**: a test first runs on part of the data (fit). Only if it passes is the rest (holdout) opened. A fail in fit means the holdout stays unseen.
- **Gate classes** (setup trades): valid = stop within the limit and enough room to run; low room = stop fine but the next obstacle is close; too wide = stop beyond the limit.
- **Keep and Exit**: the Legacy book verdicts. Exit means the stock failed the 200-day or swing-low test.
- **Spent data**: once a family of rules has been read on a stretch of history, a pass on it again is only supporting evidence.

## Rules for new tests (proposed, not yet in the Engine Rules)

1. Look the test up here first. If it is listed, say what is different and why the answer could change.
2. Add a row here when the test is registered, and fill in the result when it ends.
3. Write the pass rule and the size of edge the test could detect before running.
4. Record fails as fails. A fixed data problem is a re-run, not a replacement.

---

## 1. Stock picking and the swing desk

### 1a. The original rules (before October 2026): design, not tests

| IDs | What | Verdict | In plain words |
|---|---|---|---|
| C-1, C-2 | Sector ranking (2 x 3-month + 1-month return, top 4 weekly) and two-weekend persistence | No test exists | Design choice. "No separate evidence record exists" |
| C-4, C-5 | Widen a too-close stop to 1.5 ATR; room to resistance 3R (US) and 2R (India, changed to 3R in C-112) | No test exists | Design choice. Later looked at in C-64, C-125, C-126, which found no edge either way |
| C-6, C-22, C-24, C-35, C-36, C-38 | The market light: which setups each colour allows | No test exists | The light was never tested on its own. All replays fixed it. C-24 says "Backtest later" |
| C-25 | US skips setup 3; every US setup needs results 10+ days away | No test exists | "Backtest later". C-63 later looked at results timing in India only |
| C-15, C-16, C-19, C-20 | US weekly sector screen, whole-market scan | Tried on 30 stocks | The scans were replayed later (C-51, C-52, C-118, C-119) |
| C-29 to C-34 | Correlation control, pending-order risk, 100-trade gate, US VIX rule and others | Proposed | Parameters are "untested guesses". C-33 (US step-down) rejected by the owner |
| C-21, C-23, C-27, C-28, C-37, C-39 | Document and code alignment | Not a test | |

### 1b. First tests (Oct 2026)

| ID | Date | What we asked | Where | Verdict | In plain words |
|---|---|---|---|---|---|
| C-51 | 16 Oct | Does the frozen US scan (US-SCAN-1) show an edge over 229 nights? | US | Failed (exploratory) | The "Ready" list gave only 11 picks (150 needed). The top-10 list averaged +0.60% per 20 sessions, but the range (−1.86% to +3.12%) includes zero, and one group (metal mining) drove the year |
| C-52 | 16 Oct | US-SCAN-2: looser tightness gate, replayed light, group cap | US | Not testable | Only 52 setup picks and 19 trades (150 each needed). US-SCAN-1 stays frozen |
| C-59 | 18 Oct | Do stocks run up before results, and does it predict the next 20 sessions? | India, 3 then 7 years | Passed on relative returns; profit thin | Parked. The tag is not recommended |
| C-60, C-62 | 18 Oct | Can extra filters improve the run-up trade? (8 filters, then 19) | India | Failed (narrowly) | Best case lifted the net return 1.43 points; 1.5 was needed. No filter adopted |
| C-63 | 18 Oct | Do setups behave differently depending on where results fall? | India 2021-26 | Failed | Neither idea supported. Results gate and setup 3 unchanged |
| C-64 | 18 Oct | Which setups and exits earn most after costs? | India 2021-26 | Inconclusive | No exit change supported. The stop cap and room rule were not contradicted, but the sample was very small |
| C-65 | 18 Oct | Does momentum plus desk geometry beat either alone? | India | Failed | First idea failed both rules; second not supported (t 1.70) |
| C-67 | 18 Oct | Do doubled costs change the result? | India | No rule change | Valid desk trades survive doubled costs; looser classes do not |
| C-68 | 20 Oct | Do the replay's exits match the live exits? | India | No rule change | They agree where it mattered; live exits are better on valid trades |
| C-70 | 20 Oct | Does a longer fixed hold pay more than the live exits? | India | Failed (fit) | Holdout never opened |
| C-72 | 20 Oct | Should India skip days be excluded from the distribution count? | India | Failed (fit) | Flag not built |
| C-61, C-66 | 18 Oct | Forward paper tests of the run-up signal and of momentum inside setups | India, new data | Running | No result yet |
| C-144 | 1 Nov | Does the overall (across-category) fund score predict next-year risk-adjusted return? | India funds, 2016 to 2025 | Failed | Display only, not shown to predict (top fifth won 5 of 10 years, bar 6) |
| C-145 | 1 Nov | Owner direction (not a test): pick funds for new money by cost first, Weak as the exit warning, overall score display only | Funds | Applied | Cost untested (C-108); no predictive claim |
| C-147 | 6 Nov | Does a 25% trailing stop help the momentum books (twin of each), plus a swing paper stop-ordering fix | India and US forward paper | Running | First read Nov 2027: helps only if the worst fall is lower and the 12-month return is within 2 points. 25% picked by judgment after seeing early drops |
| C-148 | 7 Nov | Owner risk rule, not a test: names with results inside 10 sessions move to Watch and the swing paper books skip them | India and US scans, swing paper books | Applied | Forward only; no tested edge (C-63 found no benefit from a results gate in India 2021-26). Momentum books unchanged |
| C-149 | 7 Nov | Does a trailing stop (5%, 8% or 25%) help the momentum sleeve? | India 2011 onward and US replay; live twins | Replay done 7 Nov: NO LEVEL QUALIFIES (stays without a stop); live twins running | India: no stop 16.9%/yr, worst fall -37.6%; 5% 2.0%/yr (-17.1%); 8% 4.6%/yr (-18.4%); 25% 13.2%/yr (-30.2%). US: no stop 21.5%/yr, -49.9%; 5% -0.4%/yr (-20.6%); 8% 1.0%/yr (-23.3%); 25% 10.7%/yr (-41.5%). Every level cuts the fall but costs far more than 2 points a year (stops fired 267-891: sold, then missed the rebound). Replay reuses sleeve history (not out-of-sample), US store survivor-biased; live read Nov 2027 |
| C-53 | 17 Oct | Forward paper book on the US top-10 list | US, new data | Running | No result yet |

### 1c. Backtester tests (31 Oct to 1 Nov 2026)

All pre-registered: the pass rule was written before the run. "Judged" is India 2011-2019 and the US 2018-2025 unless stated.

| ID | What we asked | Verdict | In plain words |
|---|---|---|---|
| C-118 | Do the frozen India rules work on 2011-2019? (a) momentum baseline, (b) desk setups | Failed | (a) +0.35% a month over its list, range −0.21% to +0.92%. (b) only 35 valid trades in 9 years, −0.14% each. After the data fix (C-118-r2), (a) became +0.49%, range −0.03% to +1.04% |
| C-119 | Same on the US 2018-2025 (survivor-biased) | (a) passed, (b) failed | (a) +1.04% a month over its list, but +131% against SPY's +147%. (b) +0.48% per 20 sessions, range −0.28% to +1.33% |
| C-120 | Does switching to cash below the 200-day average help? | Failed | India +154% against +373% for the Nifty 500 held; US +37% against +152%. It cut India's worst fall but cost most of the return |
| C-121 | Does holding the momentum picks 3 or 6 months beat monthly? | Failed | India: monthly +0.49%, 3 months +0.29%, 6 months +0.36%. Holding longer did not help |
| C-122, C-123, C-124 | Fix price breaks in India 2010-2019 data and re-run | Data fix | 159 of 174 liquid breaks cleared; edge roughly doubled; 15 liquid breaks still unresolved |
| C-125 | What do the stop-width cap and 3R room test remove? | Exploration | The removed trades did no worse than the kept ones. Only 3-5% of trades pass the gates |
| C-126 | Does widening the stop caps by 1.5 times make the setups work? | Failed | India −0.19R, portfolio −10.3% against the index's +120.5%. US −0.13R, −9.2% against SPY's +147.1% |
| C-127 | Do setups work on top-momentum stocks only? | Failed | India top group −0.04R against −0.05R for the rest; US +0.01R against +0.02R. India 2021-25 only (reported): +0.31R against +0.06R |
| C-128 | Does a published weekly momentum book (Clenow-style) beat the index? | Failed | India +96% against +103%; US +77% against SPY's +142%. India 2021-25 only (reported): +210% against +100% |
| C-129 | Does a large-cap-tilted momentum sleeve built to NSE's Nifty200 Momentum 30 outline beat the Nifty 200? (stand-ins for the parts NSE doesn't publish) | Failed the rule, direction positive | India Feb 2011-2019: +213% against the Nifty 200's +129%, but the monthly edge (+0.32%) is too noisy to confirm (range -0.07% to +0.72%) and it beat the index in only 4 of 9 years. Equal-weight twin +207%. Replication check on NSE's series: monthly correlation 0.915, tracking difference +0.02% a month; NSE's own series made +318% over the same dates (back-calculated by NSE, not live). Addendum (same run, nothing judged): after the sleeve's own trading costs it made 13.79% a year against 9.84% for the Nifty 200, a gap of 3.94 points; costs about 0.73% a year (no tax); worst fall relative to the Nifty 200 -16.0% (Apr 2018 to Nov 2019). The yearly gap is lumpy: 2017 +26.0 points, 2015 +20.1, 2011 +11.8, but 2016 -8.5, 2018 -6.0, 2019 -4.6, 2012 -1.4. Without 2017: +96.4% against +71.8% over the other eight years, about 1.8 points a year. 2021-25 (reported only): +182% against +102%, 24.4% a year against 15.9%, 3 of 5 years, worst relative fall -20.8% |
| C-130 | Proposed: a momentum stream (the C-129 rules, India) on the scans and as a forward paper book, with monthly and equal-weight twins, beside the current desk rules | Built 1 Nov 2026, starts on paper at the first session after 1 Nov; stop thresholds and the real-money bar confirmed by the owner 1 Nov | Judges the build, not the factor, because 24 months cannot confirm the factor (it would need about 13 years). Pass conditions: live code gives the same portfolio as the replay code on each review date; monthly-return correlation with NSE's Nifty200 Momentum 30 series at or above 0.9 (rolling 36 months); tracking difference shown by calendar year with the mid-cap tilt named. Stops only for divergence from NSE's index, never for trailing the Nifty 200. Paper only: for holding the factor, an index fund is the better instrument (direct plan expense 0.20%, tracking error 0.20%, no tax passed on). Built as MOM-30 v1: a Momentum sleeve tab on the Scans and Paper test pages, a nightly list and paper book, and a scoreboard against NSE's index, Nifty 500, Nifty 200 and an index fund (month-end lines). A check while building found the C-129 replay's universe let a gold ETF in (GOLDBEES, 1.8% to 5.0% of the portfolio on three review dates in 2011-12, 2.4% in Jun 2025); the live build takes listed companies only (see the C-130 row in Engine Rules) |
| C-131 | US momentum sleeve: the C-129 method on the 200 most traded US stocks against SPY, Dec 2017 to Dec 2023 judged (survivor-biased data: delisted stocks missing) | FAILED the registered rule (2 of 4), 1 Nov 2026 | Sleeve +97.1% against SPY +78.1% (QQQ +162.9%), but the mean monthly excess of +0.28% has a 90% interval of -0.90% to +1.51%, only 2 of 6 years beat SPY, and 2020 (+85% against +16%) carries it. The sample could only detect about 0.94% a month. Jan 2024 to Oct 2026 (reported, not judged) was +236% against +58%, which survivor bias flatters most. A fail is the informative result on this data. Built at your request on 1 Nov as a comparison only: a US Momentum sleeve paper book (no pass rule, no stop), read at 12 and 24 months beside the India sleeve, SPY and QQQ. |

---

## 2. Holding rules for stocks already owned (Legacy book)

Exit rules for held stocks, tested in a replay of 2022-25 against the typical Nifty 500 stock, with pass criteria written first.

| ID | What we asked | Verdict | In plain words |
|---|---|---|---|
| C-41 | How to define the "last major swing low" | Adopted, no test | Owner approved the definition |
| C-42 | Wait for a weekly close before exiting a stock within 1 ATR of its 200-day? | Failed | Near stocks returned to Keep far more often (43.2% against 11.2%), but the 60-session gain was only +0.43 points (1 needed), in 1 of 4 years |
| C-43 | Count the swing low only if 1.5 ATR below the prior high? | Failed | Almost everything counts as deep (13,960 of 14,577), so the test separates nothing |
| C-44 | Adjust old prices for splits, bonuses, dividends, rights | Data fix | 791 actions adjusted; stocks blocked fell from 124 to 22; results unchanged |
| C-45 | Tag exited stocks that look worth re-entering | Not testable | Display only. Volume history starts Oct 2025; needs 250 sessions |
| C-46 | How firm is each Exit? | Information | Stocks that failed both tests had a median 60-session excess of −3.0 against −1.45 for Keep. The rule separates stocks only modestly |
| C-47 | Use 50-day against 200-day as extra information | Failed | Stays a plain context line |
| C-48 | Use 50-day vs 200-day or relative strength to pick re-entries | Failed | All three filters failed; the best added only +0.59 points (2 needed) |
| C-49 | Change the swing-low window from 10 to 7 or 15 sessions | Failed | Neither passes; window stays 10 |
| C-50 | Handle demergers automatically | Adopted | Stocks blocked by a corporate action fell from 22 to 6 of 2,917. The method check could not run as written (only two typed records) |

---

## 3. Funds and allocation (Portfolio Manager)

| ID | Date | What we asked | Verdict | In plain words |
|---|---|---|---|---|
| C-74 | 20 Oct | Tilt asset-class weights with market performance? | Failed (fit) | No tilt built |
| C-75 | 20 Oct | Hold sector funds only when the sector is strong? | Failed (fit) | No rule built |
| C-81 | 22 Oct | Does a Strong fund beat its category, and a Weak one trail it? | Mixed | Strong beat its category in 5 of 10 years (60% needed): fail. Weak trailed in 7 of 10: pass. Useful as a warning, not a buy signal |
| C-83 | 23 Oct | Widen the Watch band? | Failed | Funds scoring 25-35 beat and trailed about equally. Band unchanged |
| C-85 | 23 Oct | Judge funds that trailed their index; judge funds against cash | Failed / not testable | Funds that trailed their index tended to catch up (only 2 of 8 years passed). The cash test had too few funds |
| C-86 | 23 Oct | Which rebalancing cadence? | Passed; adopted | Band-to-edge: same return, far less trading |
| C-92, C-94 | 24 Oct | Alternative consistency measure; risk-aware score for equity funds | Failed | Not adopted |
| C-98 | 24 Oct | Index-fund bands | Not testable | Too few funds per band; redone as C-110 |
| C-99 | 24 Oct | Tilt equity money to the best categories | Passed | Not applied |
| C-100 | 24 Oct | Choose among all fund groups by past risk-adjusted return | Failed | Allocation unchanged |
| C-102, C-103 | 24 Oct | Score thematic and international funds | Not testable | Redone as C-105 |
| C-104 | 25 Oct | Holdings-health reading vs next-year return | Failed | Stays an information line |
| C-105 | 25 Oct | Rank correlation for thematic and international scores | Mixed | Thematic passed (weakly); international failed |
| C-106 | 25 Oct | Does the 50-over-200-day stock trend signal predict returns? | Failed | Hit rate 50% at 12 months |
| C-107 | 25 Oct | Do the swing trend rules work on fund prices? | Failed | Not used for funds |
| C-109 | 25 Oct | Score conservative and other hybrid funds | Passed | |
| C-110 | 28 Oct | Index-fund gap to the same-index median | Passed | Correlation above zero in all 10 years |
| C-101, C-108 | 24-25 Oct | Holdings health build; fund quality facts | Running | No outcome yet |

---

## 4. Data and tooling (no strategy results)

- **Data sources (C-3, C-7 to C-14, C-26, C-40)**: Alpha Vantage, ETF Database and full-page Yahoo history were rejected; Yahoo parked pending a re-test from GitHub servers.
- **C-116, C-117, C-122 to C-124**: India 2010-2019 data extended and price breaks repaired; US survivor bias labelled; standard report format. Any India result before 2020 now uses the repaired data. Re-running `scripts/derive-india-overrides.mjs` rewrites the overrides file and would drop the pre-2020 entries.

---

## 5. What the evidence says now (1 Nov 2026)

This is the plain-words reading of every result above, part by part, for the desk as it runs today.

| Part of the desk | What the tests say | How sure we are |
|---|---|---|
| Swing setups (the daily "Ready" list) | No edge in any judged test: C-118(b), C-119(b), C-126, C-127. Only 3-5% of trades pass the gates, and the trades the gates removed did no worse (C-125) | Fairly sure there is no edge. Small samples, but they all point the same way |
| Stop-width cap and 3R room test | Nothing supports them (C-125, C-126). Nothing contradicts them strongly either | Low. They were design choices and still are |
| Market light | No predictive value found. Green months did not precede better index returns: India 2013-2019 Green +0.89% next month against +1.04% for others, US 2018-2023 +0.15% against +1.31%, BSE 500 2006-2009 not significant (C-133, C-136) | Fairly sure it has no measurable edge as a predictor of the next month. The test could only see a large effect, so it may still help with risk in ways not measured |
| Sector ranking | The top four sectors did worse than the average sector in India 2013-2019 (+15% against +55%) and the US 2018-2023 (-3% against +58%) (C-134) | Fairly sure. The US result is significantly negative |
| Trend template | Clear in India: passing stocks beat failing ones by +1.19% a month, 8 of 9 years. Not confirmed in the US (+0.24%, interval touches zero) (C-135) | Moderate in India, low in the US. A stock-picking effect, not a trading rule |
| Live exits (give-back and trailing stops) | They agree with the replay's exits and are better on valid trades (C-68) | Moderate |
| Legacy Keep / Exit | Separates stocks only modestly: Exit median 60-session excess -3.0 against -1.45 for Keep (C-46) | Moderate. Useful as a warning |
| Momentum picking (monthly, top tenth of liquid names) | India about +0.5% a month over its own list, but the range of doubt touches zero. US larger but survivor-biased. Holding longer did not help (C-121). A weekly Clenow-style version lost to the index (C-128) | Low. Small, unconfirmed |
| NSE-style momentum sleeve, twice a year (C-129) | Ahead of the Nifty 200 in compounded return in both windows. Failed on significance and consistency. Carried by 2017 | Low. Weak and mixed: tracks NSE's index (0.915), but the live lead has shrunk to about 2 points a year and the last two years are negative |
| Cash switch (C-120) | Cut the worst fall but gave away most of the return (India +154% against +373%, about 220 points) | Fairly sure it should not be a rule |

**What the results do and do not mean.** A fail means the test could not show an edge. It does not prove there is none. Every stock rule has been judged against the index, and the index has been hard to beat after costs. The momentum sleeve is the only one that gets close.

**Two sets of rules, one standard.** The current desk rules and a momentum stream are both unproven. The owner's direction is to run both, as scans and as forward paper books, and to judge both against the index on the same dates with the pass rule and power written down first. Showing a list or logging a paper book costs nothing. Real money, or replacing the setups, waits for the read date.

**Corrections to statements made in this project** (so they are not repeated)
- "Every test says holding longer beats monthly" is wrong. In C-121, 3-month and 6-month holds did worse than monthly (+0.29% and +0.36% against +0.49%).
- Earnings-driven picking is not untested. It was tested in C-59 to C-63.
- A reviewer said the gap in 2021-25 was similar to the earlier one. It is larger: 8.5 points a year against 3.9.
- A reviewer said the cash rule cost about 70 points. It cost about 220 (C-120, India).
- The C-129 replay's universe was every listed symbol, not only companies, so a gold ETF entered the sleeve at 1.8%, 5.0% and 2.1% of the portfolio on three review dates in 2011-12 and 2.4% in Jun 2025 (none at other dates to Oct 2025; liquid funds and silver ETFs would have entered in Dec 2025 and Jun 2026). Too small to move the result materially; recorded, not re-run (owner, 1 Nov); re-run only if C-129 figures are ever used for a real-money decision.

**Decided by the owner (1 Nov 2026)**
- Point-in-time Nifty 200 constituent and market-cap data: not bought. The mid-cap tilt stays named, not removed.
- Real money in the momentum factor: left to the owner personally until the Portfolio Manager is fully working. The desk takes no step toward it.
- Setups do not place live orders on their own.
- C-53 (US top-10 paper book) and C-66 (momentum inside the desk's setup shapes, India) keep running to their pre-registered read.

**Decided by the owner on the multi-stream build brief (1 Nov 2026, C-137)**
- The brief is a proposal. The live desk rules stand: setups, stop cap, room test, sector gate and the light's sizing and entry rules, and the sized order shortlist and nightly order message.
- The sector gate stays in the strategies running now; each new stream decides it by a registered check.
- The main benchmark stays the plain index; the momentum fund is shown beside it.
- One fill convention for all new paper books: the next session's open, tiered costs (C-139). The two momentum books were switched from the next close to the next open before their first fill (C-140).
- The results date becomes a flag instead of a gate: approved and applied 1 Nov 2026 (C-138). C-53 and C-66 keep running; C-53's official stream notes the amendment date.

---

## 6. Where this leaves us

**Ruled out (do not repeat without a new reason)**
- A 200-day cash switch as a rule (C-120).
- Holding momentum picks 3 or 6 months (C-121).
- Wider stop caps for the setups (C-126).
- Setups limited to top-momentum stocks (C-127).
- A Clenow-style weekly momentum book (C-128).
- Re-running the C-129 sleeve on 2011-2019 with new settings. That window is spent; a new read needs new data (the forward book) or the NSE series.
- Earnings run-up filters (C-60, C-62), longer fixed holds (C-70), excluding India skip days (C-72).

**Running, no result yet**
- US momentum paper book (C-131 step 2, comparison only): built, starts at the first session after 1 Nov 2026.
- Momentum stream forward paper book (C-130): built, starts at the first session after 1 Nov 2026 (signal Mon 2 Nov, simulated fill at the next close); first review 1 Dec.
- Earnings run-up forward test (C-61), momentum-in-setups forward test (C-66), US paper book (C-53).

**Not yet tested**
- Sector ranking and trend template before 2010, including the 2008 bear market: no sector index series or stock prices are stored for those years (the market light was tested for 2006-2009 on the BSE 500, C-136). It would need a separate data job.
- Other kinds of idea, such as value or quality screens: none found in the change log, but check before running one.
- The US without survivor bias (forward data only; no free source of delisted tickers has been found).

**Closed on 1 Nov 2026**
- The market light on its own: C-133 (India, US) and C-136 (India 2006-2009). No edge shown.
- The sector ranking on its own: C-134. No edge shown; worse than the average sector.
- The trend template on its own: C-135. Clear in India, not confirmed in the US.
- The results-date rule: already tested as a gate in C-63 (India, Jan 2021 to Sep 2026, not supported as a return filter, no case to change it). It is not re-run: that data is spent, and the US has no history of past results dates.

Note: earnings-driven stock picking is **not** an untested idea. It was tested in C-59 to C-63.
| C-150 | 7 Nov | Does re-ranking the momentum sleeve monthly or quarterly beat June and December, after costs? | India 2011 onward and US replay | Replay done 7 Nov: NO FASTER SCHEDULE QUALIFIES IN BOTH MARKETS (stays semi-annual). India: monthly qualifies (20.2%/yr vs 16.9%, fall -38.1% vs -37.6%); quarterly does not. US: monthly 24.8% vs 21.5%, fall -38.7% vs -49.9%, but loses the second half (27.8% vs 33.6%), so fails. | Rule was: faster schedule must beat semi-annual by 1+ point a year, not be more than 3 points worse in the worst fall, and win both halves, in both markets. Replay reuses sleeve history (not out-of-sample); US store survivor-biased |
| C-151 | 7 Nov | Does a monthly re-rank of the momentum sleeve beat the six-monthly book, live, after costs? | India and US paper twins from 3 Nov fills | Registered, running; first read 30 Nov 2027 | Better only if it beats the registered book by 1+ point, is no more than 3 points worse in the worst fall, and leads both halves, in both markets; also needs a real fall (10%+) in the period, else runs to Nov 2028 |
| C-152 | 7 Nov | Do the highest-breadth industries beat the average industry (India replay, 2013-2019 judged)? | Replay on stored stock prices, current-list industries | FAILS (7 Nov): 288% vs 182% but lower end of interval -0.03% and ahead in 4 of 7 years, not the 5 needed; 2020-2025 no edge | Beats the average industry in compounded return, lower end of 90% bootstrap above zero, and in 2 of 3 years (same bar as C-134) |
| C-153 | 7 Nov | Does splitting the swing paper books by sector breadth (weak under 40%) show a difference live? | Orders from the next nightly scan, both markets | Information only; running | Read with C-53 at 300 orders or 12 months; no filter is applied unless the owner decides then |
| C-154 | 7 Nov | Protecting the momentum sleeve against a whole-market fall (full exit in red, sleeve sizing) | Not started | Parked by the owner, to revisit later | Decide the acceptable loss first |
| C-155 | 7 Nov | Not buying a momentum name with results within 10 sessions (rule, not a test) | Applies from the December 2026 review, India and US books | Adopted as a rule; records each review's skipped names | No separate read; the registered books are read as before, counting from this rule |
| C-156 | 7 Nov | Why so few swing signals fire, and which of the base-quality threshold, a wider India universe or the light's setup switching to look at | Not started; a descriptive replay of saved scans would come first | Parked by the owner, to investigate later | Any loosening needs enough signals to judge (C-52 had 52 of 150 needed); more signals are not more edge |
| C-157 | 8 Nov | Filings data rules for the new strategies: consolidated-first basis, original-as-of revisions, growth suppressed for five quarters after a structure event (rules, not a test) | India and US results, shareholding and insider data loaded from NSE and SEC EDGAR; applies when the filings loader is built | Adopted as rules (owner, 8 Nov 2026); no code yet | No separate read; each strategy that uses these data is tested under its own row, and the loader's completeness check (docs/DATA_SOURCES.md) must pass before any strategy reads it |
| C-158 | 8 Nov | Strategy Build Standard: one shape, build order, documents and UI conventions for every new strategy (a standard, not a test) | docs/STRATEGY_BUILD_STANDARD.md | Adopted as a standard (owner request, 8 Nov 2026) | No read; each strategy is checked against its Definition of done |
