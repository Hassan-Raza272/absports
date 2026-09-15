import { InningsSummary, Match } from '../types';
import { formatTargetLabel, getChaseTarget } from './dls';

export function isFriendly(match: Match) {
  return !match.tournamentId;
}

export function inningsForTeam(match: Match, teamId: string): InningsSummary | undefined {
  const inn1 = match.innings?.first;
  const inn2 = match.innings?.second;
  if (inn1?.battingTeam === teamId) return inn1;
  if (inn2?.battingTeam === teamId) return inn2;
  if (!inn1?.battingTeam && teamId === match.teamA) return inn1;
  if (!inn1?.battingTeam && teamId === match.teamB) return inn2;
  return undefined;
}

export function formatScore(inn?: InningsSummary) {
  if (!inn) return '—';
  return `${inn.runs}/${inn.wickets}`;
}

export function formatOvers(inn?: InningsSummary) {
  if (!inn) return '';
  return `${inn.overs}.${inn.balls} ov`;
}

export function currentRunRate(inn?: InningsSummary) {
  if (!inn) return '—';
  const balls = (inn.overs || 0) * 6 + (inn.balls || 0);
  if (balls <= 0) return '—';
  return ((inn.runs * 6) / balls).toFixed(2);
}

export function matchKindLabel(match: Match) {
  if (!match.tournamentId) return 'Friendly';
  return `Match ${match.matchNumber}`;
}

export function firstInningsComplete(match: Match) {
  const first = match.innings?.first;
  if (!first) return false;
  return !!(
    match.currentInnings === 2 ||
    match.innings?.second ||
    first.wickets >= (match.settings?.totalWickets || 10) ||
    first.overs >= match.overs
  );
}

export function liveStatusLine(match: Match) {
  const first = match.innings?.first;
  const second = match.innings?.second;
  if (match.status === 'COMPLETED' && match.result) {
    return match.playerOfMatch
      ? `${match.result} · PoM: ${match.playerOfMatch}`
      : match.result;
  }
  if (firstInningsComplete(match) && first) {
    if (match.result && !String(match.result).startsWith('Target:')) return match.result;
    const target = getChaseTarget(match) ?? first.runs + 1;
    const need = second ? Math.max(0, target - second.runs) : target;
    return formatTargetLabel(match) || `Need ${need} more · Target ${target}`;
  }
  if (match.result && !String(match.result).startsWith('Target:')) return match.result;
  if (match.toss) return `Toss: ${match.toss.winner} chose to ${match.toss.decision}`;
  return match.status === 'LIVE' ? 'First innings in progress' : (match.venue || '');
}

export function formatMatchWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-PK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
