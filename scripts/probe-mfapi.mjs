// One-off probe: does api.mfapi.in answer, and does it allow a browser page from another site to read it (CORS)? Writes data/ops/mfapi-probe.json.
import { writeFileSync } from 'node:fs';
const out = {};
for (const [k, u] of [['index', 'https://api.mfapi.in/mf/120716'], ['fund', 'https://api.mfapi.in/mf/118834'], ['latest', 'https://api.mfapi.in/mf/120716/latest']]) {
  try { const r = await fetch(u, { headers: { origin: 'https://swing-desk.1994bhargav.workers.dev', 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) }); const t = await r.text();
    out[k] = { status: r.status, acao: r.headers.get('access-control-allow-origin'), type: r.headers.get('content-type'), bytes: t.length, head: t.slice(0, 120), server: r.headers.get('server'), cf: r.headers.get('cf-mitigated') }; }
  catch (e) { out[k] = { error: String(e.message) }; }
}
writeFileSync('data/ops/mfapi-probe.json', JSON.stringify(out, null, 1) + '\n');
