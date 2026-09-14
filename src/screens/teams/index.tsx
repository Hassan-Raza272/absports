import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import EmptyState from '../../components/EmptyState';
import TeamLogoAvatar from '../../components/TeamLogoAvatar';
import { SkeletonEntityList } from '../../components/Skeleton';
import { useAuthStore, useScopedMatches, useScopeLabels, useTeamsStore, useTournamentMatches } from '../../store';
import { buildPointsTable } from '../../utils/scoring';

export default function TeamsScreen({ navigation }: any) {
  const teams = useTeamsStore(s => s.teams);
  const teamsReady = useTeamsStore(s => s.ready);
  const league = useTournamentMatches();
  const allMatches = useScopedMatches();
  const { subtitle } = useScopeLabels();
  const user = useAuthStore(s => s.user);
  const isStaff = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'scorer';
  const [query, setQuery] = useState('');
  const standings = buildPointsTable(teams, league);
  const byId = new Map(standings.map(e => [e.teamId, e]));

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...teams]
      .sort((a, b) => {
        const diff = (byId.get(b.id)?.points || 0) - (byId.get(a.id)?.points || 0);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      })
      .filter(t => !q || `${t.name} ${t.shortName} ${t.captain}`.toLowerCase().includes(q));
  }, [teams, query, byId]);

  return (
    <ScreenScaffold
      title="Teams"
      subtitle={`${subtitle} · ${teams.length} squads`}
      right={
        <TouchableOpacity onPress={() => navigation.navigate('TeamCompare')}>
          <Text style={styles.link}>Compare</Text>
        </TouchableOpacity>
      }>
      {!teamsReady ? (
        <SkeletonEntityList count={6} />
      ) : (
        <>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search squad or captain"
            placeholderTextColor={Colors.textMuted}
            style={styles.search}
          />
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {list.map(team => {
              const standing = byId.get(team.id);
              const played = allMatches.filter(m => m.teamA === team.id || m.teamB === team.id).length;
              return (
                <TouchableOpacity key={team.id} activeOpacity={0.88} onPress={() => navigation.navigate('TeamProfile', { teamId: team.id })}>
                  <LinearGradient colors={[team.primaryColor + '22', Colors.bgCard]} style={styles.card}>
                    <TeamLogoAvatar
                      name={team.name}
                      shortName={team.shortName}
                      logoURL={team.logoURL}
                      size={48}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.name} numberOfLines={1}>{team.name}</Text>
                      <Text style={styles.meta} numberOfLines={1}>
                        {team.shortName} · Cap {team.captain || 'TBD'} · {played} games
                      </Text>
                      <View style={styles.form}>
                        {(standing?.lastFive || []).map((r, i) => (
                          <View key={i} style={[styles.dot, { backgroundColor: r === 'W' ? Colors.win : r === 'L' ? Colors.loss : Colors.nr }]} />
                        ))}
                      </View>
                    </View>
                    <View style={styles.right}>
                      <Text style={styles.pts}>{standing?.points ?? 0}</Text>
                      <Text style={styles.ptsL}>pts</Text>
                      <Text style={styles.wl}>{standing?.won ?? 0}W · {standing?.lost ?? 0}L</Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
            {list.length === 0 && (
              <EmptyState
                title="No teams in this club"
                subtitle={isStaff ? 'Add squads from More → Manage teams.' : 'This club has not registered squads yet.'}
                actionLabel={isStaff ? 'Add team' : undefined}
                onAction={isStaff ? () => navigation.navigate('AdminTeams') : undefined}
              />
            )}
          </ScrollView>
        </>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  link: { color: Colors.primary, fontWeight: '800', fontSize: 12 },
  search: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.textPrimary,
    fontSize: Typography.sm,
  },
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
  name: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.base },
  meta: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2 },
  form: { flexDirection: 'row', gap: 4, marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  right: { alignItems: 'flex-end' },
  pts: { color: Colors.primary, fontWeight: '900', fontSize: Typography.xxl },
  ptsL: { color: Colors.textMuted, fontSize: 10, marginTop: -4 },
  wl: { color: Colors.textSecondary, fontSize: 11, marginTop: 4, fontWeight: '700' },
});
