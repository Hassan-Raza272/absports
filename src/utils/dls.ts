/**
 * ICC Duckworth–Lewis–Stern (Standard Edition) helpers for rain-affected
 * limited-overs matches. Resource table is the published 50-over Standard
 * Edition percentages; shorter matches are scaled so a full innings = 100%.
 */

import { Match } from '../types';

/** ICC Standard Edition G50 (average 50-over total). */
export const DLS_G50 = 245;

/**
 * Resources remaining (%) for overs left × wickets lost (0–9).
 * Source: ICC DLS/Stern Standard Edition (50-over table).
 * Rows = overs left (0..50). Columns = wickets lost (0..9).
 */
const RESOURCE_TABLE: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 0
  [4.7, 4.5, 4.1, 3.6, 2.9, 2.1, 1.3, 0.7, 0.2, 0], // 1
  [8.9, 8.5, 7.8, 6.8, 5.5, 4.0, 2.6, 1.4, 0.5, 0], // 2
  [12.7, 12.1, 11.1, 9.7, 7.9, 5.8, 3.8, 2.0, 0.8, 0], // 3
  [16.2, 15.4, 14.1, 12.4, 10.1, 7.5, 5.0, 2.7, 1.1, 0], // 4
  [19.4, 18.5, 17.0, 14.9, 12.2, 9.1, 6.1, 3.4, 1.4, 0], // 5
  [22.4, 21.3, 19.6, 17.2, 14.1, 10.6, 7.2, 4.1, 1.7, 0], // 6
  [25.2, 24.0, 22.1, 19.4, 16.0, 12.1, 8.3, 4.8, 2.1, 0], // 7
  [27.8, 26.5, 24.4, 21.5, 17.8, 13.5, 9.4, 5.5, 2.4, 0], // 8
  [30.3, 28.9, 26.6, 23.5, 19.5, 14.9, 10.4, 6.2, 2.8, 0], // 9
  [32.7, 31.1, 28.7, 25.3, 21.1, 16.2, 11.4, 6.9, 3.1, 0], // 10
  [34.9, 33.2, 30.7, 27.1, 22.6, 17.4, 12.4, 7.5, 3.5, 0], // 11
  [37.0, 35.2, 32.5, 28.7, 24.0, 18.6, 13.3, 8.2, 3.8, 0], // 12
  [39.0, 37.1, 34.3, 30.3, 25.4, 19.7, 14.2, 8.8, 4.2, 0], // 13
  [40.9, 38.9, 35.9, 31.8, 26.7, 20.8, 15.0, 9.4, 4.5, 0], // 14
  [42.7, 40.6, 37.5, 33.2, 27.9, 21.8, 15.8, 10.0, 4.9, 0], // 15
  [44.4, 42.2, 39.0, 34.5, 29.1, 22.8, 16.6, 10.6, 5.2, 0], // 16
  [46.0, 43.8, 40.4, 35.8, 30.2, 23.7, 17.3, 11.1, 5.5, 0], // 17
  [47.5, 45.2, 41.7, 37.0, 31.3, 24.6, 18.0, 11.6, 5.8, 0], // 18
  [49.0, 46.6, 43.0, 38.2, 32.3, 25.4, 18.7, 12.1, 6.1, 0], // 19
  [50.3, 47.9, 44.2, 39.3, 33.2, 26.2, 19.3, 12.6, 6.4, 0], // 20
  [51.7, 49.2, 45.4, 40.3, 34.2, 27.0, 20.0, 13.1, 6.7, 0], // 21
  [52.9, 50.4, 46.5, 41.3, 35.0, 27.7, 20.6, 13.5, 6.9, 0], // 22
  [54.1, 51.5, 47.5, 42.2, 35.9, 28.4, 21.1, 13.9, 7.2, 0], // 23
  [55.2, 52.6, 48.5, 43.1, 36.6, 29.1, 21.7, 14.3, 7.4, 0], // 24
  [56.3, 53.6, 49.5, 44.0, 37.4, 29.7, 22.2, 14.7, 7.6, 0], // 25
  [57.3, 54.6, 50.4, 44.8, 38.1, 30.3, 22.7, 15.1, 7.9, 0], // 26
  [58.3, 55.5, 51.2, 45.5, 38.7, 30.9, 23.2, 15.4, 8.1, 0], // 27
  [59.2, 56.4, 52.0, 46.3, 39.4, 31.4, 23.6, 15.8, 8.3, 0], // 28
  [60.1, 57.2, 52.8, 47.0, 40.0, 32.0, 24.0, 16.1, 8.5, 0], // 29
  [60.9, 58.0, 53.5, 47.6, 40.6, 32.5, 24.5, 16.4, 8.7, 0], // 30
  [61.7, 58.8, 54.2, 48.3, 41.1, 32.9, 24.9, 16.7, 8.9, 0], // 31
  [62.5, 59.5, 54.9, 48.9, 41.6, 33.4, 25.2, 17.0, 9.0, 0], // 32
  [63.2, 60.2, 55.5, 49.4, 42.1, 33.8, 25.6, 17.3, 9.2, 0], // 33
  [63.9, 60.9, 56.1, 50.0, 42.6, 34.2, 25.9, 17.5, 9.4, 0], // 34
  [64.6, 61.5, 56.7, 50.5, 43.0, 34.6, 26.3, 17.8, 9.5, 0], // 35
  [65.2, 62.1, 57.2, 51.0, 43.5, 35.0, 26.6, 18.0, 9.7, 0], // 36
  [65.8, 62.7, 57.8, 51.5, 43.9, 35.3, 26.9, 18.2, 9.8, 0], // 37
  [66.4, 63.2, 58.3, 51.9, 44.3, 35.7, 27.2, 18.5, 10.0, 0], // 38
  [67.0, 63.8, 58.8, 52.3, 44.6, 36.0, 27.4, 18.7, 10.1, 0], // 39
  [67.5, 64.3, 59.2, 52.8, 45.0, 36.3, 27.7, 18.9, 10.2, 0], // 40
  [68.0, 64.8, 59.7, 53.2, 45.3, 36.6, 28.0, 19.1, 10.4, 0], // 41
  [68.5, 65.2, 60.1, 53.5, 45.7, 36.9, 28.2, 19.3, 10.5, 0], // 42
  [69.0, 65.7, 60.5, 53.9, 46.0, 37.1, 28.4, 19.4, 10.6, 0], // 43
  [69.4, 66.1, 60.9, 54.2, 46.3, 37.4, 28.7, 19.6, 10.7, 0], // 44
  [69.9, 66.5, 61.3, 54.6, 46.6, 37.6, 28.9, 19.8, 10.8, 0], // 45
  [70.3, 66.9, 61.6, 54.9, 46.8, 37.9, 29.1, 19.9, 10.9, 0], // 46
  [70.7, 67.3, 62.0, 55.2, 47.1, 38.1, 29.3, 20.1, 11.0, 0], // 47
  [71.1, 67.6, 62.3, 55.5, 47.3, 38.3, 29.5, 20.2, 11.1, 0], // 48
  [71.4, 68.0, 62.6, 55.8, 47.6, 38.5, 29.6, 20.3, 11.2, 0], // 49
  [71.8, 68.3, 62.9, 56.0, 47.8, 38.7, 29.8, 20.5, 11.3, 0], // 50 — note: full table start is 100; we scale below
];

// Official start-of-innings (50 ov, 0 wkts) is 100%. Patch cell to match ICC.
RESOURCE_TABLE[50][0] = 100.0;
RESOURCE_TABLE[50][1] = 93.4;
RESOURCE_TABLE[50][2] = 85.1;
RESOURCE_TABLE[50][3] = 74.9;
RESOURCE_TABLE[50][4] = 62.7;
RESOURCE_TABLE[50][5] = 49.0;
RESOURCE_TABLE[50][6] = 34.9;
RESOURCE_TABLE[50][7] = 22.0;
RESOURCE_TABLE[50][8] = 11.9;
RESOURCE_TABLE[50][9] = 4.7;

export type DlsInterruption = {
  at: number;
  innings: 1 | 2;
  oversBowled: number;
  ballsBowled: number;
  wickets: number;
  revisedOvers: number;
  revisedTarget?: number;
  team1ResourcePct: number;
  team2ResourcePct: number;
  note: string;
};

export type DlsState = {
  applied: boolean;
  originalOvers: number;
  /** Overs allotted to Team 1 (may be reduced by rain in 1st innings). */
  team1Overs: number;
  /** Overs allotted to Team 2 (chase). */
  team2Overs: number;
  team1ResourcePct: number;
  team2ResourcePct: number;
  /** Runs required to win (set once Team 1 score is known). */
  revisedTarget?: number;
  /** Latest par score if play stopped mid-chase. */
  parScore?: number;
  interruptions: DlsInterruption[];
  updatedAt: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Absolute ICC table resource remaining for overs left & wickets lost. */
export function absoluteResource(oversLeft: number, wicketsLost: number): number {
  const w = clamp(Math.floor(wicketsLost), 0, 9);
  const whole = Math.floor(oversLeft);
  const frac = oversLeft - whole;
  if (whole >= 50) {
    const at50 = RESOURCE_TABLE[50][w];
    // Beyond 50 is rare; treat as 50.
    return at50;
  }
  if (whole <= 0) {
    return frac > 0
      ? RESOURCE_TABLE[1][w] * frac
      : RESOURCE_TABLE[0][w];
  }
  const low = RESOURCE_TABLE[whole][w];
  if (frac <= 0 || whole >= 50) return low;
  const high = RESOURCE_TABLE[Math.min(50, whole + 1)][w];
  return low + (high - low) * frac;
}

/**
 * Resource % for a match scheduled/allotted `matchOvers`, with `oversLeft`
 * remaining and `wicketsLost` down. Scaled so full allotted innings = 100%.
 */
export function resourcePercent(
  matchOvers: number,
  oversLeft: number,
  wicketsLost: number,
): number {
  const full = absoluteResource(matchOvers, 0);
  if (full <= 0) return 0;
  return (absoluteResource(oversLeft, wicketsLost) / full) * 100;
}

export function oversLeftFromScore(
  allottedOvers: number,
  oversBowled: number,
  ballsBowled: number,
): number {
  const ballsLeft = Math.max(0, allottedOvers * 6 - (oversBowled * 6 + ballsBowled));
  return ballsLeft / 6;
}

export function resourcesUsed(
  allottedOvers: number,
  oversBowled: number,
  ballsBowled: number,
  wicketsLost: number,
): number {
  const left = oversLeftFromScore(allottedOvers, oversBowled, ballsBowled);
  const remaining = resourcePercent(allottedOvers, left, wicketsLost);
  return Math.max(0, Math.min(100, 100 - remaining));
}

/** Minimum overs each side must face for a DLS result (league-friendly). */
export function minOversForResult(scheduledOvers: number): number {
  if (scheduledOvers <= 20) return 5;
  if (scheduledOvers <= 40) return 10;
  return 20;
}

export function canDecideByDls(params: {
  scheduledOvers: number;
  team2OversBowled: number;
  team2Balls: number;
}): boolean {
  const min = minOversForResult(params.scheduledOvers);
  const faced = params.team2OversBowled + (params.team2Balls > 0 ? params.team2Balls / 6 : 0);
  return faced + 1e-9 >= min;
}

/**
 * Revised target (runs to win) using Stern Standard Edition.
 * team1ResourcePct / team2ResourcePct are scaled 0–100 for the match.
 */
export function calculateRevisedTarget(params: {
  team1Score: number;
  team1ResourcePct: number;
  team2ResourcePct: number;
  g50?: number;
}): number {
  const S = Math.max(0, params.team1Score);
  const R1 = Math.max(0.01, params.team1ResourcePct);
  const R2 = Math.max(0, params.team2ResourcePct);
  const G50 = params.g50 ?? DLS_G50;

  if (R2 < R1) {
    return Math.floor(S * R2 / R1) + 1;
  }
  if (Math.abs(R2 - R1) < 0.05) {
    return S + 1;
  }
  // Team 2 has more resources than Team 1 (rare when Team 1 was shortened more).
  return S + Math.floor(G50 * (R2 - R1) / 100) + 1;
}

/** Par score for Team 2 at the moment play is cut permanently. */
export function calculateParScore(params: {
  team1Score: number;
  team1ResourcePct: number;
  team2ResourcesUsedPct: number;
}): number {
  const R1 = Math.max(0.01, params.team1ResourcePct);
  return Math.floor(params.team1Score * params.team2ResourcesUsedPct / R1);
}

export function getEffectiveOvers(match: Match, innings: 1 | 2): number {
  if (!match.dls?.applied) return match.overs;
  return innings === 1 ? match.dls.team1Overs : match.dls.team2Overs;
}

/** Runs needed to win in the chase (DLS-aware). */
export function getChaseTarget(match: Match): number | undefined {
  const first = match.innings?.first;
  if (!first) return undefined;
  if (match.dls?.applied && match.dls.revisedTarget != null) {
    return match.dls.revisedTarget;
  }
  return first.runs + 1;
}

export function formatTargetLabel(match: Match): string {
  const target = getChaseTarget(match);
  if (target == null) return '';
  if (match.dls?.applied && match.dls.revisedTarget != null) {
    const ov = match.dls.team2Overs;
    return `Target: ${target} runs (DLS · ${ov} ov)`;
  }
  return `Target: ${target} runs`;
}

export function dlsResultSuffix(match: Match): string {
  return match.dls?.applied ? ' (DLS method)' : '';
}

function team1ResourceAgainstOriginal(params: {
  originalOvers: number;
  team1Overs: number;
  oversBowled: number;
  balls: number;
  wickets: number;
}): number {
  const t1AbsFull = absoluteResource(params.originalOvers, 0);
  const t1StartAbs = absoluteResource(params.team1Overs, 0);
  if (t1AbsFull <= 0) return 100;
  if (params.wickets >= 10) return (t1StartAbs / t1AbsFull) * 100;
  const left = oversLeftFromScore(params.team1Overs, params.oversBowled, params.balls);
  const usedAbs = t1StartAbs - absoluteResource(left, params.wickets);
  return (usedAbs / t1AbsFull) * 100;
}

/**
 * Build / refresh DLS state when the scorer revises overs for the batting side.
 */
export function buildDlsRevision(params: {
  match: Match;
  inningsNumber: 1 | 2;
  /** New maximum overs for the side currently affected. */
  revisedOvers: number;
  team1Score: number;
  team1OversBowled: number;
  team1Balls: number;
  team1Wickets: number;
  team1InningsComplete: boolean;
  team2OversBowled: number;
  team2Balls: number;
  team2Wickets: number;
}): { dls: DlsState; previewNote: string } {
  const original = params.match.dls?.originalOvers ?? params.match.overs;
  const prev = params.match.dls;
  const revised = Math.max(1, Math.floor(params.revisedOvers));
  const t1AbsFull = absoluteResource(original, 0);

  let team1Overs = prev?.team1Overs ?? original;
  let team2Overs = prev?.team2Overs ?? original;
  let team1ResourcePct: number;
  let team2ResourcePct: number;

  if (params.inningsNumber === 1) {
    team1Overs = revised;
    team2Overs = revised;
    team1ResourcePct = t1AbsFull > 0 ? (absoluteResource(team1Overs, 0) / t1AbsFull) * 100 : 100;
    team2ResourcePct = team1ResourcePct;
  } else if (params.team2OversBowled === 0 && params.team2Balls === 0) {
    team2Overs = revised;
    team1ResourcePct = team1ResourceAgainstOriginal({
      originalOvers: original,
      team1Overs,
      oversBowled: params.team1OversBowled,
      balls: params.team1Balls,
      wickets: params.team1Wickets,
    });
    team2ResourcePct = t1AbsFull > 0
      ? (absoluteResource(team2Overs, 0) / t1AbsFull) * 100
      : 100;
  } else {
    team2Overs = revised;
    team1ResourcePct = team1ResourceAgainstOriginal({
      originalOvers: original,
      team1Overs,
      oversBowled: params.team1OversBowled,
      balls: params.team1Balls,
      wickets: params.team1Wickets,
    });
    const oldAllot = prev?.team2Overs ?? original;
    const leftOld = oversLeftFromScore(oldAllot, params.team2OversBowled, params.team2Balls);
    const usedAbs2 = absoluteResource(oldAllot, 0) - absoluteResource(leftOld, params.team2Wickets);
    const leftNew = oversLeftFromScore(team2Overs, params.team2OversBowled, params.team2Balls);
    const remainAbs2 = absoluteResource(leftNew, params.team2Wickets);
    team2ResourcePct = t1AbsFull > 0 ? ((usedAbs2 + remainAbs2) / t1AbsFull) * 100 : 100;
  }

  let revisedTarget: number | undefined;
  let previewNote: string;

  if (params.inningsNumber === 2 || params.team1InningsComplete) {
    revisedTarget = calculateRevisedTarget({
      team1Score: params.team1Score,
      team1ResourcePct,
      team2ResourcePct,
    });
    previewNote =
      `Team 1 resources ${team1ResourcePct.toFixed(1)}% · Team 2 resources ${team2ResourcePct.toFixed(1)}%\n` +
      `Revised target: ${revisedTarget} in ${team2Overs} overs`;
  } else {
    previewNote =
      `1st innings cut to ${team1Overs} overs. Both sides on ${team1ResourcePct.toFixed(1)}% resources.\n` +
      `Target will be set when the first innings ends.`;
  }

  const interruption: DlsInterruption = {
    at: Date.now(),
    innings: params.inningsNumber,
    oversBowled: params.inningsNumber === 1 ? params.team1OversBowled : params.team2OversBowled,
    ballsBowled: params.inningsNumber === 1 ? params.team1Balls : params.team2Balls,
    wickets: params.inningsNumber === 1 ? params.team1Wickets : params.team2Wickets,
    revisedOvers: revised,
    revisedTarget,
    team1ResourcePct,
    team2ResourcePct,
    note: previewNote,
  };

  const dls: DlsState = {
    applied: true,
    originalOvers: original,
    team1Overs,
    team2Overs,
    team1ResourcePct,
    team2ResourcePct,
    revisedTarget,
    interruptions: [...(prev?.interruptions || []), interruption],
    updatedAt: Date.now(),
  };

  return { dls, previewNote };
}

/** Finalize Team 1 resources when 1st innings ends (for later DLS cuts). */
export function finalizeTeam1Resources(match: Match, first: {
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
}): DlsState {
  const original = match.dls?.originalOvers ?? match.overs;
  const team1Overs = match.dls?.team1Overs ?? original;
  const team2Overs = match.dls?.team2Overs ?? original;
  const t1AbsFull = absoluteResource(original, 0);
  const t1StartAbs = absoluteResource(team1Overs, 0);
  let team1ResourcePct: number;
  if (first.wickets >= 10) {
    team1ResourcePct = t1AbsFull > 0 ? (t1StartAbs / t1AbsFull) * 100 : 100;
  } else {
    const left = oversLeftFromScore(team1Overs, first.overs, first.balls);
    const usedAbs = t1StartAbs - absoluteResource(left, first.wickets);
    team1ResourcePct = t1AbsFull > 0 ? (usedAbs / t1AbsFull) * 100 : 100;
  }
  const team2ResourcePct = t1AbsFull > 0
    ? (absoluteResource(team2Overs, 0) / t1AbsFull) * 100
    : 100;
  const revisedTarget = calculateRevisedTarget({
    team1Score: first.runs,
    team1ResourcePct,
    team2ResourcePct,
  });

  return {
    applied: !!(match.dls?.applied || team1Overs !== original || team2Overs !== original),
    originalOvers: original,
    team1Overs,
    team2Overs,
    team1ResourcePct,
    team2ResourcePct,
    revisedTarget: (match.dls?.applied || team1Overs !== original || team2Overs !== original)
      ? revisedTarget
      : undefined,
    interruptions: match.dls?.interruptions || [],
    updatedAt: Date.now(),
  };
}

export function decideMatchByDls(params: {
  match: Match;
  team1Score: number;
  team1Wickets: number;
  team1Overs: number;
  team1Balls: number;
  team2Score: number;
  team2Wickets: number;
  team2OversBowled: number;
  team2Balls: number;
  battingTeamName: string;
  bowlingTeamName: string;
}): { result: string; parScore: number; dls: DlsState } {
  const original = params.match.dls?.originalOvers ?? params.match.overs;
  const team1Overs = params.match.dls?.team1Overs ?? original;
  const team2Overs = params.match.dls?.team2Overs ?? original;
  const t1AbsFull = absoluteResource(original, 0);
  const t1StartAbs = absoluteResource(team1Overs, 0);

  let team1ResourcePct: number;
  if (params.team1Wickets >= 10) {
    team1ResourcePct = t1AbsFull > 0 ? (t1StartAbs / t1AbsFull) * 100 : 100;
  } else {
    const left = oversLeftFromScore(team1Overs, params.team1Overs, params.team1Balls);
    team1ResourcePct = t1AbsFull > 0
      ? ((t1StartAbs - absoluteResource(left, params.team1Wickets)) / t1AbsFull) * 100
      : 100;
  }

  const left2 = oversLeftFromScore(team2Overs, params.team2OversBowled, params.team2Balls);
  const usedAbs2 = absoluteResource(team2Overs, 0) - absoluteResource(left2, params.team2Wickets);
  // If play ends now, Team 2 gets no remaining resources.
  const team2UsedPct = t1AbsFull > 0 ? (usedAbs2 / t1AbsFull) * 100 : 100;

  const parScore = calculateParScore({
    team1Score: params.team1Score,
    team1ResourcePct,
    team2ResourcesUsedPct: team2UsedPct,
  });

  let result: string;
  if (params.team2Score > parScore) {
    result = `${params.battingTeamName} won by ${10 - params.team2Wickets} wickets (DLS method)`;
  } else if (params.team2Score < parScore) {
    result = `${params.bowlingTeamName} won by ${parScore - params.team2Score} runs (DLS method)`;
  } else {
    result = 'Match tied (DLS method)';
  }

  const dls: DlsState = {
    applied: true,
    originalOvers: original,
    team1Overs,
    team2Overs,
    team1ResourcePct,
    team2ResourcePct: team2UsedPct,
    revisedTarget: params.match.dls?.revisedTarget,
    parScore,
    interruptions: [
      ...(params.match.dls?.interruptions || []),
      {
        at: Date.now(),
        innings: 2,
        oversBowled: params.team2OversBowled,
        ballsBowled: params.team2Balls,
        wickets: params.team2Wickets,
        revisedOvers: team2Overs,
        revisedTarget: params.match.dls?.revisedTarget,
        team1ResourcePct,
        team2ResourcePct: team2UsedPct,
        note: `Play abandoned. Par ${parScore}. ${result}`,
      },
    ],
    updatedAt: Date.now(),
  };

  return { result, parScore, dls };
}
