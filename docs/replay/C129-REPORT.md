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

## Replication metric against NSE's series
Not run: no NSE price series supplied (data/replay/nse-momentum30-price.csv).
