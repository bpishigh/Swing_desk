# Test register: what we tested, what happened, what we learned

Built 1 Nov 2026 (rows C-1 to C-50 added the same day) from the Engine Rules change log (docs/ENGINE_RULES.md), the manifest (docs/backtests/manifest.json) and the reports in docs/replay/. The change log row is the full record of every test; this page is the one-page index so that nothing is run twice by accident. Numbers are quoted from those rows; where a row is long, this page gives the headline and points to the row.

## Process rule (proposed, not yet in the Engine Rules)

1. Before any new test, look it up here. If it is already listed, the new test must say what is different and why the answer could change.
2. Every new test gets a row on this page when it is registered, with the result added when it ends.
3. A dataset is "spent" for a question once a rule family has been read on it. Passing on spent data is supporting evidence only.
4. Pass rules state the power: how large an edge the test could detect in the sample.
5. Fails are recorded as fails. A fixed data problem is a re-run (new attempt number), not a replacement.

## Headline: what the evidence says (31 Oct to 1 Nov 2026)

- No stock rule we tested beats the index in both markets on all registered conditions.
- The desk's swing setups (base breakout, 20 EMA pullback, 50 SMA pullback) show no edge in the judged windows, with the gates as they are, with wider stop caps (C-126), or on top-momentum stocks only (C-127).
- Momentum selection (12-1, top decile of the 500 most traded names) shows a small edge over its own eligible list in India (after the data fix +0.49% a month, 90% interval -0.03% to +1.04%) and a larger one in the US (survivor-biased upward). It does not beat the index outright.
- Holding picks 3 or 6 months instead of one did not help (C-121). A 200-day cash switch cost most of the return (C-120). A published weekly momentum book (Clenow-style) did not beat the index either (C-128).
- Only India 2021 to 2025 looks good across several tests. That is one strong market and it is not a judged window.
- Fund tests: the score is a warning and a cost and consistency filter; the top band does not reliably beat its category (C-81).

## A. Stock tests: setups, momentum, earnings (swing desk)

| ID | Date | Question | Window | Result | Key numbers | Lesson |
|---|---|---|---|---|---|---|
| C-51 | 16 Oct | Replay of the frozen US scan (US-SCAN-1) as early evidence | US, 229 nights | Not adopted; exploratory only | Ready list gave 11 picks (needed 150); top-10 list +0.60% per 20 sessions, interval -1.86% to +3.12% | One group (metal mining) drove the year |
| C-52 | 16 Oct | US-SCAN-2: tightness in the score, replayed light, group cap | US | Not executable; not adopted | Setup picks 52 (150 needed); stage 2 had 19 trades (150 needed); Ready mean +0.51% (interval -2.3% to +3.5%), -1.07% without metal mining; stage 2 mean -0.19R | Too few picks to test at all; US-SCAN-1 stays frozen |
| C-53 | 17 Oct | Forward paper book on the US top-10 list, three streams | US forward | Adopted, running | | Forward evidence, no result yet |
| C-54 | 17 Oct | Baseline: 12-1 momentum top decile, monthly, cash below 200-day | India | Adopted as the baseline test | | Basis for C-118 onward |
| C-59 | 18 Oct | Do stocks run up before results, and does it predict the next 20 sessions? | India, 3 then 7 years | Passes on relative returns; profit view thin; parked | | Tag not recommended |
| C-60, C-62 | 18 Oct | Extra filters on the run-up trade (8, then 19) | India | Failed the registered rule narrowly; parked | C-62 net lift 1.43 pp against 1.5 needed | No filter adopted |
| C-61 | 18 Oct | Forward paper test of the run-up plus reaction signal | India forward | Adopted, running | | |
| C-63 | 18 Oct | Do setups behave differently by where results fall? | India 2021-26 | Neither hypothesis supported; parked | | Results gate and setup 3 unchanged |
| C-64 | 18 Oct | Which setups and exits earn most after costs | India 2021-26 | No exit change supported; very small sample | | Stop cap and room rule not contradicted |
| C-65 | 18 Oct | Momentum selection plus desk geometry vs either alone | India | H1 failed both rules; H2 not supported (t 1.70) | | Parked; forward check C-66 |
| C-66 | 18 Oct | Forward check of momentum membership inside setup geometry | India forward | Adopted, running | | |
| C-67 | 18 Oct | Doubled costs | India | No rule change | Valid desk trades are cost-robust; looser classes are cost-sensitive | |
| C-68 | 20 Oct | Port of the exits vs live exits | India | No rule change | Live exits agree where it mattered | |
| C-70 | 20 Oct | Longer fixed hold vs live exits | India | Both rules failed in fit; holdout not revealed | | |
| C-72 | 20 Oct | Exclude India skip days from the distribution count | India | Failed fit rule; flag not built | | |
| C-118 | 31 Oct | (a) Momentum baseline, (b) desk setups, frozen rules | India 2011-2019 | Both fail | (a) +0.35% a month (interval -0.21% to +0.92%); (b) 35 valid trades, -0.14% a trade | Then re-run after the data fix (C-118-r2): (a) +0.49%, interval -0.03% to +1.04% |
| C-119 | 31 Oct | (a) US momentum copy, (b) US-SCAN-1 top-10 | US 2018-25, survivor-biased | (a) passes all four; (b) fails the interval | (a) +1.04% a month but +131% vs SPY +147%; (b) +0.48% per 20 sessions, interval -0.28% to +1.33% | Survivor bias flatters buying past winners |
| C-120 | 31 Oct | 200-day cash rule on its own | India 2011-25, US 2018-25 | Fails both | India +153.7% vs +373.3%; US +36.6% vs +152.2% | Cuts India's worst fall but costs most of the return. Hard cash switch is out |
| C-121 | 31 Oct | Hold momentum picks 3 or 6 months | India 2011-19, US 2018-25 | Fails | India 3m +0.29%, 6m +0.36%, monthly +0.49% | Holding longer does not help |
| C-122 to C-124 | 31 Oct | Fix India 2010-2019 price breaks; re-run C-118(a) and C-121 | India | Data fix applied; 159 of 174 liquid breaks cleared | Edge roughly doubled | 15 liquid breaks still unresolved |
| C-125 | 31 Oct | Diagnostic: what the stop-width cap and 3R room test remove | India, US | Exploration, no pass rule | India 2011-19: valid -0.14R, too wide -0.04R, low room -0.04R; US valid -0.13R, too wide +0.11R | Removed trades are not worse than kept ones; valid trades are 3-5% of fills |
| C-126 | 31 Oct | Stop-width caps at 1.5 times, as a portfolio | India 2011-19, US 2018-25 | Fails | India -0.19R, -10.3% vs index +120.5%; US -0.13R, -9.2% vs SPY +147.1% | The cap is not what holds the setups back |
| C-127 | 1 Nov | Setups on top-momentum stocks only | India 2011-19, US 2018-25 | Fails | India top group -0.04R vs -0.05R outside; US +0.01R vs +0.02R | Momentum rank does not rescue the setups. India 2021-25 only: +0.31R vs +0.06R |
| C-128 | 1 Nov | Clenow-style weekly momentum book, no setups | India 2011-19, US 2018-25 | Fails | India +96.2% vs index +102.6%; US +76.6% vs SPY +142.3% | A faster rank did not beat the index. India 2021-25: +210% vs +100% (reported) |

## A0. Rules C-1 to C-50 (before the backtester): mostly design choices, few tests

These rows are the original design, data-source decisions, document corrections and the Legacy book exit work. Only C-42 to C-49 were tested with written pass criteria. The original desk rules were never backtested; the rows say so.

| IDs | What | Evidence |
|---|---|---|
| C-1, C-2 | Sector ranking (2 x 3M + 1M, top 4 weekly) and two-weekend persistence | Design choice. C-1: "No separate evidence record exists". C-2: "no backtest on record". |
| C-4, C-5 | Widen a too-close stop to 1.5 ATR(14); room to resistance 3R (US) and 2R (India; India moved to 3R in C-112) | Design choice, "no backtest on record". The stop cap and 3R room were only examined later (C-64, C-125, C-126), which found no edge either way. |
| C-6, C-22, C-24, C-35, C-36, C-38 | The market light: which setups each colour allows, Red as pilots only, follow-through tracking, Red allows setups 1 and 4 | Rules and fixes. C-24 says "Backtest later". No test of the light on its own exists. All replays fixed it. |
| C-25 | US skips setup 3 and needs results 10 or more days away | "Backtest later". C-63 later tested results timing on India only. |
| C-3, C-7 to C-14, C-26, C-40 | Data sources (NSE index file, stored closes, Alpha Vantage, ETF Database, Yahoo, Tiingo) | Source tests, not strategy tests. Alpha Vantage, ETF Database and Yahoo full-page history were rejected; Yahoo was parked pending a re-test from GitHub servers (C-26). |
| C-15, C-16, C-19, C-20 | US weekly sector-holding screen and the whole-market scan | Built and tried on 30 stocks. No backtest at that stage; the scans were replayed later (C-51, C-52, C-118, C-119). |
| C-21, C-23, C-27, C-28, C-37, C-39 | Documentation and code alignment | No test. |
| C-29 to C-34 | Correlation control, pending-order risk, 100-trade gate, MAE and MFE, US risk step-down and US VIX rule | Proposed or rejected (C-33). Parameters are "untested guesses". |
| C-41 | Definition of the swing low for the Legacy exit test | Adopted by the owner, no test. |
| C-42 | Weekly-close exit when a stock is within 1 ATR of its 200-day | Replay 2022-25 (20 and 60 session horizons, against the median Nifty 500 stock), criteria written first. No band passes, so all exit at the first close. Near band: back to Keep 43.2% vs 11.2% (passes), but 60-session excess gap only +0.43 (needs 1 point); 1 of 4 years pass. Mid band: gap +1.30 but not consistent by year. Parked. |
| C-43 | Swing low must sit 1.5 ATR below the prior high | Same replay. Fails: the deep subgroup is 13,960 of 14,577 swing-only observations, so the test barely discriminates; 60-session excess gap -0.14 (needs 1 point), 1 of 4 years pass. Swing-low leg above the 200-day treated as context only. Rejected. |
| C-44 | Back-adjust stored closes for corporate actions before exit tests | 791 actions adjusted (524 split or bonus, 79 dividend, 187 rights, 1 demerger); stocks blocked fell from 124 to 22; replay group results unchanged (both-fail -3.0 vs Keep -1.45 median 60-session excess). Interim. |
| C-45 | Re-entry tag (top-quarter relative strength and up-day volume) | Display only, untested: volume is stored only from Oct 2025. 39 of today's Exit stocks qualify. Needs 250 sessions of volume before a test can run. |
| C-46 | Show how firm each Exit is | Replay Apr 2021 to Oct 2026: back above the test within 20 sessions: both fail 11%, 200-day only far 15%, near 43%, mid 38%, swing low only 60%, Keep 78%. Median 60-session excess: both fail -3.0, Keep -1.45; mean -0.7 vs +2.3. The Exit rule separates stocks only modestly and the spread inside each state is wide. Interim. |
| C-47 | 50-day against 200-day as extra information on a verdict | Same replay. Both cuts fail. Inside Exit, 50-below-200 stocks were back to Keep less often (14.6% vs 28.6%) but the excess and year conditions failed. Stays a plain context line. Rejected. |
| C-48 | 50-day against 200-day, and relative strength, as re-entry filters | All three filters fail. F1 (50-day at or above 200-day): back to Keep 39.4% vs 14.6% but median 60-session excess only +0.59 better (needs 2); F2 (top-quarter relative strength): back to Keep 40.3% vs 18.6% but excess 1.24 points worse. Tag stays untested. Rejected. |
| C-49 | Swing-low window of 7 or 15 sessions instead of 10 | Neither passes; the window stays 10. Window 7 flags more stocks (22,641 observations vs 16,686) and more of them bounce back (65.4% back to Keep within 20 sessions). Rejected. |
| C-50 | Automatic handling of demergers | Coverage passes: stocks blocked by a corporate action fell from 22 to 6 of 2,917 (the 6 left are bonus or NCRPS cases, not demergers). Method check not evaluable as written: only two typed demerger records exist in the price data. Adopted. |

Lesson: the live desk's sector ranking, stop widening, room rule and light came from design, not evidence. The later tests (C-118 onward) are the first to check the setup rules against history, and they found no edge.

## B. Data and tooling (no rule results)

C-116 (India 2010-2019 and US survivorship labelling), C-117 (standard report), C-122 to C-124 (price-break fixes). Any India result before 2020 now carries the repaired data. Re-running scripts/derive-india-overrides.mjs rewrites the overrides file and would drop the pre-2020 entries.

## C. Portfolio Manager tests (funds and allocation)

| ID | Date | Question | Result | Lesson |
|---|---|---|---|---|
| C-74 | 20 Oct | Tilt asset-class weights with market performance | Failed fit rule; no tilt built | |
| C-75 | 20 Oct | Sector and thematic funds by sector strength | Failed fit rule | |
| C-81 | 22 Oct | Fund score: does Strong beat its category, does Weak trail it? | A fails (5 of 10 years, needs 60%), B passes (7 of 10) | Useful as a warning, not a buy signal. Replace is off |
| C-83 | 23 Oct | Widen the Watch band | Test C fails (5 of 10 years) | Band unchanged |
| C-85 | 23 Oct | Index-trailing and cash-relative rules | Index test fails (2 of 8 years); cash test not testable | Funds that trailed their index tended to catch up |
| C-86 | 23 Oct | Rebalancing cadence | Passed; band-to-edge adopted | Lowest turnover with the same return |
| C-92, C-94 | 24 Oct | Alternative consistency measure; risk-aware score for equity funds | Not adopted | |
| C-98 | 24 Oct | Index-fund bands | Not testable (too few funds per band) | Redone as C-110 |
| C-99 | 24 Oct | Tilt equity money to best categories | Passed; not applied | |
| C-100 | 24 Oct | Choose among all fund groups by past risk-adjusted return | Failed; allocation unchanged | |
| C-102, C-103 | 24 Oct | Thematic and international funds with the C-82 score | Not testable | Redone as C-105 |
| C-104 | 25 Oct | Holdings-health reading vs next-year return | Failed; information line only | |
| C-105 | 25 Oct | Rank correlation for thematic and international scores | Thematic passed (weak); international failed | |
| C-106 | 25 Oct | Stock-trend signal (50 over 200) on its own | Failed at 12 months (hit rate 50%) | |
| C-107 | 25 Oct | Swing trend rules on fund NAVs | Both tests failed | Template not used for funds |
| C-109 | 25 Oct | C-82 score on conservative and other hybrid funds | Passed | |
| C-110 | 28 Oct | Index-fund gap to the same-index median | Passed (correlation above zero in all 10 years) | |
| C-101, C-108 | 24-25 Oct | Holdings health build; fund quality facts | Registered or building; no outcome yet | |

## D. Ruled out, so do not repeat without a reason

- The 200-day cash switch as a rule (C-120).
- Slower momentum holds, 3 or 6 months (C-121).
- Wider stop-width caps for the setups (C-126).
- Setups restricted to top 12-1 momentum stocks (C-127).
- A Clenow-style weekly momentum book with the published filters (C-128).
- Earnings run-up filters (C-60, C-62): both failed narrowly. The run-up tag itself (C-59) passed on relative returns, and a forward test (C-61) is running.
- Fixed longer holds in place of the live exits (C-70).
- Excluding India skip days (C-72).

## E. Not yet tested

- India before 2010, including the 2008 bear market.
- The market light (green, yellow, red) on its own: no test exists, and all replays fixed it (India green, US yellow). The sector ranking (C-1, C-2) was also never backtested.
- The results-date rule in the replays (it was off).
- Forward paper trading of a momentum book on new data (the earnings and momentum forward tests C-61, C-66 and the US paper book C-53 are already running; their reads are not in yet).
- Other families, such as value or quality screens: I found none in the change log, but check it before running one.
- US without survivor bias (forward data only).

Correction recorded 1 Nov: earnings-driven stock picking was already tested (C-59 to C-63) and is not an untested idea.
