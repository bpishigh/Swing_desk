import { readFileSync } from 'node:fs';
const rows = readFileSync('data/source-test/log.ndjson', 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const by = {};
for (const r of rows) (by[r.id] ??= []).push(r);
const cross = by.us_close_crosscheck || [];
delete by.us_close_crosscheck;
console.log('source | probes | ok | 404 (not published yet) | blocked (other 4xx/5xx/0) | median ms');
for (const [id, rs] of Object.entries(by)) {
  const ok = rs.filter((r) => r.status === 200).length;
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
  const nf = rs.filter((r) => r.status === 404).length;
  console.log(`${id} | ${rs.length} | ${ok} | ${nf} | ${rs.length - ok - nf} | ${ms[Math.floor(ms.length / 2)]}`);
}
console.log('\nNSE publication: first successful probe per IST date (UTC time of the probe)');
for (const id of ['nse_index_close_today', 'nse_bhavcopy_today']) {
  const firsts = {};
  for (const r of by[id] || []) if (r.publishedNow && !firsts[r.istDate]) firsts[r.istDate] = r.ts;
  console.log(id, Object.fromEntries(Object.entries(firsts).map(([d, ts]) => [d, `${ts} = ${new Date(new Date(ts).getTime() + 5.5 * 3600e3).toISOString().slice(11, 16)} IST`])));
}

console.log('\nHistory depth on free plans (rows returned for a ~400-day request; the 200 SMA needs 200+)');
for (const id of ['tiingo_spy_history', 'polygon_spy_history']) {
  const ok = (by[id] || []).filter((r) => r.status === 200);
  console.log(id, ok.length ? `latest rows=${ok[ok.length - 1].rows}, oldest=${ok[ok.length - 1].oldest}` : 'no successful probe (key not set or blocked)');
}
console.log('\nUS close cross-check (newest SPY close, sources within 0.1% and on the same date)');
console.log(cross.length ? `${cross.filter((c) => c.agree).length} of ${cross.length} checks agree` : 'no cross-checks yet (needs two keyed sources)');
for (const c of cross.filter((c) => !c.agree)) console.log('disagree', c.baseDate, JSON.stringify(c.diffs));

// India runner verdict (Architecture decision 1). A 200 only counts when the file's internal date equals the session date.
console.log('\nIndia runner check (NSE probes; weekdays only; IST dates)');
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dataIso = (s) => { // dd-mm-yyyy or dd-Mon-yyyy
  const a = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s || ''); if (a) return iso(+a[3], +a[2] - 1, +a[1]);
  const b = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec(s || ''); return b ? iso(+b[3], MON[b[2]], +b[1]) : null;
};
const sessionIso = (ddmmyyyy) => `${ddmmyyyy.slice(4)}-${ddmmyyyy.slice(2, 4)}-${ddmmyyyy.slice(0, 2)}`;
const nse = rows.filter((r) => r.id.startsWith('nse_') && r.market === 'IN');
const days = {};
for (const r of nse) (days[r.istDate] ??= []).push(r);
let fullBlockDays = 0, blockDays = 0, weekdays = 0, lateOrMissing = 0;
for (const [d, rs] of Object.entries(days).sort()) {
  const dow = new Date(`${sessionIso(d)}T00:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) { console.log(d, 'weekend: ignored'); continue; }
  weekdays++;
  const blocked = rs.filter((r) => r.status === 403 || r.status === 429);
  if (blocked.length) blockDays++;
  if (blocked.length === rs.length) fullBlockDays++;
  const good = rs.filter((r) => r.id === 'nse_index_close_today' && r.status === 200 && dataIso(r.dataDate) === sessionIso(d));
  const stale = rs.filter((r) => r.id === 'nse_index_close_today' && r.status === 200 && dataIso(r.dataDate) !== sessionIso(d)).length;
  const first = good.sort((a, b) => (a.ts < b.ts ? -1 : 1))[0];
  const ist = first ? new Date(new Date(first.ts).getTime() + 5.5 * 3600e3).toISOString().slice(11, 16) : null;
  if (!ist || ist > '23:00') lateOrMissing++;
  console.log(d, `probes=${rs.length} blocked(403/429)=${blocked.length} staleDated200=${stale} indexCloseRightDate=${ist ? ist + ' IST' : 'NOT SEEN'}`);
}
const switchIf = [];
if (lateOrMissing) switchIf.push(`index-close file missing or after 23:00 IST on ${lateOrMissing} weekday(s)`);
if (fullBlockDays) switchIf.push(`${fullBlockDays} full-day block(s)`);
if (blockDays >= 2) switchIf.push(`403/429 on ${blockDays} days`);
console.log(weekdays ? (switchIf.length ? `VERDICT: review a switch away from GitHub: ${switchIf.join('; ')}` : 'VERDICT: GitHub stays the India runner') : 'No weekday probes yet');

// ---- Scheduled-run check: every cron slot should have a run line in runs.ndjson ----
{
  const { existsSync, readFileSync: rf } = await import('node:fs');
  const START = Date.parse('2026-10-06T18:37:00Z'); // first slot after the outside trigger (cron-job.org) started on 6 Oct
  const runs = existsSync('data/source-test/runs.ndjson')
    ? rf('data/source-test/runs.ndjson', 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
  // Runs now arrive as workflow_dispatch from the outside trigger (cron-job.org); GitHub's own cron was removed. Every non-local run counts as a slot hit.
  const sched = runs.filter((r) => r.event !== 'local').map((r) => Date.parse(r.ts));
  const slots = [];
  for (let t = START; t <= Date.now() - 30 * 60e3; t += 30 * 60e3) {   // 30 min grace for GitHub delay
    const d = new Date(t), dow = d.getUTCDay(), h = d.getUTCHours();
    if ((dow >= 1 && dow <= 5 && h >= 10) || (dow >= 2 && dow <= 6 && h <= 6)) slots.push(t);   // the three cron-job.org jobs (UTC)
  }
  const missed = slots.filter((s) => !sched.some((x) => x >= s && x < s + 30 * 60e3));
  const fail = runs.filter((r) => r.status !== 'success').length;
  console.log(`\nScheduled runs: expected=${slots.length} seen=${slots.length - missed.length} missed=${missed.length} | local runs=${runs.filter((r) => r.event === 'local').length} failed=${fail}`);
  for (const m of missed.slice(-12)) console.log('  missed slot', new Date(m).toISOString().slice(0, 16) + 'Z', '=', new Date(m + 5.5 * 3600e3).toISOString().slice(11, 16), 'IST');
  if (missed.length > 12) console.log(`  ...and ${missed.length - 12} earlier`);
}
