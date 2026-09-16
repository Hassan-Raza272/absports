// ─── User Roles ────────────────────────────────────────────────────────────────
export type UserRole = 'superadmin' | 'admin' | 'scorer' | 'manager' | 'public';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId?: string;
  photoURL?: string;
  currentClubId?: string;
  currentTournamentId?: string;
  clubIds?: string[];
  /** Super admin grant: this account may use Go Live on the scorecard. Superadmins always can. */
  canGoLive?: boolean;
  /** Inclusive calendar window for Go Live. Required for non-superadmin access. */
  goLiveAccess?: GoLiveAccess;
}

export interface GoLiveAccess {
  startAt: number;
  endAt: number;
}

// ─── Team ──────────────────────────────────────────────────────────────────────
export interface Team {
  id: string;
  clubId: string;
  createdBy?: string;
  name: string;
  shortName: string;
  logoURL?: string;
  primaryColor: string;
  secondaryColor: string;
  captain: string;
  viceCaptain: string;
  coach: string;
  owner: string;
  homeGround: string;
  playerIds: string[];
  stats: {
    played: number;
    won: number;
    lost: number;
    nr: number;
    nrr: number;
    points: number;
  };
}

// ─── Player ────────────────────────────────────────────────────────────────────
export type PlayerRole = 'Batter' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';
export type BattingStyle = 'Right-hand Bat' | 'Left-hand Bat';
export type BowlingStyle =
  | 'Right-arm Fast'
  | 'Right-arm Medium'
  | 'Right-arm Off-spin'
  | 'Right-arm Leg-spin'
  | 'Left-arm Fast'
  | 'Left-arm Medium'
  | 'Left-arm Spin'
  | 'N/A';

export interface Player {
  id: string;
  clubId: string;
  name: string;
  teamId: string;
  teamName: string;
  photoURL?: string;
  jerseyNumber: number;
  role: PlayerRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  nationality: string;
  dateOfBirth: string;
  battingStats: {
    matches: number;
    innings: number;
    runs: number;
    balls: number;
    notOuts: number;
    highScore: number;
    average: number;
    strikeRate: number;
    fours: number;
    sixes: number;
    fifties: number;
    hundreds: number;
  };
  bowlingStats: {
    innings: number;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
    economy: number;
    average: number;
    bestFigures: string;
    fourWickets: number;
    fiveWickets: number;
  };
  fieldingStats: {
    catches: number;
    stumpings: number;
    runOuts: number;
  };
  /** Manually added past innings (Stumps-style career builder). */
  addedScores?: AddedScore[];
}

export interface AddedScore {
  id: string;
  date: string;
  format: MatchFormat;
  against?: string;
  runs?: number;
  balls?: number;
  wickets?: number;
  overs?: number;
  note?: string;
}

// ─── Match ─────────────────────────────────────────────────────────────────────
export type MatchStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'ABANDONED';
export type MatchStage = 'league' | 'group' | 'QF' | 'SF' | 'Final' | '3rd_place' | 'playoff';

export interface Match {
  id: string;
  clubId: string;
  /** User id of who created/scheduled this match. Used to scope Go Live to own matches. */
  createdBy?: string;
  /** Absent or empty = friendly / standalone match (not part of a tournament). */
  tournamentId?: string;
  matchNumber: number;
  teamA: string; // teamId
  teamB: string;
  teamAName: string;
  teamBName: string;
  teamALogo?: string;
  teamBLogo?: string;
  venue: string;
  dateTime: string; // ISO string
  overs: number;
  settings?: MatchSettings;
  status: MatchStatus;
  toss?: {
    winner: string;
    decision: 'bat' | 'bowl';
  };
  result?: string;
  playerOfMatch?: string;
  innings: {
    first?: InningsSummary;
    second?: InningsSummary;
  };
  currentInnings?: 1 | 2;
  umpires?: string[];
  /** Knockout / hybrid stage label (e.g. QF, SF, Final). */
  stage?: MatchStage;
  /** Bracket round index (0 = first knockout round). */
  round?: number;
  /** Optional Playing XI names collected before or during scoring. Not required to start. */
  playingXI?: {
    teamA: string[];
    teamB: string[];
  };
  /** Persisted scorer workspace. This lets a live match resume after navigation or an app restart. */
  liveScoring?: LiveScoringSession;
  /**
   * ICC DLS/Stern revision when rain (or similar) shortens overs.
   * When applied, chase target and innings overs limits come from here.
   */
  dls?: {
    applied: boolean;
    originalOvers: number;
    team1Overs: number;
    team2Overs: number;
    team1ResourcePct: number;
    team2ResourcePct: number;
    revisedTarget?: number;
    parScore?: number;
    interruptions: Array<{
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
    }>;
    updatedAt: number;
  };
}

export interface MatchSettings {
  ballsPerOver: number;
  totalWickets: number;
  lastManStands: boolean;
  countWideExtras: boolean;
  countNoBallExtras: boolean;
  addWideBallsToBatsman: boolean;
  addWideRunsToBatsman: boolean;
  addNoBallExtrasToBatsman: boolean;
  /** Junior cricket: over ends after this many deliveries (legal + extras), or legal ballsPerOver. */
  maxBallsPerOverIncludingExtras?: number;
}

export interface LiveScoringSession {
  setupComplete: boolean;
  battingTeam: 'A' | 'B';
  strikerName: string;
  nonStrikerName: string;
  bowlerName: string;
  strikerRuns: number;
  strikerBalls: number;
  strikerFours?: number;
  strikerSixes?: number;
  nonStrikerRuns: number;
  nonStrikerBalls: number;
  nonStrikerFours?: number;
  nonStrikerSixes?: number;
  bowlerOvers: number;
  bowlerBalls: number;
  bowlerRuns: number;
  bowlerWickets: number;
  bowlingFigures: Record<string, {
    overs: number;
    balls: number;
    runs: number;
    wickets: number;
  }>;
  /** Dismissed batters for the current innings (full scorecard rows). */
  battingCard?: Array<{
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours: number;
    sixes: number;
    strikeRate: number;
    status: string;
    out?: string;
  }>;
  ballLog: string[];
  dismissedBatterNames: string[];
  /**
   * Full undo stack so a scorer can reverse every ball even after
   * closing and reopening the app mid-match.
   */
  undoHistory?: Array<{
    inningsNumber: 1 | 2;
    battingTeam: 'A' | 'B';
    runs: number;
    wickets: number;
    overs: number;
    balls: number;
    extras: { wides: number; noBalls: number; byes: number; legByes: number };
    ballLog: string[];
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
    bowlerName: string;
    bowlerOvers: number;
    bowlerBalls: number;
    bowlerRuns: number;
    bowlerWickets: number;
    bowlingFigures: Record<string, { overs: number; balls: number; runs: number; wickets: number }>;
    battingCard: Array<{
      playerId: string;
      name: string;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
      strikeRate: number;
      status: string;
      out?: string;
    }>;
    dismissedBatterNames: string[];
  }>;
  /** True once career stats from this match have been written to player docs. */
  statsApplied?: boolean;
  updatedAt: number;
  updatedBy?: string;
}

export interface InningsSummary {
  battingTeam?: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  extras?: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    total: number;
  };
  batting?: Array<{
    playerId: string;
    name: string;
    runs: number;
    balls: number;
    fours?: number;
    sixes?: number;
    strikeRate?: number;
    status?: string;
    out?: string;
  }>;
  bowling?: Array<{
    playerId: string;
    name: string;
    overs: number;
    maidens?: number;
    runs: number;
    wickets: number;
    economy?: number;
  }>;
}

// ─── Ball ──────────────────────────────────────────────────────────────────────
export type ExtraType = 'wide' | 'noBall' | 'bye' | 'legBye' | null;
export type DismissalType =
  | 'bowled'
  | 'caught'
  | 'lbw'
  | 'runOut'
  | 'stumped'
  | 'hitWicket'
  | 'retired'
  | null;

export interface Ball {
  id: string;
  matchId: string;
  inningsNumber: 1 | 2;
  overNumber: number;
  ballNumber: number;
  batsmanId: string;
  batsmanName: string;
  bowlerId: string;
  bowlerName: string;
  runs: number; // runs off bat
  extraRuns: number;
  extraType: ExtraType;
  isWicket: boolean;
  dismissalType: DismissalType;
  dismissedPlayerId?: string;
  dismissedPlayerName?: string;
  fielderId?: string;
  fielderName?: string;
  commentary: string;
  timestamp: number;
}

// ─── Points Table ──────────────────────────────────────────────────────────────
export interface PointsTableEntry {
  clubId?: string;
  tournamentId?: string;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  shortName: string;
  played: number;
  won: number;
  lost: number;
  nr: number;
  nrr: number;
  points: number;
  lastFive: ('W' | 'L' | 'NR')[];
}

// ─── Club / Organisation ───────────────────────────────────────────────────────
export type MatchFormat = 'T20' | 'ODI' | 'TEST' | 'CUSTOM';
export type TournamentType = 'league' | 'knockout' | 'hybrid' | 'friendly';
export type TournamentCategory =
  | 'open'
  | 'corporate'
  | 'community'
  | 'school'
  | 'other'
  | 'series'
  | 'college'
  | 'university';
export type BallType = 'tennis' | 'leather' | 'other';
export type PitchType = 'rough' | 'cement' | 'turf' | 'astroturf' | 'matting';
export type TournamentMatchKind = 'limited' | 'box' | 'pair' | 'test' | 'hundred';

export interface TournamentGroup {
  id: string;
  name: string;
  teamIds: string[];
}

export interface Club {
  id: string;
  name: string;
  shortName: string;
  logoURL?: string;
  city?: string;
  country?: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  description?: string;
  ownerId?: string;
  adminIds: string[];
  adminEmails?: string[];
  createdAt: number;
  hallOfFame?: HallOfFameEntry[];
  /** True after unscoped legacy docs were tagged with this club id. */
  legacyAdopted?: boolean;
}

export interface HallOfFameEntry {
  id: string;
  playerId?: string;
  playerName: string;
  title: string;
  year: number;
  note?: string;
}

// ─── Tournament ────────────────────────────────────────────────────────────────
export interface Tournament {
  id: string;
  clubId: string;
  /** User id of who created this competition. */
  createdBy?: string;
  name: string;
  season: string;
  year: number;
  logoURL?: string;
  bannerURL?: string;
  bannerPresetId?: string;
  city?: string;
  organiserName?: string;
  organiserPhone?: string;
  organiserEmail?: string;
  category?: TournamentCategory;
  ballType?: BallType;
  pitchType?: PitchType;
  matchKind?: TournamentMatchKind;
  homeAway?: boolean;
  needsMoreTeams?: boolean;
  needsOfficials?: boolean;
  startDate: string;
  endDate: string;
  venue: string;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED';
  format: MatchFormat;
  type: TournamentType;
  totalTeams: number;
  totalMatches: number;
  overs: number;
  ballsPerOver?: number;
  wicketsPerInnings?: number;
  /** Club team ids enrolled in this competition. */
  teamIds?: string[];
  /** Optional pools for hybrid / multi-group leagues. */
  groups?: TournamentGroup[];
  pointsConfig?: {
    win: number;
    tie: number;
    nr: number;
  };
  /** Manual point adjustments applied after auto NRR/table calc. */
  pointsOverrides?: Record<string, number>;
}

// ─── Stats ─────────────────────────────────────────────────────────────────────
export interface StatLeader {
  playerId: string;
  playerName: string;
  playerPhoto?: string;
  teamName: string;
  teamLogo?: string;
  value: number;
  secondary?: string;
}

// ─── Navigation ────────────────────────────────────────────────────────────────
export type RootStackParamList = {
  Splash: undefined;
  Main: undefined;
  TeamsList: undefined;
  PlayersList: undefined;
  StatsList: undefined;
  MyMatches: undefined;
  MyTournaments: undefined;
  AccountProfile: undefined;
  MyTeams: undefined;
  ChannelVideos: undefined;
  TeamProfile: { teamId: string };
  PlayerProfile: { playerId: string };
  PlayerCompare: { playerId?: string };
  TeamCompare: { teamId?: string };
  MatchCenter: { matchId: string; match?: Match };
  WhatIf: undefined;
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminTournaments: { openCreate?: boolean } | undefined;
  CreateTournament: undefined;
  CreateMatch: undefined;
  AdminTournamentDetail: { tournamentId: string; tab?: 'overview' | 'teams' | 'fixtures' | 'table' };
  AdminTeams: undefined;
  AdminPlayers: undefined;
  AdminFixtures: undefined;
  AdminQuickMatch: undefined;
  AdminLiveScoring: { matchId: string };
  AdminBroadcast: { matchId: string };
  Login: undefined;
  Signup: undefined;
};

export type BottomTabParamList = {
  Home: undefined;
  Matches: undefined;
  Discover: { initialFilter?: 'all' | 'live' | 'upcoming' | 'results' | 'tournaments' | 'teams' } | undefined;
  More: undefined;
};
