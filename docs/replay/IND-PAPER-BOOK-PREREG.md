# IND-PAPER-1: India paper book on IND-SCAN-1 (17 Oct 2026)

Status: ADOPTED 17 Oct 2026 under the owner's instruction to finish both scans (reversible: delete `data/india/paper/enabled.json`). Written before any order was logged.

It is the C-53 paper book (docs/replay/US-PAPER-BOOK-PREREG.md) run on the India scan, with the same engine (`src/ingest/paper-book.ts`), the same three chained streams (official, cap-waived, comparator), daily-close exits, the 60-session maximum hold and the same setup allowances per regime light. Nothing else changes except what is listed here.

## India differences
- Input list: the nightly IND-SCAN-1 top ten (`data/india/scan/latest.json`).
- Prices: as-of adjusted histories (`src/backtest/india-asof.ts`); splits and bonuses known after a signal rescale its levels, as the US book does.
- Costs: round-trip tiers 0.35% / 0.50% / 0.80% by 20-day traded value (Rs 100 crore or more, Rs 25 crore or more, below), the same as C-54. Statutory part checked 17 Oct against `data/rules/charges.json` (0.23 to 0.29%); the slippage part is a guess.
- Light: `data/india/regime.json`.
- Benchmark for the read: Nifty 500.

## Reading rule, set now
Top-10 log read at 300 picks or 12 months, whichever is later; the three streams read at 12 months regardless of count (as C-53). Mean R per stream after cost, with a bootstrap interval, and the excess over the Nifty 500 for the same holding windows. It is evidence for the India scan only if the official stream beats both the Nifty 500 and the C-54 momentum baseline over the same dates. No live rule changes while it runs.

## Known weaknesses, disclosed
Universe is the NSE index lists (about 500 names), so it excludes unlisted-industry names; the industry map is today's. India has circuit limits and BE-series trade-for-trade names that the US engine does not model: a stop can be gapped through, and the engine fills at the next close.
