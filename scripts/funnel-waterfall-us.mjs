// C-52 follow-up: where do template-qualified candidates drop out of the setup layer? Counts only (no returns), summed over the replay nights.
// Usage: node scripts/funnel-waterfall-us.mjs [--roomR=3] [--gate=on|off] [--light=yellow]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { buildHistories, runScan } from '../src/ingest/us-scan.ts';
import { SCAN } from '../src/ingest/us-scan-settings.ts';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
if (arg('roomR')) SCAN.roomR = +arg('roomR');
const GATE_OFF = arg('gate', 'on') === 'off', LIGHT = arg('light', 'yellow');
const dir = 'data/us/grouped', files = readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\d\.csv\.gz$/.test(f)).sort();
const tk = JSON.parse(readFileSync('data/us/' + readdirSync('data/us').filter((f) => /^tickers-/.test(f)).sort().pop(), 'utf8'));
const types = new Map(); for (const [s, t] of tk.rows) if (SCAN.types.includes(t)) types.set(s, t);
const allowed = new Set(types.keys());
const days = files.map((f) => { const L = gunzipSync(readFileSync(`${dir}/${f}`)).toString().split('\n'); const rows = []; for (let i = 1; i < L.length; i++) { const p = L[i].split(','); if (p.length < 5) continue; if (allowed.has(p[0]) && +p[1] > 0 && +p[2] > 0 && +p[3] > 0) rows.push([p[0], +p[1], +p[2], +p[3], +p[4]]); } return { date: f.slice(0, 10), rows }; });
const splits = JSON.parse(readFileSync('data/us/splits.json', 'utf8')).rows;
const sic = new Map(JSON.parse(readFileSync('data/us/sic.json', 'utf8')).rows.filter((r) => r[1]).map((r) => [r[0], +r[1]]));
const diag = {}; let prev = {}, nights = 0;
for (let t = SCAN.quarter * 4; t <= days.length - 23; t++) {
  const hist = buildHistories(days.slice(0, t + 1), splits.filter((r) => r[1] <= days[t].date), allowed);
  prev = runScan({ hist, types, sic, light: LIGHT, prev, noTightGate: GATE_OFF, diag }).state; nights++;
}
const out = { nights, roomR: SCAN.roomR, gateOff: GATE_OFF, light: LIGHT, candidateNights: diag };
writeFileSync(`data/replay/us-funnel-waterfall-${LIGHT}-gate${GATE_OFF ? 'off' : 'on'}-room${SCAN.roomR}.json`, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out));
