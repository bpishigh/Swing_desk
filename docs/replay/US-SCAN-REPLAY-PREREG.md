# US scan historical replay: pass criteria (C-51), written 16 Oct 2026 before any run

Status: CONFIRMED 16 Oct 2026 (owner: "keep" on the 150-pick minimum; the 0.30% cost stays as the analyst's figure because the owner has not supplied a different one). Nothing has been run at the time of this commit. Any change after a run makes the run void.

## What is replayed
- The scan exactly as frozen in US-SCAN-1 (src/ingest/us-scan-settings.ts at commit 0cd8f9d). No setting is changed or tuned in this run. A different setting would be a separate, logged run.
- Every stored night from the first night with 252 sessions of history (needed for the four-quarter relative strength) up to 20 sessions before the last stored day. About 230 nights (Oct 2025 to Sep 2026).
- Data: data/us/grouped, tickers-2026-10-12.json, splits.json, sic.json.
- Regime light: no history is stored. Headline run uses Yellow on every night (2 groups). A second run with Green (4 groups) is reported as a sensitivity, not judged.

## Picks
- A (headline): every name on the Ready list (setup defined) on a night. B (secondary): every name in the top-10 composite list, Ready or Watch.
- Entry: the close of the next session after the name appears. Exit: the close 20 sessions later. (Trigger fills and the nine exit rules are phase 2, not this run.)
- Non-overlapping: a ticker is counted once per 20 sessions after its entry.
- Cost: 0.30% of price per round trip (analyst), deducted from every pick.
- Benchmark: SPY over the same 20 sessions. Excess = pick return after cost minus SPY return.

## Pass criteria (all on pick set A, Yellow run)
1. Enough picks: at least 150 non-overlapping picks. If fewer, the replay is "not evaluable" for A and criterion 3 is judged on B instead, labelled so.
2. Method check (leak test): for 10 nights drawn at random (seed 20261016), the scan run on data truncated at that night gives the same Ready list and ranks as the run on the full data, for every stock with no split after that night. Any other difference fails the run.
3. Edge: the block-bootstrap 90% interval of the mean 20-session excess (blocks of 5 entry nights, 5,000 resamples, seed 20261016) excludes zero, and the point estimate is positive.
4. Stability: the point estimate is positive in both halves of the period (earlier half, later half).
5. Control: the mean excess of the picks is above the 95th percentile of 200 matched random controls (each control: the same nights, the same number of names per night, drawn at random from names that pass the price, dollar-volume and 65-session floors, same entry and exit, same cost). Seed 20261016.

## Reported, not judged
The same results with a 0.60% round-trip cost (sensitivity, because the owner's real cost is unconfirmed). Results by market type (SPY above or below its 200-day average at entry), by group, by the 12-1 and 6-month diagnostics, composite weights 60/25/15 against 100/0/0, hit rate, worst pick, and the number of picks per night.

## Known limits (stated now, not discovered later)
- The stock list is today's reference file, so names delisted before 12 Oct 2026 are missing (survivorship). The results will look better than live.
- One year of testable nights is one market. A pass here is evidence, not proof; the forward log and paper book continue.
- No earnings-date check, dividends or trigger fills are modelled in phase 1.

## Decision rule
All five criteria pass: record "replay supports the scan" and move to phase 2 (exit rules, trigger fills). Any fails: record which, do not tune on this data, and decide with the owner what to change; any change restarts the forward clock.

CONFIRMED: owner, 16 Oct 2026 (150 picks kept; 0.30% cost stands, with a 0.60% sensitivity reported).
