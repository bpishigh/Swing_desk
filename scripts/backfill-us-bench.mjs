// C-119 support: SPY and QQQ daily bars, about 10 years, from Nasdaq's public quote API (assetclass etf; prices split-adjusted, dividends not). Stored like the stock history:
// data/us/hist-bench/SYM.json.gz = { sym, from, to, src, bars: [date, close, high, low, volume] }. Usage: node scripts/backfill-us-bench.mjs [--from=2016-10-01]
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { nasdaqBars } from './nasdaq.mjs';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const FROM = arg('from', '2016-10-01'); mkdirSync('data/us/hist-bench', { recursive: true });
for (const s of ['SPY', 'QQQ']) {
  let g = null; for (let a = 0; a < 4 && !g; a++) { try { g = await nasdaqBars(s, 'etf', FROM); } catch (e) { console.error(s, String(e)); await new Promise((r) => setTimeout(r, 2000 * (a + 1))); } }
  if (!g || !g.bars.length) { console.error('no bars for', s); process.exitCode = 1; continue; }
  const bars = g.bars.map((b) => [b[0], b[4], b[2], b[3], b[5]]).sort((x, y) => (x[0] < y[0] ? -1 : 1));
  writeFileSync(`data/us/hist-bench/${s}.json.gz`, gzipSync(JSON.stringify({ sym: s, from: bars[0][0], to: bars[bars.length - 1][0], src: 'nasdaq', bars })));
  console.log(s, bars.length, bars[0][0], bars[bars.length - 1][0]);
}
