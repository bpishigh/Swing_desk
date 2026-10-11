# Review note: engine, setups, limits tables and entry calculation (3 Oct 2026)

Implements: Engine Rules "Setups and entry calculation" and "Position sizing and limits per market", plus the sizing parts of "Entry mechanics and book rules" (60/40 split, pilot size, 20% position cap). Ported from v9 `SETUPS`, `LIMITS`, `LIMITS_US`, `ntCalc`.

## Result
26 tests pass (18 earlier plus 8 new). `tools/make-v9-ntcalc-golden.mjs` runs the ORIGINAL v9 `ntCalc` on 400 seeded random inputs (all five setups, all lights and no light, with and without ATR/close/resistance, five sector situations, bottom-up flag, three capital levels, four risk levels); the TypeScript version matches on every output field. Hand-computed examples cover trigger, limit, ATR floor, 60/40 sizes, targets and room.

## Design choices to check
- `ntCalc` takes `riskBase` as an input. In v9 the risk passed through `currentLimits()` (proven-Green 1%, VIX above 20 halving, risk halving after losses or drawdown). Those adjustments are NOT ported yet; they need the journal and the drawdown rule. Until then the caller supplies the adjusted number.
- `LIMITS` still holds the v9 Red rows. Engine Rules OQ-8 says v10 changes Red to pilots only; that is a deliberate later change, to be made with its own test.
- The checklist (`ntChecks`: open-risk cap, daily entry cap, sector and industry counts, results gap, price bands, IPO age) is not ported yet. `cap` in `LIMITS` is the open-risk cap for new trades, not a position cap.
- Kept from v9: a stop floored by ATR is not itself checked against the setup's max stop here; that comparison lives in the checklist.

## Not covered
- Exits, trailing rules, journal tests, equity curve, risk halving, legacy book. The replay proves the port of one function against v9 on synthetic inputs, not that the rules themselves are right.
