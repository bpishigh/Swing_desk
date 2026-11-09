// Kill-line check (9 Nov 2026; owner "yes" to the reviewer's proposal, Engine Rules C-159): how often would the C-159 kill line have fired on the C-129 sleeve (semi-annual) and the C-151 monthly twin, 2011 to 2025? Descriptive only: no tuning, no new strategy test, the curves are the existing C-150 replay. Reads data/replay/kill-line-curves-india.json; writes data/replay/kill-line-check-india.json.
// Lines: (1) drawdown 20% from the book's own peak; (2) trailing 6-month return more than 5 points below the benchmark at two consecutive month-end reads. Line (3) (zero or negative average net return after 40 closed trades) needs trade records the replay does not keep and is not counted. Status: one line is Watch; the drawdown line alone, or both lines, is Kill. Variant asked by the reviewer: line (1) measured as the book's fall from its peak relative to the benchmark's move over the same window.
import { readFileSync, writeFileSync } from 'node:fs';
const J = JSON.parse(readFileSync('data/replay/kill-line-curves-india.json', 'utf8'));
const out = { run: new Date().toISOString().slice(0, 10), rule: 'C-159 kill line, lines 1 and 2 only', books: {} };
for (const [bench, B] of Object.entries(J.benchmarks)) for (const [name, C] of Object.entries(J.curves)) {
  const months = Object.keys(C).sort().filter((m) => B[m] > 0); const st = [];
  let pk = -1, pkM = null;
  for (let k = 0; k < months.length; k++) {
    const m = months[k], v = C[m]; if (v > pk) { pk = v; pkM = m; }
    const dd = v / pk - 1, rel = (v / pk) / (B[m] / B[pkM]) - 1;
    const m6 = months[k - 6], r6 = m6 ? (v / C[m6] - 1) - (B[m] / B[m6] - 1) : null;
    st.push({ m, dd, rel, r6 });
  }
  const run = (useRel) => { const rows = st.map((s, k) => { const l1 = (useRel ? s.rel : s.dd) <= -0.20, l2 = s.r6 !== null && s.r6 < -0.05 && st[k - 1] && st[k - 1].r6 !== null && st[k - 1].r6 < -0.05; const kill = l1 || (l1 && l2) || (l2 && l1), watch = !kill && (l1 || l2); return { m: s.m, l1, l2, status: kill ? 'Kill' : watch ? 'Watch' : 'Continue' }; });
    const killM = rows.filter((r) => r.status === 'Kill'), watchM = rows.filter((r) => r.status === 'Watch');
    const eps = []; for (let k = 0; k < rows.length; k++) if (rows[k].status === 'Kill' && (k === 0 || rows[k - 1].status !== 'Kill')) { const m = rows[k].m, i = months.indexOf(m), f = months[i + 12]; eps.push({ firstKillMonth: m, next12MonthsBookMinusBenchmark: f ? +(((C[f] / C[m] - 1) - (B[f] / B[m] - 1)) * 100).toFixed(1) : null, next12MonthsBook: f ? +((C[f] / C[m] - 1) * 100).toFixed(1) : null }); }
    return { months: rows.length, killMonths: killM.length, watchMonths: watchM.length, killEpisodes: eps.length, episodes: eps, killMonthList: killM.map((r) => r.m).join(' ') }; };
  out.books[`${name} vs ${bench}`] = { absoluteDrawdownLine: run(false), relativeDrawdownLine: run(true), worstDrawdown: +(Math.min(...st.map((s) => s.dd)) * 100).toFixed(1) };
}
writeFileSync('data/replay/kill-line-check-india.json', JSON.stringify(out, null, 1) + '\n');
for (const [k, v] of Object.entries(out.books)) { console.log(k, 'worst fall', v.worstDrawdown + '%'); for (const t of ['absoluteDrawdownLine', 'relativeDrawdownLine']) { const x = v[t]; console.log(' ', t, `kill months ${x.killMonths}/${x.months}, episodes ${x.killEpisodes}, watch months ${x.watchMonths}`, x.episodes.map((e) => `${e.firstKillMonth}: next12m book ${e.next12MonthsBook}%, vs bench ${e.next12MonthsBookMinusBenchmark}`).join(' | ')); } }
