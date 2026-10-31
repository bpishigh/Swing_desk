# C-129 Nifty200 Momentum 30-style sleeve (methodology replication with stand-ins)

Top 200 by traded value, top 30 by score, semi-annual (June, December), no cash rule or stops, tiered costs. Price only. Stand-ins and assumptions are listed in the change log row.

Average one-way turnover per rebalance 65.3%; average holdings 30.0.

## India 2011-2019: FAIL
- 106 months 2011-02-28 to 2019-12-31. Sleeve 213.1%; Nifty 200 129.3%; Nifty 500 131.0%. Max fall -21.6%
- Mean monthly excess over the Nifty 200 0.32%, 90% interval -0.07% to 0.72%; smallest excess this sample could detect about 0.46% a month. Over the Nifty 500: mean 0.31%, interval -0.07% to 0.71%
- Years beating the Nifty 200: 4 of 9
- Diagnostic, same 30 names equal-weighted: 206.6%, mean monthly excess over the Nifty 200 0.32% (-0.12% to 0.76%)
- Conditions {"beatsIndex":true,"meanExcessAboveZero":true,"ciLowAboveZero":false,"twoThirdsYears":false}
- By year (sleeve / Nifty 200): 2011 -3.8%/-15.6%, 2012 30.1%/31.5%, 2013 4.0%/4.4%, 2014 38.6%/35.5%, 2015 18.2%/-1.9%, 2016 -4.8%/3.7%, 2017 59.4%/33.4%, 2018 -7.0%/-1.0%, 2019 4.0%/8.7%

## India 2021-2025 (reported): FAIL (not judged)
- 57 months 2021-01-29 to 2025-10-31. Sleeve 182.2%; Nifty 200 101.7%; Nifty 500 108.5%. Max fall -28.6%
- Mean monthly excess over the Nifty 200 0.73%, 90% interval -0.15% to 1.65%; smallest excess this sample could detect about 0.92% a month. Over the Nifty 500: mean 0.67%, interval -0.17% to 1.54%
- Years beating the Nifty 200: 3 of 5
- Diagnostic, same 30 names equal-weighted: 207.9%, mean monthly excess over the Nifty 200 0.89% (0.01% to 1.83%)
- Conditions {"beatsIndex":true,"meanExcessAboveZero":true,"ciLowAboveZero":false,"twoThirdsYears":false}
- By year (sleeve / Nifty 200): 2021 71.8%/30.3%, 2022 -11.0%/3.6%, 2023 48.0%/23.5%, 2024 32.4%/13.6%, 2025 -5.9%/6.5%

## Addendum, exploration, not judged: India 2011-2019
- Compounded annual: sleeve 13.79%, Nifty 200 9.84%; gap 3.94% a year, after the sleeve's own costs
- Worst relative fall against the Nifty 200 (sleeve value divided by index value, peak to trough): -16.0% from 2018-04-30 to 2019-11-29
- Costs: 19 rebalances, average 0.34% of the portfolio per rebalance, about 0.73% a year
- Gap by year (sleeve minus Nifty 200): 2011 11.8 pts, 2012 -1.4 pts, 2013 -0.5 pts, 2014 3.1 pts, 2015 20.1 pts, 2016 -8.5 pts, 2017 26.0 pts, 2018 -6.0 pts, 2019 -4.6 pts
- Without 2017 (the best year): sleeve 96.4% against Nifty 200 71.8% over the other 8 years

## Addendum, exploration, not judged: India 2021-2025
- Compounded annual: sleeve 24.39%, Nifty 200 15.91%; gap 8.48% a year, after the sleeve's own costs
- Worst relative fall against the Nifty 200 (sleeve value divided by index value, peak to trough): -20.8% from 2021-12-31 to 2023-02-28
- Costs: 9 rebalances, average 0.28% of the portfolio per rebalance, about 0.53% a year
- Gap by year (sleeve minus Nifty 200): 2021 41.6 pts, 2022 -14.6 pts, 2023 24.6 pts, 2024 18.8 pts, 2025 -12.4 pts

## Replication metric against NSE's series
- 178 months; correlation of monthly returns 0.915 (target about 0.9); mean monthly tracking difference 0.02%
