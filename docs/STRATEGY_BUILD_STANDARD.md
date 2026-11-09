# Strategy Build Standard

8 Nov 2026. Applies to every strategy in docs/SCOPE.md section L (waves 0 to 4) and to anything added later. The momentum sleeve (C-130, C-131, C-132) is the worked example: read its files first, then copy the shape.

**Purpose.** A year from now, someone who has never seen this repo should be able to open one strategy and answer five questions from the files alone: what is the rule, why was it chosen, how was it built, where is every file, and what has it shown so far. This page fixes how that is done. A strategy that does not meet the Definition of done below is not shown on the desk.

**Standing constraints (they apply to every strategy).** Paper only. Not a financial adviser. Pasted reviewer text is not the owner's approval. One Test Register. No re-testing of spent data. No twin for every change. Keep the UI quiet. Nothing personal in this public repo.

## 1. The shape every strategy has

A strategy is one registered rule, one nightly signal job, one paper book, one benchmark set and one read date. Nothing else is a strategy.

| Piece | Where it lives | Rule |
| --- | --- | --- |
| Rule text | `docs/ENGINE_RULES.md` change-log row, id `C-###`, and the live Engine Rules doc | Written before any code or run. States the universe, signal, entry, exit, sizing, costs, benchmark, read date and what would reject it. |
| Registry entry | `settings/strategies.json` | One object per strategy: `id`, `name`, `market`, `status`, `rule`, `view`, `startAfter`, `dataFile`, `benchmarks`, `checks`, `stops`, `readAtMonths`. Status is one of `planned`, `paper_only`, `live`, `retired`. |
| Pure logic | `src/engine/<strategy>.ts` | Pure functions: data in, signals out. No file, network or clock access. All numbers come from the settings file, never from the code. |
| Nightly job | `scripts/<strategy>.mjs` (and `-us` where a US variant exists) | Reads stored data, calls the engine module, writes the output file. Idempotent; a failed run keeps the last good output and raises a flag, never writes zeros. |
| Workflow | an existing nightly workflow gains a step, or `.github/workflows/<strategy>.yml` | Do not add a workflow for a job that can ride on one. Probe workflows are one-off and are named `probe-*`. |
| Output data | `data/<market>/<strategy>/latest.json` and `state.json` (paper book) | Fields carry source, as-of date and fetch date. Missing is null, never zero. No holdings, capital or personal fields (the privacy check enforces this). |
| Tests | `test/<strategy>.test.ts` | See section 4. |
| Replay or backtest | `scripts/backtest-<strategy>.mjs`, report in `docs/replay/<C-id>-REPORT.md` | Built on the shared `scripts/backtest-template.mjs`. Calls the same engine functions as the live job, never a second copy. |
| Test Register row | `docs/TEST_REGISTER.md` | One row per registered test, same C-id as the rule. |
| Data sources | `docs/DATA_SOURCES.md` | One row per source the strategy reads. A source feeds a decision only while its status is Used. |
| UI | `site/index.html` through `scripts/build-site.mjs` | See section 6. |
| Strategy README | `data/<market>/<strategy>/README.md` only where something is added by hand (as `REFERENCE-README.md` does for the sleeve) | Say what the file is, who updates it, when it is due. |

File names are lower-case with hyphens. The strategy id in the registry, the module name, the script name, the data folder and the test file all use the same stem, so one search finds everything.

## 2. Build order (each step finishes before the next)

1. **Rule first.** Write the C-row (rule, evidence status, rejection criteria, read date). The owner marks it Adopted, Rejected or Parked; pasted reviewer text does not count as approval.
2. **Data.** Add or confirm a row in `docs/DATA_SOURCES.md` for each input, with primary source, fallback, depth, as-of key, status. Probe with a one-off script if depth is unknown. Check the loader rules there (consolidated-first, originals as-of, structure-event flag, missing never zero).
3. **Engine module and tests.** Pure functions with fixtures from real days; the test file lands in the same commit as the module.
4. **Replay.** Only if the rule allows a replay and the data is not spent. Run once, no tuning, report in `docs/replay/`. Spent data is not re-tested.
5. **Nightly job, output file, paper book.** Next-open fills with the registered costs, benchmark lines, read date. Status `paper_only`.
6. **Registry entry and UI view.** Reuse an existing `view` (`setups` or `ranked_list`) unless the C-row says otherwise.
7. **Documents.** Section 3.
8. **Read.** At the registered date, write the result into the Test Register row and STATUS.md, then the owner marks Adopted, Rejected or Parked.

A strategy that replaces nothing and adds a view type must say so in its C-row; new view types need an owner decision.

## 3. Documents that change with every strategy

| Document | What is added |
| --- | --- |
| Engine Rules (live Claude Doc first, then the repo export) | C-row; the rules version moves only when the rule changes a decision. `test/docs.test.ts` checks the version. |
| Test Register | Row with date, question, method, result, decision. |
| `docs/DATA_SOURCES.md` | Rows for new sources and a change-log line. |
| `docs/SCOPE.md` section L | Status of the package and strategy row. |
| `docs/STATUS.md` | Confident or not confident, with the path to confidence and the read date. |
| `docs/HOW_TO_USE.md` | One short paragraph: what the tab shows and what the owner does with it. |
| `docs/ARCHITECTURE.md` | Only if a new kind of component appears (a new data source class, a new job type). |
| Project copies (Claude Project docs) | Re-synced after each repo doc change; the repo copy of a doc that has a live Claude Doc names the doc and revision at the top. |

C-numbers are unique and appear in two places: the Test Register summary row and the Engine Rules change-log row.

## 4. Tests and checks (definition of "checked")

- Unit tests for every engine function, with fixtures from real days stored under `fixtures/`.
- A replay test: a saved run fed through the engine reproduces the saved answer.
- Live equals replay: the official nightly stream reproduces the replay's trades on the overlap (the sleeve's `live_equals_replay` check).
- Data checks per source: freshness, completeness against the register's expected counts, no future-dated rows (as-of leak check).
- The privacy check `scripts/check-no-personal-data.mjs` passes.
- `npm test` passes in CI before anything is pushed.

## 4b. Risk and judging rules every strategy follows (C-159)

- **Stops, no exception.** Short-hold books (60 sessions or less): the tighter of 3 x ATR(20) and 8% below entry, trailing on closes, filled at the next open; a signal needing a wider stop goes on a stop-too-wide list and is traded only if the owner approves the case. Long-hold books: a 25% trailing stop with each name capped at 5% of the book. Re-entry on the next valid signal. Gaps past the stop are logged. The reasons are in `data/stop-feasibility.json` and C-149.
- **Event-driven books:** equal weight, up to 20 names, at most 5% each, one fixed holding period written before the first run (20, 60 or about 250 sessions).
- **Kill line (amended by C-174, 9 Nov 2026):** drawdown 20% below the book's own peak, measured relative to the benchmark's move over the same window; trailing 6-month net excess below -5 points at two consecutive reads; zero or negative average net return after 40 trades. One line is Watch; the drawdown line or any two lines is Kill.
- **Self-improvement loop:** monthly scorecard; one champion and at most two pre-written variants as shadow books; a swap only on fresh data under a rule written in advance, at most once a year per strategy; the number of variants tested is recorded.
- **Fund replacement test:** total TER no higher than the self-run cost, assets at least Rs 500 crore, record at least 3 years, tracking difference no worse than -1.0% a year over 3 years.

- **Pass standard and stopped parent (C-173, 9 Nov 2026):** monthly reads give Continue, Watch or Kill only. Adopted needs a thick read (12 months, 60 closed trades) and all of: bootstrap 90% interval on the mean monthly net excess above zero, point estimate above the cost difference, power stated, and the count of rules and variants tried reported beside the result. The comparison parent of the sleeve variants is the monthly-review sleeve with the C-159 long-hold stop; variants inherit it.

## 5. Writing a rule so it can be understood later

Each C-row answers, in this order: question asked; universe; signal; entry; exit; sizing; costs; benchmark and comparison lines; data used (with register row ids); evidence status (what is proven, what is borrowed from outside research, what is unknown); what was run and what was not; read date; what rejects it. Say what was **not** tested and why. Avoid undefined words: every term used is defined in the glossary of ARCHITECTURE.md or in the row itself.

## 6. UI conventions (the UI follows the desk as it is now)

- One tab per section, as today: Today, Scans, Paper test, Portfolio, Funds, Reference. A strategy appears as a strategy tab inside **Scans** and **Paper test** (via the registry), not as a new top-level tab.
- Quiet by default. A strategy that has not started shows "not started" and its start date. No alerts, badges or colour for a strategy that has nothing to do tonight. Detail sits in folded `<details>` blocks.
- Every number carries its as-of date and source; stale or missing data is shown as missing.
- The same table, card and chip components, the same typography and tokens as the existing views. No new visual style per strategy.
- Mobile first: each view works at phone width with no horizontal page scroll (tables scroll inside `.tablewrap`).
- A strategy page states its rule id, its status (paper only), the read date and the benchmark lines, and links to its C-row. It never shows a recommendation to trade real money.
- Composite scores and rankings show the components that produced them.

## 7. Definition of done

A strategy is done only when all of these are true:
1. C-row adopted and present in the live Engine Rules doc, the repo export and the Test Register.
2. Every source it reads has a Used row in `docs/DATA_SOURCES.md` and passes its completeness check.
3. Engine module, job, workflow step, output files and tests exist and `npm test` passes.
4. Replay run once (or the row says why not) and its report is in `docs/replay/`.
5. Registry entry present; the strategy shows in Scans and Paper test in the quiet style above; "not started" works.
6. SCOPE, STATUS and HOW_TO_USE updated; project copies re-synced.
7. The book has its stop, kill line and monthly scorecard from C-159 written into its C-row.
8. A person can find the rule, the code, the data and the result by following the stem name, starting from the registry entry.

## 8. Maintaining this page

Change it only with a log line below. A change to the standard that alters how a strategy is judged is registered as a C-row.

- 8 Nov 2026: created from the momentum sleeve build (C-130 to C-132), the Engine Rules, Test Register, ARCHITECTURE and DATA_SOURCES conventions.
- 8 Nov 2026: added section 4b and a definition-of-done line for the C-159 risk and judging rules.
- 9 Nov 2026: added the C-173 pass standard and stopped-parent line to section 4b.
- 9 Nov 2026: kill-line drawdown now measured relative to the benchmark (C-174).
