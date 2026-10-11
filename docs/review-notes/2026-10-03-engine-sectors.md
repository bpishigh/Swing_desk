# Review note: engine, sector ranking (3 Oct 2026)

Implements: Engine Rules "Sector ranking" (gate, score 2 x 3M + 1M, rank; persistence over two weeks; new leader). Ported from v9 `computeSectors` and `sectorStatus`.

## Result
18 tests pass (12 earlier plus 6 new). The replay recomputes the saved week 2026-09-29 from its own stored inputs (3M, 1M, above-50 flags, mode, Nifty 3M) and matches every sector's pass, score and rank, since v9 stored its own outputs in the same document.

## What this does not prove
- One saved week only, in Red mode. Normal-mode gating, persistence and new-leader are covered by unit tests only.
- The ranking function takes returns and flags as given. Computing them from stored closes is in `indicators.ts` (`returnOver`) but not yet wired in and not yet compared with the values the nightly task writes.
- Kept from v9 and not in the rules text: a sector with a missing 1M but passing the gate scores 2 x 3M; a missing benchmark 3M passes nothing; "new leader" looks back over the previous 3 saved snapshots only, and a sector absent from a snapshot counts as outside the top 8.
- Not ported yet: top 4 / top 2 per light, confirmed-vs-early (200 SMA), max 2 per industry and 3 per sector (these belong with the limits tables).
