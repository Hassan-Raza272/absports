import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import MatchScoreCard from '../../components/MatchScoreCard';
import EmptyState from '../../components/EmptyState';
import { SkeletonMatchList } from '../../components/Skeleton';
import FilterChips from '../../components/FilterChips';
import { showAlert } from '../../components/PremiumAlert';
import {
  useAuthStore,
  useClubsStore,
  useHubStore,
  useMatchesStore,
  usePublicFeedStore,
} from '../../store';
import { deleteMatch as deleteRemoteMatch, listenUserMatches } from '../../firebase';
import { canUserGoLiveOnMatch, isUsersOwnMatch } from '../../utils/account';
import PremiumGoLiveModal from '../../components/PremiumGoLiveModal';
import { Match } from '../../types';

type Filter = 'all' | 'UPCOMING' | 'LIVE' | 'COMPLETED';

function uniqueMatches(rows: Match[]): Match[] {
  const seen = new Set<string>();
  return rows.filter(m => {
    if (!m?.id || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

export default function MyMatchesScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user);
  const clubs = useClubsStore(s => s.clubs);
  const localMatches = useMatchesStore(s => s.matches);
  const deleteMatchLocal = useMatchesStore(s => s.deleteMatch);
  const hub = useHubStore(s => s.matches);
  const hubReady = useHubStore(s => s.ready);
  const feedReady = usePublicFeedStore(s => s.ready);
  const setHubMatches = useHubStore(s => s.setMatches);
  const live = usePublicFeedStore(s => s.liveMatches);
  const upcoming = usePublicFeedStore(s => s.upcomingMatches);
  const completed = usePublicFeedStore(s => s.completedMatches);
  const setLive = usePublicFeedStore(s => s.setLiveMatches);
  const setUpcoming = usePublicFeedStore(s => s.setUpcomingMatches);
  const setCompleted = usePublicFeedStore(s => s.setCompletedMatches);
  const [filter, setFilter] = useState<Filter>('all');
  const [userMatches, setUserMatches] = useState<Match[]>([]);
  const [userMatchesReady, setUserMatchesReady] = useState(false);
  const [showGoLivePremiumModal, setShowGoLivePremiumModal] = useState(false);

  const handleGoLive = (match: Match) => {
    if (canUserGoLiveOnMatch(user, match, clubs)) {
      navigation.navigate('AdminBroadcast', { matchId: match.id });
    } else {
      setShowGoLivePremiumModal(true);
    }
  };

  useEffect(() => {
    if (!user?.id) {
      setUserMatches([]);
      setUserMatchesReady(true);
      return;
    }
    const unsub = listenUserMatches(user.id, matches => {
      setUserMatches(matches);
      setUserMatchesReady(true);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user?.id]);

  const mine = useMemo(() => {
    if (!user) return [];
    const merged = uniqueMatches([
      ...userMatches,
      ...localMatches,
      ...hub,
      ...live,
      ...upcoming,
      ...completed,
    ]);
    const scoped = merged.filter(match => isUsersOwnMatch(user, match, clubs));
    return scoped.sort((a, b) => {
      const rank = (s: string) => (s === 'LIVE' ? 0 : s === 'UPCOMING' ? 1 : s === 'ABANDONED' ? 3 : 2);
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      if (a.status === 'UPCOMING') {
        return new Date(a.dateTime || 0).getTime() - new Date(b.dateTime || 0).getTime();
      }
      return new Date(b.dateTime || 0).getTime() - new Date(a.dateTime || 0).getTime();
    });
  }, [user, userMatches, localMatches, hub, live, upcoming, completed, clubs]);

  const filtered = useMemo(() => {
    if (filter === 'all') return mine;
    if (filter === 'COMPLETED') return mine.filter(m => m.status === 'COMPLETED' || m.status === 'ABANDONED');
    return mine.filter(m => m.status === filter);
  }, [mine, filter]);

  const counts = {
    all: mine.length,
    UPCOMING: mine.filter(m => m.status === 'UPCOMING').length,
    LIVE: mine.filter(m => m.status === 'LIVE').length,
    COMPLETED: mine.filter(m => m.status === 'COMPLETED' || m.status === 'ABANDONED').length,
  };

  function openMatch(match: Match) {
    if (match.status === 'UPCOMING' || match.status === 'LIVE') {
      navigation.navigate('AdminLiveScoring', { matchId: match.id });
      return;
    }
    navigation.navigate('MatchCenter', { matchId: match.id });
  }

  function createMatch() {
    navigation.navigate('CreateMatch');
  }

  function removeFromFeeds(id: string) {
    deleteMatchLocal(id);
    setUserMatches(prev => prev.filter(m => m.id !== id));
    setHubMatches(hub.filter(m => m.id !== id));
    setLive(live.filter(m => m.id !== id));
    setUpcoming(upcoming.filter(m => m.id !== id));
    setCompleted(completed.filter(m => m.id !== id));
  }

  function handleDelete(match: Match) {
    const title =
      match.status === 'UPCOMING'
        ? 'Delete scheduled match'
        : match.status === 'LIVE'
          ? 'Delete live match'
          : 'Delete match';
    const body =
      match.status === 'LIVE'
        ? `${match.teamAName} vs ${match.teamBName} is live. Delete it from Discover and your fixtures?`
        : `Remove ${match.teamAName} vs ${match.teamBName} permanently? This cannot be undone.`;

    showAlert(title, body, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          removeFromFeeds(match.id);
          try {
            await deleteRemoteMatch(match.id);
          } catch {
            showAlert('Sync failed', 'Removed on this device, but Firebase could not delete it. Check your connection.');
          }
        },
      },
    ]);
  }

  if (!user) {
    return (
      <ScreenScaffold title="My Matches" showScope={false}>
        <EmptyState
          title="Sign in to see your matches"
          subtitle="Scheduled, live, and completed games from every club you run appear here."
          actionLabel="Sign in"
          onAction={() => navigation.navigate('Login')}
        />
      </ScreenScaffold>
    );
  }

  if (!hubReady && !feedReady && !userMatchesReady) {
    return (
      <ScreenScaffold title="My Matches" showScope={false}>
        <SkeletonMatchList count={4} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      title="My Matches"
      showScope={false}
      subtitle={`${mine.length} match${mine.length === 1 ? '' : 'es'}`}
      right={
        <TouchableOpacity onPress={createMatch} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>+ Match</Text>
        </TouchableOpacity>
      }>
      <FilterChips
        value={filter}
        onChange={setFilter}
        options={[
          { key: 'all', label: `All (${counts.all})` },
          { key: 'UPCOMING', label: `Upcoming (${counts.UPCOMING})`, accent: Colors.accent },
          { key: 'LIVE', label: `Live (${counts.LIVE})`, accent: Colors.live },
          { key: 'COMPLETED', label: `Results (${counts.COMPLETED})`, accent: Colors.primary },
        ]}
      />
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(match => {
          const club = clubs.find(c => c.id === match.clubId);
          return (
            <View key={match.id}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.clubKicker}>{club?.name || 'MY FIXTURE'}</Text>
                {(match.status === 'LIVE' || match.status === 'UPCOMING') &&
                  isUsersOwnMatch(user, match, clubs) && (
                    <TouchableOpacity
                      onPress={() => handleGoLive(match)}
                      style={styles.goLivePill}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                      <Text style={styles.goLivePillText}>GO LIVE</Text>
                    </TouchableOpacity>
                  )}
              </View>
              <MatchScoreCard
                match={match}
                clubName={club?.name}
                onPress={() => openMatch(match)}
                onDelete={() => handleDelete(match)}
              />
            </View>
          );
        })}
        {filtered.length === 0 && (
          <EmptyState
            title={mine.length === 0 ? 'No matches scheduled' : 'Nothing in this filter'}
            subtitle={
              mine.length === 0
                ? 'Create a friendly now, or schedule a league fixture from a tournament.'
                : 'Try All, Upcoming, or Results.'
            }
            actionLabel="Create Match"
            onAction={createMatch}
          />
        )}
        {mine.length === 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateMatch')}
            style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Schedule a fixture</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <PremiumGoLiveModal
        visible={showGoLivePremiumModal}
        onClose={() => setShowGoLivePremiumModal(false)}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.base, paddingBottom: 48 },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 4,
  },
  clubKicker: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  goLivePill: {
    backgroundColor: Colors.live + '20',
    borderWidth: 1,
    borderColor: Colors.live + '66',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  goLivePillText: {
    color: Colors.live,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary + '22',
    borderWidth: 1,
    borderColor: Colors.primary + '66',
  },
  headerBtnText: { color: Colors.primary, fontWeight: '800', fontSize: Typography.xs },
  secondaryBtn: {
    alignSelf: 'center',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnText: { color: Colors.textSecondary, fontWeight: '800', fontSize: Typography.sm },
});
