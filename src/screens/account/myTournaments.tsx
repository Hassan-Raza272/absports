import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import EmptyState from '../../components/EmptyState';
import { SkeletonEntityList } from '../../components/Skeleton';
import {
  useAuthStore,
  useClubsStore,
  useHubStore,
  useMatchesStore,
  useScopeStore,
  useTournamentsStore,
  useUserClubs,
} from '../../store';
import { Tournament } from '../../types';

function uniqueById<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    if (!row?.id || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

const STATUS_COLOR: Record<string, string> = {
  UPCOMING: Colors.accent,
  ONGOING: Colors.win,
  COMPLETED: Colors.primary,
};

export default function MyTournamentsScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user);
  const myClubs = useUserClubs();
  const clubs = useClubsStore(s => s.clubs);
  const selectedClubId = useScopeStore(s => s.selectedClubId);
  const selectClub = useScopeStore(s => s.selectClub);
  const localTournaments = useTournamentsStore(s => s.tournaments);
  const hubTournaments = useHubStore(s => s.tournaments);
  const hubReady = useHubStore(s => s.ready);
  const tournamentsReady = useTournamentsStore(s => s.ready);
  const matches = useMatchesStore(s => s.matches);

  const clubIds = useMemo(() => {
    const ids = new Set(myClubs.map(c => c.id));
    if (selectedClubId) ids.add(selectedClubId);
    if (user?.currentClubId) ids.add(user.currentClubId);
    (user?.clubIds || []).forEach(id => ids.add(id));
    return ids;
  }, [myClubs, selectedClubId, user?.currentClubId, user?.clubIds]);

  const mine = useMemo(() => {
    const merged = uniqueById([...localTournaments, ...hubTournaments]);
    const scoped = clubIds.size ? merged.filter(t => clubIds.has(t.clubId)) : merged;
    return scoped.sort((a, b) => {
      const rank = (s: string) => (s === 'ONGOING' ? 0 : s === 'UPCOMING' ? 1 : 2);
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus !== 0) return byStatus;
      return (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name);
    });
  }, [localTournaments, hubTournaments, clubIds]);

  function openTournament(tournament: Tournament) {
    selectClub(tournament.clubId, tournament.id);
    navigation.navigate('AdminTournamentDetail', { tournamentId: tournament.id });
  }

  function createTournament() {
    navigation.navigate('CreateTournament');
  }

  if (!user) {
    return (
      <ScreenScaffold title="My Tournaments" showScope={false}>
        <EmptyState
          title="Sign in to manage tournaments"
          subtitle="Every competition you create under your clubs lives here."
          actionLabel="Sign in"
          onAction={() => navigation.navigate('Login')}
        />
      </ScreenScaffold>
    );
  }

  if (!hubReady && !tournamentsReady) {
    return (
      <ScreenScaffold title="My Tournaments" showScope={false}>
        <SkeletonEntityList count={5} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      title="My Tournaments"
      showScope={false}
      subtitle={`${mine.length} competition${mine.length === 1 ? '' : 's'} you host`}
      right={
        <TouchableOpacity onPress={createTournament} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>+ Tournament</Text>
        </TouchableOpacity>
      }>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {mine.map(tournament => {
          const club = clubs.find(c => c.id === tournament.clubId);
          const fixtureCount = matches.filter(m => m.tournamentId === tournament.id).length;
          const liveCount = matches.filter(m => m.tournamentId === tournament.id && m.status === 'LIVE').length;
          const teamCount = tournament.teamIds?.length || tournament.totalTeams || 0;
          const statusColor = STATUS_COLOR[tournament.status] || Colors.textMuted;
          return (
            <TouchableOpacity key={tournament.id} activeOpacity={0.88} onPress={() => openTournament(tournament)}>
              <LinearGradient colors={Colors.gradCard} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.kicker}>{club?.name || 'Club'}</Text>
                  <View style={[styles.statusPill, { borderColor: statusColor + '66', backgroundColor: statusColor + '18' }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{tournament.status}</Text>
                  </View>
                </View>
                <Text style={styles.name}>{tournament.name}</Text>
                <Text style={styles.meta}>
                  {tournament.format} · {tournament.type} · {tournament.overs} ov · {tournament.season}
                </Text>
                <View style={styles.statsRow}>
                  <Stat label="Teams" value={String(teamCount)} />
                  <Stat label="Fixtures" value={String(fixtureCount || tournament.totalMatches || 0)} />
                  <Stat label="Live" value={String(liveCount)} accent={liveCount > 0 ? Colors.live : undefined} />
                </View>
                <Text style={styles.cta}>Manage teams, fixtures & table →</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
        {mine.length === 0 && (
          <EmptyState
            title="No tournaments scheduled"
            subtitle="Create a league, knockout, or hybrid competition under your club, then enroll teams and generate fixtures."
            actionLabel="Create Tournament"
            onAction={createTournament}
          />
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, accent && { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.base, paddingBottom: 48 },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerBtnText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.xs },
  card: {
    padding: Spacing.base,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { color: Colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 0.4 },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  name: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.lg, marginTop: 8 },
  meta: { color: Colors.textSecondary, marginTop: 4, fontSize: Typography.sm, textTransform: 'capitalize' },
  statsRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md },
  stat: {
    flex: 1,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.lg },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', marginTop: 2, letterSpacing: 0.5 },
  cta: { color: Colors.primary, fontWeight: '700', marginTop: Spacing.md, fontSize: Typography.sm },
});
