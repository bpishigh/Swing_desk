# Review note: engine, pre-trade checklist (3 Oct 2026)

Implements: Engine Rules "Entry mechanics and book rules" (checklist rules, daily cap, position cap, sector rank, open-risk cap) and the checklist lines of "Setups and entry calculation". Ported from v9 `ntChecks`.

## Result
35 tests pass (26 earlier plus 9 new). `tools/make-v9-checklist-golden.mjs` runs the ORIGINAL v9 `ntCalc` and `ntChecks` on 500 seeded inputs; the TypeScript version reproduces every checklist line, both its state (pass, fail, warn, n/a) and its exact text. The grid covers both markets (271 India, 229 US), all three lights and no light (120), 3,077 fails, 2,921 passes, 910 n/a and 246 warnings, results-date lines in 319 cases, IPO lines in 97 and ATR-floored stops in 116. Rule-level tests assert one rule each (setup allowed per light, Red path, position cap, open-risk cap, two entries a day, Yellow top 2, results gap, 2R India and 3R US room).

## Design choices to check
- The function is pure. The caller supplies the book state: open positions, money at risk in them, entries today, sector and industry counts (India counts kept legacy holdings), and weekdays to the results date. None of that is computed here yet; it comes with the trade store.
- Weekdays to results ignore exchange holidays (as in v9). The market calendar file (Architecture decision 8) will replace this; until then a holiday in the window overstates the gap by a day.
- Text is plain, no HTML escaping (v9 escaped user text for display). The app layer escapes.
- The wording "setup N isn't allowed in Yellow" is printed for a disallowed setup in any light, as in v9.

## Not covered
- Risk halving, proven-Green 1%, VIX halving (journal), the open-risk number itself, exits and the legacy book. The checks are only as good as the state passed in.
