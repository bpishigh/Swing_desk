// Fails if anything committed under data/, fixtures/db or fixtures/app looks like holdings, capital or trades.
// Four checks:
//  1. personal JSON keys (capital, holdings, legacy, trades, qty, ...) in data/ and fixtures/db;
//  2. string values that list stock tickers (3 or more comma-separated tickers that are not the public sector/benchmark ETFs);
//  3. a deny-list of the owner's tickers, supplied OUTSIDE the repo: env PRIVACY_DENYLIST (a GitHub secret in CI) or the git-ignored
//     file .privacy-denylist (comma or newline separated). Never commit the list, it would itself reveal the holdings;
//  4. hard-coded capital-like figures in fixtures/app, allowed only as recorded in fixtures/app/ALLOWED_PERSONAL.json
//     (a recorded file is also exempt from the deny-list, because the v9 copy is unchanged and its Rules tab names stocks).
//  data/source-test/ is exempt from check 2 only: it logs public NSE file headers and last lines.
// Usage: node scripts/check-no-personal-data.mjs   (exit 1 on any finding)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const FORBIDDEN = /(?:^|[^A-Za-z0-9_-])"?(capital|holdings?|legacy|trades?|avgPrice|avg_price|qty|quantity|fullShares|firstShares|addShares|oneR|riskPct|stop0)"\s*:/i;
const PUBLIC_TICKERS = new Set(['SPY', 'QQQ', 'XLK', 'XLF', 'XLE', 'XLV', 'XLI', 'XLY', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC', 'SMH', 'IGV', 'ITA', 'VIX']);
const TICKER_RUN = /\b[A-Z][A-Z0-9&-]{1,14}(?:, ?[A-Z][A-Z0-9&-]{1,14}){2,}\b/g;
const ALLOW_FILES = new Set(['README.md']);

export function tickerRuns(text) {
  const out = [];
  for (const m of text.matchAll(TICKER_RUN)) {
    const toks = m[0].split(/, ?/);
    if (toks.some((t) => !PUBLIC_TICKERS.has(t))) out.push(m[0]);
  }
  return out;
}
export function loadDenylist(env = process.env, file = '.privacy-denylist') {
  const raw = (env.PRIVACY_DENYLIST || '') + '\n' + (existsSync(file) ? readFileSync(file, 'utf8') : '');
  return raw.split(/[,\n]/).map((s) => s.trim().toUpperCase()).filter((s) => s.length >= 2);
}
export function denylistHits(text, deny) {
  const up = text.toUpperCase(); const hits = [];
  for (const t of deny) if (new RegExp('(?<![A-Z0-9&-])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Z0-9&-])').test(up)) hits.push(t);
  return hits;
}

function* files(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* files(p); else yield p;
  }
}
function main() {
  let bad = 0;
  const fail = (msg) => { console.error(msg); bad++; };
  // the repo is public: account files and the holdings book live in the separate private repo, never here
  try { const tracked = execFileSync('git', ['ls-files', 'portfolio'], { encoding: 'utf8' }).trim(); if (tracked) fail('tracked files under portfolio/ (personal data belongs in the private data repo): ' + tracked.split('\n').slice(0, 3).join(', ')); } catch { /* not a git checkout */ }
  const deny = loadDenylist();
  if (!deny.length) console.warn('note: no PRIVACY_DENYLIST set, ticker deny-list check skipped (set the secret in CI)');
  for (const root of ['data', 'fixtures/db']) {
    if (!existsSync(root)) continue;
    for (const p of files(root)) {
      if (ALLOW_FILES.has(p.split('/').pop())) continue;
      const text = readFileSync(p, 'utf8');
      const m = text.match(FORBIDDEN);
      if (m) fail(`personal-data key "${m[1]}" in ${p}`);
      if (!p.startsWith('data/source-test/')) for (const run of tickerRuns(text)) fail(`ticker list "${run.slice(0, 60)}" in ${p} (looks like holdings)`);
      for (const t of denylistHits(text, deny)) fail(`deny-listed ticker ${t} in ${p}`);
    }
  }
  // fixtures/app: only the recorded exceptions
  const allowFile = 'fixtures/app/ALLOWED_PERSONAL.json';
  if (existsSync('fixtures/app')) {
    const allowed = existsSync(allowFile) ? JSON.parse(readFileSync(allowFile, 'utf8')) : [];
    for (const p of files('fixtures/app')) {
      if (p === allowFile || !/\.(html|js|json|md)$/.test(p)) continue;
      const text = readFileSync(p, 'utf8');
      const found = text.split('\n').filter((l) => /capital[^\n]{0,160}[^\d.]\d{6,}(?![\d.])/i.test(l)).length;
      const rule = allowed.find((a) => a.file === p);
      const expect = rule ? rule.count : 0;
      if (found !== expect) fail(`${p}: ${found} capital-like figure line(s), recorded exceptions allow ${expect}`);
      if (!rule) for (const t of denylistHits(text, deny)) fail(`deny-listed ticker ${t} in ${p}`);
    }
  }
  if (bad) process.exit(1);
  console.log('data/, fixtures/db and fixtures/app clean');
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file://').href) main();
