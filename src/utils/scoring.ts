import { InningsSummary, Match, Player, PointsTableEntry, Team } from '../types';

export type BatterCardEntry = {
  playerId: string;
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  status: string;
  out?: string;
};

export type BowlerFigure = {
  overs: number;
  balls: number;
  runs: number;
  wickets: number;
};

/** ICC limited-overs: each bowler may bowl at most ceil(totalOvers / 5), so a full innings needs ≥5 bowlers. */
export function maxOversPerBowler(totalOvers: number): number {
  return Math.max(1, Math.ceil(totalOvers / 5));
}

export function minBowlersForFullInnings(totalOvers: number): number {
  return Math.min(11, Math.ceil(totalOvers / maxOversPerBowler(totalOvers)));
}

export function strikeRate(runs: number, balls: number): number {
  return balls > 0 ? Math.round((runs * 1000) / balls) / 10 : 0;
}

export function economyRate(runs: number, overs: number, balls: number): number {
  const totalBalls = overs * 6 + balls;
  return totalBalls > 0 ? Math.round((runs / (totalBalls / 6)) * 100) / 100 : 0;
}

export type ScoringExtra = 'wide' | 'noBall' | 'bye' | 'legBye' | null;

/**
 * ICC Laws of Cricket — strike rotation:
 * - Batters change ends when an odd number of runs are completed by running
 *   (or scored off the bat). Applies to legal balls, byes, and leg-byes.
 * - For a wide or no-ball, the automatic 1-run penalty does NOT change strike.
 *   Only additional runs completed (wide+1, nb+1 off the bat, etc.) do.
 * - At the end of an over, strike always flips for the next over (other end).
 * - Non-deliveries (e.g. retired hurt) do not change strike by themselves.
 */
export function shouldRotateStrike(params: {
  runCount: number;
  extra: ScoringExtra;
  overComplete: boolean;
  isNonDelivery?: boolean;
}): boolean {
  if (params.isNonDelivery) return false;
  // runCount is already "runs completed by batters / off the bat" for every
  // extra type in this app (wide/nb penalty is applied separately to the total).
  let rotate = params.runCount % 2 !== 0;
  if (params.overComplete) rotate = !rotate;
  return rotate;
}

export function oversAsDecimal(overs: number, balls: number): number {
  return overs + balls / 10;
}

export function buildBowlingFromFigures(
  figures: Record<string, BowlerFigure>,
  players: Player[],
): NonNullable<InningsSummary['bowling']> {
  return Object.entries(figures).map(([name, fig]) => {
    const player = players.find(p => p.name.toLowerCase() === name.toLowerCase());
    return {
      playerId: player?.id || name,
      name,
      overs: oversAsDecimal(fig.overs, fig.balls),
      maidens: 0,
      runs: fig.runs,
      wickets: fig.wickets,
      economy: economyRate(fig.runs, fig.overs, fig.balls),
    };
  });
}

export function buildLiveBattingCard(params: {
  dismissed: BatterCardEntry[];
  strikerName: string;
  nonStrikerName: string;
  strikerRuns: number;
  strikerBalls: number;
  strikerFours: number;
  strikerSixes: number;
  nonStrikerRuns: number;
  nonStrikerBalls: number;
  nonStrikerFours: number;
  nonStrikerSixes: number;
  players: Player[];
}): BatterCardEntry[] {
  const {
    dismissed, strikerName, nonStrikerName,
    strikerRuns, strikerBalls, strikerFours, strikerSixes,
    nonStrikerRuns, nonStrikerBalls, nonStrikerFours, nonStrikerSixes,
    players,
  } = params;

  const findId = (name: string) =>
    players.find(p => p.name.toLowerCase() === name.toLowerCase())?.id || name;

  const dismissedNames = new Set((dismissed || []).map(d => d.name.toLowerCase()));
  const notOut: BatterCardEntry[] = [];
  if (strikerName && !dismissedNames.has(strikerName.toLowerCase())) {
    notOut.push({
      playerId: findId(strikerName),
      name: strikerName,
      runs: strikerRuns,
      balls: strikerBalls,
      fours: strikerFours,
      sixes: strikerSixes,
      strikeRate: strikeRate(strikerRuns, strikerBalls),
      status: 'NOT_OUT',
    });
  }
  if (nonStrikerName && !dismissedNames.has(nonStrikerName.toLowerCase())) {
    notOut.push({
      playerId: findId(nonStrikerName),
      name: nonStrikerName,
      runs: nonStrikerRuns,
      balls: nonStrikerBalls,
      fours: nonStrikerFours,
      sixes: nonStrikerSixes,
      strikeRate: strikeRate(nonStrikerRuns, nonStrikerBalls),
      status: 'NOT_OUT',
    });
  }
  return [...(dismissed || []), ...notOut];
}

/** Apply one completed match's scorecard onto player career stats (mutates copies, returns updates). */
export function careerDeltasFromMatch(match: Match): Map<string, Partial<Player>> {
  const byName = new Map<string, Partial<Player>>();

  const ensure = (name: string) => {
    const key = name.toLowerCase();
    if (!byName.has(key)) {
      byName.set(key, {
        battingStats: {
          matches: 0, innings: 0, runs: 0, balls: 0, notOuts: 0, highScore: 0,
          average: 0, strikeRate: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0,
        },
        bowlingStats: {
          innings: 0, overs: 0, maidens: 0, runs: 0, wickets: 0,
          economy: 0, average: 0, bestFigures: '-', fourWickets: 0, fiveWickets: 0,
        },
        fieldingStats: { catches: 0, stumpings: 0, runOuts: 0 },
      });
    }
    return byName.get(key)!;
  };

  const teamsSeen = new Set<string>();

  [match.innings?.first, match.innings?.second].forEach(innings => {
    if (!innings) return;
    (innings.batting || []).forEach(batter => {
      const delta = ensure(batter.name);
      const bs = delta.battingStats!;
      const notOut = batter.status === 'NOT_OUT' || !batter.out;
      bs.innings += 1;
      bs.runs += batter.runs || 0;
      bs.balls += batter.balls || 0;
      bs.fours += batter.fours || 0;
      bs.sixes += batter.sixes || 0;
      if (notOut) bs.notOuts += 1;
      if ((batter.runs || 0) > bs.highScore) bs.highScore = batter.runs || 0;
      if ((batter.runs || 0) >= 100) bs.hundreds += 1;
      else if ((batter.runs || 0) >= 50) bs.fifties += 1;
      teamsSeen.add(batter.name.toLowerCase());
    });
    (innings.bowling || []).forEach(bowler => {
      const delta = ensure(bowler.name);
      const bowl = delta.bowlingStats!;
      const fullOvers = Math.floor(bowler.overs || 0);
      const balls = Math.round(((bowler.overs || 0) % 1) * 10);
      bowl.innings += 1;
      bowl.overs += fullOvers + balls / 6;
      bowl.runs += bowler.runs || 0;
      bowl.wickets += bowler.wickets || 0;
      bowl.maidens += bowler.maidens || 0;
      if ((bowler.wickets || 0) >= 5) bowl.fiveWickets += 1;
      else if ((bowler.wickets || 0) >= 4) bowl.fourWickets += 1;
      teamsSeen.add(bowler.name.toLowerCase());
    });
  });

  teamsSeen.forEach(name => {
    const delta = byName.get(name)!;
    delta.battingStats!.matches = 1;
  });

  return byName;
}

/** Suggest Player of the Match from completed scorecards (bat + bowl weighted). */
export type MatchWinnerSide = 'A' | 'B' | 'tie' | 'unknown';

/** Which side won from result text / scores. Ties and incomplete results return tie/unknown. */
export function resolveMatchWinnerSide(match: Match): MatchWinnerSide {
  const result = (match.result || '').trim();
  if (result) {
    if (/^match tied/i.test(result) || /\bno result\b/i.test(result)) return 'tie';
    if (result.startsWith(`${match.teamAName} won`)) return 'A';
    if (result.startsWith(`${match.teamBName} won`)) return 'B';
  }

  const first = match.innings?.first;
  const second = match.innings?.second;
  if (!first || !second) return 'unknown';

  const firstTeamId = first.battingTeam || match.teamA;
  const firstIsA = firstTeamId === match.teamA;

  if (match.dls?.applied && match.dls.revisedTarget != null) {
    if (second.runs >= match.dls.revisedTarget) return firstIsA ? 'B' : 'A';
    if (second.runs === match.dls.revisedTarget - 1) return 'tie';
    return firstIsA ? 'A' : 'B';
  }

  if (first.runs > second.runs) return firstIsA ? 'A' : 'B';
  if (second.runs > first.runs) return firstIsA ? 'B' : 'A';
  return 'tie';
}

/** Player names who contributed for the winning side (batting + bowling). */
export function winningTeamPlayerNames(match: Match): Set<string> {
  const winner = resolveMatchWinnerSide(match);
  const names = new Set<string>();
  const add = (name?: string) => {
    const n = (name || '').trim();
    if (n) names.add(n.toLowerCase());
  };

  const first = match.innings?.first;
  const second = match.innings?.second;
  const firstTeamId = first?.battingTeam || match.teamA;
  const firstIsA = firstTeamId === match.teamA;
  // First innings: bat = first side, bowl = other side
  // Second innings: bat = other side, bowl = first side

  const includeFirstBat = winner === 'tie' || winner === 'unknown' || winner === (firstIsA ? 'A' : 'B');
  const includeFirstBowl = winner === 'tie' || winner === 'unknown' || winner === (firstIsA ? 'B' : 'A');

  if (includeFirstBat) {
    (first?.batting || []).forEach(b => add(b.name));
  }
  if (includeFirstBowl) {
    (first?.bowling || []).forEach(bw => add(bw.name));
  }
  if (includeFirstBowl) {
    (second?.batting || []).forEach(b => add(b.name));
  }
  if (includeFirstBat) {
    (second?.bowling || []).forEach(bw => add(bw.name));
  }

  return names;
}

export function isPlayerOnWinningTeam(match: Match, playerName: string): boolean {
  const winner = resolveMatchWinnerSide(match);
  if (winner === 'tie' || winner === 'unknown') return true;
  const key = (playerName || '').trim().toLowerCase();
  if (!key) return false;
  return winningTeamPlayerNames(match).has(key);
}

/** Suggest Player of the Match — always from the winning team when there is a winner. */
export function suggestPlayerOfMatch(match: Match): string | undefined {
  type Cand = { name: string; score: number };
  const winner = resolveMatchWinnerSide(match);
  const allowed =
    winner === 'A' || winner === 'B' ? winningTeamPlayerNames(match) : null;

  const cands: Cand[] = [];
  const pushBat = (b: { name: string; runs?: number; balls?: number; sixes?: number; fours?: number }) => {
    if (allowed && !allowed.has((b.name || '').trim().toLowerCase())) return;
    const sr = b.balls ? (b.runs! * 100) / b.balls : 0;
    cands.push({
      name: b.name,
      score: (b.runs || 0) * 1.2 + (b.sixes || 0) * 2 + (b.fours || 0) * 0.5 + sr * 0.05,
    });
  };
  const pushBowl = (bw: { name: string; wickets?: number; runs?: number; maidens?: number }) => {
    if (allowed && !allowed.has((bw.name || '').trim().toLowerCase())) return;
    cands.push({
      name: bw.name,
      score: (bw.wickets || 0) * 25 - (bw.runs || 0) * 0.3 + (bw.maidens || 0) * 3,
    });
  };

  [match.innings?.first, match.innings?.second].forEach(innings => {
    (innings?.batting || []).forEach(pushBat);
    (innings?.bowling || []).forEach(pushBowl);
  });

  if (!cands.length) return undefined;
  const best = new Map<string, number>();
  cands.forEach(c => best.set(c.name, Math.max(best.get(c.name) || 0, c.score)));
  return [...best.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function mergeCareerDelta(player: Player, delta: Partial<Player>): Partial<Player> {
  const bs = player.battingStats;
  const dbs = delta.battingStats!;
  const bowl = player.bowlingStats;
  const dbowl = delta.bowlingStats!;
  const totalRuns = bs.runs + dbs.runs;
  const totalBalls = bs.balls + dbs.balls;
  const outs = (bs.innings - bs.notOuts) + (dbs.innings - dbs.notOuts);
  const totalBowlRuns = bowl.runs + dbowl.runs;
  const totalWickets = bowl.wickets + dbowl.wickets;
  const totalOvers = bowl.overs + dbowl.overs;

  return {
    battingStats: {
      ...bs,
      matches: bs.matches + dbs.matches,
      innings: bs.innings + dbs.innings,
      runs: totalRuns,
      balls: totalBalls,
      notOuts: bs.notOuts + dbs.notOuts,
      highScore: Math.max(bs.highScore, dbs.highScore),
      average: outs > 0 ? Math.round((totalRuns / outs) * 100) / 100 : totalRuns,
      strikeRate: totalBalls > 0 ? Math.round((totalRuns * 1000) / totalBalls) / 10 : 0,
      fours: bs.fours + dbs.fours,
      sixes: bs.sixes + dbs.sixes,
      fifties: bs.fifties + dbs.fifties,
      hundreds: bs.hundreds + dbs.hundreds,
    },
    bowlingStats: {
      ...bowl,
      innings: bowl.innings + dbowl.innings,
      overs: Math.round(totalOvers * 10) / 10,
      maidens: bowl.maidens + dbowl.maidens,
      runs: totalBowlRuns,
      wickets: totalWickets,
      economy: totalOvers > 0 ? Math.round((totalBowlRuns / totalOvers) * 100) / 100 : 0,
      average: totalWickets > 0 ? Math.round((totalBowlRuns / totalWickets) * 100) / 100 : 0,
      bestFigures: bowl.bestFigures,
      fourWickets: bowl.fourWickets + dbowl.fourWickets,
      fiveWickets: bowl.fiveWickets + dbowl.fiveWickets,
    },
  };
}

type PointsConfig = { win: number; tie: number; nr: number };

/** Prefer enrolled tournament teams; otherwise all provided teams (legacy). */
export function teamsForTournamentTable(allTeams: Team[], enrolledIds?: string[]): Team[] {
  if (enrolledIds && enrolledIds.length > 0) {
    const set = new Set(enrolledIds);
    return allTeams.filter(t => set.has(t.id));
  }
  return allTeams;
}

/** Rebuild standings from completed matches so Teams / Points Table stay in sync. */
export function buildPointsTable(
  teams: Team[],
  matches: Match[],
  options?: {
    pointsConfig?: PointsConfig;
    overrides?: Record<string, number>;
    includeFriendlies?: boolean;
    /** When set, only these team ids appear (zeros included). */
    enrolledTeamIds?: string[];
    /** Restrict to matches tagged with this group id via match.stage === 'group' and team membership. */
    groupTeamIds?: string[];
  },
): PointsTableEntry[] {
  const config: PointsConfig = options?.pointsConfig || { win: 2, tie: 1, nr: 1 };
  const tableTeams = teamsForTournamentTable(
    options?.groupTeamIds?.length
      ? teams.filter(t => options.groupTeamIds!.includes(t.id))
      : teams,
    options?.enrolledTeamIds,
  );
  const eligible = (options?.includeFriendlies
    ? matches
    : matches.filter(match => !!match.tournamentId)
  ).filter(match => {
    if (!options?.groupTeamIds?.length) return true;
    const set = new Set(options.groupTeamIds);
    return set.has(match.teamA) && set.has(match.teamB);
  });
  const entries: PointsTableEntry[] = tableTeams.map(team => ({
    teamId: team.id,
    teamName: team.name,
    shortName: team.shortName,
    teamLogo: team.logoURL,
    played: 0,
    won: 0,
    lost: 0,
    nr: 0,
    nrr: 0,
    points: 0,
    lastFive: [],
  }));
  const indexByTeam = new Map(entries.map((entry, index) => [entry.teamId, index]));
  const runData = new Map(entries.map(entry => [entry.teamId, { scored: 0, facedBalls: 0, conceded: 0, bowledBalls: 0 }]));
  const ballsFor = (innings: InningsSummary | undefined) =>
    (innings?.overs || 0) * 6 + (innings?.balls || 0);

  eligible
    .filter(match =>
      (match.status === 'COMPLETED' && match.innings?.first && match.innings?.second)
      || match.status === 'ABANDONED',
    )
    .forEach(match => {
      const firstIndex = indexByTeam.get(match.teamA);
      const secondIndex = indexByTeam.get(match.teamB);
      if (firstIndex == null || secondIndex == null) return;

      const firstEntry = entries[firstIndex];
      const secondEntry = entries[secondIndex];

      // Abandoned / rain-affected: No Result — 1 point each.
      if (match.status === 'ABANDONED') {
        firstEntry.played += 1;
        secondEntry.played += 1;
        firstEntry.nr += 1;
        secondEntry.nr += 1;
        firstEntry.points += config.nr;
        secondEntry.points += config.nr;
        firstEntry.lastFive.push('NR');
        secondEntry.lastFive.push('NR');
        return;
      }

      const first = match.innings.first!;
      const second = match.innings.second!;
      const firstTeamId = first.battingTeam || match.teamA;
      const secondTeamId = second.battingTeam || (firstTeamId === match.teamA ? match.teamB : match.teamA);
      const firstIdx = indexByTeam.get(firstTeamId);
      const secondIdx = indexByTeam.get(secondTeamId);
      if (firstIdx == null || secondIdx == null) return;

      const aEntry = entries[firstIdx];
      const bEntry = entries[secondIdx];
      aEntry.played += 1;
      bEntry.played += 1;

      const firstData = runData.get(firstTeamId)!;
      const secondData = runData.get(secondTeamId)!;
      firstData.scored += first.runs;
      firstData.facedBalls += ballsFor(first);
      firstData.conceded += second.runs;
      firstData.bowledBalls += ballsFor(second);
      secondData.scored += second.runs;
      secondData.facedBalls += ballsFor(second);
      secondData.conceded += first.runs;
      secondData.bowledBalls += ballsFor(first);

      // Prefer explicit result text (required for DLS, where chase can win with fewer runs).
      const result = match.result || '';
      const firstTeamName = firstTeamId === match.teamA ? match.teamAName : match.teamBName;
      const secondTeamName = secondTeamId === match.teamA ? match.teamAName : match.teamBName;
      let outcome: 'first' | 'second' | 'tie';
      if (/tied/i.test(result)) {
        outcome = 'tie';
      } else if (result.startsWith(`${secondTeamName} won`)) {
        outcome = 'second';
      } else if (result.startsWith(`${firstTeamName} won`)) {
        outcome = 'first';
      } else if (match.dls?.applied && match.dls.revisedTarget != null) {
        outcome = second.runs >= match.dls.revisedTarget
          ? 'second'
          : second.runs === match.dls.revisedTarget - 1
            ? 'tie'
            : 'first';
      } else if (first.runs > second.runs) {
        outcome = 'first';
      } else if (second.runs > first.runs) {
        outcome = 'second';
      } else {
        outcome = 'tie';
      }

      if (outcome === 'first') {
        aEntry.won += 1;
        aEntry.points += config.win;
        aEntry.lastFive.push('W');
        bEntry.lost += 1;
        bEntry.lastFive.push('L');
      } else if (outcome === 'second') {
        bEntry.won += 1;
        bEntry.points += config.win;
        bEntry.lastFive.push('W');
        aEntry.lost += 1;
        aEntry.lastFive.push('L');
      } else {
        aEntry.nr += 1;
        bEntry.nr += 1;
        aEntry.points += config.tie;
        bEntry.points += config.tie;
        aEntry.lastFive.push('NR');
        bEntry.lastFive.push('NR');
      }
    });

  entries.forEach(entry => {
    const data = runData.get(entry.teamId)!;
    entry.nrr = data.facedBalls && data.bowledBalls
      ? (data.scored / (data.facedBalls / 6)) - (data.conceded / (data.bowledBalls / 6))
      : 0;
    entry.lastFive = entry.lastFive.slice(-5);
    const extra = options?.overrides?.[entry.teamId];
    if (typeof extra === 'number') entry.points += extra;
  });

  return entries.sort((a, b) => b.points - a.points || b.nrr - a.nrr);
}
