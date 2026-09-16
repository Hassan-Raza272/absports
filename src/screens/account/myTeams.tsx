import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import EmptyState from '../../components/EmptyState';
import { useAuthStore, useClubsStore, useHubStore, useScopeStore, useTeamsStore } from '../../store';
import { listenUserTeams } from '../../firebase';
import { isUsersOwnTeam } from '../../utils/account';
import { Team } from '../../types';

function uniqueTeams(rows: Team[]): Team[] {
  const seen = new Set<string>();
  return rows.filter(t => {
    if (!t?.id || seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
}

export default function MyTeamsScreen({ navigation }: any) {
  const user = useAuthStore(s => s.user);
  const clubs = useClubsStore(s => s.clubs);
  const localTeams = useTeamsStore(s => s.teams);
  const hubTeams = useHubStore(s => s.teams);
  const selectClub = useScopeStore(s => s.selectClub);
  const [userTeams, setUserTeams] = useState<Team[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setUserTeams([]);
      return;
    }
    const unsub = listenUserTeams(user.id, teams => {
      setUserTeams(teams);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [user?.id]);

  const mine = useMemo(() => {
    if (!user) return [];
    const merged = uniqueTeams([...userTeams, ...localTeams, ...hubTeams]);
    return merged.filter(t => isUsersOwnTeam(user, t, clubs));
  }, [user, userTeams, localTeams, hubTeams, clubs]);

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
