import { Match, MatchSettings, Tournament } from '../types';

export const DEFAULT_MATCH_SETTINGS: MatchSettings = {
  ballsPerOver: 6,
  totalWickets: 10,
  lastManStands: false,
  countWideExtras: true,
  countNoBallExtras: true,
  addWideBallsToBatsman: false,
  addWideRunsToBatsman: false,
  addNoBallExtrasToBatsman: false,
};

export function settingsFromTournament(tournament?: Tournament | null): MatchSettings {
  return {
    ...DEFAULT_MATCH_SETTINGS,
    ballsPerOver: tournament?.ballsPerOver || 6,
    totalWickets: tournament?.wicketsPerInnings || 10,
  };
}

export function resolveMatchSettings(match?: Partial<Match> | null, tournament?: Tournament | null): MatchSettings {
  return {
    ...settingsFromTournament(tournament),
    ...(match?.settings || {}),
  };
}

export function allOutWickets(settings: MatchSettings): number {
  const base = Math.max(1, settings.totalWickets || 10);
  return settings.lastManStands ? base + 1 : base;
}

export function legalBallsPerOver(settings: MatchSettings): number {
  return Math.max(1, Math.min(8, settings.ballsPerOver || 6));
}

export function maxDeliveriesPerOver(settings: MatchSettings): number {
  return Math.max(legalBallsPerOver(settings), settings.maxBallsPerOverIncludingExtras || legalBallsPerOver(settings));
}
