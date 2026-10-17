# IND-SCAN-1: India whole-market scan, definition and forward test (17 Oct 2026)

Status: settings FROZEN 17 Oct 2026 at commit of this file. Written before any test of the India scan. Changing any value restarts the forward clock and must be logged.

## What it is
The US-SCAN-1 method (relative strength gate, trend template, group strength, base quality, setups and room) run by the same code (`runScan`), with India settings in `src/ingest/india-scan-settings.ts`. Every value not listed there is the US-SCAN-1 value.

## India differences (all provisional, none tuned)
- Universe: the NSE index lists in `data/india/segments.json` (Nifty 100, Midcap 150, Smallcap 250 plus Nifty 500 members; about 500 names), top 500 by 20-day traded value. Reason: only these carry an industry, and the group step needs one. First attempt with all traded stocks left 44 of 66 template names without a group, so they could never be shortlisted.
- Floors: price Rs 20, traded value Rs 5 crore a day (same as C-54). Tag at Rs 25 crore a day.
- Groups: NSE broad industries (about 18 ranked each night). Top 4 in green and red, top 2 in yellow, as the US.
- Prices: as-of adjusted histories (`india-asof.ts`), so a split or bonus never fakes a move.
- Setups per light: `LIMITS.india` from the engine, not a copy.
- Light: `data/india/regime.json`.

## Known weakness, disclosed
The industry map is today's. It is fine for the forward log; any backtest using it carries look-ahead on group membership and must say so.

## Forward test (no historical replay is claimed)
- Output `data/india/scan/<date>.json`, written each night after the India stocks job.
- Reading rule, set now: read at 150 Ready picks or 12 months, whichever is later, exactly as US C-20b: mean 20-session excess over the Nifty 500 after tiered cost (0.35/0.50/0.80%) with a bootstrap interval excluding zero, positive in both halves, and beating the C-54 momentum baseline on the same days. Until then the scan is a candidate list, not evidence.
- Expectation from US experience: Ready is rare (US gave 11 to 52 picks in a year). The top-10 list is read as the fallback, named here in advance.
