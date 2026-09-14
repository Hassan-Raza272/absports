import { Match, PointsTableEntry, Team } from '../types';
import { buildPointsTable } from './scoring';

export type HypotheticalResult = {
  matchId: string;
  winnerId: string | 'tie' | 'nr';
};

export function applyWhatIf(
  teams: Team[],
  matches: Match[],
  picks: HypotheticalResult[],
  options?: Parameters<typeof buildPointsTable>[2],
): PointsTableEntry[] {
  const byId = new Map(picks.map(p => [p.matchId, p]));
  const simulated = matches.map(match => {
    const pick = byId.get(match.id);
    if (!pick || match.status === 'COMPLETED') return match;
    if (pick.winnerId === 'nr') {
      return { ...match, status: 'ABANDONED' as const, result: 'No result (what-if)' };
    }
    const winnerName = pick.winnerId === 'tie'
      ? null
      : pick.winnerId === match.teamA
        ? match.teamAName
        : match.teamBName;
    const first = match.innings?.first || {
      battingTeam: match.teamA,
      runs: pick.winnerId === match.teamA ? 160 : 140,
      wickets: 6,
      overs: match.overs,
      balls: 0,
    };
    const second = match.innings?.second || {
      battingTeam: match.teamB,
      runs: pick.winnerId === match.teamB ? 161 : pick.winnerId === 'tie' ? first.runs : first.runs - 12,
      wickets: 7,
      overs: match.overs,
      balls: 0,
    };
    return {
      ...match,
      status: 'COMPLETED' as const,
      result: pick.winnerId === 'tie' ? 'Match tied (what-if)' : `${winnerName} won (what-if)`,
      innings: { first, second },
    };
  });
  return buildPointsTable(teams, simulated, options);
}
