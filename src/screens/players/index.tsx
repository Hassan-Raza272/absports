import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import FilterChips from '../../components/FilterChips';
import EmptyState from '../../components/EmptyState';
import { SkeletonEntityList } from '../../components/Skeleton';
import { useAuthStore, usePlayersStore, useScopedMatches, useScopeLabels, useTeamsStore } from '../../store';
import { playerShareMessage, shareText } from '../../utils/share';

type Role = 'All' | 'Batter' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';

export default function PlayersScreen({ navigation }: any) {
  const players = usePlayersStore(s => s.players);
  const playersReady = usePlayersStore(s => s.ready);
  const matches = useScopedMatches();
  const teams = useTeamsStore(s => s.teams);
  const { subtitle } = useScopeLabels();
  const user = useAuthStore(s => s.user);
  const isStaff = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'scorer';
  const [role, setRole] = useState<Role>('All');
  const [teamId, setTeamId] = useState('All');
  const [query, setQuery] = useState('');

  const season = useMemo(() => {
    const map = new Map<string, { runs: number; wickets: number; sixes: number }>();
    matches.filter(m => m.status === 'COMPLETED').forEach(match => {
      [match.innings?.first, match.innings?.second].forEach(inn => {
        (inn?.batting || []).forEach(b => {
          const cur = map.get(b.name) || { runs: 0, wickets: 0, sixes: 0 };
          cur.runs += b.runs || 0;
          cur.sixes += b.sixes || 0;
          map.set(b.name, cur);
        });
        (inn?.bowling || []).forEach(bw => {
          const cur = map.get(bw.name) || { runs: 0, wickets: 0, sixes: 0 };
          cur.wickets += bw.wickets || 0;
          map.set(bw.name, cur);
        });
      });
    });
    return map;
  }, [matches]);

  const filtered = players.filter(p => {
    const roleOk = role === 'All' || p.role === role;
    const teamOk = teamId === 'All' || p.teamId === teamId || p.teamName === teamId;
    const q = query.trim().toLowerCase();
    const queryOk = !q || p.name.toLowerCase().includes(q) || String(p.jerseyNumber).includes(q);
    return roleOk && teamOk && queryOk;
  });

  return (
    <ScreenScaffold
      title="Players"
      subtitle={`${subtitle} · ${players.length} in club`}
      right={
        <TouchableOpacity onPress={() => navigation.navigate('PlayerCompare')}>
          <Text style={styles.link}>Compare</Text>
        </TouchableOpacity>
      }>
      {!playersReady ? (
        <SkeletonEntityList count={7} />
      ) : (
      <>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search name or jersey"
        placeholderTextColor={Colors.textMuted}
        style={styles.search}
      />
      <FilterChips
        value={role}
        onChange={setRole}
        options={[
          { key: 'All', label: 'All' },
          { key: 'Batter', label: 'Bat' },
          { key: 'Bowler', label: 'Bowl' },
          { key: 'All-rounder', label: 'AR' },
          { key: 'Wicketkeeper', label: 'WK' },
        ]}
      />
      {teams.length > 0 && (
        <FilterChips
          value={teamId}
          onChange={setTeamId}
          options={[{ key: 'All', label: 'All squads' }, ...teams.map(t => ({ key: t.id, label: t.shortName }))]}
        />
      )}
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(p => {
          const live = season.get(p.name);
          const runs = live?.runs ?? p.battingStats?.runs ?? 0;
          const wickets = live?.wickets ?? p.bowlingStats?.wickets ?? 0;
          return (
            <TouchableOpacity key={p.id} activeOpacity={0.88} onPress={() => navigation.navigate('PlayerProfile', { playerId: p.id })}>
              <LinearGradient colors={Colors.gradCard} style={styles.card}>
                {p.photoURL ? (
                  <Image source={{ uri: p.photoURL }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.initials}>{p.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>#{p.jerseyNumber} · {p.teamName} · {p.role}</Text>
                  <View style={styles.pills}>
                    <Text style={styles.pill}>{runs} runs</Text>
                    <Text style={styles.pill}>{wickets} wkts</Text>
                    {(live?.sixes || p.battingStats?.sixes) ? <Text style={styles.pill}>{(live?.sixes ?? p.battingStats.sixes)} sixes</Text> : null}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => shareText(p.name, playerShareMessage(p))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.link}>Share</Text>
                </TouchableOpacity>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
        {filtered.length === 0 && (
          <EmptyState
            title="No players match"
            subtitle={isStaff ? 'Add a roster from More → Manage players.' : 'Try another role or squad.'}
            actionLabel={isStaff ? 'Add player' : undefined}
            onAction={isStaff ? () => navigation.navigate('AdminPlayers') : undefined}
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
  avatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: Colors.primary + '44' },
  avatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgElevated,
    borderWidth: 2,
    borderColor: Colors.primary + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { color: Colors.primary, fontWeight: '900' },
  name: { color: Colors.textPrimary, fontWeight: '900' },
  meta: { color: Colors.textSecondary, fontSize: Typography.xs, marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  pill: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: Colors.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
  },
});
