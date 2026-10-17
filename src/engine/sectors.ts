// Sector ranking. Implements Engine Rules "Sector ranking": gate (3M beats benchmark AND is above zero (C-58), and above 50 SMA; Red: the two 3M tests only),
// score = 2 x 3M + 1M, ranked high to low. Ported from app v9 computeSectors / sectorStatus.

export interface SectorInput { name: string; m1?: number | null; m3?: number | null; above50?: boolean; above200?: boolean }
export interface SectorRow { name: string; m1: number | null; m3: number | null; above50: boolean; above200: boolean; pass: boolean; score: number | null; rank: number | null }
export type SectorMode = 'red' | 'normal';

const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function rankSectors(inputs: SectorInput[], benchmarkM3: number | undefined, mode: SectorMode): SectorRow[] {
  const rows: SectorRow[] = inputs.map((r) => {
    const m1 = ok(r.m1) ? r.m1 : NaN, m3 = ok(r.m3) ? r.m3 : NaN;
    const above = !!r.above50, a200 = !!r.above200;
    const pass = ok(m3) && ok(benchmarkM3) && m3 > benchmarkM3 && m3 > 0 && (mode === 'red' || above);
    const score = pass && ok(m1) ? 2 * m3 + m1 : pass ? 2 * m3 : NaN;
    return { name: r.name, m1: ok(m1) ? m1 : null, m3: ok(m3) ? m3 : null, above50: above, above200: a200, pass, score: ok(score) ? +score.toFixed(2) : null, rank: null };
  });
  rows.filter((r) => r.pass && ok(r.score)).sort((a, b) => (b.score as number) - (a.score as number)).forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export interface SectorSnapshot { id: string; mode?: string; rows: Array<{ name: string; rank: number | null; pass?: boolean; above200?: boolean }> }
export interface SectorStatus { rank: number | null; persist: boolean; newLeader: boolean; pass?: boolean; above200: boolean | null }

const inTop = (r?: { rank: number | null } | null): boolean => !!r && ok(r.rank) && (r.rank as number) <= 4;

/**
 * Status of a sector in the latest snapshot (snaps oldest first).
 * persist = in the top 4 in the latest and the previous snapshot.
 * newLeader = in the top 4 now, not in the previous snapshot, and outside the top 8 (or absent) in any of the 3 snapshots before.
 */
export function sectorStatus(snaps: SectorSnapshot[], name: string): SectorStatus | null {
  if (!snaps.length) return null;
  const cur = snaps[snaps.length - 1];
  const row = cur.rows.find((r) => r.name === name);
  if (!row) return null;
  const prev = snaps.length > 1 ? snaps[snaps.length - 2].rows.find((r) => r.name === name) : null;
  const persist = inTop(row) && inTop(prev);
  let newLeader = false;
  if (inTop(row) && !inTop(prev)) {
    const back = snaps.slice(Math.max(0, snaps.length - 4), snaps.length - 1);
    newLeader = back.some((s) => { const r = s.rows.find((x) => x.name === name); return !r || !ok(r.rank) || (r.rank as number) > 8; });
  }
  return { rank: row.rank, persist, newLeader, pass: row.pass, above200: row.above200 === undefined ? null : !!row.above200 };
}
