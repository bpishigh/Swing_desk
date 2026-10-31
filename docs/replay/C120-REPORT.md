# C-120: the 200-day cash rule on its own

Price-only index returns; cash earns 0%. Same dates for rule and buy-and-hold.

## india 2011-01-04 to 2025-10-16
- Rule 153.7% vs buy-and-hold 373.3%; in the index 71.0% of sessions; 26 switches
- Worst fall: rule -24.6% vs buy-and-hold -38.3% (cut 35.8%)
- Years within 3 points or better: 6 of 15
- Conditions: {"fallCutAtLeastThird":true,"returnAtLeast80pct":false,"halfOfYearsWithin3":false} -> FAIL
- Side note, cash earning interest: rule 213.2%
- By year (rule / buy-and-hold): 2011 -11.9%/-27.6%, 2012 2.3%/31.6%, 2013 -2.8%/3.6%, 2014 37.8%/37.8%, 2015 -4.4%/-0.7%, 2016 6.9%/3.8%, 2017 26.6%/35.9%, 2018 -8.9%/-3.4%, 2019 -6.7%/7.7%, 2020 19.9%/16.7%, 2021 30.2%/30.2%, 2022 -8.4%/3.0%, 2023 20.1%/25.8%, 2024 15.2%/15.2%, 2025 -0.8%/5.3%

## us 2018-01-03 to 2025-10-31
- Rule 36.6% vs buy-and-hold 152.2%; in the index 79.8% of sessions; 20 switches
- Worst fall: rule -36.9% vs buy-and-hold -34.1% (cut -8.1%)
- Years within 3 points or better: 4 of 8
- Conditions: {"fallCutAtLeastThird":false,"returnAtLeast80pct":false,"halfOfYearsWithin3":true} -> FAIL
- Side note, cash earning interest: rule 43.2%
- By year (rule / buy-and-hold): 2018 -7.9%/-7.6%, 2019 6.5%/28.8%, 2020 -5.0%/16.2%, 2021 27.0%/27.0%, 2022 -21.0%/-19.5%, 2023 7.9%/24.3%, 2024 23.3%/23.3%, 2025 10.2%/16.4%

Overall: FAIL (needs both markets).
