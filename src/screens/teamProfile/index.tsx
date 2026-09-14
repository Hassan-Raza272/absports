import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import BackButton from '../../components/BackButton';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useTeamsStore, usePlayersStore, useMatchesStore } from '../../store';
import { buildPointsTable } from '../../utils/scoring';
import { SkeletonMatchCenter } from '../../components/Skeleton';

const TEAM_EMOJIS: Record<string, string> = {
  'abs-lions': '🦁', 'mcl-warriors': '⚔️', 'royal-kings': '👑',
  'united-xi': '🦅', 'titans': '⚡', 'falcons': '🦅',
};

type Tab = 'Overview' | 'Players' | 'Matches';

export default function TeamProfileScreen({ route, navigation }: any) {
  const { teamId } = route.params;
  const teams = useTeamsStore(state => state.teams);
  const teamsReady = useTeamsStore(state => state.ready);
  const team = teams.find(t => t.id === teamId);

  const allPlayers = usePlayersStore(state => state.players);
  const players = allPlayers.filter(p => p.teamId === teamId);

  const allMatches = useMatchesStore(state => state.matches);
  const teamMatches = allMatches.filter(m => m.teamA === teamId || m.teamB === teamId);
  const standing = buildPointsTable(teams, allMatches).find(e => e.teamId === teamId);

  const [tab, setTab] = useState<Tab>('Overview');

  if (!team) {
    if (!teamsReady) {
      return (
        <View style={styles.container}>
          <SkeletonMatchCenter />
        </View>
      );
    }
    return null;
  }

  const played = standing?.played ?? 0;
  const won = standing?.won ?? 0;
  const lost = standing?.lost ?? 0;
  const nrr = standing?.nrr ?? 0;
  const points = standing?.points ?? 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {/* Hero Header */}
        <LinearGradient colors={[team.primaryColor + '33', team.secondaryColor, Colors.bg]} style={styles.hero}>
          <BackButton
            onPress={() => navigation.goBack()}
            color={Colors.textPrimary}
            style={styles.backBtn}
          />
          <TouchableOpacity style={{ position: 'absolute', top: 55, right: Spacing.base, zIndex: 10 }} onPress={() => navigation.navigate('TeamCompare', { teamId: team.id })}>
            <Text style={{ color: Colors.primary, fontWeight: '800' }}>Compare</Text>
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <View style={[styles.teamIcon, { borderColor: team.primaryColor }]}>
              <Text style={styles.teamEmoji}>{TEAM_EMOJIS[team.id] || '🏏'}</Text>
            </View>
            <Text style={[styles.teamName, { color: team.primaryColor }]}>{team.name}</Text>
            <Text style={styles.teamShort}>{team.shortName}</Text>
            <View style={styles.heroBadges}>
              <View style={[styles.badge, { backgroundColor: team.primaryColor + '33', borderColor: team.primaryColor + '66' }]}>
                <Text style={[styles.badgeText, { color: team.primaryColor }]}>Club Team</Text>
              </View>
            </View>
          </View>
          {/* Stats strip */}
          <View style={styles.statsStrip}>
            {[
              { label: 'Played', value: String(played) },
              { label: 'Won', value: String(won), color: Colors.win },
              { label: 'Lost', value: String(lost), color: Colors.loss },
              { label: 'NRR', value: nrr > 0 ? `+${nrr.toFixed(2)}` : nrr.toFixed(2), color: nrr >= 0 ? Colors.win : Colors.loss },
              { label: 'Points', value: String(points), color: Colors.primary },
            ].map((s, i) => (
              <View key={i} style={styles.statItem}>
                <Text style={[styles.statVal, s.color ? { color: s.color } : {}]}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['Overview', 'Players', 'Matches'] as Tab[]).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && { color: team.primaryColor }]}>{t}</Text>
              {tab === t && <View style={[styles.tabUnderline, { backgroundColor: team.primaryColor }]} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Overview Tab */}
        {tab === 'Overview' && (
          <View style={styles.section}>
            {[
              { icon: '🏟️', label: 'Home Ground', value: team.homeGround },
              { icon: '🧢', label: 'Captain', value: team.captain },
              { icon: '2️⃣', label: 'Vice Captain', value: team.viceCaptain },
              { icon: '📋', label: 'Coach', value: team.coach },
              { icon: '💼', label: 'Manager', value: team.owner || '—' },
            ].map((row, i) => (
              <View key={i} style={styles.infoRow}>
                <Text style={styles.infoIcon}>{row.icon}</Text>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Players Tab */}
        {tab === 'Players' && (
          <View style={styles.section}>
            {players.length === 0 && (
              <Text style={styles.emptyText}>No players in this squad yet.</Text>
            )}
            {players.map(p => (
              <TouchableOpacity key={p.id} onPress={() => navigation.navigate('PlayerProfile', { playerId: p.id })}>
                <LinearGradient colors={Colors.gradCard} style={styles.playerRow}>
                  <View style={[styles.jerseyBadge, { backgroundColor: team.primaryColor + '33', borderColor: team.primaryColor }]}>
                    <Text style={[styles.jerseyNum, { color: team.primaryColor }]}>{p.jerseyNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName}>{p.name}</Text>
                    <Text style={styles.playerRole}>{p.role} • {p.battingStyle.split(' ')[0]}</Text>
                  </View>
                  <View style={styles.playerMiniStats}>
                    <Text style={styles.playerStatVal}>{p.battingStats?.runs ?? 0}</Text>
                    <Text style={styles.playerStatLabel}>Runs</Text>
                  </View>
                  {(p.bowlingStats?.wickets ?? 0) > 0 && (
                    <View style={[styles.playerMiniStats, { marginLeft: Spacing.sm }]}>
                      <Text style={styles.playerStatVal}>{p.bowlingStats?.wickets ?? 0}</Text>
                      <Text style={styles.playerStatLabel}>Wkts</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Matches Tab */}
        {tab === 'Matches' && (
          <View style={styles.section}>
            {teamMatches.map(m => (
              <TouchableOpacity key={m.id} onPress={() => navigation.navigate('MatchCenter', { matchId: m.id })}>
                <LinearGradient colors={Colors.gradCard} style={styles.matchRow}>
                  <View style={[styles.statusDot, { backgroundColor: m.status === 'LIVE' ? Colors.live : m.status === 'COMPLETED' ? Colors.textMuted : Colors.accent }]} />
                  <Text style={styles.matchRowText}>{m.teamAName} vs {m.teamBName}</Text>
                  <Text style={styles.matchStatus}>{m.status}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  hero: { paddingTop: 60, paddingBottom: 0 },
  backBtn: { position: 'absolute', top: 55, left: Spacing.base, zIndex: 10 },
  heroContent: { alignItems: 'center', paddingBottom: Spacing.lg },
  teamIcon: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, backgroundColor: Colors.bgElevated, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  teamEmoji: { fontSize: 50 },
  teamName: { fontSize: Typography.xxl, fontWeight: '900', textAlign: 'center' },
  teamShort: { fontSize: Typography.sm, color: Colors.textSecondary, letterSpacing: 4, marginTop: 4 },
  heroBadges: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1 },
  badgeText: { fontSize: Typography.xs, fontWeight: '600' },
  statsStrip: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: Colors.bgCard, paddingVertical: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.border },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary },
  statLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textSecondary },
  tabUnderline: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, borderRadius: 1 },
  section: { padding: Spacing.base },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  infoIcon: { fontSize: 22, marginRight: Spacing.md },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  infoValue: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },
  playerRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.sm, gap: Spacing.md },
  jerseyBadge: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  jerseyNum: { fontSize: Typography.sm, fontWeight: '800' },
  playerName: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary },
  playerRole: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  playerMiniStats: { alignItems: 'center' },
  playerStatVal: { fontSize: Typography.base, fontWeight: '700', color: Colors.primary },
  playerStatLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  emptyText: { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.xl },
  matchRow: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.sm, gap: Spacing.md },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  matchRowText: { flex: 1, fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary },
  matchStatus: { fontSize: Typography.xs, color: Colors.textSecondary },
});
