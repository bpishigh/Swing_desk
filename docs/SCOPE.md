# Repo Desk: scope of work and checks

Status as at 21 Oct 2026 (sections A to I were written on 11 Oct; section J lists what is still not built). The Claude Desk (artifact and its three scheduled tasks) is untouched and its scheduled tasks have been paused since 17 Oct; the comparison tab was removed from the dashboard that day.

## Done
- India index, whole-market stock store, NSE circular reading, corporate-action resolver, scheduled through the tick.
- US daily feed (Tiingo, Nasdaq backup), weekly screen, S&P 500 breadth; India Nifty 500 breadth; regime engine run with phone alerts for both markets.
- Phone alert path confirmed (11 Oct).
- Lean tick, daily Actions-minutes estimate (60/80/95% alerts), CI skips data-only pushes.
- Four cron-job.org jobs created and job A test-run (204). Old `source-test` jobs stay until one real evening (Mon 12 Oct) is confirmed.
- Dashboard v1 (`site/index.html`, data from `scripts/build-site.mjs`, rebuilt by the tick): Market, Screens, Data health, Claude Desk comparison (removed 17 Oct). Hosted as a Cloudflare Worker behind Access.
- Comparison tool (`src/ops/compare.ts`, `scripts/compare.mjs`). First real comparison not run yet.
- Portfolio manager design v3: `docs/PORTFOLIO_MANAGER_DESIGN.md` (11 Oct: first look at the owner's broker exports worked; charges model, rule-inferred owner, account and book, selectable allocation engine; v3 adds the objective, performance and decision log, a Keep verdict and book state machine, FIFO tax lots with itemised charges, the holdings-snapshot gate, clubbing and harvesting rules; awaiting the owner's answers in its section 14).

## Owner actions (cron-job.org; the repo cannot do these)
1. Create four jobs that POST `workflow_dispatch` (same URL pattern, token and body as today) to `.../actions/workflows/tick.yml/dispatches`, all at minutes 7 and 37 (UTC):
   - A: hours 13-17, Mon-Fri (India evening, 19:07-23:07 IST)
   - B: hours 21-23, Mon-Fri (US evening, covers summer and winter time)
   - C: hours 0-4, Tue-Sat (US late, India morning catch-up, Saturday screen start)
   - D: hours 5-7, Saturday (Saturday screen retries)
2. Pause (do not delete) the three old jobs that call `source-test.yml` once the new ones have run one evening.
3. Turn on failure emails for every job (auto-disable happens after 25 failures in a row, e.g. an expired token).
4. Check GitHub > Settings > Notifications: Actions failure and usage emails go to an address that is read.
4a. Portfolio page redesign (14 Oct, built after the owner's review of the first version): switcher for household, person and account with type-to-create; Owner field so tax and the exemption combine per PAN; periods (since start, each FY, last 12 months); verdict line, tiles, chart against the same deposits in Nifty 50, Large cap, Midcap 150, Smallcap 250 and Nifty 500 (index funds as stand-ins, history from mfapi.in in the browser); momentum label; tabs for Holdings, Tax, Income, Data. Still to do: (a) done 14 Oct: price history backfilled Apr 2021 to Oct 2025 and the page sped up (about 3x faster per account, one compute pass, parallel downloads); (b) done 14 Oct: confirm, type a price, or reject estimated items, saved with the account; (c) done 14 Oct: delete or rename an account; (d) holding verdicts (Keep, Promote, Harvest, Exit, Trim and the fund verdicts) from the design doc sections 4 and 9, which need the 200 SMA, swing low and relative-strength rank per held stock; (e) nightly refresh that flags changes in the Swing Desk morning view; (f) a segment tag per holding so each is judged against its own index; (g) closed (household-specific detail kept in the private repository). Full list in "Portfolio Manager: complete scope" below.
5. DONE 20 Oct (owner): the GitHub token used by cron-job.org was set with no expiry, so nothing to renew.

## Status
- 11 Oct 2026: four tick jobs (A-D) created in cron-job.org and test-run (204). Old `source-test` jobs still running until one real evening is confirmed.

- 11 Oct 2026: first real comparison run for Fri 9 Oct (`data/compare/2026-10-09.json`, `latest.json`). India 88 of 106 fields match, US 76 of 81. Differences, with cause:
  - India, 6 sector indices (Capital Markets, Consumer Durables, Healthcare, Infrastructure, Media, PSE): the Claude Desk's 9 Oct closes equal the 8 Oct closes exactly, so it carried yesterday's values; the Repo Desk has the 9 Oct close from the NSE file. The 1-month and 3-month return gaps for the same six follow from that. Repo Desk is right.
  - US, XLC, XLF, XLRE 200 SMA (0.5 to 1.6% higher in the Repo Desk): the Claude Desk used stale TipRanks values (dividend-adjusted, stamps 6-7 Oct). Known gap, no action.
  - Missing, not different: India Nifty 50 volume and both breadth figures (the Claude Desk had no 9 Oct volume or typed breadth on that day, per its own flag), and US VIX (not in the Claude Desk's US tracker). Repo breadth: India 17.8, US 34.4.
  - Matching: Nifty 50 and Nifty 500 closes and SMAs (200 SMA within 0.03%), India VIX 14.36 vs 14.38, SPY and QQQ closes and SMAs, SPY volume within 1%, all other sector fields.

## Checks after each change (so it cannot fall apart quietly)
- After repointing cron-job.org: the next evening, confirm one `tick` run per slot, `india-nightly`/`india-stocks` start from 19:07 IST, `us-nightly` and `us-breadth` after the US close. Then remove the dispatch steps from `source-test.yml` (it becomes a manual probe).
- Week 1 of live running: read `data/ops/usage.json`. Target projected month-end below 1,400 of 2,000. If above 70% (1,400): trim windows, or move orchestration out of Actions.
- Before 10 Mar 2028: GitHub has marked REST API version 2022-11-28 deprecated (sunset 10 Mar 2028). Update the `X-GitHub-Api-Version` header in cron-job.org and in `scripts/dispatch-*.mjs`.
- 1 Nov 2026 (US clocks go back): the US data start moves from 21:30 to 22:30 UTC. Windows B and C already cover it. Check that evening that the US day is written and the alert time is still late enough.
- First Saturday (17 Oct): `us-screen` starts by itself; compare with the Claude Desk's screen the same morning.
- Every morning of the parallel run: compare India and US closes, SMAs, regime colour and breadth with the Claude Desk. Differences get a line here, with cause.

## Small gaps (build after the comparison window)
- `skip` flag for India: TESTED 20 Oct (C-72), failed; not built. India keeps counting every day, as the US does. DONE 20 Oct (C-73, owner approved): the rules text now says no day is skipped in either market (R-2026.10.9).
- Nifty 50 volume basis (NSE shares vs Investing.com): DROPPED 20 Oct (owner): the desk uses NSE data alone and the old Claude Desk is paused.
- DONE 20 Oct (C-71): the Breadth rule in Engine Rules now states the definition the code uses. The India gap on 29 Sep (typed scan 18, ours 20.2) was not traced.
- 2027 calendars for India and US: the file itself cannot be written until NSE and NYSE publish their 2027 lists (autumn). DONE 20 Oct: every script now reads all `data/calendar/markets-<year>.json` files through `src/engine/calendar-files.ts` (before, about a dozen scripts named markets-2026.json, so holidays after 1 Jan 2027 would have counted as sessions), and the tick alerts by Telegram, once a day, from 1 Dec if the next year's file is missing (`scripts/calendar-check.mjs`).
- DCMSRIND: a primary record (company letter to NSE, 3 Feb 2026) is in data/rules/demergers-pending.json, and C-50 handles demergers from the price fall. Remaining: confirm with the 1 Nov demerger notice check that DCMSRIND averages are no longer blank.
- DONE 20 Oct (C-71): screen volume basis documented in the change log; no change.
- DONE 20 Oct: the one-off probe scripts are in `probes/` and their manual workflows are removed (probe-circ stays).

## Separate design (owner: "we relook and build this separately")
- Trades: where stored (private store / pasted per session / stay on the Claude Desk), the exit-rule alerts, new and existing holdings, US data for stocks in the trade book. The rules code exists and is tested (`src/engine/*`); storage, nightly runner and interface do not.
- The app: still the Claude Desk artifact. Needs to read the repo data (or be rebuilt) before the Claude Desk can be wound down.

## Portfolio Manager: complete scope (as at 14 Oct 2026)
Authority: `docs/PORTFOLIO_MANAGER_DESIGN.md` and the Engine Rules. No threshold below is new; every number comes from those, or is marked "owner to set". Sizes: S under a session, M about one, L several.

### A. Built and live
Upload and parse in the browser (Groww, Zerodha, auto-detect); save through the Access-protected function; ledger with FIFO lots and itemised charges; corporate actions and the break resolver; per-person tax view; dividends computed from public data; XIRR; daily valuation series; account switcher with type-to-create, owner, rename, delete; periods (since start, each FY, last 12 months); comparison with Nifty 50, Large cap, Midcap 150, Smallcap 250, Nifty 500; momentum label; Holdings, Tax, Income, Data tabs; confirm / price / reject for estimated items; price history from Apr 2021; speed work.

### B. Phase 2: holding verdicts for direct stocks (design section 4)
Built 14 Oct: B1 (Exit and Keep on the 200 SMA and the computed pivot swing low), B5 (verdict log kept with each account, written when a verdict changes), B6 (Verdict and Cap columns with a filter, a "What to do" card on the Overview, a log table on the Data tab) and E (Large/Mid/Small tag from the Nifty 100, Midcap 150 and Smallcap 250 lists; the weekly list fetch runs inside the nightly India workflow, so the tag shows a dash until its first run). Not built: the Swing Desk shortlist saving, because no shortlist with trigger and limit levels exists in the repo yet (the US screen has none; the India screener is not built). Index ETFs now go to Long-term (owner, 14 Oct), as in the design (section 3, rule 2).
Built 15 Oct: price adjustment for splits, bonuses (combined when announced together), cash dividends of 5% of price or more, and rights issues (src/pm/verdict.ts adjustSeries; stored-price check for splits and bonuses; 23 stocks stay blocked, mostly demergers). Context display (reviewer's step 1, no rule change): click a stock on the Holdings tab for 50 and 200 day distance, 3-month return, return against the Nifty 500, relative-strength rank, average traded value, position as a share of a day's trading, delivery %, NSE series, value at risk to the exit level and weight; the Overview card shows the market regime. Built nightly into site/pm-data/context.json by scripts/build-pm-site.mjs from the bhav files (src/pm/context.ts). Industry fills in after the first nightly segments fetch. Also built 15 Oct: demerger adjustment where a cost apportionment is typed in data/rules/demergers.json and the stored ex-date move agrees (some unblocked or adjusted; one stays blocked because its typed 13.4% does not match a 42% fall; the other demergers need typed records, which means the company filings, not guesses); a re-entry candidate tag for Exit stocks (relative strength top quarter and more volume on up days than down days; display only, untested, Engine Rules C-45); and a "How firm" line per verdict from the replay track record (data/replay/track-record.json, C-46). Not built: results-date flag (no results calendar is stored), price band (not in the bhav files), and sector trend (the stock-to-sector map is the industry column, which covers Nifty 500 stocks only).
Order of evaluation: Exit, Promote, Harvest, Trim, Keep. Sale-after date is a modifier.
1. **Exit and Keep (S to M).** Exit test from `src/engine/legacy.ts` (close below 200 SMA or last major swing low). Needs a swing-low per held stock; the stock store already has close and SMA200. No tax input needed.
2. **Relative-strength rank against Nifty 500 and the ten-name target (M).** Needed for Trim and for choosing which ten are Keep. Includes the 2-consecutive-weekly-ranks rule and at most two Trims a month.
3. **Promote to Swing (M).** Needs the nightly screen result for held names, and promote-with-trim sizing from the oldest lots.
4. **Harvest and sale-after date (M).** Needs the tax view (built) plus the loss-haircut and margin settings. Switched on only for listed equity, as the design says.
5. **Decision log (M).** Every verdict stored with date, rule, price, tax figures, and the 3, 6, 12 month follow-up. Scoring rule per verdict type pre-registered first.
6. **Verdict column, reasons, and a "what to do" list on the Overview (S).**
Owner to set before first verdict: the sale-after margin, loss haircut (design starts at 50%), the pre-registered scoring rules.

### C. Phase 3: fund verdicts and shortlist (design section 9.1)
1. AMFI adapters: category, expense ratio, assets (M to L; sources are public but need a monthly job).
2. Benchmark total-return series and fund-to-benchmark map per category (M).
3. Category-average job from every scheme's NAV history (M).
4. Scores for active funds, index funds and ETFs, sector funds on the stock lens (M).
5. Back-test, which gates everything: no fund verdict shows until it has run; if it fails, Replace stays off (M).
6. Verdicts Exit / Replace / Watch / Keep with persistence rule, and the fund shortlist (M).
Owner to review: score weights, gates, persistence length, margins (design section 14, item 9).

### D. Nightly refresh and alerts (S to M)
Scheduled job that recomputes verdicts and writes "what changed" to the Swing Desk morning view; phone alert on an Exit. Needs the verdicts first.

### E. Segment tag per holding (S to M)
Each holding judged against its own index (large, mid, small), not only Nifty 50. Uses the same five index series already loaded.

### F. Phase 4: reconciliation and data quality (S each, optional)
Holdings or P&L statement to remove the "unverified" label; IPO price confirmations (household-specific detail kept in the private repository); parent cost records still marked NEEDS RECORD; funds-only value series before the stored-price start; check realised gains per FY against filed returns.

### G. Phases 5 to 7: allocation, rebalancing, two swing pools (L)
**Phases 5 and 6 built 20 Oct** (allocation engine, class mapping, Allocation tab, two tests; rebalancing and new-money sizing). Preset values approved by the owner 20 Oct. Phase 6 gaps: exit loads, the quarterly cap per class, slab-rate tax, sales triggered by fund Exit or Replace verdicts. Phase 7 built 20 Oct (swing capital per account, household checks, routing card, tonight's orders sized and routed by account with the binding constraint). Phase 6 gaps closed 20 Oct except: fund Replace/Exit sale triggers are built but off until the fund-score back-test runs; exit loads need typed records. Allocation is now per account (own capital, profile, horizon) with a household roll-up (20 Oct).
Allocation engine with the selectable inputs and its two tests; drift bands; rebalancing suggestions and new-money sizing; two-pool Swing rules and routing. Preset weights, caps and bands are owner-reviewed (design section 14, item 5).

### H. Phase 8 and 9 (L)
Phase 3 partly built 22 Oct 2026 (Engine Rules C-81): fund verdicts Keep, Watch and the sector-fund Exit are live; the back-test ran and Replace is OFF (Strong band did not beat its category median reliably, 5 of 10 years). Still open in phase 3: the fund shortlist, structural Exit for active funds, a back-test for index funds and ETFs.

Phase 8 (fund overlap and look-through) built 21 Oct 2026 (Engine Rules C-78); phase 9 remains. Fund overlap and look-through; fold the ledger into the Swing Desk nightly shortlist. Prerequisite: the Swing Desk saves each night's shortlist with trigger and limit levels (open item 2 under "Next session starts here"; every day without it is lost evidence).

### I. Housekeeping
Nightly US job check; India screener NSE daily-file loader; 1 Nov DST change; Actions minutes.

### Suggested order
B1 (Exit and Keep) -> B2 -> B5 and B6 -> B3 -> B4 -> D -> E -> C -> F alongside -> G -> H. The Swing Desk shortlist saving (H prerequisite) is small and should go in early, whatever else is chosen.

## Sustainability rules
- Every job has a minutes budget and is safe to run twice (idempotent).
- Every job reports its own staleness; the tick alerts when a day is missing.
- Orchestration stays small and pure (`src/ingest/*-plan.ts`) so it can move out of Actions if the budget demands it (a free Cloudflare Worker is the option; not needed unless usage stays above 70%).
- A rule or number change is made in one commit, logged here, and compared against the Claude Desk before it is relied on.
- When the free minutes run out: runs stop starting until the month resets. GitHub's own emails and the 60/80/95% alerts are the warning; the fallback is to cut windows, or to move to a paid plan.

## Order
1. Owner repoints cron-job.org (above). 2. A few nights of side-by-side comparison. 3. Small gaps that change numbers. 4. Trades design. 5. App. 6. Claude Desk wind-down (needs the owner's go-ahead).

## Next session starts here
(Historical block from 13 Oct. Superseded by the Pending scope of work in STATUS.md; items 1, 3, 5 and 6 are done, Cloudflare Access is confirmed by the owner, 20 Oct.)
Status at 13 Oct: Portfolio Manager phase 1 is built and on the dashboard (Portfolio tab: upload, per-account and household views, short/long/total gains by year, dividends, XIRR with unrealised, books, value-over-time chart). US all-stock back-fill is complete (499 days) with a nightly job; NSE corporate-action history (2019 onward), the AMFI fund list and the rules files are in the repo; the Data store tab shows coverage.
1. Check the nightly US job picked up 12 and 13 Oct (the "refused" bug for recent days was fixed on 13 Oct).
2. Swing Desk: save the nightly shortlist with trigger and limit levels (starts the forward-test log and fills the Swing book). Not started; every day without it is lost evidence.
3. India screener: NSE daily-file loader (the archive is reachable); India is the decision test.
4. Portfolio Manager open items: some IPO prices stay "unconfirmed" until a holdings or P&L statement is uploaded; some demerger cost splits are secondary-sourced (company PDFs unreachable from here); other parents listed as "NEEDS RECORD" in the feed affect parent cost basis only; holdings/P&L check (optional); fund NAV history in the chart is opt-in (calls mfapi.in from the browser).
5. Morning: read the Claude Desk's stored numbers, build the snapshot, run `scripts/compare.mjs --claude=<snapshot>`, commit `data/compare/latest.json`.
6. Hosting: DONE. The dashboard is already deployed on Cloudflare (Workers static assets, wrangler.jsonc) behind Cloudflare Access, with the Portfolio save route (worker.ts, steps in docs/PORTFOLIO_SAVE_SETUP.md). Owner to confirm the checklist in that file (token, five settings, Access covering workers.dev and previews, 401 when signed out). 
7. Checks: Actions minutes (target below 1,400 of 2,000), 17 Oct first automatic US screen, 1 Nov DST change.

## Demergers without a typed record (C-50, proposed 15 Oct 2026)
The filing's cost share is the tax split of a purchase price, not the market's split, and often differs from the ex-date price fall (Allcargo, Veranda, DCM Shriram, Shankara). So a demerger with no usable typed record is now handled from the prices: a one-day fall of 15% or more is taken as the demerger and the earlier closes are scaled by the observed ratio ("adjusted from price"); a smaller fall drops the closes before the ex-date and the stock is treated like a recent listing. Typed records that pass the price check still win. Blocked-by-corporate-action stocks fell from 22 to 6 (the rest are bonus or NCRPS schemes). Status Proposed; criterion 2 (method check against typed records) could not be evaluated. Pending filing figures are kept in data/rules/demergers-pending.json for reference.

## US whole-market scan (C-20a, built 16 Oct 2026)
Nightly step in us-grouped-nightly runs scripts/us-scan.mjs and writes data/us/scan/<date>.json, latest.json and state.json (hysteresis: in after one night, out after two failing nights). All numbers live in src/ingest/us-scan-settings.ts (US-SCAN-1). No rule changes (those are C-20b). Open: SIC back-fill (backfill-us-sic.yml) needs a real contact in the SEC_UA secret, since SEC returns 403 for an undeclared User-Agent; until then the group step shortlists nothing and the scan note says "No SIC file". Composite weights and the special-dividend threshold await sign-off. Actions minutes are projected at 2,298 of 2,000: removing the source-test dispatch steps (451 min) is the main lever.

## source-test retired as a scheduler (16 Oct 2026)
Old cron-job.org jobs calling source-test.yml paused by the owner on 16 Oct. The dispatch steps (India nightly start, US start) are removed from source-test.yml; tick.yml already runs dispatch-nightly.mjs and dispatch-us.mjs. source-test is now a manual probe. It was the largest Actions-minutes item (about 451 min a month). Check data/ops/usage.json in a week.

## Backtester module and India history (planned 17 Oct 2026, from the external review)
**Status 20 Oct 2026: partly built.** Built: as-of data view (`src/backtest/india-asof.ts`), shared India loader (`india-loader.ts`), live-exit simulator (`desk-sim.ts`), run manifest with attempt counts and the holdout gate (`manifest.ts`, `scripts/backtest-manifest.mjs`, `docs/backtests/README.md`), first registered run C-70. Still to build: the standard report on every run (pick quality at 20, 60 and 120 sessions, full funnel with trigger fills, bootstrap intervals, regime and group splits, ex-top-group figure, sensitivity curve per named parameter), the 2010 to 2019 history and the whole-universe corporate-action back-fill (after 1 Nov), and a US loader on the same footing. Original plan follows.

Not built (original text, kept): One implementation, not a third replay script: the backtester calls the same rule functions the engine runs live, through an as-of data view (prices, corporate actions, universe and regime light as known on each night). A run manifest is committed before every run (parameters, data snapshot, date ranges, pass criterion) and results are appended to it, so every attempt is counted. Fit and holdout windows are locked in the manifest; holdout results are computed but hidden until a logged reveal, one per registered hypothesis. Standard outputs on every run: pick quality at 20, 60 and 120 sessions, the full funnel with tiered costs and trigger fills, bootstrap intervals, regime and group splits, the ex-top-group figure, a sensitivity curve for each named parameter, and the survivorship and adjustment caveats. Exploration runs are allowed and labelled; a parameter taken from a sweep carries the sweep size. Uses: pre-registered tests and plateau checks, never a search for the best number. Prerequisite is data, not code: the NSE archive load back to 2020 and the whole-universe corporate-action back-fill. Build them together, data first. First tests: the current funnel against the simple 12-1 momentum baseline, and the holding-period curve (20, 60, 120 sessions), criterion written first.

## Multiple scan strategies (owner request, logged 20 Oct 2026; not started)
Today each market has one scan (IND-SCAN-1 and US-SCAN-1: relative strength, then trend and setup geometry). The request is several scan strategies side by side. Proposed shape, for the owner to confirm before building: a strategy registry in which each strategy is one named, frozen settings file with its own pre-registration; each runs nightly on the same data and logs its picks, so every strategy gets its own forward record and its own paper stream; the Scans tab shows one list per strategy with the strategy name on each row; any strategy is tested through the backtester manifest (same costs, same windows, holdout rules) before it is shown as anything but "unproven". Candidates already evidenced in this repo: the funnel (IND-SCAN-1), plain 12-1 momentum (C-54 baseline), momentum inside desk geometry (C-66), earnings run-up and reaction (C-59 to C-62, forward test C-61). New ideas are added only with a written hypothesis. Open question for the owner: which strategies, or whether the four above are the starting set.

## Known item: stop rules against a very volatile universe (17 Oct 2026)
US candidates have a median ATR14 of 5% of price, so a 1.5 ATR stop is about 7.6% and every percentage cap of 6 to 8% fails. The India engine uses the same 1.5 ATR floor and chart-level stops; expect the same tension when the India scan is built (C-53 measures it in the US first).

**India price history loaded (17 Oct 2026).** `data/india/bhav-hist/` holds NSE's daily all-stock files for 1 Jan 2020 to 16 Oct 2025 (1,439 sessions, gzipped, 70 MB), same row shape as `data/india/bhav/`, which continues from 17 Oct 2025. Loaded by `scripts/backfill-india-bhav.mjs` (workflow `backfill-india-bhav`, resumable). Delisted stocks are included as listed on each day. Still to do before the backtester: an as-of adjusted-price view that applies `corp-actions-history.json` only up to each night, and a check of that history for 2020 to 2022 completeness.


### J. Pending scope of work (from the 21 Oct 2026 audit; the owner asked for these to be recorded)
Promised in docs/PORTFOLIO_MANAGER_DESIGN.md and not built. Nothing here is started.
1. **Stock verdicts beyond Exit and Keep:** Trim, Promote and Harvest, the sale-after date, and the verdict decision log with its 3, 6 and 12 month follow-ups (design 4, phase 2). Only Exit and Keep exist (`src/pm/verdict.ts`).
2. **Fund verdicts:** Exit, Replace, Watch and Keep for held funds, the fund shortlist (top 3 by score), the back-test gate, and the design's score weights and measures (downside, risk-adjusted, benchmark and tracking difference, expense ratio) (design 9.1, phase 3). Only Strong, Average and Weak bands with a replace candidate exist (`src/pm/fundscore.ts`); `fundVerdictSales` is off.
3. **Schedule CG CSV export** (design 7.1).
4. **Holdings-snapshot reconciliation gate** and the "unverified" label; reconciliation against the P&L statement and contract notes (design 11, phases 1 and 4).
5. **INDmoney and US adapters:** FX and Rule 115, US dividends, CAS PDF reader (design 7, 11). The `us_stock` tax type exists and nothing feeds it.
6. **Liquidity book** and the liquidity buffer as a real floor (design 3); the buffer is a display figure only today.
7. **Allocation caps for sector and country**, and a breach check of the drawdown limit against the valuation series (design 8).
8. **Tax gaps:** estimated tax on gold, debt, international and hybrid gains (shown only as "other assets" at slab rate), pre-2025 gold and deemed-short windows, folio-level FIFO (the build uses ISIN), surcharge, fund IDCW payouts, clubbing rules.
9. **Books:** a Swing lot moving to Legacy after the maximum hold; the design's 5-session exit-flag rule for partial sells (the build asks the owner yes or no instead).
10. **Readers:** reader learning (profile hash stored and confirmed), account aliases from the client code, more than the first xlsx sheet, broker chosen from the file contents rather than the file name, use of the confidence field.
11. **Corrections screen** for the break resolver (design 7.3) and the instrument override file (`data/portfolio/instrument-overrides.json`).
12. **Phase 8 follow-ups:** hybrid funds' real equity/debt mix, a full list with search for the look-through card, per-account look-through, debt and international look-through.
13. **Phase 9:** fold the ledger into the Swing Desk nightly shortlist.
14. **Housekeeping from the audit:** orphaned scripts (audit-india-actions, check-pending-demergers, fetch-results-dates, india-feed-hist-history, pm-report, pm-scan), the duplicate `verdict-before-c50.ts`, the retired `us-screen.yml`, `data/source-test/` logs no longer collected, 70 MB of generated `site/` data committed to git, and stale lines in README, ARCHITECTURE and SCOPE (Claude Desk status, design version, Pages versus Worker).

### K. Decision gaps (owner request, 25 Oct 2026: "what is missing to take a conscious decision"; recorded here so none is lost)
Each item says what it is, whether it needs a source or a test first, and where it overlaps section J. Nothing below changes a verdict or score until a test registered in the Engine Rules passes.
1. **Sell-cost box on every fund and stock card** (facts only): tax on selling each lot (short or long term), exit-load window per lot, ELSS lock-in. Also record the missing exit loads (Parag Parikh Flexi Cap, UTI Mastershare, the liquid fund). Overlaps J8 and `src/pm/switchcost.ts`. **Built 25 Oct 2026** (first slice): an "If you sold all of it today" box on every fund, ETF and stock card in the Holdings tab (value, gain split long and short term, tax with the exemption left, exit load, what you keep, a bar of long-term, short-term, inside-load and locked money, the dates lots turn long-term with the tax saved by waiting, exit-load end, ELSS lock-in end). **Exit loads for the three funds recorded 25 Oct 2026** (private repo; Parag Parikh Flexi Cap read from the AMC page, UTI Mastershare and Axis Liquid from aggregator pages because utimf.com and axismf.com would not load; loads now support tiers and a free-units share). Still open: a per-lot table, and confirming the UTI and Axis Liquid wording against the AMC documents.
2. **Risk strip for equity funds** (facts only): worst fall, volatility and worst day from NAV history, as the debt and international cards already show. The risk-aware score failed its 10-year test on plain equity (C-94: Strong 3 of 10, Weak 5 of 10), so these stay facts, not score inputs. Not started.
3. **Business facts for stocks (first slice built 25 Oct 2026):** the stock card now shows valuation (P/E, P/B, ROE, debt/equity), last-year and latest-quarter sales and profit growth, promoter, FII and DII holding with its change, and promoter pledge, for the 1,200 most traded stocks (monthly job `stock-facts`, data in `data/stocks/facts.json`; the job read 1,134 on its first run; banks and other stocks with no promoter show no pledge line). Facts only. Still open: news, results-quality checks, stocks outside the 1,200, and any test of whether these facts predict returns. Original note: earnings growth, valuation, debt, promoter holding and pledge, news. The desk reads price and volume only; the one company fact is the next results date. Needs a source probed for reliability first (as done for fund pages on 25 Oct). **Probed 25 Oct 2026:** Groww stock pages carry market cap, P/E, P/B, ROE, yearly and quarterly revenue and profit, and quarterly promoter, FII and DII holding. Promoter pledge is not on Groww or Screener and BSE's API refuses automated reads; NSE's quarterly shareholding filing (`corporate-share-holdings-master`, then the XBRL file it links to) does carry it, and the flag matched known cases (Adani Enterprises and Jaiprakash Power pledged; Reliance and Reliance Power not). Still to check: the pledged share count and percentage inside that file. Facts only until a registered test passes. Not started.
4. **Overlap line on each fund card:** how much of this fund the household already owns through other funds (look-through exists in the "what you really own" view; J12). Not started.
5. **Debt funds (first slice built 25 Oct 2026):** probed the fund page: it carries no yield, maturity, duration or credit rating (holdings ratings are empty). What it does carry is every holding with its share, so debt fund cards now show a mix: government paper and cash and repo against bonds and money-market paper, and the largest issuer (`debtMix` in `src/pm/holdingsparse.ts`, filled by the monthly fund-holdings job). Still open: yield, maturity, duration and credit rating, which exist only in each fund house's monthly factsheet (about forty different layouts); the risk class (A to C credit, I to III rate) from each scheme document. Original note: credit quality, maturity or duration and yield are not scored or shown. Needs a source. Not started.
6. **Tests that wait for time:** manager tenure, fund size and turnover (monthly record since 25 Oct 2026; first test possible about Oct 2027, rule registered then); cost in the score (C-108 was not testable; retest about Oct 2027 or sooner from the monthly AMFI expense-ratio log); holdings health (first 12-month result about Mar 2028; 3-month read 26 Jan 2027).
7. **International funds:** first slice built 25 Oct 2026. Fund size, yearly cost, exit load, benchmark and risk level now come from sharpely.in fund pages (monthly job `intl-facts`, `data/funds/intlfacts.json`, tiles on the fund card); 37 of 46 funds matched a page. The 9 without a page (Edelweiss ASEAN and Greater China, Franklin US Opportunities, three US Treasury bond FoFs, two Mirae Global X funds, Invesco EQQQ) could be matched by hand. Still open: the country mix and the overseas fund underneath (the pages list only the feeder ETF), currency effect, tax on gains.
8. **Hybrid funds:** corrected 25 Oct 2026: Aggressive Hybrid, Balanced Advantage, Multi Asset Allocation and Equity Savings funds already get a score band and a Keep or Watch verdict (Replace is off for them). Not scored: Conservative Hybrid, Balanced Hybrid and Arbitrage funds (no rule registered). A rule for them would need a registered test first (J12 covers the equity and debt mix).
9. **Goals and household limits:** the Allocation tab covers capital, risk profile, horizon and a liquidity buffer; not built are goal-by-goal buckets with cash-need dates, and sector, fund-house and country concentration limits across the household (J7).
10. **Untested or unchecked items:** ELSS lock-in check, EPF decision, the 2027 holiday calendar (J-calendar note in STATUS), the Allocation tab look-through check, the daily fund-data run (03:11 IST) and the first quarter-end checks.
11. **Corrections (J11), first part built 25 Oct 2026:** "Move to another account" for one holding's transactions (Trades tab holding card, and the Holdings table when one account is selected), changing the account and so the owner; account rename, delete and owner edit already existed. Still open: the break-resolver corrections screen and the instrument override file.
12. **Built 25 Oct 2026 (for the record):** fund quality facts (C-108, information only), the shared fund card on the Funds tab for all five groups, the stock card in the same style, the 5-year return against same-segment index funds.
