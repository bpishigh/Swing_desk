// Run from the half-hourly source-test job. Starts the Repo Desk's India index job and stock job for the latest session
// when either is behind, tells the user once if a day is still missing late in the evening, and keeps its own small state file.
// Usage: node scripts/dispatch-nightly.mjs [--dry] [--now=<ISO time>]   (--now is for testing the live path)   (needs GITHUB_REPOSITORY and GITHUB_TOKEN unless --dry)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadCalendarFiles } from '../src/engine/calendar-files.ts';
import { execFileSync } from 'node:child_process';
import { makeCalendar } from '../src/engine/calendar.ts';
import { planNightly } from '../src/ingest/nightly-plan.ts';

const DRY = process.argv.includes('--dry');
const NOW = (process.argv.find((a) => a.startsWith('--now=')) || '').slice(6) || process.env.NOW_OVERRIDE || '';
const calFile = loadCalendarFiles().india;
const cal = makeCalendar([...calFile.holidays, ...(calFile.priorHolidays || [])]);
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const feedDate = readJson('data/india/feed/latest.json', {}).date || '0000-00-00';
const stocksDate = readJson('data/india/stocks/latest.json', {}).date || '0000-00-00';
const statePath = 'data/india/orchestrator.json';
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

const inflight = { nightly: await running('india-nightly.yml'), stocks: await running('india-stocks.yml') };
const plan = planNightly({ nowMs: NOW ? Date.parse(NOW) : Date.now(), cal, feedDate, stocksDate, inflight, state });
console.log(JSON.stringify({ target: plan.target, feedDate, stocksDate, inflight, dispatch: plan.dispatch.map((d) => `${d.workflow} ${JSON.stringify(d.inputs)}`), alert: plan.alert }));
if (DRY) process.exit(0);

let failed = false;
for (const d of plan.dispatch) {
  const r = await api(`actions/workflows/${d.workflow}/dispatches`, { method: 'POST', body: JSON.stringify({ ref: 'main', inputs: d.inputs }) });
  if (r.status !== 204) { failed = true; console.error(`dispatch ${d.workflow} failed: ${r.status} ${(await r.text()).slice(0, 200)}`); }
}
if (plan.alert) {
  try { execFileSync('node', ['scripts/alert.mjs', plan.alert], { stdio: 'inherit' }); }
  catch { console.error('alert could not be sent; will try again next tick'); failed = true; delete plan.state.alertedFor; }
}
writeFileSync(statePath, JSON.stringify(plan.state, null, 1) + '\n');
process.exit(failed ? 1 : 0);
