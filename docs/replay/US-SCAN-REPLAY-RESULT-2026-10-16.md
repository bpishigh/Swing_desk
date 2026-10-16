# US scan replay result (C-51), run 16 Oct 2026

Run exactly as pre-registered (docs/replay/US-SCAN-REPLAY-PREREG.md, commit bacb1e4). Script: scripts/replay-us-scan.mjs. Outputs: data/replay/us-scan-replay-*.json. 229 nights, 16 Oct 2025 to 15 Sep 2026, US-SCAN-1 unchanged, 20-session hold, 0.30% round-trip cost, SPY benchmark.

## Criteria (headline run: Yellow, weights 60/25/15)
1. Enough picks: FAIL. Ready names gave 11 non-overlapping picks (needed 150). Judged on the top-10 list (set B, 330 picks) as pre-registered, labelled the weaker test.
2. Leak test: PASS. 10 seeded nights, no differences. (A side finding: a full-data build that applies splits dated after the night does change the list on some nights, for example 27 and 29 Oct 2025, through the $10 price floor and cross-sectional ranks. The replay uses the real-time build, which matches a past-splits-only build on all 10 nights.)
3. Edge: FAIL. Mean 20-session excess over SPY after cost +0.60%; 90% interval -1.86% to +3.12%, includes zero.
4. Both halves positive: FAIL. Earlier half +3.2%, later half -1.8%.
5. Beats random control: PASS. Picks +0.60% against a control 95th percentile of +0.14%.

Result: 2 of 5 pass. Per the decision rule, the replay does not support the scan as designed. No tuning on this data.

## Reported, not judged
- Ready (set A): 11 picks in 229 nights (0.05 a night), mean excess +0.75%, hit rate 45%, worst -11.2%. Too few to read anything. The base test (ATR10/ATR50 below 0.7 with the pivot within 5%) is almost never met.
- Top-10 list (set B): 1.4 picks a night, hit rate 48%, worst pick -44.8%. SPY above its 200-day average at entry: 314 picks, +0.71%. Below: 16 picks, -1.55%.
- Cost sensitivity: at 0.60% round trip, set B mean +0.30%.
- Green run (4 groups): Ready 48 picks (+2.4%); set B 515 picks, +0.88%, interval -1.36% to +3.19%, earlier +2.9%, later -1.1%.
- Weights 100/0/0: set B 205 picks, -0.57%, earlier +5.2%, later -5.7%. Not better than 60/25/15.
- Largest groups in B: Semiconductors and components 106 picks (+0.5%), Metal mining 76 (+3.7%), Communications equipment 44 (-0.3%), Computer hardware 30 (-1.2%).

## Limits
Today's reference list leaves out delisted names (flatters results). One year is one market, and the regime light was fixed rather than historical. Entry at the next close, no trigger fills, no exit rules, no earnings check.
