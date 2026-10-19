# India watchlist turnover check, 19 Oct 2026 (owner question: why is the watchlist so constant?)

Diagnostic only, no rule change. `scripts/diag-watch-turnover.mjs`: replays the frozen India scan (IND-SCAN-1) over the last 60 sessions (23 Jul to 19 Oct 2026, light red as live, hysteresis warmed up 30 sessions earlier) and compares each night's shown list (ready plus watch, capped as on the site) with the previous night's. Look-aheads as in the other India replays: today's industry map.

- Shown list averages 8.5 names; about 2.9 are new each night and 5.6 are kept from the night before. Only 1 night of 60 had an unchanged list.
- Qualified set (before the display cap) averages 31 names; about 2.1 enter and 2.5 leave each night.
- 61 distinct names appeared in the window.
- On 16 and 19 Oct, 5 of 6 names stayed. That is normal for one trading day; the live India scan only has two nightly snapshots so far (the 17 Oct run used Friday's closes).
- The qualified set has been shrinking (38 on 30 Sep, 12 on 19 Oct) as the market light is red, so fewer names clear the strength and trend tests and the same few leaders stay.
