// C-52 follow-up: independent tests and stop-width distribution for template-qualified, non-extended candidates (gate off, Yellow). Counts and distributions only.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories, runScan } from '../src/ingest/us-scan.ts';
import { SCAN } from '../src/ingest/us-scan-settings.ts';
const dir = 'data/us/grouped', files = readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.csv\.gz$/.test(f)).sort();
const tk = JSON.parse(readFileSync('data/us/' + readdirSync('data/us').filter((f) => /^tickers-/.test(f)).sort().pop(), 'utf8'));
const types = new Map(); for (const [s, t] of tk.rows) if (SCAN.types.includes(t)) types.set(s, t);
const allowed = new Set(types.keys());
const days = files.map((f) => { const L = gunzipSync(readFileSync(`${dir}/${f}`)).toString().split('\n'); const rows = []; for (let i = 1; i < L.length; i++) { const p = L[i].split(','); if (p.length < 5) continue; if (allowed.has(p[0]) && +p[1] > 0 && +p[2] > 0 && +p[3] > 0) rows.push([p[0], +p[1], +p[2], +p[3], +p[4]]); } return { date: f.slice(0, 10), rows }; });
const splits = JSON.parse(readFileSync('data/us/splits.json', 'utf8')).rows;
const sic = new Map(JSON.parse(readFileSync('data/us/sic.json', 'utf8')).rows.filter((r) => r[1]).map((r) => [r[0], +r[1]]));
const diagRows = []; let prev = {};
for (let t = SCAN.quarter * 4; t <= days.length - 23; t++) {
  const hist = buildHistories(days.slice(0, t + 1), splits.filter((r) => r[1] <= days[t].date), allowed);
  prev = runScan({ hist, types, sic, light: 'yellow', prev, noTightGate: true, diagRows }).state;
}
const q = (a, p) => { const b = a.filter((x) => x !== null && x === x).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : null; };
const n = diagRows.length, cnt = (f) => diagRows.filter(f).length;
const geo = { breakoutOnly: cnt((r) => r.geoBreakout && !r.geoPull20 && !r.geoPull50), pull20Only: cnt((r) => !r.geoBreakout && r.geoPull20 && !r.geoPull50), pull50Only: cnt((r) => !r.geoBreakout && !r.geoPull20 && r.geoPull50), several: cnt((r) => [r.geoBreakout, r.geoPull20, r.geoPull50].filter(Boolean).length > 1), none: cnt((r) => !r.geoBreakout && !r.geoPull20 && !r.geoPull50) };
const test = (g, w, c, ro) => { const rows = diagRows.filter(g); return { n: rows.length, widthOverCap: rows.filter((r) => r[w] > r[c]).length, roomFail: rows.filter((r) => r[ro] !== null && r[ro] < SCAN.roomR).length, bothFail: rows.filter((r) => r[w] > r[c] && r[ro] !== null && r[ro] < SCAN.roomR).length, widthPctQ: [0.1, 0.5, 0.9].map((p) => q(rows.map((r) => r[w]), p)), atrsQ: [0.1, 0.5, 0.9].map((p) => q(rows.map((r) => r[w.replace('Width', 'Atrs')]), p)), roomRQ: [0.1, 0.5, 0.9].map((p) => q(rows.map((r) => r[ro]), p)) }; };
const okSet = (r, g, w, a, ro) => r[g] && r[w] !== null && r[w] <= 12 && r[a] !== null && r[a] <= 2.5 && (r[ro] === null || r[ro] >= SCAN.roomR);
const prop = { breakout: cnt((r) => okSet(r, 'geoBreakout', 'brkWidth', 'brkAtrs', 'brkRoomR')), pullback20: cnt((r) => okSet(r, 'geoPull20', 'p20Width', 'p20Atrs', 'p20RoomR')), pullback50: cnt((r) => okSet(r, 'geoPull50', 'p50Width', 'p50Atrs', 'p50RoomR')) };
prop.anySetup = cnt((r) => okSet(r, 'geoBreakout', 'brkWidth', 'brkAtrs', 'brkRoomR') || okSet(r, 'geoPull20', 'p20Width', 'p20Atrs', 'p20RoomR') || okSet(r, 'geoPull50', 'p50Width', 'p50Atrs', 'p50RoomR'));
const propNoRoom = cnt((r) => (r.geoBreakout && r.brkWidth <= 12 && r.brkAtrs <= 2.5) || (r.geoPull20 && r.p20Width <= 12 && r.p20Atrs <= 2.5) || (r.geoPull50 && r.p50Width <= 12 && r.p50Atrs <= 2.5));
const out = { proposedAtrCap_2_5ATR_12pct: { ...prop, anySetupIgnoringRoom: propNoRoom },
  candidateNights: n, geometry: geo,
  breakout: test((r) => r.geoBreakout, 'brkWidth', 'brkCap', 'brkRoomR'),
  pullback20: test((r) => r.geoPull20, 'p20Width', 'p20Cap', 'p20RoomR'),
  pullback50: test((r) => r.geoPull50, 'p50Width', 'p50Cap', 'p50RoomR'),
  atrPctQuantiles10_50_90: [0.1, 0.5, 0.9].map((p) => q(diagRows.map((r) => r.atrPct), p)),
  distPctQuantiles10_50_90: [0.1, 0.5, 0.9].map((p) => q(diagRows.map((r) => r.distPct), p)),
  note: 'gate off, Yellow, steps 1-5 qualified and not extended; each test evaluated independently; widths in percent of trigger, "atrs" = stop distance in ATR14 units',
};
writeFileSync('data/replay/us-funnel-detail-yellow-gateoff.json', JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out));
