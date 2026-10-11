# Fixtures (exported 3 Oct 2026 from Swing Desk v9)

Purpose: known-good inputs for the replay test (Gate B) and the parallel run (Gate A). Nothing here changes unless re-exported.

## db/ (market data and regime inputs only)
Exported from the live database: `tracker` (India index days and typed breadth), `feed/latest` and `feed_hist` (India sectors, index closes `idx_closes`), `sectors`, `us_tracker`, `us_feed/latest`, `us_feed_hist` (US sector data and `closes` for SPY, QQQ and the 14 sector ETFs), `us_screen/latest`, and the `IDX_*` rows of `symbols` (index page URLs).

Deliberately left out, because they reveal what the owner holds or owns:
- collections `settings` (capital), `legacy`, `trades`, `us_trades`, `logs`, `overrides`;
- the `stocks` field of `feed`, `feed_hist`, `us_feed`, `us_feed_hist` (it is keyed by the owner's holdings);
- closes of open-trade tickers in `us_feed_hist/closes`;
- the non-index rows of `symbols`.
`scripts/check-no-personal-data.mjs` runs on every push and checks: personal JSON keys; string values that list three or more stock tickers (flags strings once did, and were scrubbed on 3 Oct 2026 after review); a deny-list of the owner's tickers kept in the `PRIVACY_DENYLIST` repository secret or a git-ignored local file, never committed; and `fixtures/app`, where only the exceptions recorded in `fixtures/app/ALLOWED_PERSONAL.json` pass. Free-text `flags` fields must be written without stock names when exported.
Stock-level replay (sizing, exits, EMAs of holdings) will use synthetic holdings written for the tests, or a local-only export that is never committed.

## scheduled-tasks/
The three prompts that are the code of today's data fill, verbatim, with trigger ids and schedules. They are exported here so the scripts can be checked line by line against them.

## app/
`swing-desk-v9.html` is the v9 app exactly as published (copied unchanged on the owner's instruction, 3 Oct 2026). It contains one hard-coded default capital figure in the `capital()` function, and its Rules tab names some stocks the owner holds; the repo is private. Both are recorded in `ALLOWED_PERSONAL.json`. A history that once held the unscrubbed `feed/latest` flags is still in git; the repo must stay private. It is the reference for the Gate B replay: `node tools/make-v9-golden.mjs fixtures/app/swing-desk-v9.html` regenerates `fixtures/expected/`.
