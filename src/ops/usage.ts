// Estimates the month's GitHub Actions minutes from the list of workflow runs and decides which budget alerts are due.
// An estimate: GitHub bills each job rounded up to a whole minute; a run here is counted as one job.

export interface RunLite { name: string; startedAt: string; endedAt: string }
export const BUDGET_MIN = 2000;                 // free plan, private repo
export const THRESHOLDS = [60, 80, 95];         // percent of the budget

export function estimateMinutes(runs: RunLite[]): { total: number; byWorkflow: Record<string, number> } {
  const byWorkflow: Record<string, number> = {}; let total = 0;
  for (const r of runs) {
    const secs = (Date.parse(r.endedAt) - Date.parse(r.startedAt)) / 1000;
    if (!Number.isFinite(secs) || secs < 0) continue;
    const m = Math.max(1, Math.ceil(secs / 60));
    byWorkflow[r.name] = (byWorkflow[r.name] ?? 0) + m; total += m;
  }
  return { total, byWorkflow };
}

/** Straight-line projection to month end from the days elapsed so far. */
export function projectMonth(usedSoFar: number, dayOfMonth: number, daysInMonth: number): number {
  return Math.round((usedSoFar / Math.max(1, dayOfMonth)) * daysInMonth);
}

/** Thresholds newly crossed and not yet alerted this month; the highest only (one message). */
export function dueAlert(used: number, alerted: number[], budget = BUDGET_MIN): number | null {
  const pct = (used / budget) * 100;
  const crossed = THRESHOLDS.filter((t) => pct >= t && !alerted.includes(t));
  return crossed.length ? crossed[crossed.length - 1] : null;
}
