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
  const entries = buildPointsTable(teams, matches, {
    pointsConfig: tournamentDoc?.pointsConfig || tournament?.pointsConfig,
    overrides: tournamentDoc?.pointsOverrides || tournament?.pointsOverrides,
    enrolledTeamIds: tournamentDoc?.teamIds?.length
      ? tournamentDoc.teamIds
      : tournament?.teamIds?.length
        ? tournament.teamIds
        : undefined,
  });

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
        {entries.length === 0 ? (
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
                pointsTableImageStyleMessage(tournamentDoc || tournament, entries, clubName || club?.name)
                  || pointsTableShareMessage(tournamentDoc || tournament, entries, clubName || club?.name),
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
