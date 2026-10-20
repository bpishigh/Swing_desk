# C-72 India skip days, 20 Oct 2026

Registered in the change log and the run manifest (C-72-r1, attempt 1 of 1) before running. Script `scripts/replay-ind-skipflag.mjs`, output `data/replay/ind-skipflag.json`. The engine's own `analyze()` was run over Nifty 50 close and volume, Jan 2020 to 16 Oct 2025 (1,436 sessions), with no skipped days (A) and with monthly F&O expiry, Muhurat sessions and the session after a holiday skipped (B: 145 of 1,436 sessions). Rebalancing days and ordinary half-days are not in B (no dated list is stored). Signal: 5 or more active distribution days. Outcome: the Nifty 500 over the next 20 and 60 sessions and the worst drawdown inside 60 sessions. Fit window: signals to 31 Dec 2023 (929 sessions). The holdout (387 sessions) stayed hidden because the fit rule failed.

| Fit window | A, every day counted | B, skip days excluded |
|---|---|---|
| Sessions with the signal on | 361 of 929 | 298 of 929 |
| Next 60 sessions, signal on | +6.68% | +6.42% |
| Next 60 sessions, signal off | +6.62% | +6.76% |
| Gap (off minus on) | -0.06pp | +0.34pp |
| Worst 60-session drawdown, on / off | -6.55% / -6.08% | -6.82% / -6.00% |

- B minus A on the 60-session gap is +0.40pp (paired monthly-cluster t 2.78), below the 1.0pp the rule required. A and B gave a different signal on 63 sessions. FAIL: the skip flag is not built.
- The larger finding is about the signal, not the skip days: in 2020 to 2023 the Nifty 500 did as well after sessions with 5 or more distribution days as after sessions without (+6.7% against +6.6% over 60 sessions). Only the drawdown shows a small, consistent tilt (about 0.5 to 0.8pp worse when the signal is on). One index and one regime history; this is not a test of the cap itself and no change to it is proposed.

Reading: no skip flag. The code keeps counting every day, as the US does, and the rules text ("Skipped days", India) should be changed to say so; that wording change needs the owner's approval.
