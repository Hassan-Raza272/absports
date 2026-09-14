import { MatchStage, Team } from '../types';

export type Pairing = {
  teamA: Team;
  teamB: Team;
  stage?: MatchStage;
  round?: number;
};

/** Single or double round-robin pairings for enrolled teams. */
export function buildRoundRobinPairings(teams: Team[], homeAndAway = false): Pairing[] {
  if (teams.length < 2) return [];
  const list = [...teams];
  // Circle method needs even count; bye slot if odd.
  const bye = { id: '__bye__', name: 'BYE' } as Team;
  if (list.length % 2 === 1) list.push(bye);

  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;
  const rotating = list.slice(1);
  const pairs: Pairing[] = [];

  for (let r = 0; r < rounds; r++) {
    const roundTeams = [list[0], ...rotating];
    for (let i = 0; i < half; i++) {
      const a = roundTeams[i];
      const b = roundTeams[n - 1 - i];
      if (a.id === '__bye__' || b.id === '__bye__') continue;
      pairs.push({ teamA: a, teamB: b, stage: 'league', round: r });
      if (homeAndAway) {
        pairs.push({ teamA: b, teamB: a, stage: 'league', round: rounds + r });
      }
    }
    rotating.unshift(rotating.pop()!);
  }
  return pairs;
}

export function stageForTeamCount(count: number): MatchStage {
  if (count <= 2) return 'Final';
  if (count <= 4) return 'SF';
  if (count <= 8) return 'QF';
  return 'playoff';
}

/** Seeded single-elimination bracket pairings (power-of-two padded with byes). */
export function buildKnockoutPairings(teams: Team[]): Pairing[] {
  if (teams.length < 2) return [];
  const seeded = [...teams];
  let size = 1;
  while (size < seeded.length) size *= 2;
  while (seeded.length < size) {
    seeded.push({ id: `__bye_${seeded.length}`, name: 'BYE' } as Team);
  }
  const pairs: Pairing[] = [];
  const stage = stageForTeamCount(size);
  for (let i = 0; i < size / 2; i++) {
    const a = seeded[i];
    const b = seeded[size - 1 - i];
    if (a.id.startsWith('__bye') || b.id.startsWith('__bye')) continue;
    pairs.push({ teamA: a, teamB: b, stage, round: 0 });
  }
  return pairs;
}

export function nextKickoff(from: Date, index: number, hoursApart = 24): Date {
  const d = new Date(from);
  d.setHours(d.getHours() + index * hoursApart, 0, 0, 0);
  return d;
}
