/** Default club used for first launch and for adopting legacy unscoped data. */
export const DEFAULT_CLUB_ID = 'ahscore';
/** Keep this document id so existing fixtures stay linked. */
export const DEFAULT_TOURNAMENT_ID = 'MCL2026';

export const SCOPE_STORAGE_KEYS = {
  club: '@ahscore/selectedClubId',
  tournament: '@ahscore/selectedTournamentId',
} as const;

/** Sentinel: show every match in the club, including friendlies. */
export const ALL_TOURNAMENTS_ID = '__all__';
