# C-66 forward check: momentum list x desk geometry (India), 18 Oct 2026

Forward test, owner-adopted 18 Oct 2026. Registered in the Engine Rules change log before running.

- Nightly (india-stocks workflow): scripts/india-scan.mjs --extras writes data/india/scan/geometry.json; scripts/momentum-forward.mjs india logs new candidates (one per symbol and setup per 20 sessions) and scores matured ones.
- Monthly: data/india/momentum/YYYY-MM.json holds the C-54 top-decile list as of the first session (October seeded from 1 Oct 2026).
- Score: buy next close, sell 21 sessions later, tiered cost, minus equal-weight market of the industry universe; moves above 60% flagged and excluded.
- Reading rule: 100+ matured entries each side (valid plus room-under-3R), momentum ahead by 1.5pp net mean and 5pp win rate, monthly-cluster t above 2.
- Nothing in scan selection or ranking changes; the site shows a "Momentum list" chip only.
