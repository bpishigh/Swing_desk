# C-126: stop-width cap at 1.5 times, portfolio against the index

0.5% risk per trade, at most 5 open, live exits, costs inside R. Index is price only.

## India 2011-2019: FAIL

| | Trades | Mean R (90%) | Taken / skipped | Portfolio | Max fall | Index | Years positive |
|---|---|---|---|---|---|---|---|
| current cap | 35 | -0.14 (-0.50 to +0.32) | 35 / 0 | -2.4% | -4.2% | 120.5% | 3 of 8 |
| wider cap | 105 | -0.19 (-0.35 to -0.02) | 103 / 2 | -10.3% | -11.0% | 120.5% | 4 of 9 |

Conditions (wider cap): {"meanRAboveZero":false,"ciLowAboveZero":false,"atLeast100Trades":true,"beatsIndex":false,"twoThirdsYearsPositive":false}

## US 2018-2025 (survivor-biased upward): FAIL

| | Trades | Mean R (90%) | Taken / skipped | Portfolio | Max fall | Index | Years positive |
|---|---|---|---|---|---|---|---|
| current cap | 78 | -0.13 (-0.36 to +0.07) | 76 / 2 | -7.2% | -9.8% | 147.1% | 2 of 8 |
| wider cap | 195 | -0.13 (-0.28 to +0.03) | 169 / 26 | -9.2% | -9.5% | 147.1% | 3 of 8 |

Conditions (wider cap): {"meanRAboveZero":false,"ciLowAboveZero":false,"atLeast100Trades":true,"beatsIndex":false,"twoThirdsYearsPositive":false}

## India 2021-2026 (reported; exits to 2025-12-31 only, the index file ends there): FAIL (not judged)

| | Trades | Mean R (90%) | Taken / skipped | Portfolio | Max fall | Index | Years positive |
|---|---|---|---|---|---|---|---|
| current cap | 36 | +0.51 (-0.26 to +1.34) | 36 / 0 | 9.0% | -3.4% | 75.9% | 3 of 5 |
| wider cap | 121 | +0.32 (+0.00 to +0.65) | 110 / 11 | 18.2% | -4.5% | 108.5% | 3 of 5 |

Conditions (wider cap): {"meanRAboveZero":true,"ciLowAboveZero":true,"atLeast100Trades":true,"beatsIndex":false,"twoThirdsYearsPositive":false}

Judged markets (India 2011-2019 and US): FAIL
