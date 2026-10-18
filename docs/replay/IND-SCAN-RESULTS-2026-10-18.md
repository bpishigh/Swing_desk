# C-63 India scans x results replay (18 Oct 2026)
Registered in the change log before running. Script `scripts/replay-ind-scan-results.mjs`; outputs `data/replay/ind-scan-results.json` and `ind-scan-results-picks.json`.
Replay of the frozen India scan (IND-SCAN-1, `runScan`) on 1,405 nights, Jan 2021 to Sep 2026, as-of data, light fixed to green. Buy the next close, sell 20 sessions later, tiered cost, no desk stops or targets. A name enters at most once per 20 sessions. Limits: realised results dates (perfect calendar), today's industry map, green light throughout.

| Pool A (Ready + Watch), 2,008 entries | n | Net | Wins | Market |
|---|---|---|---|---|
| All picks | 2,008 | +2.80% | 53% | +0.85% |
| Results 1 to 5 sessions away | 164 | +3.99% | 52% | |
| 6 to 10 away | 134 | +2.48% | 52% | |
| 11 to 20 away (inside hold) | 270 | +1.28% | 48% | |
| 21+ away or none | 1,405 | +3.00% | 54% | |
| 1 to 20 sessions after results, reaction >= +2% | 273 | +3.35% | 59% | |
| Everything else | 1,735 | +2.71% | 52% | |

H1 (results gate): near-results minus rest +0.60 pp, wins -0.6 pp, t 0.77: not supported as a return filter. Risk (post hoc): near-results picks spread wider (sd 18.4% vs 13.4%; losses over 10% in 18.5% vs 12.8%; gains over 10% in 28.5% vs 23.1%). The gate is a risk control, not a return protector.
H2 (entry after strong results): +0.63 pp net, +7.0 pp wins, t 1.30: fails the registered bars; sign flips by year.
Pool B (all qualified, 2,843 entries): H1 -1.05 pp (t -0.18), H2 +0.59 pp (t 1.77).
By year (pool A): 2021 +6.8, 2022 +1.9, 2023 +5.2, 2024 +2.1, 2025 -1.0, 2026 +1.2.
