import { TournamentGroup } from '../types';

export const MIN_POOLS = 2;
export const MAX_POOLS = 8;

export function poolLabel(index: number): string {
  return `Pool ${String.fromCharCode(65 + index)}`;
}

export function makePoolId(): string {
  return `pool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeDefaultPools(count: number, existing: TournamentGroup[] = []): TournamentGroup[] {
  const n = Math.max(MIN_POOLS, Math.min(MAX_POOLS, count));
  if (n <= existing.length) return existing.slice(0, n);
  const extra: TournamentGroup[] = [];
  for (let i = existing.length; i < n; i++) {
    extra.push({ id: makePoolId(), name: poolLabel(i), teamIds: [] });
  }
  return [...existing, ...extra];
}

export function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter(id => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** A team may sit in only one pool. Toggle off if already in that pool. */
export function assignTeamToPool(
  groups: TournamentGroup[],
  poolId: string,
  teamId: string,
): TournamentGroup[] {
  return groups.map(group => {
    const without = group.teamIds.filter(id => id !== teamId);
    if (group.id !== poolId) return { ...group, teamIds: without };
    if (group.teamIds.includes(teamId)) return { ...group, teamIds: without };
    return { ...group, teamIds: [...without, teamId] };
  });
}

export function placeTeamInPool(
  groups: TournamentGroup[],
  poolId: string,
  teamId: string,
): TournamentGroup[] {
  return groups.map(group => {
    const without = group.teamIds.filter(id => id !== teamId);
    if (group.id !== poolId) return { ...group, teamIds: without };
    if (without.includes(teamId)) return { ...group, teamIds: without };
    return { ...group, teamIds: [...without, teamId] };
  });
}

export function removeTeamFromPools(groups: TournamentGroup[], teamId: string): TournamentGroup[] {
  return groups.map(group => ({
    ...group,
    teamIds: group.teamIds.filter(id => id !== teamId),
  }));
}

export function teamIdsFromPools(groups: TournamentGroup[], extra: string[] = []): string[] {
  return uniqueIds([...groups.flatMap(g => g.teamIds || []), ...extra]);
}

export function poolForTeam(groups: TournamentGroup[] | undefined, teamId: string): TournamentGroup | undefined {
  return (groups || []).find(g => (g.teamIds || []).includes(teamId));
}

/** Snake-draft teams across pools so group sizes stay even. */
export function balanceTeamsIntoPools(groups: TournamentGroup[], teamIds: string[]): TournamentGroup[] {
  if (!groups.length) return groups;
  const unique = uniqueIds(teamIds);
  const next = groups.map(group => ({ ...group, teamIds: [] as string[] }));
  const n = next.length;
  unique.forEach((id, i) => {
    const round = Math.floor(i / n);
    const pos = i % n;
    const idx = round % 2 === 0 ? pos : n - 1 - pos;
    next[idx] = { ...next[idx], teamIds: [...next[idx].teamIds, id] };
  });
  return next;
}
