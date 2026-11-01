# Multi-stream signal desk: build brief (PROPOSAL, reconciled with the owner on 1 Nov 2026)

**Status: a proposal, not adopted.** The owner attached this brief on 1 Nov 2026 and asked for its contradictions with the live desk to be sorted first. The owner's answers are below and override any conflicting text in the brief that follows. Nothing in the brief changes a live rule. The live desk rules stand until a change is registered in the Engine Rules change log and approved (see C-137).

## Reconciliation: owner answers, 1 Nov 2026

| # | Contradiction | Owner answer | What it means |
|---|---|---|---|
| 1 | Brief retires the setups, stop cap, 3R room test and sector gate from the live path and main-line paper | Keep | They stay live. C-53 and C-66 keep running to their pre-registered reads. |
| 2 | Brief makes the light context only | Keep the light's live rules | The light keeps sizing risk and gating entries as today. "Context only" and the regime-sized twin are not adopted. |
| 3 | Brief removes the sector gate from every stream | Keep it for the strategies running now; for the rest, check | The sector gate stays in the running strategies. For each new stream, whether to use it is decided by a registered check, not assumed either way. |
| 4 | Brief makes the trend template the India main-line filter | Asked which template and how it differs | See "Trend template" below. Not adopted; nothing changes. |
| 5 | Brief says live orders from the desk's screens are paused | Keep live desk rules | The sized shortlist and the nightly order message for official candidates stay as built (C-111, C-113). Real-money decisions stay with the owner. |
| 6 | Brief lists "resolved owner decisions" | Keep live desk rules | Those items are proposals only. The owner's recorded decisions are the ones in the Test Register. |
| 7 | Brief makes the results date a flag, not a gate | OK with the suggestion | Approved as a proposed change, see C-137. Applied 1 Nov 2026 as C-138. |
| 8 | Brief benchmarks the desk against the momentum index fund | Keep the plain index | Nifty 500 (India) and SPY (US) stay the main benchmark. The momentum fund is shown beside it. |
| 9 | Fund expense 0.3 to 0.4% | Go with suggestion | Use 0.20% base expense plus 0.20% tracking error (Kotak direct plan, Sep 2026 factsheet). |
| 10 | Stream 1 "partly built" | Go with suggestion | Stream 1 is built: the India and US momentum paper books start with the 2 Nov signal. |
| 11 | Sleeve "tracks the published index" | Go with suggestion | Say it correlates (0.915) with a named mid-cap tilt: it trailed NSE by about 4 points a year in 2011 to 2019 and led it in 2021 to 2025. |
| 12 | "Streams never read each other" but stream 5 starts from the momentum quintile, stream 11 restricts stream 1, and the combined list reads all | Go with suggestion | Define stream 5 from its own signal, or count it in the momentum family. |
| 13 | Family agreement is meant to be independent evidence, but pullbacks start from momentum names | Go with suggestion | An A-with-B agreement is not counted as independent agreement. |
| 14 | Thresholds must come from a published source or an owner decision, but the stall exit, the 3 to 5 session dip and the 100-day break and 2.5 ATR exit have neither | Go with suggestion | Those are untested placeholders: logged as factors, not adopted. |
| 15 | "Fail at read date means switch off" versus the register's "a fail means not shown" with low power | Go with suggestion | Each stream's read is "supports or rules out"; a read too weak to judge says so. |
| 16 | Fills "next morning only" but streams 2 and 5 enter on a close | Go with suggestion | One fill convention is chosen and stated for all paper books before any new stream starts. |

### Trend template: which one, and how it differs from the current one

It is the same template. The brief's conditions (close above the 50-, 150- and 200-day averages; 150 above 200; 200 rising; 50 above 150; at least 30% above the 52-week low; within 25% of the 52-week high) are the conditions already in the Engine Rules (Stock selection) and in the code C-135 tested. The differences are only in how it is used:

- **Today:** one filter inside a funnel. In the scan the stock first passes the relative-strength gate, then the template, then group strength, base quality, setups and the room test. India and US both use it.
- **Brief:** the template becomes the universe filter for India streams, with a no-template twin, and is dropped in the US (C-135: India passes at +1.19% a month in 8 of 9 years; the US did not confirm at +0.24%).
- **What C-135 tested:** the template on its own, passing against failing stocks among the 500 most traded names, not the scan's own floors or its relative-strength gate.
- **Not adopted:** the record has the test result only. Making it a main-line filter would be a new registered rule.

---

# Build brief: multi-stream signal desk (Swing Desk v2 architecture) — final

Owner: Bhargav. Date: 31 Oct 2026; revised 1 Nov 2026 after C-129, its replication check, the second outside review, and C-133 to C-136. Status: final build brief for the implementing session. Read with `swing-desk/DECISION-BRIEF-FACTOR-SLEEVE.md`, which records the owner-level decision this brief implements: index core plus a factor sleeve held through index funds; the desk's live outputs limited to the Legacy cleanup and the Portfolio Manager; every stream below runs on paper against the fund until it earns capital. Nothing here changes a live rule until it passes its own pre-registered test. The brief supersedes the pattern-setup funnel (setups 1, 1ipo, 2, 3, 4 as gates) and the sector gate; it does not change the Engine Rules regime light's computation, the Portfolio Manager spec, or the ledger.

## 0. Revision note (1 Nov 2026)

C-129 (Momentum-30-style sleeve, India 2011–2019, stand-ins for NSE's unpublished parameters) compounded +213% against +129% for the Nifty 200 (13.8% vs 9.8% a year, a 3.9-point gap net of trading costs of about 0.73% a year), and +182% against +102% in 2021–Oct 2025 (reported, not judged). It failed its registered rule (interval included zero; 4 of 9 years), the rule having been set above the power of 106 months. Without 2017 the gap is about 1.8 points a year. Relative drawdowns against the Nifty 200 of 16% (2018–2019) and 21% (2021–2023). The equal-weight twin made +206.6%, so weighting did not drive the result; universe, name count, score, turnover and the absence of a cash rule changed together and are not separated.

Replication check (run 1 Nov): monthly-return correlation with NSE's Nifty200 Momentum 30 price series 0.915 over 178 months (target 0.9). Tracking difference averages +0.02% a month but hides two opposite gaps: the sleeve trailed NSE's series by about 4 points a year in 2011–2019 (NSE +318% vs sleeve +213%) and led it in 2021–Oct 2025 (sleeve +182% vs NSE +138%). The pattern is a mid-cap tilt from the traded-value weighting stand-in, not a code error; it is named on every report and not tuned. NSE's series before Aug 2020 is a back-calculation; the live record since then (about 2 points a year over the Nifty 200 from Jan 2021 to date, after a weak 2022–2024) is the only independent piece.

Second review (1 Nov), adjudicated: the time stop is redefined as a stall exit so it never caps a working trade (section 5); a tightness gate on stream 5 is rejected on the record (section 4); costs stay per trade at liquidity tier, with slippage tiers and the fund's expense ratio added so the comparison is fair both ways (sections 2 and 7).

C-133 to C-136 (1 Nov), the desk's own rules tested one at a time, each registered first:
- Market light (C-133): Green months did not precede better index returns than other months in India 2013–2019 (+0.89% vs +1.04%) or the US 2018–2023 (+0.15% vs +1.31%); Red months were not worse. Light 2006–2009 (C-136): right sign, interval spans zero, 48 months and one crash; the gap is Green sitting in rising years, not an edge within years. The light has no shown predictive power at the horizon it is used on. It becomes dashboard context and stops being a sizing input; the soft 50% rule and its 2005–2010 test are withdrawn (the precondition, predictive power, failed on 160 months; stock prices for 2005–2010 are not stored). The regime-sized book is logged as the twin, not the main line.
- Sector ranking (C-134): top-four sectors +15% vs +55% for the average sector (India 2013–2019); −3% vs +58% (US 2018–2023), significantly worse. The sector gate and the group-strength step are removed from every stream and from the combined list; stream 6 is retired as defined. Likeliest cause: 1- and 3-month sector returns mean-revert while the published industry-momentum effect sits at 6–12 months; the contrarian reading is one window and is not traded.
- Trend template (C-135): India passes (passing stocks beat failing ones by +1.19% a month, 8 of 9 years); US misses (+0.24%). Fails the shared "both markets" rule. Registered as a market-specific filter: India streams run with the template as the main-line universe filter and a no-template twin; US streams the reverse. The effect overlaps the momentum sleeve's selection and is a stock-selection effect, not a way to trade.
- Results-date rule: C-63 already found it is not a return filter; it stays a flag, never a gate.

Consequences carried into this brief:
- Stream 1 is the Momentum-30-style sleeve as frozen in C-129. Owner decision 1 is resolved.
- The desk's benchmark is the Nifty200 Momentum 30 index fund (section 7). For holding the factor the fund is strictly better than the self-run sleeve (same expected return; tracking error of tenths of a point against the sleeve's ±4 points a year by period; 0.3–0.4% expense against 0.73% trading cost plus short-term tax). The sleeve is a paper book and a carrier for overlays, not a candidate for capital.
- Per-stream criteria are set at the power the sample allows (section 7). The external record carries the burden of proving the factor; the desk's tests carry the burden of replication and of showing that overlays do not subtract.
- Relative drawdowns of 15–25% against the benchmark are written into expectations; only the household drawdown limit (20% Balanced; `docs/HOUSEHOLD_DRAWDOWN_LIMIT.md`, from the Portfolio Manager spec) triggers the governor, and it raises a review, never an automatic sale.
- Of the desk's own rules, one has a supported effect (trend/momentum selection, strongly in India, weakly in the US); the light, the sector gate, the setups, the caps and the room test do not. Risk mechanics (sizing, caps, ATR stops) are controls, not return sources, and are not tested as such.

## 1. Why this redesign

Out-of-sample tests (C-118 India 2011–2019, C-119 US 2018–2025, C-120 cash rule, C-121 longer holds, C-129 Momentum-30-style sleeve and its replication, C-133 to C-136 rule-by-rule tests, US-SCAN-1/2 replays, C-53 paper book) established:

1. Momentum selection over a liquid universe shows positive point estimates over its own universe in every test; intervals include zero on nine years in India, as expected for an effect of that size and a test of that power. The trend template shows the same selection effect strongly in India (C-135).
2. Equal-weighting a 500-stock universe against a cap-weighted index explains most of the earlier "loses to the index" results (C-121: equal-weight top 500 +40% vs Nifty 500 +126% before any picking). A top-200 universe, 30 names, semi-annual turnover and no cash rule beat the Nifty 200 in both windows (C-129) and track the published index (0.915).
3. The pattern-setup layer (percentage stop caps, chart-level stops, 3R room test, base-quality gates) skips 90%+ of fills in every dataset and shows no edge where it operates. It is retired, not re-tested.
4. Holding-period evidence is mixed: a C-118 side note favoured 60–120 sessions, C-121 (registered) had monthly ahead of 3- and 6-month holds in India. No holding-period rule is adopted on it; the sleeve's semi-annual cadence comes from the published methodology. C-121 says nothing about time stops versus trailing stops.
5. A hard cash switch on the 200-day cost about 220 points of compounded return in India 2011–2025 and did not cut US drawdown (C-120); the light itself has no shown predictive power (C-133, C-136). The light is context, not a sizing input.
6. The sector gate selected the wrong sectors in both markets (C-134) and is removed.

The desk is therefore rebuilt as independent signal streams, each with its own paper book, combined by a fixed agreement rule, with risk handled by sizing rather than by entry patterns. The builder must not tune any rule against the 2011–2026 data; that data's clean status is spent. Replication of published rules and forward paper books are the evidence.

## 2. Ground rules (apply to every stream)

- One implementation: the same rule code runs live and in replay through an as-of data view. Module and replay must agree on every stock on the last date (standing parity test). The parity test checks portfolios, not returns; costs are charged elsewhere.
- Pre-registration: every stream has a change-log row with its rules, thresholds, data, pass criterion (with stated power) and read date, committed before the first signal is logged. Any change to a stream restarts its clock as a new version.
- No tuning on seen data. Thresholds come from the published source or from the owner's earlier decisions; sensitivity curves may be drawn, parameters may not be picked from them. No sweeps to separate the C-129 components. Stand-ins may be adjusted toward NSE's series by correlation alone, never by returns, with every attempt logged and the set frozen after five.
- Costs on every paper trade, per trade, at liquidity tier: India 0.35 / 0.50 / 0.80% round trip by tier; US tiers from the charges model; plus a slippage assumption that rises for thinner names (set per tier in settings). This is the mechanism that produced the sleeve's 0.73% a year and it produces the right figure for any turnover; no flat annual deduction is used. Fills at trigger from stored highs and lows, limit respected; next-morning execution only. Tax effect of each exit shown from the ledger's tax view. On the benchmark side, the fund's expense ratio is charged, so the comparison is fair in both directions.
- Point-in-time everything: universe membership, corporate actions, regime light, event calendars as known on the night. Delisted names count at last price inside the outcome window.
- Price-only on both sides of every comparison (stored prices carry no ordinary-dividend adjustment; benchmarks are price indices), stated on every report. Comparisons with a fund's NAV show the fund's dividend yield taken off and say so.
- Personal data never enters data/ or logs; identifiers stripped at parse as per the Portfolio Manager spec.
- Owner decides; the builder reports fails as fails.

## 3. Architecture: three layers plus risk

### Layer 1: streams
Each strategy is a stream: universe filter → signal → entry rule → stop → exit style → own paper book → own read date. Streams never read each other. Output per night: list of (ticker, stream, rank, trigger, limit, stop, exit style, factors).

### Layer 2: families and the overlap table
Streams are grouped into families by the effect they measure. Agreement is counted by family, not by stream (four momentum variants agreeing is one vote).

Families: A trend/momentum; B pullback/reversal; C earnings/events; D ownership/insiders; E quality/value. (The former family F, regime/allocation, is removed as a sizing input after C-133; the light is context only.)

The overlap table lists every ticker with signals tonight, the families agreeing, the streams within each family, the regime light (context), and the volatility-targeted size.

### Layer 3: combined list and score
- Combined list = tickers ordered by (number of families agreeing, then evidence weight of the strongest family, then rank within it). Evidence weights fixed in settings: C and A highest, E next, D next, B lowest.
- Horizon rule: when streams of different holding styles agree, the trade uses the slower stream's exit.
- Score: until a bucket (1-family, 2-family, 3+-family) has 50 closed paper trades, show the family count and weights only. After that, show the bucket's historical hit rate and expectancy in R from the paper books. Never display a percentage that is not calibrated from logged trades.
- The combined list is itself a stream ("agreement ≥ 2 families") with its own paper book, tested against each stream alone.
- Nightly diagnostics: streams fired, families fired, family mix of the combined list, largest single industry share, correlation matrix between stream returns (rolling 60 sessions).

### Risk and portfolio modules (apply to all streams)
- Volatility targeting: position size so each position contributes equal risk; book-level volatility target in settings.
- Exposure caps: per name, per industry group (SIC/NSE basic industry map), per family, rolling over 20 sessions, not per night only. Caps are controls, not return sources, and are not tested as such.
- Regime light: dashboard context only after C-133 and C-136. The main line of every paper book is sized without regard to the light; a regime-sized twin (50% new-entry size below the index 200-day, no forced exits, never cash) is logged beside it so the question stays measured forward. No cash switch anywhere.
- Market-specific universe filter: India streams apply the trend template (close above the 50-, 150- and 200-day averages; 150 above 200; 200 rising; 50 above 150; ≥30% above the 52-week low; within 25% of the 52-week high) as the main-line universe filter with a no-template twin; US streams run without it and log a with-template twin (C-135).
- Drawdown governor: on a breach of the household limit (20% Balanced), a review is raised; no automatic sale. Relative drawdown against the benchmark is reported, not acted on.
- Exits per holding style (section 5). No percentage stop caps; no room test. Stops in ATR where a stream declares one.
- Universe exclusions for every stream: ASM, GSM, trade-for-trade, 2% and 5% price bands (India); pledge above a threshold flagged; results date inside 10 sessions flagged, never a gate (C-63).
- Journal: every signal, fill, exit and reason logged with the ledger commit and data as-of date; reproducible.

## 4. Stream catalogue, by priority

Status: B built, P partly built, N not built. Data: have / free source named / paid.

### Tier 1 — build first, one book
1. **Core momentum sleeve, Momentum-30 style (A).** As run in C-129, frozen: universe top 200 by traded value at each rebalance (stand-in for Nifty 200); score = equal blend of 6- and 12-month return each divided by daily volatility (NSE's z-score transform if the whitepaper specifies it); top 30, buffer: an existing holding stays while in the top 45; weights score × traded value capped at 5%, falling back to the 5% cap alone when the 5× rule cannot allocate; equal-weight twin and monthly-review twin logged alongside, not judged; rebalance semi-annual (end June, end December); no cash rule; no stops; no template filter (the sleeve is the published methodology as is). Paper book builds at the next close after sign-off; December is the first scheduled review. Pass conditions (C-130): live code gives the same portfolio as replay code on every review date (two differing dates = stop; one = investigate); rolling 36-month correlation with NSE's series ≥ 0.9 (stop below 0.85; rolling 12-month below 0.8 is a flag only); tracking difference by calendar year with the mid-cap tilt named. AMFI NAV of a Nifty200 Momentum 30 index fund is the standing monthly proxy for the live series; the NSE file is reconciled annually. Four-row outcome table incl. "tracks the index, trails it by more than the tilt explains" (implementation fault). Interim review at 12 months, re-review at 24. Not a candidate for capital; carrier for overlays and tax-aware exits. US equivalent: top 200 by dollar volume, same score, compared with MTUM. [P; data: have.]
2. **Post-earnings announcement drift (C).** Buy on positive surprise (reported vs prior-year quarter or consensus where available) on the first close after results; hold 40–60 sessions; ATR stop. [N; results dates from NSE announcements / free US earnings calendar; reported EPS from filings.]
3. **Volatility targeting and exposure caps (risk).** [P as rules; N as module.]
4. **India trend-template filter (A), market-specific.** Applied as the universe filter for India streams 5, 7, 11a and the combined list, with a no-template twin; logged as a twin only in the US. Not a stream of its own; a filter with a registered twin. [B as a rule; N as a module.]

### Tier 2 — log from night one, trade on pass
5. **Pullback in uptrend (B).** Universe: names in the top momentum quintile (so in an uptrend by construction; in India also passing the template). Signal: a fall over 3–5 sessions or a touch of the 20-day average. Entry: the first up close after the dip, never the dip itself. ATR stop; hold to the momentum exit. No tightness or volume gate: a volatility-contraction gate is the base-quality gate that passed 11 times a year in US-SCAN-1 and has no evidence in the register, and daily volume cannot distinguish accumulation from distribution. Volume ratio and tightness are logged as factors on every signal, so the paper book will show any predictive split; a filter may be registered from that split, never adopted on intuition. [P; have.]
6. **Retired after C-134.** Sector/industry rotation on 1- and 3-month scores selected the wrong sectors in both markets. A 6–12 month industry-momentum version may be logged as a tier-3 stream (see 12a); it has no place in the funnel.
7. **Donchian breakout comparator (A).** Buy 20- or 55-day high close; exit opposite channel or ATR trail. [P in C-53; have.]
8. **Promoter and insider buying, India (D).** SEBI PIT disclosures and quarterly shareholding patterns; signal on net promoter/insider buying above a size threshold; hold 3–6 months. [N; free.]
9. **Special-situations calendar (C).** Buyback tender arbitrage (retail reservation), demergers (parent and child), index inclusion/exclusion, rights and open offers, delisting offers. Each with its own entry/exit template. [N; free exchange announcements.]
10. **Quality-value positional (E).** F-score ≥ 7 and top-half earnings yield; annual holds; rebalance quarterly. [N; needs quarterly-results parser or fundamentals feed.]
11. **Low-volatility / quality overlay on momentum (A+E).** Restrict stream 1 to the calmer half of the universe by ATR%; later by quality once fundamentals exist. [N; price half: have.]
11a. **Positional 12-1 momentum, weekly review (A).** Top 20–30 by 12-1, 1–3 month holds, 100-day break and 2.5 ATR exits; a logged comparator to the core sleeve, not the core. [P; have.]

### Tier 3 — log quietly
12. 52-week-high proximity rank (A). [have]
12a. Industry momentum at 6–12 months, logged only (A). [have; replaces stream 6]
13. Turnaround: cheap, improving F-score, insider buying, rising delivery (E+D). [needs fundamentals]
14. Gap continuation on results (C). [needs opens in US store; results dates]
15. Dual momentum across asset classes for the Portfolio Manager tilt. [have; Portfolio Manager, not desk]
16. Standalone short-term reversal (B). [have; expect cost fail]
17. Delivery-percentage accumulation; mutual-fund holdings changes (D). [free; factors only]
18. Operator-activity, pledge, ASM/GSM screens: exclusion filter, not a stream. [free]

### Tier 4 — factors only, never gates
19. Chart patterns: VCP, high tight flag, deep base, base tightness, AVWAP, CAN SLIM N. Logged as factors on stream outputs.
20. RSI, MACD, indicator scores. Not used.
21. Seasonality and calendar tilts. Not used.
22. Flow and sentiment (FII/DII, put-call) and the regime light. Context on the dashboard only.

### Retired (negative evidence, not re-tested)
The swing setups (base breakout, IPO base, 20 EMA and 50 SMA pullbacks as gates), the 6–8% stop-width cap and the 3R room test: C-64, C-118(b), C-119(b), C-125–127, US-SCAN-1/2. The sector gate and group-strength step: C-134. The light as a sizing input and the soft 50% rule: C-133, C-136, C-120. Removed from the live path and from main-line paper; the regime twin and the mechanical comparators (streams 5 and 7) keep the questions measured.

### Excluded
Pairs/stat-arb (shorting), intraday and opening-range (no-intraday rule), options and volatility selling, ML signal combination, derivative hedging (possible later as its own test).

## 5. Holding styles and exits

| Style | Hold | Exit |
|---|---|---|
| Sleeve | Semi-annual rebalance | Leaves top 45 at rebalance; no stop |
| Swing | 2–8 weeks typical, no calendar cap | ATR stop; trailing ATR on a working trade; stall exit only |
| Positional | 1–6 months | Rank exit, 100-day break, 2.5 ATR stop |
| Compounder | 1–5 years | Fundamental exit, partial profit-taking |
| Event | To resolution | Event-specific template |

The stall exit replaces the former time stop: a trade is closed for time only if it has made no progress (below +1R after 20 sessions; number pre-registered in settings), never because a calendar date arrived while it is above its trailing stop. A working trade is exited by the trail alone, so the right tail is not cut. A stream declares its style; the overlap rule uses the slower style when streams disagree.

## 6. Data and sources

- Have: India daily bars 2011–present with corporate-action adjustment (splits, bonuses, rights, large special dividends; demergers typed; no ordinary-dividend adjustment), delivery data, regime light history (replayed, context only), monthly top-500 and top-200 lists by traded value, NSE Nifty200 Momentum 30 price series (`data/replay/nse-momentum30-price.csv`), US daily bars Oct 2024–present (Massive, FIGI-keyed, split-adjusted), US SIC map, ledger (Portfolio Manager), `docs/HOUSEHOLD_DRAWDOWN_LIMIT.md`.
- Free to add: AMFI daily NAV file (fund proxy for the live momentum series), NSE corporate announcements (results dates, buybacks, demergers, index changes), SEBI PIT disclosures, shareholding patterns, pledge data, bulk/block deals, mutual-fund portfolios, Nifty 200 constituent change notices, US earnings calendar (free API, verify), SEC filings.
- Not stored and not planned: India stock prices and sector indices before 2011 (would need a separate data job; no test currently depends on them). US delisted tickers (no free source; forward data only).
- Paid (deferred by owner decision): consensus estimates, fundamentals feed with history, point-in-time Nifty 200 membership and market cap (would remove the mid-cap tilt; nothing depends on it).
- Resolve the 30 symbols carrying 81% of unresolved price breaks before any replay touches 2011–2019 again.

## 7. Testing, benchmarks and read dates

- Benchmark hierarchy: (i) the Nifty200 Momentum 30 index fund (India) and MTUM (US), the zero-effort way to own the factor, is the benchmark for the desk as a whole and for stream 1, charged at its expense ratio; (ii) the Nifty 200 / Nifty 500 price indices and S&P 500 for context; (iii) each stream's equal-weight eligible universe for selection skill. All price-only; fund NAV comparisons net of dividend yield.
- Each stream: pre-registered criterion with stated power, set at what the sample can detect (the minimum detectable effect is computed and written into the row before the run); 90% block-bootstrap interval on mean excess return vs its benchmark, after per-trade costs, slippage and the tax effect; point estimate above the cost difference; read at the later of N closed trades (set per stream from expected frequency) or 12 months. Streams failing at read date are switched off. A criterion that the factor's plausible effect size could not clear is not registered; a forward book is understood to support or rule out, not confirm.
- Each stream's paper book carries its twins (regime-sized; template on/off by market); twins are reported beside it at every read and are never the main line unless a registered read says so.
- Replication checks for published rules (stream 1 vs NSE series, done, 0.915; stream 2 PEAD vs published drift magnitudes): a pass means "implementation reproduces the source", not "edge confirmed".
- Combined stream tested against each component stream.
- Strategy-level: the desk's after-tax, after-cost XIRR vs the cash-flow-matched momentum index fund (net of its expense ratio) and vs Nifty 500 / S&P 500 price. Read at 300 closed trades or 24 months, floor 150. A stream earns capital only by beating the fund after tax on its forward book; a self-run allocation, if ever made, is turned down by half if it trails the fund by more than 2 points annualised after tax. Relative drawdowns of 15–25% against the fund are not a trigger; the household drawdown limit raises a review.
- Live: core factor exposure through index funds at the allocation engine's lines (Portfolio Manager decision, see the decision brief). No live orders from the desk's screens. The Legacy cleanup is the desk's only live output.

## 8. Nightly output (dashboard)

1. Combined list: ticker, families agreeing, streams, regime light (context), size, calibrated bucket stats where available, exit style, trigger/limit/stop, tax effect of exit. Paper only; labelled so.
2. Per-stream lists; a separate Momentum page for stream 1 showing the 30 names, rank, weight, status, both twins, and the monthly NSE/AMFI correlation line.
3. Diagnostics: counts, family mix, industry concentration, stream correlation, data freshness, data gaps (unresolved corporate actions, missing results dates), twins vs main book per stream.
4. Paper-book status per stream: trades, expectancy in R, hit rate, days to read date, relative drawdown vs benchmark.

## 9. Build order

1. Done: C-129 replication check (0.915); C-130 rewritten; C-133 to C-136 run and recorded; register and live docs updated.
2. Stream framework: as-of data view, stream interface, paper-book logger with twins, overlap table, settings files with change logs. Reproducibility (parity) test.
3. Stream 1 Momentum page and paper book (both twins), then streams 5, 7, 11a logging from night one with the India template filter and its twin. Risk module (3). AMFI NAV proxy line.
4. Free Indian sources: results dates and reported EPS (stream 2), SEBI PIT and shareholding (stream 8), announcements calendar (stream 9), Nifty 200 constituent notices. Exclusion filters (18).
5. Tier-3 price-only streams (12, 12a, 16) as logs.
6. Fundamentals parser or feed decision (streams 10, 11, 13).
7. Combined-stream paper book and score calibration once buckets reach 50 trades.
8. Any live allocation to a self-run stream only per section 7, after a pass.

## 10. Owner decisions

- Resolved: stream 1 definition (C-129 sleeve); factor exposure through the fund; point-in-time data deferred; correlation stop windows (36-month stop, 12-month flag); live orders from the desk's screens paused, Legacy cleanup continues; stall exit replaces the time stop; no tightness gate on stream 5; costs per trade with slippage tiers and fund expense on the benchmark side; light demoted to context with the regime-sized book as twin; sector gate removed and stream 6 retired; template as India main-line filter with twins both ways; 2005–2010 soft-regime test withdrawn.
- Outstanding: book-level volatility target and per-family exposure caps (numbers); the stall-exit threshold (proposed: below +1R after 20 sessions); slippage per liquidity tier (numbers); fundamentals parser vs paid feed; the Portfolio Manager decisions in the decision brief (hold a factor sleeve, which defensive factor, caps, funds).