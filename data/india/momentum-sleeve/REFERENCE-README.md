# Monthly reference lines (added by hand)

`reference.json` holds two lines the nightly job cannot fetch: Nifty 200 and an index-fund NAV. Add one entry after each month-end, keyed by the same month as the sleeve board (YYYY-MM):

    { "2026-11": { "nifty200": 12345.67, "fundNav": 12.3456 } }

- `nifty200`: the month-end close of the Nifty 200 price index.
- `fundNav`: the month-end NAV of the Nifty 200 Momentum 30 index fund (direct plan). State in the entry that dividends are not added back; the board compares it with the sleeve, which is price only.
- Missing months are shown as blank. The first entry is due after the 30 Nov 2026 month-end.
