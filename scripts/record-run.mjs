// Appends one line per workflow run to data/source-test/runs.ndjson.
// Runs even when an earlier step failed, so a failed run still leaves a trace.
// Missing scheduled runs (slots with no line) are found by summarise-source-test.mjs.
import { appendFileSync, mkdirSync } from 'node:fs';

mkdirSync('data/source-test', { recursive: true });
const rec = {
  ts: new Date().toISOString(),
  event: process.env.GITHUB_EVENT_NAME || 'local',   // schedule | workflow_dispatch
  runId: process.env.GITHUB_RUN_ID || null,
  status: process.env.JOB_STATUS || 'unknown',       // success | failure | cancelled
};
appendFileSync('data/source-test/runs.ndjson', JSON.stringify(rec) + '\n');
console.log('run recorded', rec);
