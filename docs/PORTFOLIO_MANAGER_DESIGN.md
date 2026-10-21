# Portfolio Manager: design for review

Status: draft v6 for review (v5 plus the third outside review: oldest lots promoted, swing-exit tiebreaker, ten-name ranking, Access on preview deployments, ETF tax and STT rows). Before that: draft v5 for review (v4 plus the second outside review: partial-sell attribution, promote with trim, sale-after dates instead of Hold, Swing excluded from rebalancing, specified-fund tax rows, upload hardening). Before that: draft v4 for review, nothing built yet. First written 11 Oct 2026; v2 the same day after the owner's answers and a first look at sample exports; v3 after an outside review of v2; v4 after an outside review of v3 (contradictions removed, verdict order and tax-saving formula pinned, benchmark and gate definitions added).
Owner decisions are marked **Decided**. Everything else is a proposal. Tax and law statements are researched from public sources (section 7 and Appendix A), each marked High, Medium or Low confidence with its source and date. Medium and Low items are treated conservatively by the tool, and the owner is advised to get one professional check before acting on a large trade that depends on them. I am not a lawyer or a tax adviser; this is decision support.

## 1. What it is for, and the objective

One place that holds the complete record of what the household owns, and says what is good, what is bad and why. It covers stocks, mutual funds and index funds across several broker and fund apps. It sizes new money across holdings using public information only. It joins the Repo Desk dashboard as extra tabs and shares one ledger with the Swing Desk.

It does not place orders. Uploads are manual.

**Objective (proposal, needs the owner's numbers):** maximise long-run after-tax, after-cost return, subject to a household drawdown limit. Without it the objective is met by putting everything in the hottest stock, which the caps in section 8 forbid. The drawdown limit is what gives the risk profiles in section 8 a reason to exist. **Default:** a household drawdown limit of 20% on the Balanced profile, selectable in the app. A liquidity buffer is optional; if none is entered there is no Liquidity book, no floor check and no shortfall warning, and the system never asks for one.

**What kind of engine this is.** The allocation engine is a policy engine, not an optimiser: it does not estimate returns, so it cannot maximise anything. It enforces a chosen policy and keeps the rest of the household from hurting returns. The return-seeking parts are the Swing Desk and the Legacy cleanup.

**Decided 11 Oct (owner):** nothing is tagged by hand. Owner, account and book come from the uploaded files and from written rules (section 3). Every choice the owner might want to change (capital, risk profile, caps, allocation) is selectable inside the system, not fixed to one scenario (section 8).

### 1.1 How the Swing Desk and the Portfolio Manager work together

They are one system with two jobs, sharing one ledger and one market-data feed. The Swing Desk decides **what to trade and where to exit** in the Swing book. The Portfolio Manager decides **how much capital the Swing book gets, which account it sits in, and what happens to everything else** (Legacy, Long-term, Liquidity, tax, performance). Neither places orders; execution stays manual.

| Question | Owner | How the other side is involved |
|---|---|---|
| Which new swing trades tonight, with trigger, limit, stop and size | Swing Desk | Reads capital and open positions from the Portfolio Manager (below) |
| How much of household capital is swing capital, and the split between accounts | Portfolio Manager (section 8, section 5) | The Swing Desk sizes against it and never keeps its own capital number |
| Which account a trade goes to | Portfolio Manager (section 5 routing) | Uses the Swing Desk's sizing and open-risk limits as constraints |
| When a swing trade exits (stop, trail, max hold) | Swing Desk (Engine Rules) | The ledger records the sale; a breach with the lot still held is flagged, not auto-moved |
| Exit, Keep or Promote for an old direct stock | Portfolio Manager (section 4) | Uses the Swing Desk's screen and Engine Rules exit test as its input |
| Tax timing, harvesting, whose account sells | Portfolio Manager (section 7) | Swing Desk shows the tax effect on a shortlist line when it applies |
| Funds, ETFs, allocation, performance (and an optional liquidity buffer) | Portfolio Manager | Not part of the Swing Desk |

**What flows each way (identifier-free files, the ledger-derived ones kept in the private portfolio folder, not in the public `data/` market folders):**
- **Portfolio Manager to Swing Desk, after every upload:** swing capital per account; cash per account; open swing positions with stops; names blocked for a new swing buy (a short-term Legacy lot in the same account, or the stock already held in the other account); the household position count and combined open risk.
- **Swing Desk to Portfolio Manager, every night:** the saved shortlist with trigger and limit levels (this is how an executed order is recognised as a Swing trade, section 3); stop and breach flags for open swing lots; the screen result and exit-test levels (200 SMA, last major swing low) for every Legacy name, which feed the verdicts.
- **Both read** the same market feed, and both show on the same dashboard.

**Constraints combine, the tightest wins.** A trade must clear the Swing Desk's rules (20% position cap on swing capital, open-risk limit, about 10 positions) and the Portfolio Manager's household limits (profile cap on investable capital, swing allocation, no stock in two accounts). The shortlist shows which constraint bound for each trade.

**Failure behaviour (proposal).** The Swing Desk runs as it does today until the ledger exists. After that, if the ledger is older than a set number of days, the shortlist still appears but is marked unsized for the stale account, with a banner, rather than using old capital silently. If the Swing Desk's night run fails, the Portfolio Manager keeps its last Legacy verdicts, each labelled with its date.

**Build order.** The Swing Desk is unchanged until phase 1 of section 13 delivers the ledger. The first change to it is saving the nightly shortlist (needed from day one, so orders can be recognised later). Reading capital and positions from the ledger comes with phase 7.

## 2. Performance and the decision log

Verdicts are labels with no feedback loop unless results are measured. So measurement is part of phase 1, not an add-on.

- **Returns:** after-tax, after-cost XIRR for every slice the ledger can cut: holding, book, account, owner, household. Each against one named benchmark (for example Nifty 500 TRI, or a fund's own index) with its source and date. **The comparison is like for like:** a portfolio's XIRR is money-weighted, a published benchmark return is time-weighted, so the benchmark figure is the XIRR of the same cash flows (same amounts, same dates) invested in the benchmark's total-return series. Otherwise the tab rewards or punishes the timing of deposits instead of the choices. **After-tax XIRR:** realised flows after actual tax; open positions marked to market with an accrued tax liability at the rate that would apply if sold today, shown as a separate line so the pre-tax figure stays visible.
- **Dividends and IDCW payouts are not in the order files.** They are computed from public data (section 7.4) and labelled *computed*; where no source exists for an instrument, returns are labelled **price-only** on that line, never silently shown as total return.
- **Decision log:** every verdict the system issues is recorded with its date, the rule that produced it, the price and the tax figures at that time. The log then records what happened to that name over the following 3, 6 and 12 months. Every verdict run is reproducible from a ledger commit plus a market-data as-of date. Judging criteria are written down before the first verdict is issued, the same discipline as the Engine Rules and the Dalal work. **One scoring rule per verdict type, fixed before the first verdict:** Exit is scored by what the name did against what the proceeds earned (or against the benchmark); Keep and Promote by the name against the benchmark over the same window; a sale-after date by whether the gain survived to the date, net of the tax saved; Harvest by the tax saved less the move in the name between the sale and the re-buy (or the end of the window if not re-bought).

## 3. The ledger (foundation)

One ledger for the household. Every lot carries tags, all derived by rule on each upload, with the reason stored beside the result.

| Tag | Where it comes from |
|---|---|
| Owner | The name in the uploaded file's header, stored as a role tag (P1, P2), mapped to a name only in the dashboard's configuration |
| Account | The platform the file came from (broker or fund-house name) |
| Asset class | One class per lot, read from a mapping in `settings/instruments.json` (its own file, since it changes on a different cadence and for different reasons than the allocation) from the AMFI scheme category (funds) or the instrument type (direct stocks and ETFs): direct equity, active equity fund, index (equity index fund or ETF), sector or thematic fund, hybrid, gold, silver, international, debt, liquid. Wrapper (ETF or fund) is a separate attribute, so a gold ETF is the gold class and never two. The **tax type** (section 7) is a third attribute derived from class, wrapper and listed status |
| Book | Inferred per lot by the rules below: Swing, Legacy, Long-term or Liquidity |

**Book inference (proposal, evaluated on every upload; the rule that fired is shown):**

1. **Liquidity** is an optional emergency buffer, which sits outside total capital. **No buffer is required, and none is assumed.** If no buffer amount is entered, this book is empty: every liquid and money-market holding is the debt class inside capital and sits in the Long-term book, and there is no floor check. If an amount is entered, the classification is mechanical, by AMFI scheme category (carried in the AMFI master list through the name-to-code map): overnight, liquid and money-market funds count toward it, oldest first, up to the buffer amount (the rupee amount the owner enters, section 8). Every other debt category is Long-term unless `settings/allocation.json` names a specific scheme as buffer. Any liquid-category holding above the buffer amount is the debt asset class inside capital and sits in the Long-term book. The buffer is never scored as an underperforming holding. A bank-cash part of the buffer (a savings account, say) is a typed figure, labelled as such, and counts toward the buffer; without it a household keeping part of its buffer in a bank account would show a false shortfall.
2. Other mutual funds and ETFs (index, active, gold, silver, sector, international) are **Long-term**. Sector and thematic funds are Long-term by book but take the stock lens for their verdict (section 9.1).
3. Direct stocks start as **Legacy**, which means they are under the exit test and the verdicts in section 4.
4. A direct-stock lot becomes **Swing** in one of two ways: the system promotes it (it passes the Swing Desk screen and gets a stop), or it was bought after the Swing Desk went live on a name that was on that night's shortlist and inside its trigger and limit.
5. Book is per lot, so one stock can hold lots in two books.
6. There is no tagging step. If a classification looks wrong, the fix is a change to the rule, logged as the Engine Rules are. A one-off data fix (a missing cost, section 11) is a typed override, kept in a dated file.

**Requirement on the Swing Desk.** Path 4's second route only works if the Swing Desk saves every nightly shortlist with its trigger and limit levels, and the parser can join an executed order to that night's list. That is a new requirement on the Swing Desk. Orders before the go-live date cannot use this route.

**Book transitions are a state machine, each with a trigger and an audit entry:**

| From | To | Trigger |
|---|---|---|
| Legacy | Swing | The system promotes it (passes the screen, stop set). **Promote with trim:** the Swing lot is sized to the Swing rules at its new stop (20% of swing capital, the open-risk limit, the household position count); the quantity is the smaller of the position and that size, taken from the **oldest** lots: tax first-in-first-out consumes the oldest lot when a Swing lot is later sold, whatever the book says, so promoting the oldest lots makes the Swing exit and the lot the tax column sells the same lot, and no clock resets (which lots are promoted has no other tax effect); the remainder stays in Legacy under the Legacy trim rules. Promotion never puts the Swing book out of compliance on day one |
| Swing | Swing, breach flagged | The stop was hit but the lot is still held, because execution is manual. The lot is flagged and an alert is raised; it does not change book on its own |
| Swing | Legacy | Held past the Swing Desk's maximum hold period. This is the only trigger: a book change never comes from a hand-entered note |
| Any | Closed | A sell is recorded in a later upload; which book's lots close follows the attribution rule below |

The exact hold period and the breach handling are taken from the Engine Rules exit table and confirmed in review.

**Partial sells and book attribution.** When a name holds lots in more than one book and a sell covers part of the quantity, the ledger needs a rule for which book's lots close, separate from tax first-in-first-out. The sell closes **Swing** lots first only when the Swing Desk had flagged an exit for that name (stop hit, trail or maximum hold) within the last 5 sessions (a setting); otherwise it closes **Legacy** lots first-in-first-out and leaves the swing quantity untouched, so a deliberate Legacy trim is never recorded as a swing exit. If the sell is larger than the Legacy quantity, the remainder closes Swing lots. This keeps the no-hand-tag rule and gives the ledger the one fact it needs. Book P&L follows this rule; the tax column always follows statutory first-in-first-out.

**Tax lots versus book lots.** Book is an internal label. Tax is not. Capital gains on shares are computed first-in-first-out within a depository account, and on mutual funds first-in-first-out within a folio (shares: High, since CBDT Circular 768 of 24 June 1998 applies first-in-first-out to each demat account separately; fund units per folio: Medium; see Appendix A, item 1). So selling shares from a Swing lot in an account that also holds an older Legacy lot is taxed as a sale of the older lot. **The effect is deferred, not avoided:** after that sale the Legacy position that remains carries, for tax, the swing lot's cost and buy date, so its tax clock has reset to short-term; this bites later when the Legacy name is exited, and the shortlist line shows it. The ledger therefore keeps two separate P&L columns, **book P&L** and **tax P&L**, and never mixes them. The risk is a **short-term Legacy lot**: first-in-first-out then attaches a swing sale to it at the short-term rate on a different cost basis. So a new Swing buy in a stock where the same account holds an open short-term Legacy lot is not opened there; it is routed to the other account if that is allowed (section 5), otherwise held back. If the open Legacy lots are already long-term, the buy is allowed and the shortlist shows the tax effect (the sale is taxed at the long-term rate on the older cost) and the clock reset on the remaining Legacy lot; the book P&L and tax P&L columns already carry the difference.

**Gross and itemised, not folded.** Each order stores its gross price and its charges as separate items (brokerage, STT, exchange charge, stamp duty, GST, DP). Tax and performance need different sums: STT is not deductible for capital gains, while brokerage, stamp duty and exchange levy are (Medium to High confidence, Appendix A item 2), and the economic cost includes everything. One folded "cost per unit" cannot serve both views.

Each transaction carries named fields for exchange and order id (charges differ by exchange, and the order id is the merge key). Fund units carry a per-person folio alias (F1, F2): the parser assigns aliases on first sight and keeps a salted one-way hash of the folio number so later uploads reuse the alias, and the number itself is never stored. The salt is a long random secret kept in the access-controlled configuration with the names and slab rates, never in the repo (a short numeric folio number is brute-forceable from its hash once the salt is known), and the browser parser receives it only after Access; this keeps first-in-first-out grouping per folio without the number. Each lot stores: instrument, units, gross price, itemised charges, buy date (needed for tax), source file and as-of date. No number without a source and date, as everywhere else in the Repo Desk.

Swing Desk reads the **Swing** book. The portfolio manager reads the others. Both see the household total. Swing Desk stops keeping its own holdings list.

## 4. Legacy book

Goal: shrink the list of direct stocks toward about 10, without hurting tax. Each name gets one verdict, with the reason shown. The Engine Rules already define the kept holdings: an exit test (a close below the 200 SMA or the last major swing low), a stop under the higher of the two, trimming to the 1% give-back and 20% caps, and a 10-stock target for the whole book.

- **Keep**: passes the exit test and ranks in the top ten (below). Stays in Legacy under the Engine Rules legacy-book rules (stop, weekly trail, trimming).
- **Promote to Swing**: passes today's Swing Desk screen, gets a proper stop and is managed as a swing trade.
- **Harvest**: a loss lot worth booking now (defined below). Shown as a sale with a date; any re-buy waits until T+1 or later (harvesting rule below).
- **Exit**: fails the exit test. Never deferred for tax.
- **Trim**: passes the exit test but ranks below the ten-name target (below). Reduced to zero over time, not at once.

**Sale-after date (a modifier, not a verdict).** A name that passes the exit test and the screen is a Keep and has no sale pending, so there is nothing to hold for. A date applies only to a non-urgent sale that is already pending for another reason: a trim to the 20% cap, a rebalance sale (9.2) or a Replace (9.1). Such a line reads "sell after <date>" when a long-term date or the end of an exit-load window falls within N days and waiting saves more than it risks (below).

**Precedence.** A name can pass the exit test and the swing screen at once, so verdicts are evaluated in a fixed order and the first rule that fires wins: **Exit, Promote, Harvest, Trim, Keep.** Every other rule that was also true is recorded as "also true" in the decision log. Exit comes first, so a breaking-down name is never held for its tax date. Promote ranks above Harvest: a name that passes the screen is wanted, and selling it to book a loss would lose the screen result, since the re-bought lot becomes Swing only if the name is on that night's shortlist inside its trigger and limit; otherwise it would land in Legacy. Harvest therefore applies to a loss lot on a name that passed the exit test but not the screen. A name that failed the test is already an Exit sale and its loss is booked by that sale.

**The ten-name target and which ten stay (proposal).** Ten is a target for the Legacy book, and when more than ten names pass the exit test the rest are chosen by rank. Names are ranked by the Swing Desk's relative-strength measure against the Nifty 500 (the same feed the screen uses), with position weight as the tie-break (the larger position first). The top ten are Keep; the others are Trim. Trim reduces a name to zero through the Legacy trim rules and any sale-after date, lowest rank first, at most two names a month (a setting), so tax timing and charges are not forced into one week. A name that Promote moves to Swing leaves the count. The rank is recomputed each night and a name changes tier only after 2 consecutive weekly ranks on the other side of the line, so rank noise does not cause churn.

**The swing low, defined (Decided 14 Oct, owner; built in `src/pm/verdict.ts`).** The Engine Rules say "the last major swing low" without a computation (the old app took a typed number). For the Portfolio Manager it is the most recent confirmed pivot low on daily closes: a close that is the lowest of the 10 sessions on each side of it, so it is confirmed only once 10 later sessions exist. The 10 is a starting value (`PIVOT_SIDE`), not yet tested. Closes are used because the stored history before Oct 2025 has no intraday lows. The 200 SMA is the average of the last 200 stored closes. The exit test fires on either leg. Where a split, bonus or demerger falls inside the last 300 sessions the stored closes are not adjusted, so the verdict reads "No verdict" with the reason rather than guess. A close older than 7 days, or fewer than 200 sessions, also gives "No verdict". Logged in the live Engine Rules document as change-log row C-41 (Interim, 14 Oct 2026).

**Policy:** no direct stock is held outside the exit test. The end-state for a direct stock is Keep, Promote or Exit, until the desk has a fundamentals source. Anything meant as a long-term holding is a fund or ETF.

**The sale-after date is a comparison, not a fixed rule.** "Close to long-term" means a lot with a gain within N days of its long-term date, where selling before that date taxes the gain at the short-term rate. N is a setting, default 60 days, and is only the search window. For each candidate the line shows two numbers: the tax saved if the gain survives, and the expected loss over the wait, estimated from the stock's ATR in the Swing Desk feed (a first formula: ATR × √N; untested, to be pre-registered with a margin before use). The date is applied only when the saving exceeds the risk by that margin. A name that is breaking down is exited regardless of its tax date.

**Tax saved is not a flat rate gap.** It depends on the person's position that year, which the section 7 ledger already holds: with the long-term exemption for the year unused, a gain inside the exemption saves the whole short-term tax (it would be tax-free as long-term); once the exemption is used, the saving drops to the difference between the short-term and long-term rates. Brought-forward and same-year losses are netted first, so the formula takes the person's remaining exemption and available losses as inputs.

**A loss worth booking.** The value of a harvested loss is the tax it saves. That is zero this year if the person has no gains to set it against, and only a discounted future value if it merely carries forward, which is unconfirmed until it is reported in a return (haircut set in the settings file, starting at 50%). Against it stands the round trip: charges both ways plus overnight gap risk. Harvest fires only when the tax value exceeds the round-trip cost plus a margin, and the line shows both numbers.

**Harvesting rule.** Public sources say India has no wash-sale rule. They cite no statute, case or guidance on same-day re-buys, so this is Low confidence. The general anti-avoidance rule is understood to apply only above a monetary threshold on the tax benefit (₹3 crore under the income-tax rules; Medium, to verify), far above a household portfolio's tax saving, so the real constraint is the desk's own no-intraday rule. A same-day sell and re-buy also breaks the desk's no-intraday rule. So the tool takes the conservative line: a harvested loss is booked on day T and any re-buy waits until T+1 or later, with a real economic reason noted in the decision log, and it does not harvest the same name repeatedly in a short span. A second use is **gain harvesting**: each person has a yearly long-term gains exemption on listed equity and equity funds (₹1.25 lakh at present, section 7), so the tool may suggest selling long-term lots with gains up to the unused exemption and re-buying at T+1 or later to lift the cost base. The same conservative timing rule applies, and the re-bought lot starts a new holding period, so it is short-term for the next 12 months; the line shows that. Both sit in the rules table in section 7.

## 5. Two swing pools with a household layer (Decided)

Each account runs the normal Swing Desk rules on its own swing capital: position size, stop distance, open-risk limit. **Swing capital per account is derived, not a setting, and is re-derived only when the allocation changes or quarterly, not on every upload,** so a rally in one account's funds cannot shrink the other account's swing capital and make its open positions look oversized with no trade made: the household swing allocation (section 8) × that account's share of household investable capital at the last derivation. It is capped at what the account can hold, its cash plus its open swing exposure; any shortfall is shown, never silently assigned to the other account. The per-account open-risk limits depend on it. **Cash per account** comes from the holdings statement if it carries a cash line, otherwise from a typed figure at each upload (a data input, not a tag); routing step 1 cannot run without it. The household layer adds:

1. A stock is held in only one account at a time. This applies to the Swing book only; Legacy already spans accounts.
2. Combined open risk stays within the same percentage limit, applied to combined swing capital.
3. The roughly 10-position cap applies to the household.

When these constraints disagree, the tightest one wins, and the nightly shortlist shows which constraint bound for each trade.

New-trade routing, in order: (1) the account that has the cash; (2) if both do, **tax** (whose short-term losses can absorb a gain), but only for an account whose source of capital is recorded as own income and only when every rules-table row the comparison uses is at High or Medium to High confidence, otherwise this step is skipped and the shortlist never shows a tax reason; (3) the account with fewer open positions. The nightly shortlist shows every trade sized and labelled with the account.

Closed trades carry an owner tag so each person has a separate tax view.

**Clubbing.** Under section 64(1)(iv), income from an asset transferred to a spouse without adequate consideration is taxed in the giver's hands, including a gain when the spouse later sells it; this reaches cash gifted and then invested. It does not reach income earned on the clubbed income, and it requires the marriage to subsist at transfer and when the income arises (High to Medium confidence, Appendix A item 4). The "sell from the person with the lower tax drag" logic is therefore valid only for capital that is that person's own in substance. So the ledger records the **source of capital per account** (own income, or transferred from the spouse, with amount and date). **Cross-person tax routing is switched on for an account only when its source is recorded as own income.** Where money was transferred, that part is treated as the giver's for tax and routing ignores it. Routing otherwise uses cash and position count. Any transfer is entered as a recorded input; that part is then treated as the giver's.

## 6. Charges (Decided in principle 11 Oct: build them in, reconcile with the P&L statement)

Some broker order files carry no charges, only quantity and value. Gains need them, so the ledger applies a charges model per order and marks every figure as modelled until a P&L statement or contract note confirms it.

**Model for Groww, delivery equity and ETFs.** Rates are held in one dated table with a source and an effective date on every row, never in code.

| Charge | Rate | Applies to | Source |
|---|---|---|---|
| Brokerage | lower of 0.1% and ₹20 per executed order, minimum ₹5 | buy and sell | Groww pricing page |
| STT, listed shares | 0.1% | buy and sell | NSE investor page, updated 17 Apr 2026; same before and after 1 Apr 2026 |
| STT, equity-oriented ETF units | 0.001%, on sale only; none on purchase | sell | one broker page, no effective date: Medium, to verify |
| STT, gold, silver and international ETFs | none | | same broker page: Medium, to verify |
| Exchange transaction charge | NSE 0.00297%, BSE 0.00375% | buy and sell | Groww pricing page |
| SEBI turnover fee | 0.0001% | buy and sell | NSE page and Groww |
| IPFT charge | NSE 0.0001% | buy and sell | Groww pricing page |
| Stamp duty | 0.015% | buy | NSE page and Groww |
| DP charges | depository fee plus a Groww fee, per sell debit, Groww part waived under ₹100 | sell | Groww pricing page |
| GST | 18% on brokerage, DP, exchange, SEBI and IPFT charges | as listed | NSE page and Groww |
| Mutual fund stamp duty | 0.005% of the amount invested, deducted before units are allotted | purchases | AMC pages, in force since July 2020 |
| Mutual fund brokerage | none on direct plans | | Groww pricing page |

Known limits of the model:

- The Groww page shows no effective date, so the rows are marked current. Groww's delivery brokerage may not always have had this structure (to verify), so older orders would be wrong under a single current rate. An effective-date row for each earlier regime is to be found and added; until it is, older orders are flagged as estimates.
- STT on ETFs differs by instrument (rows above), so the charges table is verified against the NSE page before the phase-1 build, since it is a phase-1 deliverable. STT is not deductible for capital gains, so it changes the performance figure and not the tax figure. Which charges count toward cost for tax is in section 7.
- DP charges apply per sell debit, not per order. The model counts one per instrument per sell day. Which depository each account sits on is confirmed from the account statements.

**Calibration and reconciliation.** One or two contract notes per rate regime, which carry exact charges per order, calibrate the table. The annual P&L statement per financial year, for each person, then acts as a check. Where the modelled and reported figures agree within a stated tolerance the model is trusted; where they differ, the reported figure replaces the modelled one for that sale and the gap is logged with its likely cause. Contract notes carry identity details and are parsed the same way as the order files: identifiers dropped at parse, files never stored.

## 7. Tax stays per person

Each person has an own yearly long-term gains exemption and own loss set-offs, so the tool can suggest whose account to sell or harvest from, subject to section 5. The rules below were researched on 11 Oct 2026 and are kept in one dated rules table (`settings/tax.json`), one row per instrument type and per date range, each with its source and confidence. Surcharge and cess are not in the rates shown. Budget 2026 (1 Feb 2026) did not change the equity capital-gains rates, according to two secondary sources; the primary text of the Finance Act is not yet checked.

| Type | Long-term after | Short-term | Long-term | Applies to transfers | Exemption applies | Confidence |
|---|---|---|---|---|---|---|
| Listed shares and equity-oriented funds (65% or more in domestic equity), STT paid; includes ELSS and an aggressive hybrid fund if its equity share is 65% or more | more than 12 months | 20% | 12.5% above ₹1.25 lakh of gains per person per financial year, no indexation | on or after 23 Jul 2024 (before it: 15% and 10% above ₹1 lakh) | **Yes** | High |
| Gold and silver ETFs, listed | more than 12 months | at slab rate | 12.5%, no indexation | on or after 1 Apr 2025, any purchase date | No | Medium to High |
| Gold and silver ETFs bought before 1 Apr 2023 | more than 12 months | at slab rate | 12.5%, no indexation | transfers from 23 Jul 2024 to 31 Mar 2025 | No | Medium: to verify |
| Gold and silver ETFs bought before 1 Apr 2023 | more than 36 months | at slab rate | 20% with indexation | transfers before 23 Jul 2024 | No | Medium: to verify |
| Listed international ETFs (the same date carve-outs as the gold rows above apply) | more than 12 months (listed securities) | at slab rate | 12.5%, no indexation | on or after 1 Apr 2025 | No | Medium |
| Unlisted overseas and gold fund-of-funds | more than 24 months | at slab rate | 12.5%, no indexation | on or after 1 Apr 2025 | No | Medium: the 24 months is inferred from AMC tax reckoners |
| Gold, silver and international funds and ETFs bought on or after 1 Apr 2023 and transferred before 1 Apr 2025 (the old "specified mutual fund" test: 35% or less in domestic equity) | none: deemed short-term | at slab rate at any holding period | same | purchases on or after 1 Apr 2023, transfers before 1 Apr 2025 | No | Low to Medium: secondary sources disagree on 23 Jul 2024 to 31 Mar 2025, so the conservative reading (slab at any period) is used; verify against the Finance (No. 2) Act 2024 text. |
| Debt funds (more than 65% in debt and money-market instruments) bought on or after 1 Apr 2023 | none | at slab rate at any holding period | same | from 1 Apr 2025 under the new test; before it under the old test | No | High |
| Debt funds bought before 1 Apr 2023 | more than 24 months | at slab rate | 12.5%, no indexation | transfers on or after 23 Jul 2024 (before it: 36 months, 20% with indexation) | No | Medium: to verify |
| Hybrid funds with 35% to 65% in domestic equity (neither equity-oriented nor specified) | more than 24 months | at slab rate | 12.5%, no indexation | on or after 23 Jul 2024 | No | Medium: to verify |
| US stocks | more than 24 months | at slab rate | 12.5%, no indexation, no ₹1.25 lakh exemption | on or after 23 Jul 2024 | No | Medium to High |

The **specified mutual fund definition narrowed on 1 Apr 2025**: the old test caught any fund with 35% or less in domestic equity (gold, silver and international funds and ETFs); the new test is more than 65% in debt and money-market instruments, which releases them. The "exemption applies" column is true only for listed equity and equity funds, so the sale-after and gain-harvesting formulas cannot claim the ₹1.25 lakh exemption on a gold or international lot.

Rules that sit beside the table:
- **Set-off.** A short-term loss sets off against short-term and long-term gains; a long-term loss only against long-term gains, so a long-term loss on equity cannot reduce a short-term gain (High).
- **Carry-forward.** Eight assessment years after the loss year, and only if that year's return was filed by the due date (High). The ledger computes realised gains and losses by financial year and by tax type from the order history, applies the same-year set-off, and carries the remainder forward. An opening balance is typed only for a loss that predates the uploaded files. A carried-forward loss counts only if it was reported in a return filed on time, which the ledger cannot see, so it is shown as unconfirmed.
- **Cost.** STT is not deductible for capital gains. Brokerage, stamp duty on purchase and exchange levy are. GST on brokerage is treated as part of brokerage, and DP charges on sale are included in the performance figure but left out of the tax figure until confirmed; the difference is a few rupees per sale. Mutual fund stamp duty is deducted from the amount invested, and cost is taken as the amount paid (Medium).
- **Demergers.** The cost of the new company's shares is the original cost × (net book value of what moved ÷ the parent's net worth before the demerger), section 49(2C). The original cost is reduced by the same amount, section 49(2D). The holding period of the new shares counts from the purchase of the originals (High to Medium). Companies publish the apportionment percentage in a shareholder notice; that figure is typed once into the override file. Bonus shares carry nil cost and a holding period from allotment, and splits spread the cost over the new quantity with the holding period unchanged (Medium; the primary text is checked when the parser is built).
- **Grandfathering.** For equity lots bought before 1 Feb 2018, cost is stepped up to the 31 Jan 2018 value in a defined way. It is checked whenever uploaded files contain lots that old.
- **US holdings.** Convert each purchase and sale to INR at the SBI telegraphic transfer buying rate on the last day of the month before the month of the transaction (Rule 115 as read on the Income Tax Department page for capital gains: High for the sale; Medium for the purchase, where the same convention is commonly applied). Every USD transaction stores both that rate and the transaction-date rate, with source and date, so the ledger can switch without re-parsing. US dividends are taxed at slab rate on the gross amount; the 25% US withholding (with the W-8BEN form on file) is claimed as a foreign tax credit on Form 67. TCS on remittances for investment is 20% above ₹10 lakh a financial year and is creditable against tax; Budget 2026 left that unchanged. Foreign assets are reported in Schedule FA by calendar year with no minimum value (Medium to High).
- **Harvesting.** The timing rule and the gain-harvesting use in section 4.
- **Lock-in and exit load.** ELSS units are locked in for 3 years from allotment, each SIP instalment on its own date (High). Harvest, Replace and rebalance sales never take a locked unit, and never take a unit inside an exit-load window unless the saving exceeds the load.
- **Slab rate.** Each person's slab rate is a configuration input, kept with the names in the access-controlled configuration. It prices every slab-rate line and, once the dividend report arrives, dividends.

This is decision support, not tax advice. Items marked Medium or Low have no primary-source confirmation yet. The tool treats them conservatively and shows the flag beside the number. A one-time professional check is recommended before acting on a large trade that depends on one.

### 7.1 The automatic tax view (Decided 11 Oct)

Nothing is worked out by hand. On every upload the ledger replays the whole order history and rebuilds this view for each person, so it is always current and always traceable to orders.

- **Per person and financial year, by tax type** (listed equity, gold and silver ETF, international ETF, overseas fund-of-funds, debt fund, US stock): realised short-term and long-term gain or loss, after deductible charges.
- **Set-off and carry-forward:** same-year set-off by the rules above, the remainder carried forward up to eight years, flagged *unconfirmed* until the owner says the loss was reported in a timely return.
- **Exemption:** the ₹1.25 lakh long-term equity exemption used and left this year, and the gain-harvesting headroom.
- **Estimated tax** at the rates in the rules table, before surcharge and cess, each line showing its confidence mark.
- **Unmatched sells:** any sell with no buy behind it is listed with its reason and is left out of the totals until a corporate-action override resolves it. Totals show a banner while any are open.
- **Schedule CG layout:** the same figures grouped as the income-tax return asks (sale value, cost, expenses, gain, by section), exported as CSV for the owner to copy into the return. Reconciliation against the broker P&L statement applies when that is uploaded.
- It lives in the Tax tab of the dashboard (section 12) and ships in phase 1 as a report, since it needs only the ledger and the rules table. Replay of real order files (kept private) is the test.

### 7.2 Corporate actions that need a typed cost

The order history does not carry demergers, bonuses or splits, so they surface as unmatched sells. **The Swing Desk already tracks corporate actions** (`src/ingest/corp-actions.ts`, `data/india/corp-actions.json`) for price adjustment, and the ledger reuses that store and its parser for bonus and split ratios and ex-dates, with no second list. Two gaps: the stored list starts on 3 Oct 2025, so earlier actions are not in it and are backfilled once from the earliest buy date in the uploaded files; and a demerger carries no ratio or cost there, because the price step only needs the price move. What the ledger adds is cost and quantity: bonus and split quantities come from the shared store, and cost for a demerger is typed. Anything still unexplained is resolved once by an entry in `data/portfolio/corp-action-overrides.json` (same pattern as the market-data overrides; personal files stay out of the public data folders). The entry is dated and carries its source:

- `demerger`: parent symbol, new symbol, record date, ratio, **cost-apportionment percent** published by the company. New lots take parent cost × percent and the parent lots' cost falls by the same amount; the holding period of the new shares counts from the parent purchase dates.
- `bonus`: symbol, allotment date, quantity; nil cost, holding period from allotment.
- `split`: symbol, date, ratio; cost spread over the new quantity, holding period unchanged.

(Replay detail from the household's real files is kept in the private repository.)

### 7.3 The break resolver: the system finds the cause itself (Decided 11 Oct, owner)

**Requirement (owner): every upload is checked and explained by the system; the owner does no research.** A *break* is a sell larger than the open lots of that company, or a holding the statement shows that the lots do not. The resolver runs in the Actions workflow after each merge, on the whole company lineage rather than one ISIN, and tries these steps in order. Each step produces a proposed event with its evidence.

1. **Lineage.** Join symbols and ISINs of one company: an ISIN change inside the stream, an exchange symbol-change record, the AMFI or NSE master. This fixes renames (an old name to a new name) and split-driven ISIN changes (a split that changes the ISIN).
2. **Corporate-action history for the lineage.** Splits, bonuses, mergers, demergers, rights and buybacks with ex-dates between the first buy and the break, from the exchange corporate-action feed (the Swing Desk store holds only Oct 2025 onward; **it is back-filled once from the exchange archive and then kept current nightly**, in the same file). Apply the ratio to the lots held on the record date.
3. **Demerger entitlement.** If a sell appears on a symbol with no buy, look for a parent the person held on the record date. Entitlement = parent units on that date times the ratio; the break is explained when the entitlement equals the unmatched quantity. Cost = parent cost times the company's published apportionment percent (read from the notice; if none, the first-day price split, labelled an estimate).
4. **Rights entitlement.** Symbols ending in -RE or -RE1 are rights entitlements: nil cost; shares bought on exercise carry the rights price.
5. **IPO allotment.** The first trade lies within a few sessions of a listing date and the break is a multiple of the issue's lot size: take the issue price and lot from the exchange's IPO record. Cost = issue price times quantity.
6. **Nothing explains it.** The item stays *unexplained* and appears once in the app with the candidates already filled in, answered with one tap or one typed number. The answer is stored in the overrides file and never asked again, for any later upload.

**The accept rule.** A proposal is applied automatically only when it **closes the break to the unit** (sells and open lots then balance exactly) **and** rests on a dated, sourced record. A proposal that does not close the break to the unit, or rests on an estimate, is shown as *proposed* with its evidence and applied after one confirmation. Nothing is applied that fails both tests. Every applied event is listed on a Corrections screen with its source and reversible; the holdings statement stays the final gate.

**Proposals that cannot be confirmed yet (reconcile later).** A proposal that rests on an estimate (an IPO price that depends on the category applied under, a price not checked against the prospectus, a rights entitlement whose ratio is not in the feed) stays *proposed*: it is used in a provisional replay, every figure that depends on it carries an "unconfirmed" label, and nobody is asked again. When a P&L statement or holdings statement is uploaded later, its buy value or sale cost for that sale replaces the estimate automatically, and the Corrections screen shows what changed.

**Tests.** Synthetic fixtures covering a split, a merger, demergers, bonuses, a rights entitlement, IPO allotments, and an unexplained case (it must end in the one-tap queue, not guess).

**Limit, stated plainly.** If an exchange record is missing or the data feed is down, the resolver falls to step 6 rather than guessing; it can only be fully automatic for events the exchanges publish. Off-market transfers and gifts leave no public record, so those are the only items that can ever reach the owner.

### 7.4 Dividends computed from public data (Decided 11 Oct, owner)

**The owner does not upload a dividend report.** A dividend is a public corporate action, so the system computes it: **entitlement = units held on the record date (from the ledger) times the declared dividend per share.**

- **Indian stocks and ETFs:** the exchange corporate-action feed (the same one the break resolver uses, section 7.3) gives amount per share, ex-date and record date. Holding is taken at the close before the ex-date. Gross amount is computed; TDS is shown at the rate in force (10% above ₹5,000 a year from one company, a dated rate in the rates table). Confidence High on amount and date, Medium on the net credited.
- **US stocks:** the dividend history for each ticker from a public data source, amount per share and ex-date, converted at the Rule 115 rate (section 7) with US withholding at the treaty rate shown as a credit to claim, labelled an assumption. Confidence Medium until checked against a real broker statement.
- **Mutual fund IDCW payouts**: declared amounts per unit come from each fund house's disclosure, which is less uniform. Confidence Low to Medium. Growth plans have no payouts and need nothing.
- **Why it is labelled:** a computed dividend is an entitlement, not proof that cash arrived. The page marks dividends *computed*, and a bank-credit or broker dividend report, if the owner ever uploads one, replaces the computed line for that payment. Without any, total return includes computed dividends and says so.
- **Test:** compare the computed figure for a held stock in a past year against one real credit once the owner has one to hand.

## 8. Allocation engine: every scenario selectable in the system (Decided 11 Oct)

The owner enters total capital. Nothing else is fixed. These are all selectable in the app, and the target allocation is recalculated for any combination:

| Input | Choices |
|---|---|
| Total capital | investable capital, excluding the liquidity buffer: a typed amount, or taken from the ledger plus new money |
| Risk profile | Cautious, Balanced, Aggressive, or a short questionnaire that picks one, or a custom set of weights |
| Horizon | a number of years. Bands (under 3, 3 to 7, 7 to 15, over 15) are presets that set that number |
| Liquidity buffer | **optional, no default.** Blank means none: no Liquidity book, no floor check, no warning. If a rupee amount is typed it is held outside total capital |
| Asset classes in scope | the ten classes of section 3 (direct equity, active equity fund, index, sector or thematic, hybrid, gold, silver, international, debt, liquid), each switchable. **Hybrid has no target weight of its own:** it is folded into equity and debt by its mix, taken from the scheme category's mandated midpoint until fund-level mix is available from the holdings adapter (phase 8). Sector and thematic funds default to a zero target with a cap |
| Caps | single stock as a percent of total capital, single fund, sector, country, asset class minimum and maximum |

**Position cap is a function of total capital:** cap per stock = a percent set by the profile × total household capital. Starting values (untested guesses to review): about 5% Cautious, 8% Balanced, 12% Aggressive.

**Drawdown limit (proposal, to confirm).** It needs a stored daily valuation series (market feed for stocks, AMFI NAV for funds), which is a named phase-1 output. The household drawdown is the fall from the highest value of investable capital to today's value, after adding new money and taking out withdrawals. Starting limits by profile: about 12% Cautious, 20% Balanced, 30% Aggressive. A concentrated portfolio can fall 35 to 40% in a bad year, so the figure is a monitoring line, not a guarantee. A breach raises a review, never an automatic sale. It is reported on the ledger's own value history and later by replaying past market falls through today's holdings.

**One capital input, one precedence rule.**
- Swing capital is an allocation line (active direct equity as a percent of household capital), not a second capital number. The Swing Desk reads it from here.
- The Swing book keeps its 20% per-position cap, measured on swing capital; the profile cap is measured on household capital. The tighter of the two wins. For example, at a 30% swing allocation they come to 6% and 8% of household capital, so 6% applies.
- The ledger's value of capital is authoritative; a typed amount is a labelled scenario and never replaces it.
- **Rule:** the liquidity buffer sits outside total capital. **Pinned:** "total capital" means investable capital everywhere in this section. All asset-class weights, including the debt and liquid class held inside capital, sum to 100% of investable capital, and every cap is a percent of investable capital. If a buffer is entered it is shown beside it and checked against the floor; a "with buffer" household total is a secondary display only. With no buffer, none of this appears. Test 1 below uses this definition.

**Rebalancing policy** (detail in 9.2). Rebalancing sales never touch the Swing book: a swing position has its own exit under the Engine Rules, and the swing allocation is adjusted through its capital line, which changes only what new trades are sized against. Each asset class has a drift band. The household is checked monthly on upload. New money goes to underweight classes first. Sales happen only when drift exceeds the band, taken from long-term lots first where the tax table allows.

**How it stays complete and stable.** The preset weights, horizon glide and caps live in one settings file (`settings/allocation.json`), not in code. `settings/allocation.json`, `settings/instruments.json`, `settings/funds.json` and `settings/tax.json` each keep a change log, as the Engine Rules do: every change dated and with its reason. The output for any combination shows, per asset class: target, current, gap, and the rule behind each number. Two tests run on every combination of the selectable inputs:
1. Weights add to 100% and respect every minimum, maximum and cap (and the liquidity buffer, when one is entered). A combination that cannot be satisfied returns a plain message saying which constraints clash; it never returns a guess.
2. A one-notch change in any input moves the targets by a bounded amount. The glide from horizon to equity share is defined as a continuous curve of the horizon in years (preset curve points in `settings/allocation.json`), so the portfolio cannot flip because a horizon crossed a band edge; bands only choose a starting number.

The preset numbers are starting values and are reviewed with the owner before use.

**New-money sizing.** Inputs: current ledger, the amount to invest, the allocation above. Output: a table of amounts per holding or fund, with the rule that produced each line.

- Fill underweight asset classes first.
- No single holding above its cap; no new money into names marked Exit or failing the screen.
- New direct-stock money goes only through the Swing Desk shortlist, never into Legacy.
- Prefer the account and person with lower tax drag for any sale that funds the purchase, within the accounts section 5 allows.

## 9. What "good and bad" means

Proposal, to be pinned in review. Public information only. Every metric names its data source, refresh and as-of date, as the Repo Desk does for market data.

- **Funds:** scored and given verdicts as in 9.1. The measures: return against the fund's own benchmark and category over 1, 3 and 5 years; rolling-return consistency; expense ratio (direct vs regular). NAV history and expense ratios come from AMFI and the AMC pages; benchmark total-return series from NSE Indices. Category averages are not published anywhere, so they are computed from AMFI NAV histories of every scheme in the same AMFI category: a data job of its own, named in phase 3. Fund holdings, needed for overlap, come from monthly factsheets and are a separate, harder adapter; manager changes come from scheme documents. Index funds are judged on tracking difference and expense ratio, not on beating the market. Liquidity-book funds are not scored for return.
- **Hysteresis.** A fund's 1, 3 and 5 year returns reorder often, and a fund that flips between Good and Bad each month would cause churn, which costs tax and charges. A verdict must persist for a set number of months, or rest on a structural reason (mandate change, manager change, sustained underperformance against the category over a full cycle), before Exit is issued for a fund.
- **Stocks:** trend and relative strength from the same data the Swing Desk uses, plus position weight and concentration.
- **Household view:** allocation by asset class, sector and country; one number for total value; later, concentration by sector and single name after looking through funds to their holdings, and a household drawdown figure.

Each verdict is a short label plus reasons, each reason carrying its source and date.

### 9.1 Fund verdicts, scoring and the fund shortlist (owner requirement, 11 Oct; the numbers below are proposals to review)

Held mutual funds, index funds and ETFs each get a verdict with reasons, every fund type is scored on one scale within its peer group, and the system produces a shortlist of candidates to buy or switch into. The Liquidity book is not scored. Debt funds outside any buffer are scored only on expense ratio and category until a credit-quality and duration data source is found (not in the first version).

**Peer groups.** Active funds are compared within their AMFI category. Index funds and ETFs are compared only with others tracking the **same index**. Gold, silver and international ETFs and funds are compared within their underlying (gold, silver, a named foreign index). The choice of index itself (Nifty 50 against Nifty 500, say) is an allocation decision in the settings file, not something the score decides.

**Sector and thematic funds** sit in one AMFI category across unrelated themes (a pharma fund beside an infrastructure fund), so category percentiles mean nothing. They take the stock lens instead: trend and relative strength of the fund's NAV, the Legacy-style exit test (a close below the 200-day average or the last major swing low) and cost. Verdicts are Keep or Exit only; they are not on the fund shortlist, and the allocation caps in section 8 limit their total.

**Gates (a fund must pass all to be shortlisted).** Direct plan only; at least 5 years of NAV history for active funds (3 for a category younger than 5 years), and one to two years of tracking history for index funds and ETFs, since tracking is observable quickly and a cheaper new fund on the same index must be able to enter; assets under management above a floor set per category; no pending merger or wind-up; for ETFs, traded volume and premium or discount to NAV inside set limits. A held fund that fails a gate gets a flag, not an automatic Exit.

**Score for active funds (0 to 100, weights in `settings/funds.json`, starting values):**

| Component | Weight | Measured as |
|---|---|---|
| Consistency | 30 | share of rolling 3-year windows in which the fund beat its benchmark (total-return series) and the category median |
| Excess return | 25 | 3 and 5 year annualised return over benchmark, after costs |
| Downside | 15 | maximum drawdown and downside capture against the category |
| Risk-adjusted return | 15 | return per unit of volatility over 3 years |
| Cost | 15 | direct-plan expense ratio against the category median |

Each component is a percentile rank within the peer group, so the score is relative. Manager tenure and manager changes come from scheme documents and are a flag, not points. The three return-based components share one return series and are highly correlated, so the effective weight on past return is closer to 70 than the table shows, and the back-test reports it. A peer group below a minimum size (10 funds, a setting) gets a score shown but no Replace.

**Score for index funds and ETFs:** tracking difference (1 and 3 years, weight 60; it already contains the expense ratio, so cost is not counted twice), tracking error (25), and size and liquidity (15, for ETFs: volume and premium to NAV). Expense ratio is a tie-break and a flag only. Index funds are never scored on beating the market. Among funds on the same index, the best score is also the lowest all-in cost.

**What the score is, and is not.** Past fund returns persist only weakly, so the score is mainly a filter for cost and consistency, not a forecast. That is why the default core of the allocation leans on index funds and the active-fund score is used to remove poor funds and to choose between close candidates. The weights and margins are fixed and logged before the first verdict (section 2), and a back-test is run over the available history to check whether the top-quartile score predicted a better next-year category rank; the pass criterion is fixed with the weights before the test: the prior-year top-quartile score must beat the category median in the following year in at least 60% of the annual test points, over at least five annual points, with the number of funds and test points reported (proposed thresholds). If it fails, Replace verdicts stay switched off and the score is used only for the gates and for cost; the weights are not tuned until it passes. Scores cover funds live today, so funds that closed or merged are missing from history (survivorship bias); the back-test states this.

**Data (each metric shows source and as-of date):** NAV history and scheme category from AMFI; expense ratios from AMFI and AMC disclosures; assets under management from AMFI monthly data; benchmark total-return series from NSE Indices, BSE Indices or CRISIL depending on the category (availability of history to verify); the fund-to-benchmark map and the total-return source per index family are a named phase-3 deliverable, and the back-test is a gate, so no fund verdict is shown until it has run; rolling returns, drawdown, capture and tracking difference are computed by the system from these, not taken from third-party ratings. Computed monthly, on the first run after month end, and on every upload.

**Verdicts for held funds** (evaluated in this order, the first that fires wins, the others are logged as "also true"):
1. **Exit**: a structural reason: mandate or category change, assets down more than 50% over 12 months net of market moves (a setting), or a merger notice, manager change followed by underperformance, an index fund whose tracking difference is worse than the best fund on the same index by more than the margin for the set number of months.
2. **Replace**: the fund is in the bottom quartile of its peer group for the set number of consecutive monthly reviews, or a shortlisted fund beats it by more than the score margin for that long. The verdict names the replacement and shows the switch cost: tax on the sale (from the ledger, using the person's remaining exemption and losses), any exit load, and the break-even in months. If a long-term date or the end of an exit-load window falls within N days, the verdict reads "Replace after <date>", a dated action (the sale-after modifier of section 4); ELSS lock-in applies.
3. **Watch**: the score has dropped or a gate failed, but the persistence rule is not met. No action; shown so it is not a surprise.
4. **Keep**: everything else.

The persistence rule (a verdict must hold for a set number of monthly reviews, or rest on a structural reason) is the hysteresis from the start of this section. Hysteresis stops a fund flipping every month, which would cost tax and charges.

**The fund shortlist.** For each asset class that is underweight, or that holds a fund with a Replace or Exit verdict, the system lists the top 3 funds that pass the gates, ranked by score, each with its score breakdown, cost, size and the tax cost of any switch. A name enters or leaves the shortlist only after it has been in or out of the top 3 for two consecutive monthly reviews. New-money sizing (section 8) draws its funds from this shortlist. Fund overlap and look-through risk (phase 8) refine the shortlist later; until then a note warns that two shortlisted funds in one class may hold the same stocks.

### 9.2 Rebalancing suggestions

The system suggests a rebalance whenever one of these happens, and otherwise says nothing:
- an asset class drifts outside its band (checked monthly and on every upload);
- a new upload adds money, so new money is routed first;
- a fund gets an Exit or Replace verdict;
- the owner changes an allocation input, or the horizon glide moves a target by more than the band;
- a drawdown breach (this raises a review, never a sale).

**How a suggestion is built.** It is a dated action list, never an order:
1. New money goes to underweight classes first, from the fund shortlist.
2. If drift remains outside the band, sales come only from the Long-term and Legacy books (never the Swing book, which has its own exit under the Engine Rules, and never ELSS units inside their lock-in), in this order: Legacy names with an Exit verdict and funds with an Exit or Replace verdict (both are already sales); then lots that are cheapest to sell, meaning loss lots, then long-term lots within the person's unused exemption, then other long-term lots, then short-term lots; and never a lot inside its exit-load window unless the saving is larger than the load.
3. Each line shows the account, the units, the estimated tax, the charges, and the rule behind it. Which person's account sells follows section 5 (cross-person only where the source of capital allows it).
4. A suggestion is skipped when the trade is below a minimum size or when its cost exceeds a set share of the trade. At most one rebalance suggestion per asset class per quarter unless drift passes twice the band.

The suggestion is decision support; execution is manual, and the ledger records the result on the next upload. Bands, minimum trade size and quarterly cap are in `settings/allocation.json` and reviewed before use.

## 10. Where the parser runs, and where personal data lives

**Decided 11 Oct (owner): files are uploaded on the dashboard (an Upload tab), not to git. The upload tool lives in the dashboard.** The parser is repo code (TypeScript in `src/`, with tests) and the Pages build ships it inside the dashboard, so the same code is tested in CI and runs in the browser.

1. **In the browser.** The owner picks an export on the Upload tab. The page reads the file locally, drops PAN, mobile number, client code and folio numbers, and parses it into identifier-free transactions. The raw file never leaves the browser.
2. **Identifier gate, twice.** The page refuses to send if its own output still matches a PAN pattern, a mobile number or the client code. The check is **field-aware**: it matches PAN and mobile patterns on whole fields only and skips fields the schema declares numeric, because exchange order ids are long numeric strings and quantities or values can contain ten-digit substrings (a blanket ten-digit rule would reject every valid payload). The check also covers the **file name**, which on some brokers' tradebooks carries the client code. The server-side function repeats the same check and rejects the payload if it fails.
3. **Save.** The page posts only the clean transactions, with the holdings statement's clean snapshot, to a Cloudflare Pages Function behind the same Access rule. The function commits them to the private repo under `data/portfolio/inbox/`, which starts the Actions workflow. The workflow merges by exchange order id, runs the corporate-action step, the reconciliation gate and the tax view, and commits the ledger.
4. **Write path.** This replaces the earlier rule that the dashboard holds no write token: the page still holds none, but the function holds one, a GitHub fine-grained token limited to this repo with contents write, kept as a Cloudflare secret. The function writes only under `data/portfolio/inbox/`, accepts only requests whose Access token is valid, and takes a payload size limit. The function **verifies the Cloudflare Access JWT** (the `Cf-Access-Jwt-Assertion` header) against the Access public keys and the application audience, not merely the presence of a header, and the Access policy is confirmed to cover the function's route; both have tests. The token's contents-write scope is repo-wide; the restriction to `data/portfolio/inbox/` is enforced by the function's code. Fine-grained tokens expire, so a rotation date is kept and checked. Merges into the ledger happen in the workflow, never in the function.
5. **Upload tab ships only when** Access is in place and tested (section 12), the function's path and identity checks have tests, and the gate has fixture tests with fake PAN, mobile and client-code patterns. **Access must also cover preview deployments and the `pages.dev` subdomain, not just the production domain** (Pages creates a preview URL for every branch deployment, and Access policies for Pages do not cover previews unless that is switched on); a test fetches a preview URL unauthenticated and expects a redirect to the login. The identity provider requires a second factor, since the Access policy is the only thing between the ledger and the internet. Two uploads at once can race on the inbox commit, so the function retries on a SHA conflict and the workflow runs under a concurrency group that serialises it.

**Browser bundle.** The page needs an xlsx reader. It is a vendored, version-pinned library, reviewed and with no network access at run time; a hand-written zip-and-XML reader is not worth its risk. The bundle size and the supply-chain choice are named here. **Who sees what.** The Pages build ships the ledger data to the browser behind Access, so every viewer with Access sees the whole household. That is the intent; the Access policy lists exactly two identities, confirmed before the personal tabs ship.

Closed risk: identifiers never reach git, Actions logs or the function's logs. Open risk: a bug in the strip step could let one through; the two gates are the control. Anyone whose files are uploaded agrees before they are uploaded.

Raw files with identifiers never reach git. PAN, mobile number and client code are dropped at parse, and folio numbers are replaced by per-person aliases, and never reach the ledger, the repo or a log. Owner names are replaced by role tags in the ledger and appear only in the dashboard's access-controlled configuration.

## 11. Uploads

Start with one broker's exports. If they work, other platforms follow, one adapter each.

| File | Covers | Frequency | Required |
|---|---|---|---|
| First-adapter broker stock order history (xlsx) | Every executed stock and ETF order: name, symbol, ISIN, buy or sell, quantity, value, exchange, exchange order id, date and time | Monthly | Yes |
| First-adapter broker mutual fund order history (xlsx) | Every purchase and redemption: scheme name, type, units, NAV, amount, date | Monthly | Yes |
| Holdings statement from each broker (current units per ISIN and per scheme) | A check on the replayed lots; never a source of data | Optional | **No. Without it the account shows "unverified"** |
| Dividend report, and fund IDCW payouts | **Optional: dividends are computed from public data (section 7.4)**; an upload only replaces a computed line | Optional | No |
| Broker stocks P&L, per financial year | Realised gains and charges, to check section 6 | Once, then yearly | Optional; a cross-check only |
| One or two contract notes per rate regime | Exact charges, to calibrate section 6 | Once | Optional; public rate tables are used instead |
| **Fill-level broker tradebook CSV**, stocks and mutual funds (per financial year) | One row per fill: symbol, ISIN, date, exchange, segment, trade id, order id, quantity, price, buy or sell. No charges | Per financial year | Yes (second adapter) |
| US broker holdings export, plus order history if offered | US stocks and USD transactions, with FX rate source and date | Monthly or on demand | Only for US holdings |
| NSDL or CDSL CAS PDF | Cross-check of units across all brokers and funds | Optional | No |

**The holdings statement is an optional check, not a requirement.** The system builds holdings from the orders alone. Without a statement the account carries an **"unverified" label** and the break resolver (7.3) plus the internal checks (no negative lots, every sell matched, no unexplained quantity) are the only controls. When a statement is supplied, an upload is accepted only when the replayed open lots, **as at the statement's date and excluding orders inside the settlement window**, match it exactly, per ISIN and per scheme. Holdings reflect settled positions: a share order is pending for a day or two (T+1), and fund units arrive one to three days after the order. Anything inside the window is shown as **pending**, not as a mismatch. A mismatch is shown, with its likely cause (a missed corporate action, a missing order, an ISIN change), and nothing is accepted until it is explained. It is the strongest correctness test available and catches what the orders cannot show (an off-market transfer, a missed corporate action), so the page offers it, never demands it.

**Typical gaps in broker order exports, each with its handling.** Replaying stock orders oldest first (FIFO) gives open lots with buy dates and realised gains by financial year; mutual fund rows are checked as units × NAV against amount. Gaps to expect:

| Gap | Handling |
|---|---|
| Quantities are as at order time, not adjusted for splits or bonuses. One stock appears under two ISINs | Corporate-action step in the parser, reusing the Repo Desk's NSE circular resolver, with a typed override file as the last resort; the holdings snapshot catches what it misses |
| A sell has no matching buy (for example a demerger, or a bonus on a stock whose buy side is missing) | A bonus is resolved from the exchange announcement (nil cost); a demerger needs the company's published cost percentage, read from its notice where one exists, otherwise typed once in the override file |
| Mutual fund rows may carry scheme names only, no ISIN, folio or scheme code | Map names to AMFI scheme codes once, keep the map in the repo, flag any unmapped name |
| No charges | Section 6 |
| No dividends or IDCW | Computed from public data (section 7.4); price-only label only where a source is missing |
| Different instrument types are taxed differently | Section 7 rules table |
| The mutual fund file has no row id | De-duplicate on scheme, type, date, units and amount, and show any collision for review. Identical recurring SIP instalments on the same date are rare but possible |
| Switches and SIP instalments need a check | Checked on each upload. Standing SIPs run outside the system, so the parser infers them from recurring purchases and flags any that feed an Exit-verdict or overweight fund |
| Files carry identity details (PAN, mobile number, client code) | Removed at parse, never stored (section 10) |

**Fill-level tradebooks (a second adapter): typical findings, each with its handling.**

| Finding | Handling |
|---|---|
| The format is fills, not orders: several rows share an order id | Adapter aggregates fills by order id and date before the ledger step |
| The same file may be uploaded twice, or files may overlap | Merge by trade id makes a re-upload harmless; the upload screen says "already loaded" |
| Date ranges with no rows. Files come straight from the broker, so a missing period is treated as no trades | The page lists the covered dates and shows any gap over a few weeks as "no trades, as attested"; the holdings statement is the final check |
| IPO allotments and demerger shares are not in a tradebook | Entered from the holdings statement, the allotment record or the corporate-action step; the sells with no buy are the signal |
| Sells with no matching buy (demergers, bonuses, a split not scaling old lots, rights entitlements, IPO allotments) | The corporate-action step supplies quantity and cost for each; IPO allotments are typed once from the allotment record; the ledger never invents a cost; the holdings statement is the final check |
| Symbols renamed over time | Alias map keyed on ISIN where present, else typed once |
| Corporate actions needed before the lots are right: splits, mergers, demergers, bonuses, ISIN changes | Section 7.2 step and override file; the holdings statement catches the rest |
| No charges, no dividends | Same handling as the first adapter |
| The file name carries the client code | The page reads the file locally and the gate (section 10) checks the file name too; the name is never sent or stored |

**Mutual fund tradebooks in the same layout (segment set to MF, units as quantity and NAV as price).**

| Finding | Handling |
|---|---|
| Rows may carry the ISIN, unlike name-only fund files | Map to the AMFI scheme code by ISIN, with no name matching |
| No folio number, so tax FIFO is by ISIN within the demat account | Matches the design's per-folio rule only if there is one folio per scheme; the holdings statement confirms |
| Trade id doubles as order id; one row per instalment | Merge by trade id; a duplicate file adds nothing |
| An IDCW payout plan | Payouts are dividends, taxed at slab rate, and are not in the file; they are computed (section 7.4). The scheme category decides the tax class, to be confirmed from the scheme's equity share |
| A fund's tax class is not certain (for example a commodities or multi-asset fund) | Tax class set from the scheme's disclosed asset mix, flagged Low until checked |
| A financial year holds no rows | Either no orders that year or the file is missing; the person confirms |

**One person, several accounts.** The same instrument can appear in files from two accounts of one person. Each file's client code becomes an **account alias** (hashed and never stored in clear), tax FIFO runs per account (section 7), and the household view adds the accounts of one person.

(Replay detail from the household's real files is kept in the private repository.)

**What is stored.** The parser writes a normalised ledger of identifier-free transactions, so later uploads merge by exchange order id and a corporate action found later can re-run the lots. Closed positions stay as transactions, because brought-forward losses and re-runs need them. A reconciliation step shows what changed since the last upload (new, closed, quantity changed) before it is accepted.

### 11.1 Any platform, any layout (Decided 11 Oct, owner)

**Requirement (owner): the system parses files from any platform without a new adapter being written each time.** It works in the browser, deterministically, with no model call (a file that holds identifiers is never sent to a service). Steps:

1. **Read the container.** CSV (any delimiter and encoding), xlsx (every sheet), and later PDF text. Find the **header row** by scanning down for the first row that matches enough known column names, so preamble lines (name, client code, report title, date range) are skipped and also stripped as identifiers.
2. **Map columns by synonym and by content.** A synonym table maps names to canonical fields: instrument (symbol, scrip, stock name, scheme, security), ISIN, side (buy, sell, B, S, purchase, redemption, switch in or out), quantity (quantity, units, qty), price (price, rate, NAV, average price), value (value, amount, net amount), date and time, order or trade id, exchange, charges. Content checks confirm the mapping: an ISIN column matches the ISIN pattern, a side column holds two or three distinct values, a date column parses. A file with only value and quantity gets price = value divided by quantity; one with price and quantity gets the value.
3. **Resolve dates safely.** Detect the format by the whole column (any day above 12 settles day-first versus month-first); never guess per row. Time zones: the exchange's, stated in the profile for foreign platforms.
4. **Classify the instrument.** By ISIN prefix (INE equity, INF fund or ETF, then the AMFI and exchange masters), by US ticker pattern for US-broker files, by currency column. A mixed file is split by instrument.
5. **Check the invariants before accepting.** Quantity times price equals value within rounding; sides are consistent; no negative quantities; dates inside the stated range; the rows reconcile to a holdings snapshot where one exists. A file failing a check is rejected with the row and reason.
6. **Fingerprint and learn.** The column set's hash is stored as a **profile**. A known profile is applied silently on every later upload. An unknown layout above a high mapping confidence is accepted and shown once for a glance; below it, the page shows the proposed mapping and asks for confirmation once, then saves the profile, so the same layout is never asked about again.
7. **Account identity.** The client code, folio or account number found in the file (header lines, file name or a column) is hashed into an **account alias**; the person is asked once to name it ("Person 2, Broker B account 2"). Several accounts per person and several people are normal.

**Honest limit.** Layouts that carry no instrument identifier, or scanned images, cannot be parsed deterministically; those are refused with a clear message. Fixture tests cover every layout received so far plus synthetic variants (renamed columns, swapped column order, preamble lines, month-first dates).

## 12. Dashboard integration

Extra tabs on the existing Repo Desk page: Upload (section 10), Funds (verdicts, scores and shortlist, 9.1), Rebalance (9.2), Household (total, allocation, owner and account split), Holdings (verdicts with reasons), Legacy cleanup, New money, Allocation (the selectable inputs in section 8), Performance, Tax view per person (section 7.1: realised gains by year, set-off, carry-forward, exemption, estimated tax, Schedule CG export). The market data already on the page feeds the verdicts.

**Hosting:** Cloudflare Pages behind Cloudflare Access, deployed from the private repo, since GitHub Pages does not serve a private repo on the free plan. The project and the access rule are created in the Cloudflare account by the owner; steps to be written. The Upload tab's function also needs a GitHub token stored as a Cloudflare secret (section 10). Personal tabs must not ship until access control is in place and tested, including on preview deployments (section 10). **The dashboard build fails, and does not fall back to showing the page, if it cannot find the access configuration.** Before access control is in place the dashboard stays market data only.

## 13. Phases

1. Ledger schema; the first broker's stock and mutual fund adapters; the corporate-action step; **the any-platform file reader (section 11.1)**; the itemised charges model with its dated rates table; asset-class tags and book inference with reasons; the **holdings-snapshot reconciliation gate**; **basic performance** (XIRR per book and household against one benchmark, labelled price-only until dividends are in). The **automatic tax view** (section 7.1) and the typed corporate-action override file (section 7.2). **The break resolver (section 7.3), with the one-off back-fill of the corporate-action archive.** Tests: replay of real order files (kept private); **fixture tests for the corporate-action step**, a synthetic split, bonus, demerger and ISIN change, each with a known correct replay (the Dalal finding: one unadjusted split flipped a result from loss to profit, and the holdings gate catches a missed action but not one applied with the wrong ratio); every inferred book carries its reason.
2. Legacy cleanup: verdicts, the tax table, the Swing Desk screen. **Keep, Promote, Trim and Exit need no tax input and are built first; Harvest and the sale-after date are switched off until the rules-table rows they use are at High confidence in Appendix A (the listed-equity row already is, so they ship for listed equity with this phase),** so the largest return lever does not wait on tax confirmation. This is the largest return lever and needs only the ledger, the tax table and the screen, not the allocation engine. Includes the decision log.
3. **Fund data, scoring and verdicts:** the AMFI adapters (NAV, category, expense ratio, assets), the benchmark total-return series, the category-average job, the fund scores, verdicts for held funds, index funds and ETFs, and the fund shortlist (9.1), with the back-test. Moved up from phase 5: it needs only the ledger and these data sources, not the allocation engine.
4. Household views; reconciliation against the P&L statement and contract notes.
5. Allocation engine and its two tests.
6. **Rebalancing suggestions and new-money sizing** (9.2 and section 8): drift bands, sale order by tax cost, the dated action list.
7. Two-pool Swing Desk rules and routing, tax view (cross-person routing only for accounts whose source of capital is recorded as own income).
8. Fund overlap and look-through risk (the holdings-based adapter).
9. Fold into the Swing Desk nightly shortlist.

The dashboard's market tabs are hosted first, since they carry no personal data. **The holdings-reconciliation check is optional:** an unverified account is labelled everywhere it appears, and tax and rebalancing figures built on it carry the same label. Phase 1 also outputs the stored daily valuation series.

## 14. Open questions

Decided 11 Oct: a 20% drawdown limit on the Balanced profile, no direct stock outside the exit test, N = 60 days with the margin set before first use, identifier-free transactions stored, and cost for unmatched sells taken from the company's published apportionment or typed once.

1. ~~The liquidity buffer~~ Optional; never requested.
2. Optional uploads: holdings statements to remove the "unverified" label, IPO allotment details, any mutual fund order history, and any holdings transferred in off-market. Also the US broker export.
3. Optional: a holdings statement to remove the "unverified" label; the stocks P&L per financial year, and one or two contract notes per rate regime. The dividend report is not needed (section 7.4).
3a. (Resolved cases from the household's real files are kept in the private repository.)
4. Check the ledger's realised gains by financial year against what was reported in returns already filed (a handful of figures, no document needed). A carried-forward loss counts only if it was reported in that year's return filed on time, something the ledger cannot see.
5. Review of the starting preset weights, drift bands and caps in section 8 once drafted, and the risk questionnaire wording.
6. Other accounts or asset types (FDs, NPS) later; not in scope now.
7. **Where upload and parsing happen: decided.** On the dashboard's Upload tab, parsed in the browser, saved through an Access-protected function that commits identifier-free transactions to the private repo (section 10). The function's GitHub token is the one write credential and needs a careful setup.
8. Pre-register the scoring rule per verdict type (section 2) and the sale-after margin before the first verdict.
9. Review of the fund-score weights, gates, persistence length, score margin, drift bands, minimum trade size and quarterly cap (sections 9.1 and 9.2) once drafted into the settings files.

## Appendix A. Tax questions answered (researched 11 Oct 2026)

Each question was researched from public sources. Primary sources were not always reachable, so confidence is stated. Where confidence is not High the tool applies the conservative reading and flags it.

| # | Question | Answer used by the tool | Source | Confidence |
|---|---|---|---|---|
| 1 | Lot matching | First-in-first-out per depository account for shares, and per folio for fund units. Two PANs are computed separately because each person's account and folio stand alone | CBDT Circular 768 of 24 Jun 1998 (Income Tax Department site): first-in-first-out for demat shares, applied to each demat account separately; Circular 704 of 1995 links a sale to its contract notes. Fund units per folio: broker and AMC pages only | High for shares; Medium for fund units |
| 2 | What counts as cost | Brokerage, stamp duty and exchange levy are deductible; STT is not. GST and DP charges not confirmed, handled as in section 7 | Broker support page, no section cited | Medium to High |
| 3 | Loss harvesting | No wash-sale rule is reported, with no statute or case on same-day re-buys. The general anti-avoidance rule is understood to apply only above a ₹3 crore tax benefit (Medium, to verify). Tool re-buys at T+1 or later | Broker pages, no authority cited | Low |
| 4 | Capital moved between accounts | Gains and income on assets given to a spouse without adequate consideration are clubbed with the giver, including cash invested afterwards. Income on that income is not clubbed. Tool records source of capital per account | Tax-education pages on section 64(1)(iv) | High to Medium |
| 5 | Rules by type and date | The table in section 7. Equity STCG 20% and LTCG 12.5% above ₹1.25 lakh from 23 Jul 2024; specified mutual funds redefined from 1 Apr 2025; Budget 2026 changed buyback taxation and futures and options STT, not equity delivery or equity funds | AMC tax reckoners (Mirae, Edelweiss), post-Budget notes from a fund house and a broker | High for equity; Medium for overseas fund-of-funds and gold and silver |
| 6 | Losses | Short-term loss against any gain; long-term loss only against long-term gain; eight years; return filed on time | Tax-filing education page | High |
| 7 | Corporate actions | Demerger cost per sections 49(2C) and 49(2D); holding period of new shares counts from the originals | Broker support page | High to Medium |
| 8 | Grandfathering | Applies to equity lots bought before 1 Feb 2018 | Known rule, not re-sourced in this pass | Medium |
| 9 | US holdings | 24 months; slab rate short-term; 12.5% long-term; no exemption; SBI telegraphic transfer buying rate on the last day of the month before the month of the transaction (Rule 115), with both that and the transaction-date rate stored; Form 67 credit; TCS 20% above ₹10 lakh; Schedule FA | Investment-platform tax guide | Medium to High |

Before acting on a large trade that rests on a Medium or Low row, get one professional check of that row.
