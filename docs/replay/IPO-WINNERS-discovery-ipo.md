# IPO winners study — discovery-ipo (2020-01-02..2022-12-31)

Definitions: docs/replay/IPO-WINNERS-PREREG.md. Descriptive. Paper only.

## Counts

- cohort: {"total":383,"kept":152}
- mintv0: 30000000
- sample: 2020-01-02..2022-12-31
- ipos: 133
- w3: 21
- w5: 11
- w10: 2
- noBreakout: 44
- noBreakoutWinners5: 1
- firstBreakouts: 89
- precision5: 11%
- precision10: 2%
- reach2: 16%
- f60med: -0.01087848932676505
- f120med: 5%
- f250med: 3%
- trail: {"0.25":{"n":89,"mean":0.2481269822682941,"median":0.003635859519408492,"win":0.5168539325842697,"topDecileShare":0.8401630289133737,"hold":159.52808988764045,"meanExBest":0.19375291163793254,"best":5.033045197740113},"0.35":{"n":89,"mean":0.2821023778112007,"median":-0.004821561338289914,"win":0.48314606741573035,"topDecileShare":0.8388202948622177,"hold":255.14606741573033,"meanExBest":0.2362262299473449,"best":4.319203389830508},"0.5":{"n":89,"mean":0.3025363957743904,"median":-0.019751054852320635,"win":0.4606741573033708,"topDecileShare":0.8229872408713759,"hold":366.40449438202245,"meanExBest":0.2618847484998698,"best":3.879881355932203}}

## Single-feature splits at the sample median (precision across all first breakouts)

| feature | cut | low n | high n | low 2x-in-250 | high 2x-in-250 | low 5x | high 5x |
|---|---|---|---|---|---|---|---|
| rel | 64.00 | 44 | 45 | 11% | 20% | 9% | 13% |
| baseDepth | 0.13 | 44 | 45 | 20% | 11% | 9% | 13% |
| volX | 5.21 | 44 | 45 | 11% | 20% | 11% | 11% |
| rs63 | 0.21 | 22 | 23 | 23% | 17% | 18% | 9% |
| pop0 | 0.00 | 44 | 45 | 11% | 20% | 20% | 2% |
| regime green vs other | - | 81 | 8 | 17% | 0% | 12% | 0% |

## 5x+ winners and their first breakout

| symbol | listed | first breakout | sessions after listing | vs listing close | base days | base depth | vol x | RS63 | regime | peak x (from s30) | peak from entry | 250s fwd | 60s max dd |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| MAZDOCK | 2020-10-12 | 2020-12-09 | 41 | 14% | 1 | 4% | 2.4 | n/a | green | 12.5 | 2.3 | -32% | -52% |
| KAYNES | 2022-11-22 | 2023-02-06 | 53 | 29% | 2 | 6% | 2.0 | n/a | green | 10.3 | 8.6 | 224% | -6% |
| CHOICEIN | 2022-04-08 | 2022-09-12 | 104 | 52% | 25 | 4% | 2.9 | 20% | green | 8.3 | 1.1 | -56% | -76% |
| ANANDRATHI | 2021-12-14 | 2022-04-13 | 83 | 14% | 68 | 17% | 50.3 | 9% | green | 7.6 | 1.6 | -68% | -77% |
| PRUDENT | 2022-05-20 | 2022-09-06 | 73 | 17% | 14 | 12% | 8.8 | 8% | green | 7.2 | 4.1 | 73% | -11% |
| KALYANKJIL | 2021-03-26 | 2021-06-04 | 45 | 8% | 44 | 28% | 5.8 | n/a | green | 7.1 | 2.2 | -27% | -26% |
| BCLIND | 2021-03-04 | 2021-05-10 | 42 | 10% | 15 | 14% | 2.9 | n/a | green | 6.8 | 0.4 | -73% | -91% |
| PCBL | 2022-01-13 | 2022-08-30 | 154 | 12% | 95 | 30% | 6.0 | 18% | green | 6.1 | 4.2 | 26% | -11% |
| INOXGREEN | 2022-11-23 | 2023-07-24 | 165 | 9% | 164 | 40% | 6.1 | 40% | green | 5.9 | 3.4 | 161% | -5% |
| SARVESHWAR | 2022-12-08 | 2023-08-02 | 161 | 31% | 6 | 13% | 4.4 | 41% | green | 5.2 | 0.1 | -93% | -97% |

## Trailing exits (addendum 2)

| trail | trades | mean net | median net | winners | top-10% share of profit | mean hold (sessions) | mean ex best | best |
|---|---|---|---|---|---|---|---|---|
| 0.25 | 89 | 25% | 0% | 52% | 84% | 160 | 19% | 503% |
| 0.35 | 89 | 28% | -0% | 48% | 84% | 255 | 24% | 432% |
| 0.5 | 89 | 30% | -2% | 46% | 82% | 366 | 26% | 388% |

5x+ winners with no qualifying first breakout: IRFC 7.2x
