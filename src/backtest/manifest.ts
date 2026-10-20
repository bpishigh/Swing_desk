// Backtester: the run manifest. C-69. Every test is registered here BEFORE it runs (change-log id, hypothesis, parameters, fit and holdout windows,
// the pass rule, a fingerprint of the data it will see); the result is appended after; attempts per change-log id are counted, so a number taken from
// the best of many tries says how many there were. Holdout rows are computed but kept hidden until one logged reveal per registered test.
// Records and counts only: it changes no rule and no past result.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface Snapshot { sessions: number; first: string; last: string; symbols: number; splits: number; hash: string }
export interface RunEntry {
  id: string; changeLog: string; title: string; hypothesis: string; script: string; params: Record<string, unknown>;
  fit?: [string, string]; holdout?: [string, string]; passRule: string; data: Snapshot; registeredAt: string;
  attempt: number; exploration: boolean; status: 'registered' | 'done' | 'abandoned';
  result?: { at: string; summary: string; file?: string }; holdoutReveal?: { at: string; note: string };
}
export interface Manifest { version: 1; runs: RunEntry[] }
export interface RegisterInput {
  changeLog: string; title: string; hypothesis: string; script: string; params?: Record<string, unknown>;
  fit?: [string, string]; holdout?: [string, string]; passRule: string; data: Snapshot; exploration?: boolean;
}

export const MANIFEST_PATH = 'docs/backtests/manifest.json';
export const emptyManifest = (): Manifest => ({ version: 1, runs: [] });
export const loadManifest = (path = MANIFEST_PATH): Manifest => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Manifest) : emptyManifest());
export function saveManifest(m: Manifest, path = MANIFEST_PATH): void { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, JSON.stringify(m, null, 1) + '\n'); }

/** True when the change log (the repo copy of the Engine Rules) has a row for this id. */
export const inChangeLog = (id: string, rulesText: string): boolean => new RegExp(`^\\|\\s*${id.replace(/[-]/g, '\\-')}\\s*\\|`, 'm').test(rulesText);

/** Registers a run. Refuses a run with no change-log row unless it is labelled exploration, and refuses overlapping or inverted windows. */
export function register(m: Manifest, i: RegisterInput, rulesText: string, now = new Date().toISOString()): RunEntry {
  const exploration = !!i.exploration;
  if (!exploration && !inChangeLog(i.changeLog, rulesText)) throw new Error(`${i.changeLog} has no row in the change log: register the test there first, or label the run as exploration`);
  if (!i.passRule || i.passRule.trim().length < 10) throw new Error('write the pass rule before the run');
  for (const w of [i.fit, i.holdout]) if (w && !(w[0] <= w[1])) throw new Error(`window ${w.join(' to ')} is inverted`);
  if (i.fit && i.holdout && !(i.fit[1] < i.holdout[0])) throw new Error('the fit window must end before the holdout window starts');
  const attempt = m.runs.filter((r) => r.changeLog === i.changeLog).length + 1;
  const e: RunEntry = { id: `${i.changeLog}-r${attempt}${exploration ? '-x' : ''}`, changeLog: i.changeLog, title: i.title, hypothesis: i.hypothesis, script: i.script, params: i.params ?? {}, fit: i.fit, holdout: i.holdout, passRule: i.passRule, data: i.data, registeredAt: now, attempt, exploration, status: 'registered' };
  m.runs.push(e); return e;
}
const find = (m: Manifest, id: string): RunEntry => { const e = m.runs.find((r) => r.id === id); if (!e) throw new Error(`unknown run ${id}`); return e; };
export function recordResult(m: Manifest, id: string, summary: string, file?: string, now = new Date().toISOString()): RunEntry { const e = find(m, id); if (e.result) throw new Error(`${id} already has a result; register a new attempt instead`); e.result = { at: now, summary, ...(file ? { file } : {}) }; e.status = 'done'; return e; }
export function abandon(m: Manifest, id: string, why: string, now = new Date().toISOString()): RunEntry { const e = find(m, id); e.status = 'abandoned'; e.result = { at: now, summary: `abandoned: ${why}` }; return e; }
/** One reveal per registered run, with a note saying why. */
export function revealHoldout(m: Manifest, id: string, note: string, now = new Date().toISOString()): RunEntry { const e = find(m, id); if (!e.holdout) throw new Error(`${id} has no holdout window`); if (e.holdoutReveal) throw new Error(`${id} holdout was already revealed on ${e.holdoutReveal.at}`); if (!note || note.trim().length < 10) throw new Error('say why the holdout is being revealed'); e.holdoutReveal = { at: now, note }; return e; }

/** Splits rows by date into fit and holdout. The holdout rows are returned only after a reveal; until then only their count is. */
export function gate<T>(e: RunEntry, rows: T[], dateOf: (r: T) => string): { fit: T[]; holdout: T[] | null; hidden: number; other: number } {
  const inW = (w: [string, string] | undefined, d: string) => !!w && d >= w[0] && d <= w[1];
  const fit = rows.filter((r) => inW(e.fit, dateOf(r))), ho = rows.filter((r) => inW(e.holdout, dateOf(r)));
  return { fit, holdout: e.holdoutReveal ? ho : null, hidden: e.holdoutReveal ? 0 : ho.length, other: rows.length - fit.length - ho.length };
}
/** How many runs a change-log id has used: quote this beside any number taken from it. */
export const attempts = (m: Manifest, changeLog: string): number => m.runs.filter((r) => r.changeLog === changeLog).length;
