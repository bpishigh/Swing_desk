# IPO winners study — validation-ipo (2011-01-03..2018-12-31)

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
- reach2: 11%
- f60med: -0.06386732533521511
- f120med: -0.1330822924320353
- f250med: -0.23435419440745675
- trail: {"0.25":{"n":82,"mean":0.08272693554079985,"median":-0.025893553223388363,"win":0.35365853658536583,"topDecileShare":1.4387227171374477,"hold":143.7560975609756,"meanExBest":0.05540145438586024,"best":2.2960909090909087},"0.35":{"n":82,"mean":0.04087911306745083,"median":-0.03117500468427968,"win":0.32926829268292684,"topDecileShare":2.737167678205145,"hold":197.0609756097561,"meanExBest":0.013036992128889625,"best":2.2960909090909087},"0.5":{"n":82,"mean":0.024899957581666552,"median":-0.03117500468427968,"win":0.32926829268292684,"topDecileShare":4.727693615284849,"hold":290.9756097560976,"meanExBest":-0.0031394368814105134,"best":2.2960909090909087}}

## Single-feature splits at the sample median (precision across all first breakouts)

| feature | cut | low n | high n | low 2x-in-250 | high 2x-in-250 | low 5x | high 5x |
|---|---|---|---|---|---|---|---|
| rel | 54.00 | 41 | 41 | 7% | 15% | 0% | 2% |
| baseDepth | 0.10 | 41 | 41 | 12% | 10% | 0% | 2% |
| volX | 4.03 | 41 | 41 | 7% | 15% | 0% | 2% |
| rs63 | 0.18 | 17 | 18 | 24% | 6% | 6% | 0% |
| pop0 | -0.00 | 41 | 41 | 7% | 15% | 0% | 2% |
| regime green vs other | - | 61 | 21 | 8% | 19% | 2% | 0% |

## 5x+ winners and their first breakout

| symbol | listed | first breakout | sessions after listing | vs listing close | base days | base depth | vol x | RS63 | regime | peak x (from s30) | peak from entry | 250s fwd | 60s max dd |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DBL | 2016-08-11 | 2017-02-06 | 120 | 6% | 46 | 17% | 4.4 | 18% | green | 5.2 | 4.5 | 242% | -5% |

## Trailing exits (addendum 2)

| trail | trades | mean net | median net | winners | top-10% share of profit | mean hold (sessions) | mean ex best | best |
|---|---|---|---|---|---|---|---|---|
| 0.25 | 82 | 8% | -3% | 35% | 144% | 144 | 6% | 230% |
| 0.35 | 82 | 4% | -3% | 33% | 274% | 197 | 1% | 230% |
| 0.5 | 82 | 2% | -3% | 33% | 473% | 291 | -0% | 230% |
