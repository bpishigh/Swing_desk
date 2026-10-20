# C-70 holding period, India, 20 Oct 2026

Registered in the change log and the run manifest (C-70-r1, attempt 1 of 1) before running. Script: `scripts/replay-ind-holdperiod.mjs`; output `data/replay/ind-holdperiod.json`. Entries are the C-65 momentum-list names (monthly list, regime on, bought at the next close, tiered cost), restricted to entries with 120 sessions of data after them: 1,798 trades, of which 931 in the fit window (entries to 31 Dec 2023). The holdout (867 trades) stayed hidden because neither fit rule passed. Disclosure: the entries were seen in C-65; the new variable is hold length.

| Fit window, net of cost | Hold 20 | Hold 60 | Hold 120 | Live exits (60 cap) |
|---|---|---|---|---|
| Return a trade | +3.56% | +12.49% | +23.21% | +2.60% |
| Excess over market, per 20 sessions | +0.92% | +1.04% | +0.86% | |

- H1 (longer hold pays): hold 60 minus hold 20 is +0.12pp (t 0.22); hold 120 minus hold 20 is -0.06pp (t -0.11). FAIL. A longer hold earns more in total only because it sits in the market longer; per 20 sessions the edge over the market is flat at about 1%.
- H2 (live exits beat a plain 60-session hold): live minus hold 60 is -9.89% a trade (t -4.42). FAIL, and clearly. This repeats the C-65 and C-68 finding: on these names the exits give up return. Part of that gap is time in the market (the live exits are out after about 9 sessions on average), so the like-for-like reading is the per-20-session column, where there is no sign that holding longer or shorter matters.

Reading: no change. The live exits and the C-65 Parked status stand; no holding-period rule is proposed. The question this leaves open is about risk, not return (the exits cut the worst outcomes), which C-65 already scored.
