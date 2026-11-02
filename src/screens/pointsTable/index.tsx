import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Spacing } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import EmptyState from '../../components/EmptyState';
import PremiumPointsTable from '../../components/PremiumPointsTable';
import { SkeletonEntityList } from '../../components/Skeleton';
import {
  useClubsStore,
  useScopeLabels,
  useScopeStore,
  useTeamsStore,
  useMatchesStore,
  useTournamentMatches,
  useTournamentsStore,
} from '../../store';
import { buildPointsTable } from '../../utils/scoring';
import { pointsTableShareMessage, pointsTableImageStyleMessage, shareText } from '../../utils/share';

export default function PointsTableScreen({ navigation }: any) {
  const teams = useTeamsStore(s => s.teams);
  const teamsReady = useTeamsStore(s => s.ready);
  const matchesReady = useMatchesStore(s => s.ready);
  const matches = useTournamentMatches();
  const { clubName, tournament, tournamentName } = useScopeLabels();
  const tournamentDoc = useTournamentsStore(s => s.tournament);
  const clubId = useScopeStore(s => s.selectedClubId);
  const club = useClubsStore(s => s.clubs.find(c => c.id === clubId));
  const activeTournament = tournamentDoc || tournament;
  const groups = activeTournament?.groups?.filter(g => (g.teamIds || []).length) || [];
  const entries = buildPointsTable(teams, matches, {
    pointsConfig: activeTournament?.pointsConfig,
    overrides: activeTournament?.pointsOverrides,
    enrolledTeamIds: activeTournament?.teamIds?.length ? activeTournament.teamIds : undefined,
  });
  const poolTables = groups.map(group => ({
    group,
    entries: buildPointsTable(teams, matches.filter(m => !m.groupId || m.groupId === group.id), {
      pointsConfig: activeTournament?.pointsConfig,
      overrides: activeTournament?.pointsOverrides,
      enrolledTeamIds: group.teamIds,
      groupTeamIds: group.teamIds,
    }),
  }));

  if (!teamsReady || !matchesReady) {
    return (
      <ScreenScaffold title="Table">
        <SkeletonEntityList count={8} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold
      title="Table"
      right={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.navigate('WhatIf')}>
            <Text style={styles.headerLink}>What-if</Text>
          </TouchableOpacity>
        </View>
      }>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {poolTables.length > 0 ? (
          poolTables.map(({ group, entries: poolEntries }) => (
            <View key={group.id} style={{ marginBottom: Spacing.base }}>
              <PremiumPointsTable
                entries={poolEntries}
                title={group.name}
                subtitle={`${tournamentName} · ${clubName || club?.name || 'AB Sports'}`}
                qualifyCount={2}
                onShare={() =>
                  shareText(
                    `${group.name} table`,
                    pointsTableImageStyleMessage(activeTournament, poolEntries, clubName || club?.name)
                      || pointsTableShareMessage(activeTournament, poolEntries, clubName || club?.name),
                  )
                }
                onPressTeam={teamId => navigation.navigate('TeamProfile', { teamId })}
              />
            </View>
          ))
        ) : entries.length === 0 ? (
          <EmptyState
            title="No league table yet"
            subtitle="Select a tournament and complete official matches. Friendlies stay off this table."
            actionLabel="Browse teams"
            onAction={() => navigation.navigate('TeamsList')}
          />
        ) : (
          <PremiumPointsTable
            entries={entries}
            title={tournamentName}
            subtitle={`${clubName || club?.name || 'AB Sports'} · Friendlies excluded`}
            onShare={() =>
              shareText(
                'Points table',
                pointsTableImageStyleMessage(activeTournament, entries, clubName || club?.name)
                  || pointsTableShareMessage(activeTournament, entries, clubName || club?.name),
              )
            }
            onPressTeam={teamId => navigation.navigate('TeamProfile', { teamId })}
          />
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  headerLink: { color: Colors.primary, fontWeight: '800', fontSize: 12 },
  scroll: { padding: Spacing.base, paddingBottom: 40 },
});
