# Test register: what we tested, what happened, what we learned

Built 1 Nov 2026 from the Engine Rules change log (docs/ENGINE_RULES.md), the manifest (docs/backtests/manifest.json) and the reports in docs/replay/. The change log row is the full record of every test; this page is the one-page index so that nothing is run twice by accident. Numbers are quoted from those rows; where a row is long, this page gives the headline and points to the row.

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
| C-52 | 16 Oct | US-SCAN-2: tightness in the score, replayed light, group cap | US | Not adopted | See row | Parked |
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
- The market light (green, yellow, red): all replays fixed it (India green, US yellow).
- The results-date rule in the replays (it was off).
- Forward paper trading of a momentum book on new data (the earnings and momentum forward tests C-61, C-66 and the US paper book C-53 are already running; their reads are not in yet).
- Other families, such as value or quality screens: I found none in the change log, but check it before running one.
- US without survivor bias (forward data only).

Correction recorded 1 Nov: earnings-driven stock picking was already tested (C-59 to C-63) and is not an untested idea.
