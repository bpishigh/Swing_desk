# IPO winners study — validation-ipo-adj (2011-01-03..2018-12-31)

Definitions: docs/replay/IPO-WINNERS-PREREG.md. Descriptive. Paper only.

## Counts

- cohort: {"total":365,"kept":188}
- mintv0: 30000000
- sample: 2011-01-03..2018-12-31
- ipos: 142
- w3: 15
- w5: 1
- w10: 0
- noBreakout: 60
- noBreakoutWinners5: 0
- firstBreakouts: 82
- precision5: 1%
- precision10: 0
- reach2: 12%
- f60med: 3%
- f120med: 2%
- f250med: -0.05232383808095953
- trail: {"0.25":{"n":82,"mean":0.10004466242349805,"median":-0.093071527915756,"win":0.43902439024390244,"topDecileShare":1.2628218949212522,"hold":202.71951219512195,"meanExBest":0.0729329803658757,"best":2.2960909090909087},"0.35":{"n":82,"mean":0.036897017204102364,"median":-0.1839582102152807,"win":0.35365853658536583,"topDecileShare":3.289104446055531,"hold":286.6463414634146,"meanExBest":0.009005734588215868,"best":2.2960909090909087},"0.5":{"n":82,"mean":0.0009767921979091944,"median":-0.10729824561403488,"win":0.3780487804878049,"topDecileShare":129.42913291891975,"hold":408.780487804878,"meanExBest":-0.027357949985955,"best":2.2960909090909087}}

## Single-feature splits at the sample median (precision across all first breakouts)

| feature | cut | low n | high n | low 2x-in-250 | high 2x-in-250 | low 5x | high 5x |
|---|---|---|---|---|---|---|---|
| rel | 54.00 | 41 | 41 | 10% | 15% | 0% | 2% |
| baseDepth | 0.10 | 41 | 41 | 12% | 12% | 0% | 2% |
| volX | 4.03 | 41 | 41 | 7% | 17% | 0% | 2% |
| rs63 | 0.18 | 17 | 18 | 24% | 6% | 6% | 0% |
| pop0 | -0.00 | 41 | 41 | 10% | 15% | 0% | 2% |
| regime green vs other | - | 61 | 21 | 10% | 19% | 2% | 0% |

## 5x+ winners and their first breakout

| symbol | listed | first breakout | sessions after listing | vs listing close | base days | base depth | vol x | RS63 | regime | peak x (from s30) | peak from entry | 250s fwd | 60s max dd |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DBL | 2016-08-11 | 2017-02-06 | 120 | 6% | 46 | 17% | 4.4 | 18% | green | 5.2 | 4.5 | 242% | -5% |

## Trailing exits (addendum 2)

| trail | trades | mean net | median net | winners | top-10% share of profit | mean hold (sessions) | mean ex best | best |
|---|---|---|---|---|---|---|---|---|
| 0.25 | 82 | 10% | -9% | 44% | 126% | 203 | 7% | 230% |
| 0.35 | 82 | 4% | -18% | 35% | 329% | 287 | 1% | 230% |
| 0.5 | 82 | 0% | -11% | 38% | 12943% | 409 | -3% | 230% |
