# Backtest run manifest (C-69)

`manifest.json` records every registered test: change-log id, hypothesis, parameters, fit and holdout windows, the pass rule, a fingerprint of the data, the result and, if there is a holdout, whether it has been revealed. Tests before C-69 (C-59 to C-68) were registered only in the Engine Rules change log; the manifest starts with the first test registered through it.

Workflow for a test: (1) add its row to the change log and re-export the Engine Rules; (2) `node scripts/backtest-manifest.mjs register --file=spec.json` (refused without a change-log row, a written pass rule and sane windows; `"exploration": true` is allowed and labelled `-x`); (3) run the script; (4) `result`; (5) if the fit window passes its rule, one `reveal` of the holdout with a reason, then record that too. A second attempt at the same change-log id is a new registration, and the attempt count is quoted beside any number taken from it.

Code: `src/backtest/manifest.ts` (rules, tested in `test/manifest.test.ts`), `src/backtest/india-loader.ts` (the shared data), `src/backtest/desk-sim.ts` (live exits), `src/backtest/india-asof.ts` (as-of view).
