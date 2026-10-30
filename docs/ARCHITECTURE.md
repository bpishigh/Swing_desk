<!-- Copy of the Claude Doc 'Swing Desk – Code and Architecture', doc rev 58, exported 3 Oct 2026. The live doc is the source of truth. https://claude.ai/code/artifact/4b363c70-acb3-4794-b868-141a2057a885 -->

# Swing Desk – Code and Architecture (Source of Truth)

2026-10-03 · @Owner

## Purpose and how the two documents relate

This document says how the Swing Desk is built so a new engineer or an AI coding tool can run, fix and extend it without asking the original author. The companion Engine Rules document says what the desk decides and why. Rules change only through that document's Change log; this document describes the machinery that carries them out.

**Code version:** app v9.1 on Claude Artifacts (3 Oct 2026), patched from v9 to follow Engine Rules R-2026.10.5 (the repo's engine follows the version in `RULES_VERSION`, currently R-2026.10.9). The GitHub build has started in the private repo bpishigh/Swing_desk (phase 0: scaffold, fixtures, source test, Telegram alert, and a TypeScript engine replayed against v9; engine commit b6ae0f6, 3 Oct 2026). The live desk is v9.1 and still fed by the Claude scheduled tasks, so sections marked Target describe the intended design, not what runs.

**Reading order for a newcomer:** this section, the system map, data flow, schema, then the runbook. Read the Engine Rules before changing any calculation.

**Hard rules for anyone changing the code:**

1. No rule value is written in code. It comes from a settings file or table named in the Settings section. (Applies to the rewrite; app v9 still keeps them in constants.)
2. Every number shown to the trader carries a source and an as-of date. Missing or stale data is shown as missing, never filled in.
3. A change that alters a decision is logged in the Engine Rules Change log first.
4. In the Claude runtime, never retry or route around a 403 or 407 from the organisation proxy. On a GitHub runner, a 403 from a source such as NSE comes from the source itself: the right first response is standard browser headers and a session cookie on the first request, logged. Evasion such as rotating addresses or ignoring a site's stated terms is never acceptable. Record every block in the data quirks list.

## System map

Today the desk is one self-contained HTML app with a built-in database, filled by three scheduled Claude tasks. The target moves the fill and the app off Claude.

| Part | Today (app v9) | Target (GitHub build) |
| --- | --- | --- |
| App | Single HTML file published as a Claude Artifact (swing-desk.html), rules and screens in one script | Static app on GitHub Pages, one rules module shared by India and US |
| Database | Artifact built-in database, collections listed in the Schema section | JSON files committed to the repo by the nightly job; where trades and the journal live depends on decision 3 below (browser storage is the weakest option) |
| India data fill | Claude task, nightly 21:40 IST weekdays, and morning 07:20 IST Tue–Sat | GitHub Actions script, nightly |
| US data fill | Same morning task; US sector pages, TipRanks SMAs, stored closes | GitHub Actions script, nightly, from verified sources only |
| US stock screen | Claude task, Saturday 08:41 IST, writes the us_screen collection | Same script as the daily scan, run nightly |
| Alerts | None | Telegram or ntfy message after each run and on failures |
| Checks | Manual look at stamps | Automated data-health checks that block a stale run from reaching the app |

**Scheduled tasks today:**

| Task | Id | Schedule | Job |
| --- | --- | --- | --- |
| India nightly | trig_01PmtKhLn7Y14j5QRP791DMC | 21:40 IST, weekdays | Fill India feed and sector closes |
| Morning | trig_01LXdn6TvN5LNpFeAcdQvcGd | 07:20 IST, Tue–Sat | Fill US feed, compute returns and 200 SMAs from stored closes, top up history (max 2 gaps a run). Never uses an API key |
| US weekly screen | trig_01GLFkAY7uPtSXawEcXvAJVH | Saturday 08:41 IST, automatic approval | Build the us_screen document for the sectors in the top group |

The three task prompts are the code of today's data fill. They live inside the scheduled tasks and are not yet copied into this document or a repo, so export them with the fixtures (decision 9) before anything is changed. The Claude app, its database and the tasks are the only runtime. Decided 3 Oct 2026: app v9 stays the live desk on Claude while the GitHub build is made in a private repo, and the two run in parallel until the new data matches (scope of work, phases 1 and 2). If the Claude account or tasks stop, the data stops filling; that dependence is the main reason for the GitHub build.

## Data flow and schedule

**India, each weekday evening (21:40 IST):**

1. Download the official NSE index close file for the day (ind_close_all_DDMMYYYY.csv). Quirk seen on 3 Oct 2026: NSE's whole-market file (sec_bhavdata_full_DDMMYYYY.csv) can carry the previous session's data under a holiday's file name (the 02 Oct file held 01 Oct data), so the engine always reads the date inside the file and never trusts the filename.
2. Append the closes to the idx_closes history, then compute each sector's SMAs and 1- and 3-month returns from that history.
3. Write the feed document (collection feed, doc latest) and the dated tracker row (tracker).
4. The app reads feed and tracker on load and computes the regime under the Engine Rules. Breadth and similar regime inputs are typed in by the trader today (decision 5).

**US, each morning (07:20 IST, Tue–Sat, after the US close):**

1. Read sector ETF and SPY closes from the StockAnalysis pages (latest 50 rows).
2. Merge the rows into the stored closes document (us_feed_hist, doc closes), keyed by date. Existing dates are never overwritten.
3. Compute 1- and 3-month returns for every sector and for SPY from stored closes. Compute the 200 SMA from stored closes where 200 dates exist; otherwise use the TipRanks value and mark sma200Src.
4. Top up history from Yahoo date-windowed pages for at most 2 tickers with gaps, and stop on any HTTP 429.
5. Write us_feed (doc latest) with the date of the data, flags and the fetch time. A run that cannot confirm today's date writes a flag and leaves the previous values.

**US stock screen, Saturday 08:41 IST:** read the top-group sector ETFs from us_feed, pull each ETF's top 10 holdings, fetch each stock's recent history, compute the metrics listed in the Schema section, and write us_screen (doc latest).

**Target schedule (GitHub Actions):** India after the NSE file is published, US after the US close, whole-market scan nightly, each run followed by data-health checks and an alert.

## Data sources, checks and known quirks

Data accuracy has been the main failure of the desk, more than strategy. Each source below has a status, and a source may only feed a decision while its status is Used.

| Source | Used for | Status | Notes |
| --- | --- | --- | --- |
| NSE official index close file | India sector closes, SMAs, returns | Used | Complete and dated. Primary India source |
| StockAnalysis ETF pages | US sector ETF and SPY closes (50 rows) | Used | Latest 50 rows only, so history must be stored |
| Stored closes (us_feed_hist/closes) | US returns and 200 SMA | Used | Unadjusted closes, SPY dates as the calendar. Source of truth for US averages |
| TipRanks | US 50 and 200 SMA where no stored history | Interim | Stamps went stale; dividend-adjusted so 200 SMA runs up to about 1.3% lower than computed |
| Yahoo history, date-windowed pages | Top-up of stored closes | Parked | Complete rows but 9 of 32 requests returned 429. Slow top-up only |
| Yahoo full-page history | none | Rejected | Truncated and gappy when read through the Claude fetch tool. Re-test from GitHub (phase 0) |
| Yahoo chart API | none | Rejected | Blocked for the Claude fetch tool by robots rules, not necessarily by the source. Re-test from GitHub (phase 0) |
| Alpha Vantage | none | Rejected | 25 requests a day and a burst limit; owner said not to use the key. PROPOSED (owner decision, 3 Oct 2026, third review): the first probe showed Yahoo 429 and Stooq 403 from GitHub's servers, so the keyless US plan may not hold. The seven-day test now also probes free-tier keyed EOD APIs (Tiingo, Polygon, EODHD) and Yahoo with the cookie and crumb handshake; each key lives only in a GitHub secret and its probe is skipped when absent. The Alpha Vantage key stays unused. Owner approved Tiingo first, with Massive or EODHD as backup, and FRED for VIX, as a logged exception (3 Oct 2026); adoption for production waits on the test (history depth and cross-check) |
| ETF Database averages | none | Rejected | Values unreliable |
| Upstox and Dhan pages | India stock prices, volume, averages and EMAs for the held stocks | Used, with known gaps | The Dhan technical page was stale for a number of the held stocks on 1 Oct (Engine Rules OQ-6). To be replaced by averages computed from stored closes |
| StockAnalysis holdings, history and statistics | US screen: ETF holdings, stock history, 200 SMA, 52-week change, next results date | Used | The stock 200 SMA is the figure the page publishes, not computed here, and whether it is dividend-adjusted is not recorded. Results dates may be missing and are then flagged |
| TradingView and Chartink scans (manual) | Breadth, RS rank, trend template and volume scans | Manual | Run and typed in by the trader. The target replaces these with the whole-market store |

**Checks the pipeline must enforce (target; today partly manual):**

- Every stored value has a source name and an as-of date.
- A date earlier than the previous run's is a failed run, not new data.
- Closes must be unadjusted and must not jump more than a set percentage in a day without a corporate-action note (splits and bonuses corrupt averages otherwise).
- A computed SMA needs the full window of stored dates. Fewer means missing, not approximate.
- A run with a stale or missing source writes a flag and keeps the old values; it never writes zeros.

**Known quirks:**

- Computed 200 SMA differs from published figures by up to about 1.3% for dividend-paying ETFs. This is expected (Engine Rules C-14).
- In the Claude runtime a 403 or 407 means the organisation proxy blocks that site; do not retry or route around it. On GitHub, treat a 403 as the source's own response and follow hard rule 4.
- A 429 means the source is rate limiting. The response asks not to refetch; stop and move on.
- Summaries of fetched pages can report wrong row counts. Count rows in the stored data, not in the summary.
- GitHub servers may be blocked by NSE or Yahoo. None of the target data sources has been tested from GitHub yet; do this first in build phase 0.

## Data schema

The app database is a set of collections of documents keyed by id. In the US market the app adds the prefix us_ to the collections marked in the last column; India uses the bare name. Writes to an existing document need the document's version (if_version), or they are rejected.

| Collection | Document id | Holds | US prefix |
| --- | --- | --- | --- |
| settings | main (India), us | capital, startCapital | document per market |
| tracker | date YYYY-MM-DD | daily benchmark row: close, high, low, volume, sma50, sma200, and b (breadth and related inputs); distribution and follow-through are computed from these rows | yes |
| regime | date | saved regime inputs: n50, n500 (green, mixed or red), dist, breadth, ftd, expiry. Empty today; the regime is computed from tracker rows | yes |
| sectors | weekend date | weekly sector ranking: mode, nifty {m1, m3}, rows[] each with name, rank, score, m1, m3, above50, above200, pass | yes |
| feed | latest | latest data fill: bench, date, fetchedAt, flags, sectors (19 India, 14 US), stocks (India stocks only) | yes |
| feed_hist | date (India); closes (US) | India: one snapshot per day with bench, sectors, stocks. US: the stored closes used to compute returns and averages | yes |
| trades | trade id | planned, open and closed trades (fields below). Empty today | yes |
| logs | log id | skipped setups (type skip) and no-trade weeks (type notrade) with date, reason and outcome. Empty today | yes |
| legacy | h01, h02 and so on | existing long-term holdings under the exit test: stock, symbol, isin, sector, industry, qty, avg, status, bucket, tax, order. India only | no |
| overrides | stock symbol | manual stand-in values: date, savedAt, sma50, sma200. Used when the feed cannot give an average | yes |
| us_screen | latest | weekly US candidate screen | US only |

**US feed document (us_feed/latest):**

```json

```

**US screen document (us_screen/latest):** date, fetchedAt, source, sectors (the ETF tickers screened) and stocks, a list where each stock carries sym, sector, weight, date, close, sma50, sma200, ema20, atr14, high50, high1, low10, low3, r1m, avgVol, adv (average dollar volume), volRatio, chg52, earnings (next results date or empty) and flags.

**Trade document fields (app v9):** status (planned, open, closed), createdDate, stock, setup, sector, industry, sectorRank, regime, pivot, trigger, limit, method (gtt or amo), stop0, stop, atr, resultsDate, riskPct, oneR, fullShares, firstShares, addShares, pilot, checksFailed[], note, lots[], sells[], added, thirdSold, extSold, gttPlaced; later also maxClose, minClose and lastEval {date, close}, which feed MAE and MFE. These are close-based, not intraday, so they understate how often a stop was nearly hit.

Field lists above were read from the live documents and the app code on 3 Oct 2026. Types and allowed values (for example the exact values of status) will be formalised as a JSON schema file in build phase 3, and a test will compare every saved document with it.

## Settings and configuration

**Today (app v9):** rule values live in constants near the top of the app script. Changing a rule means editing the script, which is the thing the target design removes.

| Constant | What it holds |
| --- | --- |
| SETUPS | Per setup: trigger %, limit %, max stop width, basis text, stop hint, flags (breakout, ipo, resultsExempt) |
| LIMITS (India), LIMITS_US | Per regime: allowed setups, number of top sectors, risk per trade %, max positions, and cap (the maximum total open risk for new trades as a % of capital, not a position cap; to be renamed maxOpenRiskPct in the rewrite). Red setups must change to pilots only in v10 (Engine Rules OQ-8) |
| SECTORS, SECTORS_US | Sector names and the index or ETF used for each |
| IDX | Benchmark names per market (US: SPY, QQQ; India: Nifty 50, Nifty 500) |
| EXIT_RULES | Exit rule names recorded in the journal |
| SCR_MIN_ADV, SCR_MIN_RESULTS | US screen liquidity floor ($50 million) and results-date gap (10 trading days) |

**Target:** one settings file per market (settings/india.json, settings/us.json) holding every value above plus the room multiple (3R in both markets, C-112), the 1.5 ATR stop floor, distribution-day and breadth thresholds, VIX threshold, liquidity floors and the source list. Both files share one schema (settings/schema.json), so a value that exists for one market must exist for the other, even when equal. The app and the scripts read the same files. Each file carries a rulesVersion field that must match the current Engine Rules version; a mismatch fails the build and is shown on the screen footer.

**Secrets:** none in the app. The target alert tokens live in GitHub repository secrets. Logged exception to the no-API-key rule (owner decision, 3 Oct 2026): US end-of-day data may use Tiingo as the primary source, Massive (the former Polygon) or EODHD as the backup, and FRED for a VIX cross-check (FRED lags a day; Cboe's free VIX history file needs no key and is the candidate primary VIX source, pending the seven-day test), each key held only as a GitHub repository secret (TIINGO_KEY, POLYGON_KEY, EODHD_KEY, FRED_KEY), never in the repo, the app or the data files. The India feed stays keyless. The Alpha Vantage key stays unused. A key is adopted for production only after the seven-day source test shows the free plan returns 200 or more days of history and its newest SPY close agrees with the second source within 0.1%. The EMA length is 20 everywhere: the feed field is ema20 and the screen computes a 20-period EMA. The app code still names a local variable ema21, a leftover to rename in the rewrite.

## Target repository layout

This layout is a proposal for the GitHub build, to be confirmed in build phase 0. It keeps rules, data, scripts and app apart.

```text

```

**Actual layout so far (3 Oct 2026), where it differs from the target above:** TypeScript on Node 22 with type stripping and no dependencies, not a separate language per layer. The engine is `src/engine/` (indicators, regime, sectors, setups, sizing, checklist, exits, journal, book, legacy, proposals, format, settings) and is pure functions with no I/O. Tests are in `test/`. `fixtures/` holds the market files from the live database (`db/`), the v9 a`nd v9.1 app files (app/, with test/app-parity.test.ts checking v9.1 against the engine`), the golden outputs of v9's own code (`expected/`) and the scheduled-task prompts (`scheduled-tasks/`). `tools/` holds the golden generators, `scripts/` the source test, alert sender and privacy check, `docs/review-notes/` one review note per engine block. Rule values are still in code (`setups.ts`); the switches and parameters for rules that are still Proposed (C-29 to C-34) are in `src/engine/settings.ts`, all off. The two source-of-truth docs are copied into the repo as docs/ENGINE_RULES.md and docs/ARCHITECTURE.md (exported from the live docs with tools/doc-xml-to-md.mjs). The live docs stay the source of truth: after any change to either doc, re-export the copy and commit it in the same step; a test fails if the rules version in the code and in the copy differ. Nothing personal (capital, holdings, trades) is in the repo; a test blocks it from `data/` and `fixtures/db/`.

The two docs stay the master copies. A job in the repo fails if docs/ENGINE_RULES.md carries a different rules version from settings/*.json.

## Testing, runbook and failure handling

**Testing today:** the US screen was tested with a headless browser against seeded data (test_ui.js checks the panel renders; test_plan.js checks that Plan this trade fills the New trade form for a stock). Calculations were checked against stored closes. There is no automated test of the India path.

**Testing target:** unit tests for every function in the engine using fixtures from real days; a replay test that feeds a saved run through the engine and compares the regime, the ranking and the screen with saved answers; a data-health test per source; any change to a rule value fails the tests until the Engine Rules version is bumped.

**Testing progress (3 Oct 2026):** 98 tests pass in CI on every push. Seven engine blocks are replayed against the original v9 code run over seeded random inputs (regime, sector ranking, sizing, checklist, exits, journal, book and legacy numbers), plus tests that quote the rule text and, for Proposed rules, hand-built cases. A replay proves the port equals v9, not that v9's rules are right. Still to do: replay the engine over stored real days once the source test has produced them (Gate B), and the ten-session parallel run per market (Gate A).

**Runbook, when something looks wrong:**

1. Check the as-of dates on the feed. A stale date means the fill did not run or the source did not update.
2. Check the run log of the failing job (today the task's run history; target the Actions run) for a 403, 407 or 429. Those mean blocked or rate limited: follow hard rule 4 and record it in the quirks list.
3. Compare one sector's computed 200 SMA with the stored closes count. Fewer than 200 dates means the value is a fallback and flagged.
4. If a value is wrong and the source is right, fix the compute step and add a test with that day's data.
5. If the source is wrong, add or change an override, log it, and open a Change log entry if a rule has to change.

**Failure handling:** a failed run keeps the previous good data and raises a flag; it never writes zeros or guesses. Today, tasks have no self-healing and nobody is alerted. The target sends a Telegram or ntfy alert on any failed or stale run.

**Checked on 3 Oct 2026:** the India feed is dated 1 Oct, which is right because 2 Oct was a holiday and 3 Oct is a Saturday. The US feed holds 2 Oct data, written at 07:25 IST on 3 Oct, so the morning run worked. The India nightly run of 1 Oct finished in about 40 seconds and the feed carries flags that some stocks have stale EMAs (Dhan technical page) and two prices came from an earlier run, so that run may have under-fetched; this is open item OQ-6 in the Engine Rules. Five US sectors still use TipRanks 200 SMAs with stale stamps until the history top-up completes.

## Handover checklist and glossary

**Before handing this to a person or an AI tool:**

- [ ] Both documents are current: the Engine Rules version matches the code, and the Change log has every decision to date.
- [ ] The open items in the Engine Rules (OQ-5, OQ-6, OQ-7, OQ-8) are closed or assigned.
- [ ] The schema is formalised as a JSON schema file and a test checks saved documents against it (field lists are written out in this document today).
- [ ] The repo layout above is built and the tests pass.
- [ ] Every data source has been run from the real runner (GitHub servers) and its status in the sources table is current.
- [ ] Scheduled jobs, alert channels and where secrets are kept are listed with who owns each.
- [ ] The new owner has run the runbook once on a deliberately stale feed.

**For an AI coding tool:** give it both documents, the repo, and the instruction to change a rule only by writing the Change log row first and to update the tests with the change.

**Glossary:**

| Term | Meaning |
| --- | --- |
| R, 1R | The money risked on a trade, the distance from entry to stop times shares |
| ATR | Average true range, the typical daily price swing, here over 14 sessions |
| SMA, EMA | Simple and exponential moving averages, for example 50 SMA, 20 EMA |
| Regime, traffic light | Green, Yellow or Red market state that sets how much risk is allowed |
| Distribution day | A day the index falls on higher volume, a sign of selling |
| Follow-through day | A strong up-day on rising volume after a correction, a sign of recovery |
| Setup | A named pattern for entering a stock (base breakout, pullbacks, earnings gap) |
| Pivot | The price above which a base breaks out |
| Persistence | A sector holding a top rank on two consecutive weekends |
| MAE, MFE | Worst and best points of a trade versus entry, in R |
| Feed | The data the fill jobs write for the app to read |
| Source of truth | The one document or file that wins when copies disagree |
| Pilot | A trade at reduced risk (0.25%) in a Red market, an early sector or a new leader |
| GTT, AMO | India broker orders: a standing trigger order, and an after-market order placed for the next morning |
| RS, RS leader | Relative strength against the market; a leader is in the top 20% (India) or has its RS line rising against SPY (US) |
| Legacy book | The owner's older India holdings, managed by an exit test and a separate risk budget, not by the new-trade rules |
| Bhavcopy | NSE's daily file of every listed stock's prices and volume |

## Decisions to make before the build

Added after the first review on 3 Oct 2026. Each one changes the design if it goes the other way, so settle them before phase 1.

| # | Decision | Why it matters | Recommendation | Status |
| --- | --- | --- | --- | --- |
| 1 | Source test from the real runner (phase 0) | NSE may block cloud servers, and several sources were rejected only because of the Claude fetch tool or the organisation proxy, not the source. Yahoo chart, stooq and Tiingo's free tier are untested from GitHub | A throwaway workflow calls every candidate source daily for a week and logs the status code. If NSE blocks GitHub, India runs on a small VPS or a cron on the owner's own machine | India runner decided 3 Oct 2026 (owner): GitHub, reviewed on Sat 10 Oct from the week's log (scripts/summarise-source-test.mjs prints the verdict). Success means HTTP 200 and the file's internal date (dataDate) equals the session date, because NSE has served the previous session under a new day's filename; a 200 with a stale date is a failure. Switch to a small server or the owner's machine if any one of these holds: (1) on any weekday the index-close file was not fetched with the right date by 23:00 IST, which leaves one more poll before the 23:30 deadline; (2) any single weekday where every NSE probe returned 403 or 429 (a full-day block); (3) 403 or 429 on two or more different days (intermittent). Two isolated 429s on different days at the first probe of the window, with success later in the same window, are normal for NSE and do not trigger a switch by themselves. The IST time the file first appears with the right date is logged each day and sets the production polling window. The choice is cheap to reverse: the scripts are plain Node with no dependencies and run unchanged from any scheduler. No rule changes, so nothing in the Engine Rules. Status of the test (3 Oct 2026): probes run from GitHub every 30 minutes on weekdays; first full week is Mon 5 to Fri 9 Oct, summary due Sat 10 Oct. GitHub stays the India runner unless that week shows blocks, and the week must include at least one successful fetch of the index-close file inside the nightly window, because the regime depends on it and it has not yet been observed from GitHub. First result: NSE bhavcopy, event calendar and Nifty 500 list answered 200; Yahoo chart returned 429; Stooq 403 |
| 2 | Hosting and privacy | GitHub Pages is public on the free plan, so committed data would publish holdings, capital and trades | Keep personal data out of any public repo: private repo with Cloudflare Pages behind a login, or a local app | Decided 3 Oct 2026 (owner): private repo on the free GitHub plan, so Pages cannot serve it. Recommended: Cloudflare Pages behind a free login (Cloudflare Access), deployed from the private repo. Confirmed by owner 3 Oct 2026 |
| 3 | Where trades and journal persist | Browser storage is lost with the browser profile, and the fresh-money test depends on the journal | Commit trades through the GitHub API to a private repo, or use a small hosted database | Decided 3 Oct 2026 (owner): closed trades and the journal are committed to the private repo through the GitHub API; browser storage is only a cache |
| 4 | One language for the engine | If the app is JavaScript and the jobs are Python, two engines drift apart | Write the engine in TypeScript, run the nightly jobs in Node, and import the same module in the app | Decided 3 Oct 2026 (owner) |
| 5 | India breadth | Today breadth is a manual scan feeding tracker.b, so the regime depends on a number typed each night | Store the NSE daily bhavcopy (whole-market closes) and compute breadth and the whole-market scan from it; build this store first | Decided 3 Oct 2026 (owner) |
| 6 | Corporate actions for single stocks | Unadjusted closes are right for index ETFs but wrong across a split or bonus, which breaks a stock's 200 SMA and 52-week high for a year | Use the NSE corporate actions file to adjust or flag; set the maximum unexplained daily move in phase 1 | Open |
| 7 | Correcting a bad close | Never overwriting a stored date means one bad fetch is permanent | Allow a logged, flagged re-fetch of a named date | Decided 3 Oct 2026 (owner) |
| 8 | Market calendars | Skipped days for expiry, rebalancing, holidays and Muhurat need a source | A holiday and special-day file per market in settings, updated yearly, used by the tests | Decided 3 Oct 2026 (owner) |
| 9 | Fixtures | The Claude runtime holds the only copy of the data and the v9 script | Before any build, export every collection and the v9 script into the repo as the first test fixtures | Done 3 Oct 2026: fixtures/ in the private repo. Market and regime collections, the v9 app file and the three task prompts are committed; capital, legacy, trades, logs, overrides and holdings-keyed fields are deliberately not |
| 10 | Data-health numbers | Checks without numbers cannot block anything | Set maximum daily move, minimum stored dates and maximum staleness per source in phase 1 | Open |
| 11 | Nightly schedule | GitHub's timer is best-effort and can run 10 to 40 minutes late, and the NSE file's publication time varies | The job polls every 20 minutes inside a window until the file appears, then stops. Phase 0 logs the publication time daily, in IST. Owner approved 3 Oct 2026: polling stops at 23:30 IST, and if the file never appeared the alert names which file is missing and says whether the previous session's file is still being served under today's date (the probe already detects that) | Recommended |
| 12 | Alert heartbeat | Alerts only on failure mean a dead alert channel looks like a quiet week | Send one message a week saying the desk is alive | Recommended |
| 13 | Closes basis | The documents said both unadjusted and split-adjusted | Split-adjusted and dividend-unadjusted closes in both markets, with a one-time re-baseline of the stored US history and a test. This refines the earlier statement that closes are unadjusted | Recommended |
| 14 | Archive constituent lists | Without past membership, backtests carry survivorship bias | Save the index and ETF constituent lists nightly from phase 1; it is a few kilobytes a day | Recommended |

The build phases and what each delivers are in the scope of work document. Each phase there has a deliverable and a definition of done.
