# Audit of the back-adjusted price leak (19 Nov 2026)
Defect: closes in the history store are adjusted backwards for later splits and bonuses, so a price LEVEL at an old date is the true price divided by every later split factor. Anything that ranks or filters on price level used the future. Returns, ratios (stop width, ATR/price, distance from a high) and volume-based figures are unaffected because the factor cancels.
## Affected (price level used)
- GROWTH-FACTORS price factor and the growth combo: rerun on raw prices, C-256 (CAGR 21.4 to 15.5 and 16.3 to 13.1; lift 2.27 to 1.50 and 1.70 to 1.50).
- GROWTH-FACTORS-US and the US anatomy: the US store has no raw prices; price legs are upper bounds (status "direction only").
- US-MULTIBAGGER-ANATOMY Part 1 and 2 (price percentile, price feature, India and US): leaky; the India precision test was rerun on raw prices (C-256; nothing kept). India Part 1 "price percentile 30" understates how un-cheap the winners really were.
- BLEND (growth combo plus trend leaders): the growth leg used the leaky price; the blend already failed the drawdown bar and the growth leg is now weaker, so the verdict (fail) stands; the 20.6% blend CAGR is superseded and not re-run.
- Eligibility floors on adjusted price (minPrice 10 or 20 in ind-base, momentum-sleeve, clenow and setups backtests, src/backtest/multibagger.ts): a later splitter looks cheaper than it was, so it is wrongly excluded; the error runs against future winners, so those results are, if anything, conservative. Not re-run.
## Unaffected
Trend leaders, HUNT-1 rules M1-M4 and the swing rules (new highs, volume, returns, no price floor), results-event study, IPO studies (first-day turnover filter uses raw), swing-setup replays (stops, ATR, room are ratios), VALUE-1 (market cap uses the raw close and filing share counts), live books (they price on the true price on the day).
## Fix going forward
Anything new that uses a price level reads the raw close (H.openRaw in scripts/lib/study-harness.mjs for India) or says plainly that it cannot.
