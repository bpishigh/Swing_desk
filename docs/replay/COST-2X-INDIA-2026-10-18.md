# C-67 double-cost check (India), 18 Oct 2026

Registered in the change log before running. No rule changes. `scripts/replay-ind-scan-results.mjs` and `scripts/replay-ind-setups.mjs` with `--costx=2` (every tiered cost doubled); outputs `data/replay/*-cost2x.json`. Average cost is about 0.48% a trade, so doubling removes about 0.48 pp from each trade.

| Class (C-64, desk exits) | Trades | Net per trade, base | Net per trade, 2x | Label |
|---|---|---|---|---|
| Valid (width and room pass) | 40 | +1.50% (+0.36R) | +1.02% (+0.27R) | robust; break-even cost about 2.0% a trade |
| 20 EMA pullback, valid | 28 | +2.16% | +1.68% | robust |
| 50 SMA pullback, valid | 9 | +0.58% | +0.06% (-0.06R) | sensitive |
| Breakout, valid | 3 | -1.86% | -2.36% | negative |
| Room under 3R | 429 | +0.53% | +0.07% | no margin |
| Stop too wide | 732 | +0.47% | -0.01% | cost-sensitive |

| Scan group (C-63) | Picks | Net per pick, base | 2x | Edge over market, base | 2x |
|---|---|---|---|---|---|
| A | 2,008 | +2.80% | +2.33% | +0.85% | +0.38% |
| B | 2,843 | +2.71% | +2.24% | +0.70% | +0.23% |

Reading: the narrow valid filter survives double cost; the looser classes do not. Scan picks stay positive in absolute terms, but most of their edge over holding the market is gone at double cost. Slippage (the 0.10 / 0.25 / 0.55% part) is still a guess; the path is tradebook fills against the day's VWAP.
