// Run from the half-hourly source-test job. Starts the Repo Desk's US daily job and the Saturday stock screen when they are due,
// tells the user once if a day or the screen is still missing, and keeps its own small state file.
// Usage: node scripts/dispatch-us.mjs [--dry] [--now=<ISO time>]   (needs GITHUB_REPOSITORY and GITHUB_TOKEN unless --dry)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { execFileSync } from 'node:child_process';
import { makeCalendar } from '../src/engine/calendar.ts';
import { planUs } from '../src/ingest/us-plan.ts';

const DRY = process.argv.includes('--dry');
const NOW = (process.argv.find((a) => a.startsWith('--now=')) || '').slice(6) || process.env.NOW_OVERRIDE || '';
const calFile = loadCalendarFiles().us;
const cal = makeCalendar(calFile.holidays);
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const feedDate = readJson('data/us/feed/latest.json', {}).date || '0000-00-00';
const screenDate = readJson('data/us/screen/latest.json', {}).feedDate || '0000-00-00';
const breadthDate = Object.keys(readJson('data/us/breadth.json', {})).sort().pop() || '0000-00-00';
const scanDate = readJson('data/us/scan/latest.json', {}).asOf || '0000-00-00';
const statePath = 'data/us/orchestrator.json';
const state = readJson(statePath, {});
const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN;
const api = async (path, init = {}) => fetch(`https://api.github.com/repos/${repo}/${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', ...(init.headers || {}) } });

async function running(workflow) {
  if (DRY) return false;
  for (const status of ['in_progress', 'queued']) {
    const r = await api(`actions/workflows/${workflow}/runs?status=${status}&per_page=5`);
    if (!r.ok) throw new Error(`cannot list ${workflow} runs (${r.status})`);
    if ((await r.json()).total_count > 0) return true;
  }
  return false;
}

const inflight = { daily: await running('us-nightly.yml'), screen: await running('us-screen.yml'), breadth: await running('us-breadth.yml'), scan: await running('us-hist-nightly.yml') };
const plan = planUs({ nowMs: NOW ? Date.parse(NOW) : Date.now(), cal, feedDate, screenDate, breadthDate, scanDate, inflight, state });
console.log(JSON.stringify({ feedDate, screenDate, breadthDate, scanDate, inflight, dispatch: plan.dispatch.map((d) => `${d.workflow} ${JSON.stringify(d.inputs)}`), alerts: plan.alerts }));
if (DRY) process.exit(0);

let failed = false;
for (const d of plan.dispatch) {
  const r = await api(`actions/workflows/${d.workflow}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: d.inputs }) });
  if (r.status !== 204) { failed = true; console.error(`dispatch ${d.workflow} failed: ${r.status} ${(await r.text()).slice(0, 200)}`); }
}
for (const [i, a] of plan.alerts.entries()) {
  try { execFileSync('node', ['scripts/alert.mjs', a], { stdio: 'inherit' }); }
  catch {
    console.error('alert could not be sent; will try again next tick'); failed = true;
    const k = a.startsWith('The weekly') ? 'screen' : a.startsWith('US breadth') ? 'breadth' : a.startsWith('US scan') ? 'scan' : 'daily';
    delete plan.state[k].alertedFor;
  }
}
writeFileSync(statePath, JSON.stringify(plan.state, null, 1) + '\n');
process.exit(failed ? 1 : 0);
