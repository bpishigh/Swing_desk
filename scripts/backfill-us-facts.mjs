// US filings loader (spec step 6; Batch A US versions): SEC EDGAR company facts for the liquid US common stocks into data/us/facts/<TICKER>.json.gz, in the same quarterly shape as data/india/filings
// (src/ingest/edgar-facts.ts). Fetch is whole-file per company and idempotent: a file is rewritten only when its content changed, so the nightly run commits only new filings.
// Wanted: common stocks and ADRs, price at least the scan floor, the 600 highest by dollar volume on the latest stored day (a buffer over the 500 the books use). Needs sec.gov access (the runner, not the Claude workspace).
// --incremental (the nightly run): one small submissions call per name; the facts file is refetched only when a 10-Q or 10-K newer than the stored `latestAccn` exists, and the stored copy is replaced only once the facts carry that filing (the facts API can trail the filing by hours; a name still waiting is retried the next night and counted).
// Usage: node scripts/backfill-us-facts.mjs [--limit=N] [--only=AAPL,MSFT] [--incremental]
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { buildQuarters } from '../src/ingest/edgar-facts.ts';
import { SCAN } from '../src/ingest/us-scan-settings.ts';

const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const UA = process.env.SEC_UA || 'Swing Desk research (personal use) noreply@github.com', sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LIMIT = Number(arg('limit') ?? 600), ONLY = arg('only')?.split(','), INC = process.argv.includes('--incremental');
const R = (p, d = null) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const get = async (u) => { for (let a = 0; a < 3; a++) { try { const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(90000) }); if (r.ok) return { ok: true, j: await r.json() }; if (r.status === 404) return { ok: false, status: 404 }; if (r.status === 429 || r.status >= 500) { await sleep(3000 * (a + 1)); continue; } return { ok: false, status: r.status }; } catch (e) { await sleep(2000); } } return { ok: false, status: 0 }; };

const tk = R('data/us/' + readdirSync('data/us').filter((f) => /^tickers-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().pop());
const okType = new Set(tk.rows.filter((r) => SCAN.types.includes(r[1])).map((r) => r[0]));
const last = readdirSync('data/us/grouped').filter((f) => /\.csv\.gz$/.test(f)).sort().pop();
let wanted = [];
for (const line of gunzipSync(readFileSync('data/us/grouped/' + last)).toString('utf8').split('\n').slice(1)) { const p = line.split(','); if (!okType.has(p[0])) continue; if (+p[1] >= 5) wanted.push([p[0], +p[1] * +p[4]]); }
wanted = wanted.sort((a, b) => b[1] - a[1]).slice(0, LIMIT).map((x) => x[0]); if (ONLY) wanted = ONLY;
const sic = new Map((R('data/us/sic.json', { rows: [] }).rows ?? []).map((r) => [r[0], r[1]]));
const tickers = await get('https://www.sec.gov/files/company_tickers.json'); if (!tickers.ok) { console.error('SEC ticker file not reachable', tickers.status); process.exit(1); }
const cik = new Map(); for (const v of Object.values(tickers.j)) cik.set(v.ticker, String(v.cik_str).padStart(10, '0'));
mkdirSync('data/us/facts', { recursive: true });
const stat = { wanted: wanted.length, written: 0, unchanged: 0, noCik: [], failed: [], short: [] }; const t0 = Date.now();
for (const t of wanted) {
  const c = cik.get(t) ?? cik.get(t.replace('.', '-')); if (!c) { stat.noCik.push(t); continue; }
  const f = `data/us/facts/${t.replace(/[^A-Za-z0-9.-]/g, '_')}.json.gz`, prev = existsSync(f) ? JSON.parse(gunzipSync(readFileSync(f)).toString('utf8')) : null;
  let newest = null;
  if (INC && prev?.latestAccn) {
    const sub = await get(`https://data.sec.gov/submissions/CIK${c}.json`); await sleep(120);
    if (sub.ok) { const rc = sub.j?.filings?.recent, i = (rc?.form ?? []).findIndex((x) => x === '10-Q' || x === '10-K'); newest = i >= 0 ? rc.accessionNumber[i] : null; if (newest && newest === prev.latestAccn) { stat.unchanged++; continue; } if (!newest) { stat.unchanged++; continue; } }
  }
  const r = await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${c}.json`); await sleep(180);
  if (!r.ok) { stat.failed.push(`${t}:${r.status}`); continue; }
  const results = buildQuarters(r.j, sic.get(t) ?? null); if (results.length < 8) stat.short.push(`${t}:${results.length}`);
  if (INC && newest && !results.some((x) => x.accn === newest)) { stat.waiting = (stat.waiting ?? 0) + 1; continue; }   // facts do not carry the new filing yet: keep the stored copy and retry tomorrow
  const doc = { ticker: t, cik: c, sic: sic.get(t) ?? null, latestAccn: newest ?? results.at(-1)?.accn ?? null, results }, body = JSON.stringify(doc);
  if (prev && JSON.stringify(prev) === body) { stat.unchanged++; continue; }
  writeFileSync(f, gzipSync(body)); stat.written++;
}
stat.seconds = Math.round((Date.now() - t0) / 1000); stat.short = stat.short.slice(0, 80);
writeFileSync('data/us/facts-log.json', JSON.stringify({ at: new Date().toISOString(), ...stat }) + '\n'); console.log(JSON.stringify(stat));
