# Review note: book numbers, legacy book, today's limits (engine block 6)

Files: `src/engine/book.ts`, `src/engine/legacy.ts`, `test/book.test.ts`, `tools/make-v9-book-golden.mjs`, `fixtures/expected/book-v9.json`.

## What it does
- `openRiskRs`: held shares x (average cost - stop), floored at 0 per trade; trades with no stop count 0.
- `bookCount`: India = open + kept legacy + unchecked legacy (10-stock target); US = open trades only.
- `currentLimits`: light limits with three risk adjustments in this order: proven Green = 1% (India only, Journal Test pass), VIX above 20 halves (India only), risk halving state halves (both). Stale flag when the regime date is not today.
- `pickRegime`: tracker result if complete, else saved regime for today, else latest saved.
- `regimeDroppedToday` / `trackerDropped`: tracker based (regime level fell versus previous row, both complete), else saved-regime comparison.
- `legacyPrice`, `legacyGiveBack`, `legacyAdvice`: kept holdings' give-back, and the per-holding advice text (stop = higher of stop, 10-week average, swing low; give-back above 1% tighten or trim; above 20% of capital trim; sector above 3).

## How it was checked
Replay against the original v9 functions (run in node `vm`): 700 holdings (text, price, gain, give-back %), 250 books (give-back, open risk, book count both markets), 300 synthetic desks over a 260-row synthetic tracker (limits with every adjustment combination, regime drop). 64 tests pass.
The synthetic tracker series also exercises `regimeFrom` over long histories, which the real fixtures (5 complete rows each) could not.

## What it does not prove
- Rules text only: replays prove the port equals v9, not that v9's rules are right.
- Legacy advice replay compares text, price, gain and give-back %, not the HTML layout (that stays in the app).
- India price-band and lower-circuit checks live in the checklist port (already reviewed); v9 has no further automatic circuit or corporate-action logic (GTT re-placement on ex-date is an instruction only).

## v9 behaviours kept that the rules text does not state
- Give-back and advice treat a typed price of 0 as missing (v9 uses `num(price)||num(close)`).
- Ordering of adjustments: halving applies after the VIX halving, so both can stack (1% -> 0.5% -> 0.25%).
- The legacy 3% budget is only reported (tile and give-back figure); nothing here blocks entries. v9 shows it in the checklist via the caller.

## Not implemented by design (still Proposed)
OQ-8 Red to pilots only, C-29 correlation control, C-30 pending orders in open risk, C-33 US open-risk cap by light, C-34 US VIX analogue.
