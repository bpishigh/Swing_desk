# Review note: OQ-8 and the Proposed rules C-29 to C-34 (engine block 7)

Files: `src/engine/settings.ts`, `proposals.ts`, changes in `setups.ts`, `book.ts`, `checklist.ts`, `journal.ts`; `test/proposals.test.ts`.

## OQ-8 (a rule, so it is ON)
`LIMITS.red.setups` now equals the Yellow list in each market (India 1, 1ipo, 3, 4; US 1, 1ipo, 4). Pilot size 0.25%, 2 positions, 0.5% open risk were already in the table; the RS-leader-above-own-50-SMA path was already in the checklist. `LIMITS_V9` keeps the old table so replays against v9 still run. The owner gave no preference on which list; "same as Yellow" was the recommended option and is a choice to confirm. One wording change: the checklist said "isn't allowed in Yellow" even for Red; it now says Red (the replay maps it back and says so).

## Proposed rules (all OFF in `DEFAULT_SETTINGS.proposals`; none is a rule until tested and logged Adopted)
- C-33 US max open risk by light: the step-down 2 / 1 / 0.5 was the reviewer's suggestion; the owner decided on 3 Oct to leave US Yellow at 2%, so C-33 is Rejected and the switch stays off (live limits 2 / 2 / 0.5). Applied in `currentLimits` only when the switch is on and market is US.
- C-34 US VIX halving: mechanism only. Threshold 25 is a starting guess (India's is 20); the US feed does not yet carry a VIX field. Test in phase 6.
- C-30 pending orders in open risk: `pendingRiskRs(planned)` = full size x (trigger - stop); `ntChecks` reads open + pending + this trade vs cap when `pendingRiskRs` is passed. Not passed = v9 check.
- C-29 correlation guard: my reading of the proposal, to confirm. Correlation of daily close-to-close returns over the last 63 common dates between sectors that hold open risk; sectors above 0.8 link (transitively) into groups; a group of 2+ sectors holding more than 50% of open risk breaches. Single-sector concentration is left to the 3-per-sector rule. Too little history gives "unknown", never "uncorrelated". The proposal says "3-month returns correlate": I used daily returns over 3 months because correlating one 3-month return per sector is not possible. Challenger (60-day per stock, flag above 0.75) is `stockCorrelationFlags`.
- C-31 second Journal tier: 100 closed trades, expectancy after costs above 0, profit factor, drawdown limit. Profit factor 1.5 and drawdown 15% are starting guesses (the proposal said "not set"). Costs come from a new optional `Trade.costs`; unrecorded counts as 0 and `costsRecorded` shows how many trades had it.
- C-32 intraday MAE/MFE: from daily low and high, bars after the entry date through the exit date (entry-day bar excluded because the fill time is unknown). Needs the whole-market daily high/low store, which does not exist yet.

## What it does not prove
All numbers marked guess are untested. There is no v9 replay for the proposals (v9 does not have them); tests quote the rule text and use hand-built cases. Nothing here is wired into the desk.
