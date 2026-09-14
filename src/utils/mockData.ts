import { Club, Tournament } from '../types';
import { DEFAULT_CLUB_ID, DEFAULT_TOURNAMENT_ID } from '../constants/scope';

export const DEFAULT_CLUB: Club = {
  id: DEFAULT_CLUB_ID,
  name: 'Community Cricket',
  shortName: 'CC',
  city: '',
  country: '',
  description: 'Starter organisation for legacy matches on AB Sports.',
  adminIds: [],
  createdAt: Date.UTC(2026, 0, 1),
  legacyAdopted: false,
};

export const TOURNAMENT: Tournament = {
  id: DEFAULT_TOURNAMENT_ID,
  clubId: DEFAULT_CLUB_ID,
  name: 'Open Season',
  season: 'Season 1',
  year: 2026,
  startDate: '2026-08-10',
  endDate: '2026-09-05',
  venue: 'Multiple Venues',
  status: 'ONGOING',
  format: 'T20',
  type: 'league',
  totalTeams: 0,
  totalMatches: 0,
  overs: 20,
  ballsPerOver: 6,
  wicketsPerInnings: 10,
  teamIds: [],
  pointsConfig: { win: 2, tie: 1, nr: 1 },
};
