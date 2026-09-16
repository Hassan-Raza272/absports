import { useMemo } from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Match, Team, Player, User, PointsTableEntry, Tournament, Club } from '../types';
import { ALL_TOURNAMENTS_ID, SCOPE_STORAGE_KEYS } from '../constants/scope';

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

// ─── Auth Store ─────────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (val: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>(set => ({
  user: null, // Start logged out by default
  isLoading: false,
  isAuthenticated: false,
  setUser: user => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: isLoading => set({ isLoading }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

// ─── Scope (selected club + tournament) ─────────────────────────────────────────
interface ScopeState {
  selectedClubId: string | null;
  selectedTournamentId: string | null;
  hydrated: boolean;
  setScope: (clubId: string | null, tournamentId?: string | null) => void;
  selectClub: (clubId: string, tournamentId?: string | null) => void;
  selectTournament: (tournamentId: string | null) => void;
  hydrate: (clubId: string | null, tournamentId: string | null) => void;
}

function persistScope(clubId: string | null, tournamentId: string | null) {
  Promise.all([
    AsyncStorage.setItem(SCOPE_STORAGE_KEYS.club, clubId || ''),
    AsyncStorage.setItem(SCOPE_STORAGE_KEYS.tournament, tournamentId || ''),
  ]).catch(() => {});
}

export const useScopeStore = create<ScopeState>(set => ({
  selectedClubId: null,
  selectedTournamentId: null,
  hydrated: false,
  setScope: (clubId, tournamentId = null) => {
    set({ selectedClubId: clubId, selectedTournamentId: tournamentId ?? null });
    persistScope(clubId, tournamentId ?? null);
  },
  selectClub: (clubId, tournamentId = null) => {
    set({ selectedClubId: clubId, selectedTournamentId: tournamentId ?? null });
    persistScope(clubId, tournamentId ?? null);
  },
  selectTournament: tournamentId => {
    set(state => {
      persistScope(state.selectedClubId, tournamentId);
      return { selectedTournamentId: tournamentId };
    });
  },
  hydrate: (clubId, tournamentId) =>
    set({ selectedClubId: clubId, selectedTournamentId: tournamentId, hydrated: true }),
}));

export async function hydrateScopeFromStorage() {
  try {
    const [clubId, tournamentId] = await Promise.all([
      AsyncStorage.getItem(SCOPE_STORAGE_KEYS.club),
      AsyncStorage.getItem(SCOPE_STORAGE_KEYS.tournament),
    ]);
    useScopeStore.getState().hydrate(clubId || null, tournamentId || null);
  } catch {
    useScopeStore.getState().hydrate(null, null);
  }
}

function matchInTournamentScope(match: Match, tournamentId: string | null): boolean {
  if (!tournamentId || tournamentId === ALL_TOURNAMENTS_ID) return true;
  return match.tournamentId === tournamentId;
}

/** Matches visible for the selected club + tournament. Friendlies and live always stay visible. */
export function useScopedMatches(): Match[] {
  const matches = useMatchesStore(state => state.matches);
  const publicLive = usePublicFeedStore(state => state.liveMatches);
  const publicUpcoming = usePublicFeedStore(state => state.upcomingMatches);
  const clubId = useScopeStore(state => state.selectedClubId);
  const tournamentId = useScopeStore(state => state.selectedTournamentId);
  return useMemo(() => {
    const inClub = (match: Match) => !clubId || match.clubId === clubId;
    const byId = new Map<string, Match>();
    for (const match of matches) {
      if (!matchInTournamentScope(match, tournamentId)) continue;
      byId.set(match.id, match);
    }
    // Public feeds often arrive before club queries — merge so home stats don't stick at 0.
    for (const match of [...publicLive, ...publicUpcoming]) {
      if (!inClub(match) || !matchInTournamentScope(match, tournamentId)) continue;
      const existing = byId.get(match.id);
      byId.set(match.id, existing ? { ...existing, ...match } : match);
    }
    return Array.from(byId.values());
  }, [matches, publicLive, publicUpcoming, clubId, tournamentId]);
}

export function useTournamentMatches(): Match[] {
  const matches = useMatchesStore(state => state.matches);
  const tournamentId = useScopeStore(state => state.selectedTournamentId);
  return useMemo(() => {
    if (!tournamentId || tournamentId === ALL_TOURNAMENTS_ID) {
      return matches.filter(m => !!m.tournamentId);
    }
    return matches.filter(m => m.tournamentId === tournamentId);
  }, [matches, tournamentId]);
}

export function useScopeLabels() {
  const clubId = useScopeStore(state => state.selectedClubId);
  const tournamentId = useScopeStore(state => state.selectedTournamentId);
  const club = useClubsStore(state => state.clubs.find(c => c.id === clubId));
  const tournament = useTournamentsStore(state => state.tournaments.find(t => t.id === tournamentId));
  const clubName = club?.name || 'AB Sports';
  const tournamentName = tournament?.name || 'All matches';
  return {
    club,
    tournament,
    clubName,
    tournamentName: tournamentId === ALL_TOURNAMENTS_ID ? 'All matches' : tournamentName,
    subtitle: tournamentId === ALL_TOURNAMENTS_ID
      ? 'All matches'
      : tournament ? tournament.name : 'AB Sports',
  };
}

// ─── Clubs Store ────────────────────────────────────────────────────────────────
interface ClubsState {
  clubs: Club[];
  ready: boolean;
  setClubs: (clubs: Club[]) => void;
  addClub: (club: Club) => void;
  updateClub: (id: string, club: Partial<Club>) => void;
  getClubById: (id: string) => Club | undefined;
}

export const useClubsStore = create<ClubsState>((set, get) => ({
  clubs: [],
  ready: false,
  setClubs: clubs => set({ clubs, ready: true }),
  addClub: club => set(state => ({
    clubs: state.clubs.some(c => c.id === club.id) ? state.clubs : [...state.clubs, club],
  })),
  updateClub: (id, updated) =>
    set(state => ({
      clubs: state.clubs.map(c => (c.id === id ? { ...c, ...updated } : c)),
    })),
  getClubById: id => get().clubs.find(c => c.id === id),
}));

// ─── Tournaments Store ──────────────────────────────────────────────────────────
interface TournamentsState {
  tournaments: Tournament[];
  tournament: Tournament | null;
  ready: boolean;
  setTournaments: (tournaments: Tournament[]) => void;
  setTournament: (t: Tournament | null) => void;
  addTournament: (t: Tournament) => void;
  updateTournament: (id: string, t: Partial<Tournament>) => void;
  getTournamentById: (id: string) => Tournament | undefined;
  setReady: (ready: boolean) => void;
}

export const useTournamentsStore = create<TournamentsState>((set, get) => ({
  tournaments: [],
  tournament: null,
  ready: false,
  setReady: ready => set({ ready }),
  setTournaments: tournaments => {
    const next = uniqueById(tournaments);
    const selectedId = useScopeStore.getState().selectedTournamentId;
    const current =
      next.find(t => t.id === selectedId) ||
      next[0] ||
      null;
    set({ tournaments: next, tournament: current, ready: true });
  },
  setTournament: tournament => set({ tournament }),
  addTournament: tournament =>
    set(state => ({
      tournaments: state.tournaments.some(t => t.id === tournament.id)
        ? state.tournaments
        : [...state.tournaments, tournament],
      tournament: state.tournament || tournament,
    })),
  updateTournament: (id, updated) =>
    set(state => {
      const tournaments = state.tournaments.map(t => (t.id === id ? { ...t, ...updated } : t));
      const tournament = tournaments.find(t => t.id === (state.tournament?.id || id)) || state.tournament;
      return { tournaments, tournament };
    }),
  getTournamentById: id => get().tournaments.find(t => t.id === id),
}));

// ─── Teams Store ────────────────────────────────────────────────────────────────
interface TeamsState {
  teams: Team[];
  ready: boolean;
  setTeams: (teams: Team[]) => void;
  addTeam: (team: Team) => void;
  updateTeam: (id: string, team: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  getTeamById: (id: string) => Team | undefined;
  clearTeams: () => void;
  setReady: (ready: boolean) => void;
}

export const useTeamsStore = create<TeamsState>((set, get) => ({
  teams: [], // Empty by default
  ready: false,
  setReady: ready => set({ ready }),
  setTeams: teams => set({ teams: uniqueById(teams), ready: true }),
  addTeam: team => set(state => ({
    teams: uniqueById([...state.teams.filter(t => t.id !== team.id), team]),
  })),
  updateTeam: (id, updatedTeam) =>
    set(state => ({
      teams: state.teams.map(t => (t.id === id ? { ...t, ...updatedTeam } : t)),
    })),
  deleteTeam: id => set(state => ({ teams: state.teams.filter(t => t.id !== id) })),
  getTeamById: id => get().teams.find(t => t.id === id),
  clearTeams: () => set({ teams: [], ready: false }),
}));

// ─── Players Store ──────────────────────────────────────────────────────────────
interface PlayersState {
  players: Player[];
  ready: boolean;
  setPlayers: (players: Player[]) => void;
  addPlayer: (player: Player) => void;
  updatePlayer: (id: string, player: Partial<Player>) => void;
  deletePlayer: (id: string) => void;
  getPlayerById: (id: string) => Player | undefined;
  getPlayersByTeam: (teamId: string) => Player[];
  clearPlayers: () => void;
  setReady: (ready: boolean) => void;
}

export const usePlayersStore = create<PlayersState>((set, get) => ({
  players: [], // Empty by default
  ready: false,
  setReady: ready => set({ ready }),
  setPlayers: players => set({ players: uniqueById(players), ready: true }),
  addPlayer: player => set(state => ({
    players: uniqueById([...state.players.filter(p => p.id !== player.id), player]),
  })),
  updatePlayer: (id, updatedPlayer) =>
    set(state => ({
      players: state.players.map(p => (p.id === id ? { ...p, ...updatedPlayer } : p)),
    })),
  deletePlayer: id => set(state => ({ players: state.players.filter(p => p.id !== id) })),
  getPlayerById: id => get().players.find(p => p.id === id),
  getPlayersByTeam: teamId => get().players.filter(p => p.teamId === teamId),
  clearPlayers: () => set({ players: [], ready: false }),
}));

// ─── Matches Store ──────────────────────────────────────────────────────────────
interface MatchesState {
  matches: Match[];
  liveMatch: Match | null;
  ready: boolean;
  setMatches: (matches: Match[]) => void;
  addMatch: (match: Match) => void;
  updateMatch: (id: string, match: Partial<Match>) => void;
  deleteMatch: (id: string) => void;
  setLiveMatch: (match: Match | null) => void;
  getMatchById: (id: string) => Match | undefined;
  clearMatches: () => void;
  setReady: (ready: boolean) => void;
}

export const useMatchesStore = create<MatchesState>((set, get) => ({
  matches: [], // Empty by default
  liveMatch: null,
  ready: false,
  setReady: ready => set({ ready }),
  setMatches: matches => {
    const next = uniqueById(matches);
    set({
      matches: next,
      liveMatch: next.find(m => m.status === 'LIVE') || null,
      ready: true,
    });
  },
  addMatch: match => set(state => {
    const matches = uniqueById([match, ...state.matches.filter(m => m.id !== match.id)]);
    return { matches, liveMatch: matches.find(m => m.status === 'LIVE') || null };
  }),
  updateMatch: (id, updatedMatch) =>
    set(state => {
      const newMatches = state.matches.map(m => (m.id === id ? { ...m, ...updatedMatch } : m));
      const live = newMatches.find(m => m.status === 'LIVE') || null;
      return { matches: newMatches, liveMatch: live };
    }),
  deleteMatch: id =>
    set(state => {
      const newMatches = state.matches.filter(m => m.id !== id);
      const live = newMatches.find(m => m.status === 'LIVE') || null;
      return { matches: newMatches, liveMatch: live };
    }),
  setLiveMatch: liveMatch => set({ liveMatch }),
  getMatchById: id => get().matches.find(m => m.id === id),
  clearMatches: () => set({ matches: [], liveMatch: null, ready: false }),
}));

// ─── Points Table Store ─────────────────────────────────────────────────────────
interface PointsTableState {
  entries: PointsTableEntry[];
  setEntries: (entries: PointsTableEntry[]) => void;
  addEntry: (entry: PointsTableEntry) => void;
  updateEntry: (teamId: string, entry: Partial<PointsTableEntry>) => void;
  deleteEntry: (teamId: string) => void;
  clearEntries: () => void;
}

export const usePointsTableStore = create<PointsTableState>(set => ({
  entries: [],
  setEntries: entries => set({ entries }),
  addEntry: entry => set(state => ({ entries: [...state.entries, entry] })),
  updateEntry: (teamId, updatedEntry) =>
    set(state => ({
      entries: state.entries.map(e => (e.teamId === teamId ? { ...e, ...updatedEntry } : e)),
    })),
  deleteEntry: teamId =>
    set(state => ({
      entries: state.entries.filter(e => e.teamId !== teamId),
    })),
  clearEntries: () => set({ entries: [] }),
}));

// ─── Public discovery feed (all clubs) ──────────────────────────────────────────
interface PublicFeedState {
  liveMatches: Match[];
  upcomingMatches: Match[];
  completedMatches: Match[];
  liveReady: boolean;
  upcomingReady: boolean;
  completedReady: boolean;
  ready: boolean;
  setLiveMatches: (matches: Match[]) => void;
  setUpcomingMatches: (matches: Match[]) => void;
  setCompletedMatches: (matches: Match[]) => void;
}

export const usePublicFeedStore = create<PublicFeedState>(set => ({
  liveMatches: [],
  upcomingMatches: [],
  completedMatches: [],
  liveReady: false,
  upcomingReady: false,
  completedReady: false,
  ready: false,
  setLiveMatches: liveMatches =>
    set(state => {
      const liveReady = true;
      const ready = liveReady && state.upcomingReady && state.completedReady;
      return { liveMatches: uniqueById(liveMatches), liveReady, ready };
    }),
  setUpcomingMatches: upcomingMatches =>
    set(state => {
      const upcomingReady = true;
      const ready = state.liveReady && upcomingReady && state.completedReady;
      return { upcomingMatches: uniqueById(upcomingMatches), upcomingReady, ready };
    }),
  setCompletedMatches: completedMatches =>
    set(state => {
      const completedReady = true;
      const ready = state.liveReady && state.upcomingReady && completedReady;
      return { completedMatches: uniqueById(completedMatches), completedReady, ready };
    }),
}));

interface HubState {
  matches: Match[];
  tournaments: Tournament[];
  teams: Team[];
  ready: boolean;
  setMatches: (matches: Match[]) => void;
  setTournaments: (tournaments: Tournament[]) => void;
  setTeams: (teams: Team[]) => void;
}

export const useHubStore = create<HubState>(set => ({
  matches: [],
  tournaments: [],
  teams: [],
  ready: false,
  setMatches: matches => set({ matches: uniqueById(matches), ready: true }),
  setTournaments: tournaments => set({ tournaments: uniqueById(tournaments), ready: true }),
  setTeams: teams => set({ teams: uniqueById(teams), ready: true }),
}));

export function useUserClubs() {
  const user = useAuthStore(state => state.user);
  const clubs = useClubsStore(state => state.clubs);
  return useMemo(() => {
    if (!user) return [];
    const email = user.email?.toLowerCase();
    return clubs.filter(club =>
      user.role === 'superadmin' ||
      club.ownerId === user.id ||
      (club.adminIds || []).includes(user.id) ||
      (!!email && (club.adminEmails || []).includes(email)) ||
      (user.clubIds || []).includes(club.id),
    );
  }, [user, clubs]);
}

export function useMatchById(matchId?: string) {
  const local = useMatchesStore(state => state.matches.find(m => m.id === matchId));
  const live = usePublicFeedStore(state => state.liveMatches.find(m => m.id === matchId));
  const upcoming = usePublicFeedStore(state => state.upcomingMatches.find(m => m.id === matchId));
  const completed = usePublicFeedStore(state => state.completedMatches.find(m => m.id === matchId));
  const hub = useHubStore(state => state.matches.find(m => m.id === matchId));
  return local || live || upcoming || completed || hub;
}
