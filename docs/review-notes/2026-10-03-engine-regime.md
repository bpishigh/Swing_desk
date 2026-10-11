# Review note: engine skeleton, regime (3 Oct 2026)

Implements: Engine Rules, "Regime traffic light" and its exact definitions (R-2026.10.2). Scope of Work phase 1 (first part of the TypeScript engine) and the Gate B replay idea, started early.

## What changed
- `src/engine/indicators.ts`: SMA, seeded EMA, ATR (simple mean of last 14 true ranges), calendar-month returns from stored closes.
- `src/engine/regime.ts`: tracker analysis (distribution days, follow-through) and the regime result, ported from v9 `analyze` / `regimeFrom` with identical behaviour.
- `tools/make-v9-golden.mjs`: runs the ORIGINAL v9 code over the exported tracker fixtures and writes `fixtures/expected/regime-v9-{india,us}.json`.
- `test/`: 12 tests. Rule tests quote the rule they assert; the replay tests compare TS against the v9 golden file row by row.

## Result
All 12 pass. Replay is exact on the fixtures.

## What this does not prove (read before trusting it)
- Only 5 of 24 India rows and 5 of 53 US rows are complete (the SMAs were only stored recently), so the replay compares 10 regime results, not months. It proves the port, not the rule.
- Both markets read Red on every complete row in the fixtures, so the Green and Yellow paths are covered by unit tests only, not by real days.
- Behaviour kept from v9 that the rules document does not state, for the reviewer to confirm or turn into change-log rows:
  1. "Rising" 50 SMA is judged against the previous row that has a 50 SMA; with no previous row it counts as not rising.
  2. A "new low" for the follow-through count is any low below the lowest low since the start of the stored series (or since the last failed follow-through reset). There is no look-back window.
  3. Follow-through status is measured in rows (tracker docs), not exchange sessions, so a missing row shortens the 10-session test.
  4. Missing 50/200 SMA on the latest row are taken from the newest of the previous 5 rows that has both (v9 note says they move little overnight).
  5. Distribution-day volume compare uses the previous stored row, even if that row is a skipped day.
- Not yet ported: sector ranking, setups and entry calculation, limits tables, journal tests, risk halving.
