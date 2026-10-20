# Archived one-off probes

Scripts that tested a data source once (NSE, Dhan, Massive, Tiingo, Nasdaq and the ETF holdings feeds) while the desk was being built. Their results are in `data/source-test/`. The manual workflows that ran them were removed on 20 Oct 2026 (they are in git history: `git log --diff-filter=D -- .github/workflows/probe-*.yml`); to run one again, add a small manual workflow that calls `node probes/<name>.mjs`. `scripts/probe-circ.mjs` and its workflow stay, because reading one NSE circular on demand is still useful.
