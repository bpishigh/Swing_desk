# Test register: what we tested, what happened, what we learned

One page that lists every test we have run on the Swing Desk and Portfolio Manager rules, in plain words, so nothing is repeated by accident. The full record of each test is its row in the Engine Rules change log (docs/ENGINE_RULES.md); the reports are in docs/replay/. Built 1 Nov 2026; brought up to date through C-129 and its addendum on 1 Nov 2026.

## Start here

- **No stock rule we tested has passed its pre-registered test against the index in both India and the US.** That includes the desk's swing setups, momentum picking, holding picks longer, a cash switch, and a published weekly momentum book. One idea (C-129, below) came out ahead of the index in direction but failed on significance.
- **The swing setups show no edge.** Changing their stop limits (C-126) or limiting them to strong-momentum stocks (C-127) did not help.
- **Momentum picking is the only thing with a small edge**, and only against its own list of stocks, not against the index. India: about +0.5% a month more than that list, but the range of doubt just touches zero. The US result is larger but flattered by survivor bias.
- **India 2021 to 2025 looks good in several tests.** It is one strong market, and not a judged period.
- **The original desk rules (sector ranking, stop widening, room rule, market light) were never backtested.** They came from design.
- **Fund tests**: the fund score works as a warning and a cost filter, not as a buy signal.
- **The momentum factor looks positive in direction but is unconfirmed (C-129).** A sleeve built to NSE's Nifty200 Momentum 30 outline made +213% against the Nifty 200's +129% in India 2011-2019 (13.8% a year against 9.8%), and +182% against +102% in 2021-25 (reported only). It still failed its own rule: the monthly edge (+0.32%) was too noisy to confirm, and it beat the index in only 4 of 9 years. 2017 carries the result: without it the lead is about 1.8 points a year, not 3.9. Trading costs take about 0.73% a year, and tax is not counted. The test was too small to detect an edge of this size (it could only see 0.46% a month or more). We have not compared it with NSE's own index series.
- **The rules running on the desk today are in a weaker position than momentum.** The setups, the stop caps and the room test have no edge in any judged test, and the market light and sector ranking were never tested. They still scan, give signals and run in paper tests. Momentum has weak positive evidence. Neither is proven, so owner's direction on 1 Nov is to run both and judge both the same way (see section 5).
- **What is still open**: India before 2010, the market light on its own, and forward paper trading on new data.

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
| C-129 | Does a large-cap-tilted momentum sleeve built to NSE's Nifty200 Momentum 30 outline beat the Nifty 200? (stand-ins for the parts NSE doesn't publish) | Failed the rule, direction positive | India Feb 2011-2019: +213% against the Nifty 200's +129%, but the monthly edge (+0.32%) is too noisy to confirm (range -0.07% to +0.72%) and it beat the index in only 4 of 9 years. Equal-weight twin +207%. NSE's own series not yet compared. Addendum (same run, nothing judged): after the sleeve's own trading costs it made 13.79% a year against 9.84% for the Nifty 200, a gap of 3.94 points; costs about 0.73% a year (no tax); worst fall relative to the Nifty 200 -16.0% (Apr 2018 to Nov 2019). The yearly gap is lumpy: 2017 +26.0 points, 2015 +20.1, 2011 +11.8, but 2016 -8.5, 2018 -6.0, 2019 -4.6, 2012 -1.4. Without 2017: +96.4% against +71.8% over the other eight years, about 1.8 points a year. 2021-25 (reported only): +182% against +102%, 24.4% a year against 15.9%, 3 of 5 years, worst relative fall -20.8% |

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
| Market light, sector ranking, trend template | Never tested on their own. Every replay fixed the light | Unknown |
| Live exits (give-back and trailing stops) | They agree with the replay's exits and are better on valid trades (C-68) | Moderate |
| Legacy Keep / Exit | Separates stocks only modestly: Exit median 60-session excess -3.0 against -1.45 for Keep (C-46) | Moderate. Useful as a warning |
| Momentum picking (monthly, top tenth of liquid names) | India about +0.5% a month over its own list, but the range of doubt touches zero. US larger but survivor-biased. Holding longer did not help (C-121). A weekly Clenow-style version lost to the index (C-128) | Low. Small, unconfirmed |
| NSE-style momentum sleeve, twice a year (C-129) | Ahead of the Nifty 200 in compounded return in both windows. Failed on significance and consistency. Carried by 2017 | Low to moderate. Best evidence we have, still short of proof |
| Cash switch (C-120) | Cut the worst fall but gave away most of the return (India +154% against +373%, about 220 points) | Fairly sure it should not be a rule |

**What the results do and do not mean.** A fail means the test could not show an edge. It does not prove there is none. Every stock rule has been judged against the index, and the index has been hard to beat after costs. The momentum sleeve is the only one that gets close.

**Two sets of rules, one standard.** The current desk rules and a momentum stream are both unproven. The owner's direction is to run both, as scans and as forward paper books, and to judge both against the index on the same dates with the pass rule and power written down first. Showing a list or logging a paper book costs nothing. Real money, or replacing the setups, waits for the read date.

**Corrections to statements made in this project** (so they are not repeated)
- "Every test says holding longer beats monthly" is wrong. In C-121, 3-month and 6-month holds did worse than monthly (+0.29% and +0.36% against +0.49%).
- Earnings-driven picking is not untested. It was tested in C-59 to C-63.
- A reviewer said the gap in 2021-25 was similar to the earlier one. It is larger: 8.5 points a year against 3.9.
- A reviewer said the cash rule cost about 70 points. It cost about 220 (C-120, India).

**Waiting on the owner**
- Add the momentum stream to the scans and to paper testing (draft entry C-130, see the Engine Rules).
- Whether the existing forward tests C-53 and C-66 run to their pre-registered read (recommended) or are stopped.
- Whether the setups keep placing live orders while the evidence stands as above.
- The NSE Nifty200 Momentum 30 price history, to run the replication check (data/replay/nse-momentum30-price.csv).

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
- Momentum stream forward paper book (C-130), once approved.
- Earnings run-up forward test (C-61), momentum-in-setups forward test (C-66), US paper book (C-53).

**Not yet tested**
- India before 2010, including the 2008 bear market.
- The market light on its own, and the sector ranking (C-1, C-2).
- The results-date rule in the replays (it was off).
- Other kinds of idea, such as value or quality screens: none found in the change log, but check before running one.
- The US without survivor bias (forward data only).

Note: earnings-driven stock picking is **not** an untested idea. It was tested in C-59 to C-63.
