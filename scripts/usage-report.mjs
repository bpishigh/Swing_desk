// Once a day: estimate this month's GitHub Actions minutes from the runs list, write data/ops/usage.json, and alert at 60/80/95% of the free budget.
// Usage: node scripts/usage-report.mjs [--force]   Needs GITHUB_REPOSITORY and GITHUB_TOKEN. Runs after 06:00 IST, at most once per IST day.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { BUDGET_MIN, estimateMinutes, projectMonth, dueAlert } from '../src/ops/usage.ts';
const FORCE = process.argv.includes('--force');
const ist = new Date(Date.now() + 5.5 * 3600e3);
const today = ist.toISOString().slice(0, 10), month = today.slice(0, 7);
const path = 'data/ops/usage.json';
const prev = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
if (!FORCE && (prev.date === today || ist.getUTCHours() < 6)) { console.log('usage: already done today (or too early)'); process.exit(0); }
const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN;
const runs = [];
for (let page = 1; page <= 15; page++) {
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/runs?created=%3E%3D${month}-01&per_page=100&page=${page}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' } });
  if (!r.ok) { console.error(`cannot list runs (${r.status})`); process.exit(1); }
  const j = await r.json();
  for (const x of j.workflow_runs) if (x.status === 'completed' && x.run_started_at) runs.push({ id: x.id, name: x.name, startedAt: x.run_started_at, endedAt: x.updated_at });
  if (j.workflow_runs.length < 100) break;
}
// A run's start-to-update time includes waiting for a runner; GitHub bills each job's own time, rounded up. Read the jobs and keep the billed
// figure per run in data/ops/usage-jobs.json ({runId: [minutes, workflow, startedAt]}). The runs list only reaches back 1,000 runs, so the
// month's total is the sum of this file, not of the list; entries from earlier months are dropped.
const cachePath = 'data/ops/usage-jobs.json';
const cache = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
let fetched = 0;
for (const r of runs) {
  if (cache[r.id] != null && Array.isArray(cache[r.id])) continue;
  let m = estimateMinutes([r]).total;                                   // fallback: the run's own time
  if (fetched < 250) {
    const jr = await fetch(`https://api.github.com/repos/${repo}/actions/runs/${r.id}/jobs?per_page=50`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' } });
    fetched++;
    if (jr.ok) { let mm = 0; for (const j of (await jr.json()).jobs || []) { const sec = (Date.parse(j.completed_at) - Date.parse(j.started_at)) / 1000; if (Number.isFinite(sec) && sec >= 0) mm += Math.max(1, Math.ceil(sec / 60)); } m = mm; }
  }
  cache[r.id] = [m, r.name, r.startedAt];
}
for (const k of Object.keys(cache)) if (!Array.isArray(cache[k]) || !String(cache[k][2]).startsWith(month)) delete cache[k];
const byWorkflow = {}; let total = 0;
for (const v of Object.values(cache)) { byWorkflow[v[1]] = (byWorkflow[v[1]] ?? 0) + v[0]; total += v[0]; }
writeFileSync(cachePath, JSON.stringify(cache) + '\n');
const dom = ist.getUTCDate(), dim = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 0)).getUTCDate();
const projected = projectMonth(total, dom, dim);
const alerted = prev.month === month ? prev.alerted || [] : [];
const t = dueAlert(total, alerted);
const out = { date: today, month, usedMinutesEstimate: total, budget: BUDGET_MIN, projectedMonthEnd: projected, byWorkflow: Object.fromEntries(Object.entries(byWorkflow).sort((a, b) => b[1] - a[1])), alerted, note: 'Estimate from run durations (each run rounded up to a minute, calendar month); GitHub billing page is the authority.' };
if (t) {
  try {
    execFileSync('node', ['scripts/alert.mjs', `GitHub Actions: about ${total} of ${BUDGET_MIN} free minutes used this month (${Math.round((100 * total) / BUDGET_MIN)}%), heading for about ${projected}. Biggest: ${Object.entries(out.byWorkflow).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')}.`], { stdio: 'inherit' });
    out.alerted = [...alerted, ...[60, 80, 95].filter((x) => x <= t)];
  } catch { console.error('alert could not be sent; will try again tomorrow'); }
}
mkdirSync('data/ops', { recursive: true });
writeFileSync(path, JSON.stringify(out, null, 1) + '\n');
console.log(`usage: about ${total} min used, projected ${projected}`);
