import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import MatchScoreCard from '../../components/MatchScoreCard';
import FilterChips from '../../components/FilterChips';
import EmptyState from '../../components/EmptyState';
import { SkeletonMatchList } from '../../components/Skeleton';
import {
  useAuthStore,
  useMatchesStore,
  useScopedMatches,
  useScopeLabels,
  useScopeStore,
  useTeamsStore,
  useTournamentsStore,
} from '../../store';
import { isFriendly } from '../../utils/matchDisplay';
import { ALL_TOURNAMENTS_ID } from '../../constants/scope';

type Filter = 'all' | 'LIVE' | 'UPCOMING' | 'COMPLETED' | 'friendly';

export default function FixturesScreen({ navigation }: any) {
  const matches = useScopedMatches();
  const matchesReady = useMatchesStore(s => s.ready);
  const { clubName, tournamentName } = useScopeLabels();
  const tournaments = useTournamentsStore(s => s.tournaments);
  const selectedTournamentId = useScopeStore(s => s.selectedTournamentId);
  const selectTournament = useScopeStore(s => s.selectTournament);
  const allTeams = useTeamsStore(s => s.teams);
  const user = useAuthStore(s => s.user);
  const canScore = !!user;
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const activeTournament = useMemo(() => {
    if (!selectedTournamentId || selectedTournamentId === ALL_TOURNAMENTS_ID) return null;
    return tournaments.find(t => t.id === selectedTournamentId) || null;
  }, [tournaments, selectedTournamentId]);

  const enrolledTeams = useMemo(() => {
    if (!activeTournament?.teamIds?.length) return [];
    const set = new Set(activeTournament.teamIds);
    return allTeams.filter(t => set.has(t.id));
  }, [activeTournament, allTeams]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return matches
      .filter(match => {
        if (filter === 'friendly') return isFriendly(match);
        if (filter === 'all') return true;
        return match.status === filter;
      })
      .filter(match => {
        if (!q) return true;
        return `${match.teamAName || ''} ${match.teamBName || ''} ${match.venue || ''}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const rank = (s: string) => (s === 'LIVE' ? 0 : s === 'UPCOMING' ? 1 : 2);
        const byStatus = rank(a.status) - rank(b.status);
        if (byStatus !== 0) return byStatus;
        return new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime();
      });
  }, [matches, filter, query]);

  return (
    <ScreenScaffold title="Matches" subtitle={`${clubName} · ${tournamentName}`}>
      {!matchesReady ? (
        <SkeletonMatchList count={5} />
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search teams or venue"
            placeholderTextColor={Colors.textMuted}
            style={styles.search}
          />
          <FilterChips
            value={filter}
            onChange={setFilter}
            options={[
              { key: 'all', label: `All (${matches.length})` },
              { key: 'LIVE', label: 'Live', accent: Colors.live },
              { key: 'UPCOMING', label: 'Upcoming', accent: Colors.accent },
              { key: 'COMPLETED', label: 'Results', accent: Colors.primary },
              { key: 'friendly', label: 'Friendlies', accent: Colors.accentBlue },
            ]}
          />
          {tournaments.length > 0 && (
            <FilterChips
              value={(selectedTournamentId || ALL_TOURNAMENTS_ID) as string}
              onChange={id => selectTournament(id)}
              options={[
                { key: ALL_TOURNAMENTS_ID, label: 'All comps' },
                ...tournaments.map(t => ({ key: t.id, label: t.name })),
              ]}
            />
          )}
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {activeTournament && enrolledTeams.length > 0 && (
              <View style={styles.enrolledBox}>
                <Text style={styles.enrolledHeader}>ENROLLED TEAMS ({enrolledTeams.length})</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teamRow}>
                  {enrolledTeams.map(t => (
                    <View key={t.id} style={styles.teamChip}>
                      <Text style={styles.teamChipName}>{t.name}</Text>
                      <Text style={styles.teamChipTag}>{t.shortName}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {filtered.map(match => (
              <MatchScoreCard
                key={match.id}
                match={match}
                clubName={clubName}
                onPress={() => navigation.navigate('MatchCenter', { matchId: match.id })}
              />
            ))}
            {filtered.length === 0 && (
              <EmptyState
                title={activeTournament ? `No matches scheduled yet for ${activeTournament.name}` : 'No matches in this filter'}
                subtitle={
                  activeTournament
                    ? enrolledTeams.length > 0
                      ? `${enrolledTeams.length} enrolled squads are ready for fixtures.`
                      : 'Enroll teams to schedule fixtures.'
                    : canScore
                    ? 'Schedule a league game from the scoring desk.'
                    : 'Open Discover for live games at other clubs.'
                }
                actionLabel={canScore && activeTournament ? 'Manage Tournament' : canScore ? 'Scoring desk' : 'Discover'}
                onAction={() => {
                  if (canScore && activeTournament) {
                    navigation.navigate('AdminTournamentDetail', { tournamentId: activeTournament.id, tab: 'fixtures' });
                  } else {
                    navigation.navigate(canScore ? 'AdminDashboard' : 'Discover');
                  }
                }}
              />
            )}
          </ScrollView>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  search: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: Typography.sm,
  },
  list: { padding: Spacing.base, paddingBottom: 40 },
  enrolledBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  enrolledHeader: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  teamRow: { flexDirection: 'row', gap: 8 },
  teamChip: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  teamChipName: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.xs },
  teamChipTag: { color: Colors.primary, fontWeight: '800', fontSize: 10 },
});
