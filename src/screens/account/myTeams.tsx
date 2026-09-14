import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import EmptyState from '../../components/EmptyState';
import { useAuthStore, useClubsStore, useHubStore, useScopeStore, useUserClubs } from '../../store';

export default function MyTeamsScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user);
  const myClubs = useUserClubs();
  const clubs = useClubsStore(s => s.clubs);
  const teams = useHubStore(s => s.teams);
  const selectClub = useScopeStore(s => s.selectClub);
  const ids = new Set(myClubs.map(c => c.id));
  const mine = teams.filter(t => ids.has(t.clubId) || t.id === user?.teamId);

  if (!user) {
    return (
      <ScreenScaffold title="My Teams" showScope={false}>
        <EmptyState title="Sign in to see your teams" actionLabel="Signup" onAction={() => navigation.navigate('Signup')} />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title="My Teams" showScope={false} subtitle="Squads in your clubs">
      <ScrollView contentContainerStyle={styles.list}>
        {mine.map(team => {
          const club = clubs.find(c => c.id === team.clubId);
          return (
            <TouchableOpacity
              key={team.id}
              onPress={() => {
                selectClub(team.clubId, null);
                navigation.navigate('TeamProfile', { teamId: team.id });
              }}>
              <LinearGradient colors={[team.primaryColor + '22', Colors.bgCard]} style={styles.card}>
                <View style={[styles.dot, { backgroundColor: team.primaryColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{team.name}</Text>
                  <Text style={styles.meta}>{team.shortName} · {club?.name || 'Club'} · Cap {team.captain || 'TBD'}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
        {mine.length === 0 && (
          <EmptyState
            title="No teams yet"
            subtitle="Add squads to a club you registered. Then start matches between them."
            actionLabel="Manage teams"
            onAction={() => navigation.navigate('AdminTeams')}
          />
        )}
      </ScrollView>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.base, paddingBottom: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  name: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.base },
  meta: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2 },
});
