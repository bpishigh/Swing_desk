// The run manifest from the command line (C-69). Register a test BEFORE running it; record the result after; reveal a holdout once.
//   node scripts/backtest-manifest.mjs register --file=spec.json        (spec = changeLog, title, hypothesis, script, params, fit, holdout, passRule [, exploration])
//   node scripts/backtest-manifest.mjs result --id=C-70-r1 --summary="..." [--file=data/replay/x.json]
//   node scripts/backtest-manifest.mjs reveal --id=C-70-r1 --note="why the holdout is being revealed"
//   node scripts/backtest-manifest.mjs abandon --id=C-70-r1 --why="..."
//   node scripts/backtest-manifest.mjs list
// --manifest=<path> overrides docs/backtests/manifest.json. The data fingerprint is taken from the stored India data at registration time.
import { readFileSync, existsSync } from 'node:fs';
import { loadManifest, saveManifest, register, recordResult, revealHoldout, abandon, attempts, MANIFEST_PATH } from '../src/backtest/manifest.ts';
import { loadIndia } from '../src/backtest/india-loader.ts';
const [cmd] = process.argv.slice(2), arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const path = arg('manifest', MANIFEST_PATH), m = loadManifest(path);
const rules = existsSync('docs/ENGINE_RULES.md') ? readFileSync('docs/ENGINE_RULES.md', 'utf8') : '';
try {
  if (cmd === 'register') {
    const spec = JSON.parse(readFileSync(arg('file'), 'utf8'));
    const e = register(m, { ...spec, data: spec.data ?? loadIndia().snapshot }, rules); saveManifest(m, path);
    console.log(`registered ${e.id} (attempt ${e.attempt} of ${spec.changeLog}); data ${e.data.hash}, ${e.data.sessions} sessions to ${e.data.last}`);
  } else if (cmd === 'result') { const e = recordResult(m, arg('id'), arg('summary', ''), arg('file')); saveManifest(m, path); console.log(`${e.id} done`); }
  else if (cmd === 'reveal') { const e = revealHoldout(m, arg('id'), arg('note', '')); saveManifest(m, path); console.log(`${e.id} holdout revealed ${e.holdoutReveal.at}`); }
  else if (cmd === 'abandon') { const e = abandon(m, arg('id'), arg('why', '')); saveManifest(m, path); console.log(`${e.id} abandoned`); }
  else if (cmd === 'list') { for (const r of m.runs) console.log(`${r.id.padEnd(12)} ${r.status.padEnd(10)} attempt ${r.attempt} of ${attempts(m, r.changeLog)} ${r.title}${r.holdoutReveal ? ' [holdout revealed]' : r.holdout ? ' [holdout hidden]' : ''}`); if (!m.runs.length) console.log('no runs registered yet'); }
  else { console.error('usage: register | result | reveal | abandon | list'); process.exit(2); }
} catch (e) { console.error('refused:', e.message); process.exit(1); }
