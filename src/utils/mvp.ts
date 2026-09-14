import { Match } from '../types';

export type SuperStar = {
  name: string;
  teamName: string;
  points: number;
  detail: string;
};

function batterPoints(runs: number, balls: number, fours: number, sixes: number, notOut: boolean, wicketsLeftImpact: number) {
  let pts = runs * 1;
  if (runs >= 50) pts += 8;
  if (runs >= 100) pts += 16;
  pts += fours * 1 + sixes * 2;
  if (notOut) pts += 2;
  if (balls > 0 && (runs * 100) / balls >= 150) pts += 4;
  pts += wicketsLeftImpact;
  return pts;
}

function bowlerPoints(wickets: number, runs: number, overs: number) {
  let pts = wickets * 25;
  if (wickets >= 3) pts += 8;
  if (wickets >= 5) pts += 16;
  if (overs >= 2 && runs / overs <= 6) pts += 6;
  return pts;
}

/** Live MVP ranking used for Super Stars. */
export function buildSuperStars(match: Match, limit = 5): SuperStar[] {
  const scores = new Map<string, SuperStar>();
  const add = (name: string, teamName: string, points: number, detail: string) => {
    if (!name) return;
    const current = scores.get(name) || { name, teamName, points: 0, detail: '' };
    current.points += points;
    current.detail = [current.detail, detail].filter(Boolean).join(' · ');
    scores.set(name, current);
  };

  const sides = [
    { inn: match.innings?.first, battingTeam: match.innings?.first?.battingTeam === match.teamB ? match.teamBName : match.teamAName, bowlingTeam: match.innings?.first?.battingTeam === match.teamB ? match.teamAName : match.teamBName },
    { inn: match.innings?.second, battingTeam: match.innings?.second?.battingTeam === match.teamB ? match.teamBName : match.teamAName, bowlingTeam: match.innings?.second?.battingTeam === match.teamB ? match.teamAName : match.teamBName },
  ];

  sides.forEach(({ inn, battingTeam, bowlingTeam }) => {
    if (!inn) return;
    (inn.batting || []).forEach(b => {
      add(
        b.name,
        battingTeam,
        batterPoints(b.runs || 0, b.balls || 0, b.fours || 0, b.sixes || 0, b.status === 'NOT_OUT', 0),
        `${b.runs}(${b.balls})`,
      );
    });
    (inn.bowling || []).forEach(bw => {
      add(bw.name, bowlingTeam, bowlerPoints(bw.wickets || 0, bw.runs || 0, bw.overs || 0), `${bw.wickets}/${bw.runs}`);
    });
  });

  return Array.from(scores.values()).sort((a, b) => b.points - a.points).slice(0, limit);
}
