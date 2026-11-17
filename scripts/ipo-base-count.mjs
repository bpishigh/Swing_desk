// India IPO base: COUNT ONLY (owner 18 Nov 2026: a separate IPO base with its own ticker list). No returns are read. Counts how often the desk's IPO-base geometry would have fired on the IPO list
// (data/india/ipo/list.json) from the 30th session after listing to the 250th, and how many of those names sit inside the swing scan's universe today.
// Geometry = the desk's 1ipo path (src/ingest/us-scan.ts and src/ingest/us-scan-settings.ts): base of the last 15 sessions at most 25% deep, last close within 5% of the base high, close above the 50-session average
// (or the average of the sessions available, at least 30). Breakout event = the next session trades 0.5% above the base high (setup 1ipo trigger) on at least 2x its 50-session average volume.
// Liquidity floor Rs 5 crore/day (20-session average of close x volume) at the signal. Cooldown 20 sessions per name. Windows containing a one-day move over 40% are skipped (possible unadjusted bonus or split).
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
const days = [], seenD = new Set();
for (const f of readdirSync('data/india/bhav-hist').filter((x) => x.endsWith('.json.gz')).sort()) days.push(JSON.parse(gunzipSync(readFileSync('data/india/bhav-hist/' + f))));
for (const f of readdirSync('data/india/bhav').filter((x) => /^\d{4}-\d\d-\d\d\.json$/.test(x)).sort()) days.push(JSON.parse(readFileSync('data/india/bhav/' + f)));
days.sort((a, b) => (a.date < b.date ? -1 : 1)); const D = days.filter((d) => !seenD.has(d.date) && seenD.add(d.date)), idx = new Map(D.map((d, i) => [d.date, i]));
const list = JSON.parse(readFileSync('data/india/ipo/list.json', 'utf8')).rows, seg = JSON.parse(readFileSync('data/india/segments.json', 'utf8'));
const inScan = new Set([...Object.keys(seg.industry), ...Object.keys(seg.scanExtra ?? {}), ...Object.keys(existsSync('data/india/industry-inferred.json') ? JSON.parse(readFileSync('data/india/industry-inferred.json', 'utf8')).industry : {})]);
const events = []; let names = 0;
for (const L of list) {
  const i0 = idx.get(L.listed); if (i0 == null) continue; names++;
  const h = [], l = [], c = [], v = [], dt = [];
  for (let i = i0; i < D.length; i++) { const r = D[i].rows[L.sym]; if (!r || r[0] !== 'EQ' || !(r[5] > 0)) continue; dt.push(D[i].date); h.push(r[3] > 0 ? r[3] : r[5]); l.push(r[4] > 0 ? r[4] : r[5]); c.push(r[5]); v.push(r[6] || 0); }
  let cool = -99;
  for (let t = 30; t < Math.min(c.length - 1, 250); t++) {
    if (t - cool < 20) continue;
    const n = 15, bh = Math.max(...h.slice(t - n + 1, t + 1)), bl = Math.min(...l.slice(t - n + 1, t + 1));
    const k = Math.min(50, t + 1), sma = c.slice(t - k + 1, t + 1).reduce((a, b) => a + b, 0) / k;
    if (!(c[t] > sma && (bh - bl) / bh <= 0.25 && (bh - c[t]) / bh <= 0.05)) continue;
    const t1 = t + 1; if (!(h[t1] >= bh * 1.005)) continue;
    const kv = Math.min(50, t1), av = v.slice(t1 - kv, t1).reduce((a, b) => a + b, 0) / kv; if (!(v[t1] >= 2 * av)) continue;
    const tv = c.slice(t - 19, t + 1).reduce((a, x, j) => a + x * v[t - 19 + j], 0) / 20; if (tv < 5e7) continue;
    let split = false; for (let j = t - 49 > 1 ? t - 49 : 1; j <= t1; j++) if (Math.abs(c[j] / c[j - 1] - 1) > 0.4) { split = true; break; } if (split) continue;
    events.push({ sym: L.sym, signal: dt[t], breakout: dt[t1], sessionsSinceListing: t, inScanToday: inScan.has(L.sym) }); cool = t;
  }
}
const byYear = {}; for (const e of events) byYear[e.breakout.slice(0, 4)] = (byYear[e.breakout.slice(0, 4)] ?? 0) + 1;
const out = { run: '2026-11-18', rule: 'count only, no returns read', listingsOnList: names, events: events.length, byYear, distinctNames: new Set(events.map((e) => e.sym)).size, inScanToday: events.filter((e) => e.inScanToday).length, medianSessionsSinceListing: events.map((e) => e.sessionsSinceListing).sort((a, b) => a - b)[Math.floor(events.length / 2)] ?? null, firstThirtyToHundredDays: events.filter((e) => e.sessionsSinceListing < 70).length, events };
writeFileSync('data/india/ipo/base-count.json', JSON.stringify(out) + '\n'); const { events: _, ...show } = out; console.log(JSON.stringify(show, null, 1));
