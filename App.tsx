import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SplashScreen from './src/screens/splash';
import AppNavigator from './src/navigation';
import {
  ensureDefaultClub,
  initDatabase,
  listenClubs,
  listenMatches,
  listenPlayers,
  listenMatchesInClubs,
  listenPublicLiveMatches,
  listenPublicUpcomingMatches,
  listenPublicCompletedMatches,
  listenTeams,
  listenTeamsInClubs,
  listenTournaments,
  listenTournamentsInClubs,
  listenUserProfile,
  onAuthChange,
  ensureSuperAdminProfile,
} from './src/firebase';
import {
  hydrateScopeFromStorage,
  useAuthStore,
  useClubsStore,
  useHubStore,
  useMatchesStore,
  usePlayersStore,
  usePublicFeedStore,
  useScopeStore,
  useTeamsStore,
  useTournamentsStore,
} from './src/store';
import { userClubs, emailLooksLikeSuperAdmin } from './src/utils/account';
import { attachOfflineFlush } from './src/utils/offlineQueue';
import { ALL_TOURNAMENTS_ID } from './src/constants/scope';
import { User, UserRole } from './src/types';
import { DEFAULT_CLUB_ID, DEFAULT_TOURNAMENT_ID } from './src/constants/scope';
import { Colors } from './src/theme';
import { PremiumAlertHost } from './src/components/PremiumAlert';

function FirebaseBootstrap() {
  const setUser = useAuthStore(state => state.setUser);
  const setMatches = useMatchesStore(state => state.setMatches);
  const setPlayers = usePlayersStore(state => state.setPlayers);
  const setTeams = useTeamsStore(state => state.setTeams);
  const setClubs = useClubsStore(state => state.setClubs);
  const setTournaments = useTournamentsStore(state => state.setTournaments);
  const setLiveMatches = usePublicFeedStore(state => state.setLiveMatches);
  const setUpcomingMatches = usePublicFeedStore(state => state.setUpcomingMatches);
  const setCompletedMatches = usePublicFeedStore(state => state.setCompletedMatches);
  const selectedClubId = useScopeStore(state => state.selectedClubId);
  const selectedTournamentId = useScopeStore(state => state.selectedTournamentId);
  const selectClub = useScopeStore(state => state.selectClub);
  const selectTournament = useScopeStore(state => state.selectTournament);
  const clubs = useClubsStore(state => state.clubs);
  const tournaments = useTournamentsStore(state => state.tournaments);
  const user = useAuthStore(state => state.user);
  const setHubMatches = useHubStore(state => state.setMatches);
  const setHubTournaments = useHubStore(state => state.setTournaments);
  const setHubTeams = useHubStore(state => state.setTeams);

  useEffect(() => {
    let cancelled = false;
    const unsubscribers: Array<() => void> = [];
    (async () => {
      await initDatabase();
      if (cancelled) return;
      await hydrateScopeFromStorage();
      const defaults = await ensureDefaultClub();
      if (cancelled) return;
      const scope = useScopeStore.getState();
      if (!scope.selectedClubId) {
        scope.selectClub(defaults.clubId, defaults.tournamentId);
      }
      attachOfflineFlush();
      unsubscribers.push(
        listenPublicLiveMatches(setLiveMatches),
        listenPublicUpcomingMatches(setUpcomingMatches),
        listenPublicCompletedMatches(setCompletedMatches),
        listenClubs(setClubs),
      );
    })();
    return () => {
      cancelled = true;
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [setClubs, setLiveMatches, setUpcomingMatches, setCompletedMatches]);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    const unsubscribeAuth = onAuthChange(firebaseUser => {
      unsubProfile?.();
      unsubProfile = undefined;
      if (!firebaseUser) {
        setUser(null);
        return;
      }
      unsubProfile = listenUserProfile(firebaseUser.uid, data => {
        const email = firebaseUser.email || data?.email || '';
        ensureSuperAdminProfile({
          id: firebaseUser.uid,
          email,
          name: data?.name || firebaseUser.displayName,
          role: data?.role,
        }).then(ensured => {
          if (ensured === 'superadmin' && data?.role !== 'superadmin') {
            // Profile listener will re-fire after RTDB write.
          }
        }).catch(() => {});

        if (!data) {
          const existing = useAuthStore.getState().user;
          if (existing?.id === firebaseUser.uid) return;
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName || 'AB Sports User',
            email,
            role: emailLooksLikeSuperAdmin(email) ? 'superadmin' : 'public',
          });
          return;
        }
        const role = (
          data.role === 'superadmin' || emailLooksLikeSuperAdmin(email)
            ? 'superadmin'
            : data.role || 'public'
        ) as UserRole;
        setUser({
          id: firebaseUser.uid,
          name: data.name || firebaseUser.displayName || 'AB Sports User',
          email: firebaseUser.email || data.email || '',
          role,
          photoURL: data.photoURL,
          currentClubId: data.currentClubId,
          currentTournamentId: data.currentTournamentId,
          clubIds: data.clubIds,
          canGoLive: !!data.canGoLive,
          goLiveAccess: data.goLiveAccess,
        });
        if (data.currentClubId && !useScopeStore.getState().selectedClubId) {
          useScopeStore.getState().selectClub(data.currentClubId, data.currentTournamentId || null);
        }
        ensureDefaultClub().catch(() => {});
      });
    });
    return () => {
      unsubscribeAuth();
      unsubProfile?.();
    };
  }, [setUser]);

  useEffect(() => {
    if (!selectedClubId) {
      setTeams([]);
      setPlayers([]);
      setMatches([]);
      setTournaments([]);
      return;
    }
    // Mark club-scoped data as pending so screens can show skeletons until
    // the first Firebase snapshot arrives. Do not clear existing rows here —
    // that left Home hero at 0 while the public feed still rendered below.
    useTournamentsStore.getState().setReady(false);
    useTeamsStore.getState().setReady(false);
    usePlayersStore.getState().setReady(false);
    useMatchesStore.getState().setReady(false);
    const unsubscribers = [
      listenTournaments(selectedClubId, setTournaments),
      listenTeams(selectedClubId, setTeams),
      listenPlayers(selectedClubId, setPlayers),
      listenMatches(selectedClubId, setMatches),
    ];
    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, [selectedClubId, setMatches, setPlayers, setTeams, setTournaments]);

  useEffect(() => {
    if (!selectedClubId || clubs.length === 0) return;
    if (!clubs.some(club => club.id === selectedClubId)) {
      const fallback = clubs.find(club => club.id === DEFAULT_CLUB_ID) || clubs[0];
      selectClub(fallback.id, DEFAULT_TOURNAMENT_ID);
    }
  }, [clubs, selectedClubId, selectClub]);

  useEffect(() => {
    const mine = userClubs(user, clubs).map(club => club.id);
    const ids = Array.from(new Set(mine));
    if (ids.length === 0) {
      setHubMatches([]);
      setHubTournaments([]);
      setHubTeams([]);
      useHubStore.setState({ ready: true });
      return;
    }
    useHubStore.setState({ ready: false });
    const unsubs = [
      listenMatchesInClubs(ids, setHubMatches),
      listenTournamentsInClubs(ids, setHubTournaments),
      listenTeamsInClubs(ids, setHubTeams),
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, [user, clubs, setHubMatches, setHubTournaments, setHubTeams]);

  useEffect(() => {
    if (tournaments.length === 0) return;
    if (selectedClubId && tournaments[0].clubId && tournaments[0].clubId !== selectedClubId) return;
    if (selectedTournamentId === ALL_TOURNAMENTS_ID) return;
    const belongs = selectedTournamentId
      ? tournaments.some(tournament => tournament.id === selectedTournamentId)
      : false;
    if (!belongs) {
      selectTournament(tournaments[0].id);
    }
  }, [tournaments, selectedTournamentId, selectedClubId, selectTournament]);

  return null;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return (
      <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <SplashScreen onFinish={() => setShowSplash(false)} />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
        <FirebaseBootstrap />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
        <PremiumAlertHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
