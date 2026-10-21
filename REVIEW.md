# How to review this repo

Swing Desk is a manually traded swing-trading tool (India, with a US variant). This repo is the planned move off Claude: a rules engine in TypeScript, market-data scripts, and tests. The old app v9 reference copy was removed on 21 Oct 2026. The engine is not wired into it.

## What is authoritative
- The Engine Rules doc (see its header for the rules version) is the source of truth for rules. Where code and doc disagree, the side that is latest and accurate is right (owner rule, 21 Oct 2026, C-79): check the change log and the history, then fix the other side. A copy is in `docs/ENGINE_RULES.md` (the live doc is a Claude Doc; the copy header gives the doc revision). The Code and Architecture doc is in `docs/ARCHITECTURE.md`.
- App v9 is the behaviour the engine must reproduce, except where the rules doc says otherwise (OQ-8: Red uses the Yellow setup list).

## Read in this order
0. `docs/ENGINE_RULES.md` (rules) and `docs/ARCHITECTURE.md` (how the system is meant to fit together).
1. `docs/review-notes/`, in date order. Each note: what the block does, how it was checked, what it does not prove, v9 behaviours kept that the rules text does not state.
   - engine-regime, engine-sectors, engine-setups-sizing, engine-checklist, engine-exits-journal, engine-book-legacy, engine-proposed-rules
2. `src/engine/*.ts` against the note, then `test/*.test.ts`.
3. `fixtures/README.md`, then `tools/make-v9-*.mjs` (how the golden files were produced by running v9's own code).
4. `.github/workflows/` and `scripts/` (source test, alert, privacy check).

## What to check
- Does each function do what the rule text says? Quote the rule next to the code.
- Do the tests test the rule, or only that the port equals v9? Replays prove the port, not the rules.
- Are the v9 behaviours listed under "kept that the rules text does not state" acceptable, or should they be decisions?
- Proposed rules (C-29 to C-34) are in `proposals.ts` and `book.ts` behind switches in `settings.ts`, all OFF. Numbers marked guess are untested. Check the switches really keep v9 behaviour when off.
- Privacy: nothing personal (capital, holdings, trades) may be in `data/` or `fixtures/db/` (`scripts/check-no-personal-data.mjs`).

## Run it
`npm test` (Node 22, no dependencies; 98 tests). CI runs the same on every push.

## Known limits
- Real-day replay data is thin (five complete tracker rows per market, all Red); the synthetic series in `tools/make-v9-book-golden.mjs` fills the gap for regime, not for real-market behaviour.
- Data accuracy is not yet proven: the seven-day source test (`data/source-test/`) and the ten-session parallel run are still to come.
- No order is ever placed by this tool.

## Please report
Findings as a list: file, line, rule or v9 behaviour concerned, what is wrong, and a suggested fix. Do not edit the code in the review session.

## Keeping the docs in sync
The two docs in `docs/` are copies of live Claude Docs. After any change to a live doc, re-export it (`node tools/doc-xml-to-md.mjs <read-result.json> <out.md> "<header>"`) and commit the copy with the code change. `test/docs.test.ts` fails if the rules version in `src/engine/settings.ts` and in `docs/ENGINE_RULES.md` differ.
