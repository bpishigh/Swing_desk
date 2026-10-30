// Estimates the month's GitHub Actions minutes from the list of workflow runs and decides which budget alerts are due.
// An estimate: GitHub bills each job rounded up to a whole minute; a run here is counted as one job.

export interface RunLite { name: string; startedAt: string; endedAt: string }
/** Monthly minutes to alert against, or null for no cap. The repository is public (owner, 30 Oct 2026), and GitHub-hosted standard runners are free for public repositories, so there is no monthly cap and nothing to alert against. Set a number here (2000 was the free private-repo allowance) to switch the 60/80/95% alerts back on. The figures in data/ops/usage.json are still written, to spot a workflow that suddenly uses far more than usual. */
export const BUDGET_MIN: number | null = null;
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

/** Thresholds newly crossed and not yet alerted this month; the highest only (one message). No budget (null or 0) means no alert. */
export function dueAlert(used: number, alerted: number[], budget: number | null = BUDGET_MIN): number | null {
  if (!budget) return null;
  const pct = (used / budget) * 100;
  const crossed = THRESHOLDS.filter((t) => pct >= t && !alerted.includes(t));
  return crossed.length ? crossed[crossed.length - 1] : null;
}
