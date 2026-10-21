# Portfolio save: Cloudflare steps (owner)

The Portfolio tab saves accounts through a Cloudflare Worker route (`worker.ts` calling `functions/api/portfolio.ts`; the dashboard is a Workers static-assets deploy, configured in `wrangler.jsonc`) that sits behind Cloudflare Access and commits clean transactions to `portfolio/accounts/<account>.json` in the separate private data repo `bpishigh/swing_desk_portfolio` (this code repo is public). Nothing else is written. The function checks the Access login token itself (signature, audience, expiry, allowed e-mail) before it does anything, and keeps only the transaction fields (no client code, name or PAN).

## One-time steps (about 10 minutes)
1. **GitHub token.** GitHub > Settings > Developer settings > Fine-grained tokens > Generate. Repository access: only `swing_desk_portfolio` (the private data repo; the same token is also saved as the `PORTFOLIO_TOKEN` Actions secret of the code repo so the nightly jobs can update the holdings book). Permission: Contents = Read and write (nothing else). Expiry: 1 year; put the renewal date in your calendar. Copy it once.
2. **Worker settings** (Workers & Pages > your Worker > Settings > Variables and Secrets, the runtime section, not Build). Add:
   - `GITHUB_TOKEN` (secret): the token from step 1.
   - `REPO` (text): `bpishigh/swing_desk_portfolio`
   - `TEAM_DOMAIN` (text): your Access team domain, e.g. `yourteam.cloudflareaccess.com`
   - `POLICY_AUD` (text): Zero Trust > Access > Applications > your application > Overview > "Application Audience (AUD) Tag"
   - `ALLOWED_EMAILS` (text): the e-mails allowed to save and read, comma separated (the people who should upload).
3. **Access must cover the whole address**, including the `*.workers.dev` address and any preview URLs, not only a custom domain. A push to the repo redeploys the Worker; "Retry deployment" re-runs the old commit.
4. Open the dashboard through the Cloudflare link, go to Portfolio, choose "＋ Add files", name the account, enter its owner (the person whose PAN it is), leave "Save" ticked. The status line says how many transactions were stored. Next visit the accounts load by themselves.

## What to check
- Without signing in, `/api/portfolio` returns 401 (try it in a private window).
- `portfolio/accounts/*.json` appears in the private data repo after the first save and contains no PAN, client code or name.
- If saving says "Not saved: 401", the AUD tag or team domain is wrong; "502" means the token or repo name is wrong.
- Revoke the token in GitHub at any time to stop all writes and reads.
