import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput } from 'react-native';
import BackButton from '../../components/BackButton';
import { showAlert } from '../../components/PremiumAlert';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useAuthStore, usePlayersStore } from '../../store';
import { updatePlayer as updateRemotePlayer } from '../../firebase';
import { playerShareMessage, shareText } from '../../utils/share';
import { AddedScore, MatchFormat } from '../../types';
import { SkeletonMatchCenter } from '../../components/Skeleton';

type Tab = 'Batting' | 'Bowling' | 'Fielding';

export default function PlayerProfileScreen({ route, navigation }: any) {
  const { playerId } = route.params;
  const players = usePlayersStore(state => state.players);
  const playersReady = usePlayersStore(state => state.ready);
  const updatePlayer = usePlayersStore(state => state.updatePlayer);
  const player = players.find(p => p.id === playerId);
  const user = useAuthStore(s => s.user);
  const [tab, setTab] = useState<Tab>('Batting');
  const [past, setPast] = useState({ runs: '', balls: '', wickets: '', against: '', format: 'T20' as MatchFormat });

  if (!player) {
    return (
      <View style={styles.container}>
        {!playersReady ? (
          <SkeletonMatchCenter />
        ) : (
          <Text style={styles.notFound}>Player not found</Text>
        )}
      </View>
    );
  }

  const battingRows = [
    { label: 'Matches', value: player.battingStats?.matches ?? 0 },
    { label: 'Innings', value: player.battingStats?.innings ?? 0 },
    { label: 'Runs', value: player.battingStats?.runs ?? 0 },
    { label: 'High Score', value: player.battingStats?.highScore ?? 0 },
    { label: 'Average', value: (player.battingStats?.average ?? 0).toFixed(2) },
    { label: 'Strike Rate', value: (player.battingStats?.strikeRate ?? 0).toFixed(2) },
    { label: 'Fours', value: player.battingStats?.fours ?? 0 },
    { label: 'Sixes', value: player.battingStats?.sixes ?? 0 },
    { label: 'Fifties', value: player.battingStats?.fifties ?? 0 },
    { label: 'Hundreds', value: player.battingStats?.hundreds ?? 0 },
  ];

  const bowlingRows = [
    { label: 'Innings', value: player.bowlingStats?.innings ?? 0 },
    { label: 'Overs', value: player.bowlingStats?.overs ?? 0 },
    { label: 'Maidens', value: player.bowlingStats?.maidens ?? 0 },
    { label: 'Runs', value: player.bowlingStats?.runs ?? 0 },
    { label: 'Wickets', value: player.bowlingStats?.wickets ?? 0 },
    { label: 'Economy', value: (player.bowlingStats?.economy ?? 0).toFixed(2) },
    { label: 'Average', value: (player.bowlingStats?.average ?? 0) > 0 ? (player.bowlingStats?.average ?? 0).toFixed(2) : '-' },
    { label: 'Best Figures', value: player.bowlingStats?.bestFigures ?? '-' },
  ];

  const fieldingRows = [
    { label: 'Catches', value: player.fieldingStats?.catches ?? 0 },
    { label: 'Stumpings', value: player.fieldingStats?.stumpings ?? 0 },
    { label: 'Run Outs', value: player.fieldingStats?.runOuts ?? 0 },
  ];

  const rows = tab === 'Batting' ? battingRows : tab === 'Bowling' ? bowlingRows : fieldingRows;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        <LinearGradient colors={Colors.gradHeader} style={styles.hero}>
          <BackButton
            onPress={() => navigation.goBack()}
            color={Colors.onPrimary}
            style={styles.backBtn}
          />
          <View style={{ position: 'absolute', top: 55, right: Spacing.base, zIndex: 10, flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => navigation.navigate('PlayerCompare', { playerId: player.id })}>
              <Text style={{ color: Colors.primary, fontWeight: '800', fontSize: 12 }}>Compare</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => shareText(player.name, playerShareMessage(player))}>
              <Text style={{ color: Colors.primary, fontWeight: '800', fontSize: 12 }}>Share</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.heroContent}>
            <LinearGradient colors={Colors.gradCard} style={styles.avatar}>
              <Text style={styles.avatarText}>{player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</Text>
            </LinearGradient>
            <Text style={styles.playerName}>{player.name}</Text>
            <Text style={styles.playerTeam}>{player.teamName}</Text>
            <View style={styles.heroBadges}>
              <View style={styles.badge}><Text style={styles.badgeText}>{player.role}</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>#{player.jerseyNumber}</Text></View>
              <View style={styles.badge}><Text style={styles.badgeText}>{player.nationality}</Text></View>
            </View>
          </View>
          <View style={styles.heroStats}>
            {[
              { label: 'Runs', value: player.battingStats?.runs ?? 0, color: Colors.primary },
              { label: 'SR', value: (player.battingStats?.strikeRate ?? 0).toFixed(0), color: Colors.accent },
              { label: 'Wkts', value: player.bowlingStats?.wickets ?? 0, color: Colors.accentPurple },
              { label: 'Eco', value: (player.bowlingStats?.economy ?? 0) > 0 ? (player.bowlingStats?.economy ?? 0).toFixed(2) : '-', color: Colors.accentBlue },
            ].map((s, i) => (
              <View key={i} style={styles.heroStatItem}>
                <Text style={[styles.heroStatVal, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.heroStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Style Info */}
        <View style={styles.styleRow}>
          <View style={styles.styleItem}>
            <Text style={styles.styleLabel}>🏏 Batting Style</Text>
            <Text style={styles.styleValue}>{player.battingStyle}</Text>
          </View>
          <View style={[styles.styleDiv]} />
          <View style={styles.styleItem}>
            <Text style={styles.styleLabel}>⚾ Bowling Style</Text>
            <Text style={styles.styleValue}>{player.bowlingStyle}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['Batting', 'Bowling', 'Fielding'] as Tab[]).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && { color: Colors.primary }]}>{t}</Text>
              {tab === t && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Table */}
        <View style={styles.statsSection}>
          {rows.map((row, i) => (
            <View key={i} style={[styles.statRow, i % 2 === 0 && styles.statRowAlt]}>
              <Text style={styles.statLabel}>{row.label}</Text>
              <Text style={styles.statValue}>{row.value}</Text>
            </View>
          ))}
          {(player.addedScores || []).length > 0 && (
            <>
              <Text style={[styles.statLabel, { marginTop: Spacing.lg, fontWeight: '800', color: Colors.textPrimary }]}>Added past scores</Text>
              {player.addedScores!.map(score => (
                <Text key={score.id} style={[styles.statLabel, { marginTop: 6 }]}>
                  {score.date.slice(0, 10)} · {score.format} · {score.runs ?? 0} ({score.balls ?? 0}) · {score.wickets ?? 0} wkts{score.against ? ` vs ${score.against}` : ''}
                </Text>
              ))}
            </>
          )}
          {user && (user.role === 'superadmin' || user.role === 'admin') && (
            <View style={{ marginTop: Spacing.lg }}>
              <Text style={[styles.statLabel, { fontWeight: '800', color: Colors.textPrimary, marginBottom: 8 }]}>Add past innings</Text>
              <TextInput style={styles.input} placeholder="Runs" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" value={past.runs} onChangeText={runs => setPast(p => ({ ...p, runs }))} />
              <TextInput style={styles.input} placeholder="Balls" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" value={past.balls} onChangeText={balls => setPast(p => ({ ...p, balls }))} />
              <TextInput style={styles.input} placeholder="Wickets" placeholderTextColor={Colors.textMuted} keyboardType="number-pad" value={past.wickets} onChangeText={wickets => setPast(p => ({ ...p, wickets }))} />
              <TextInput style={styles.input} placeholder="Against" placeholderTextColor={Colors.textMuted} value={past.against} onChangeText={against => setPast(p => ({ ...p, against }))} />
              <TouchableOpacity
                onPress={async () => {
                  const entry: AddedScore = {
                    id: `add-${Date.now()}`,
                    date: new Date().toISOString(),
                    format: past.format,
                    runs: parseInt(past.runs, 10) || 0,
                    balls: parseInt(past.balls, 10) || 0,
                    wickets: parseInt(past.wickets, 10) || 0,
                    against: past.against || undefined,
                  };
                  const addedScores = [...(player.addedScores || []), entry];
                  const battingStats = {
                    ...player.battingStats,
                    matches: (player.battingStats?.matches || 0) + 1,
                    innings: (player.battingStats?.innings || 0) + 1,
                    runs: (player.battingStats?.runs || 0) + (entry.runs || 0),
                    balls: (player.battingStats?.balls || 0) + (entry.balls || 0),
                  };
                  battingStats.strikeRate = battingStats.balls ? (battingStats.runs * 100) / battingStats.balls : 0;
                  battingStats.average = battingStats.innings ? battingStats.runs / battingStats.innings : 0;
                  const bowlingStats = {
                    ...player.bowlingStats,
                    wickets: (player.bowlingStats?.wickets || 0) + (entry.wickets || 0),
                  };
                  updatePlayer(player.id, { addedScores, battingStats, bowlingStats });
                  try {
                    await updateRemotePlayer(player.id, { addedScores, battingStats, bowlingStats });
                    setPast({ runs: '', balls: '', wickets: '', against: '', format: 'T20' });
                  } catch {
                    showAlert('Saved locally', 'Could not sync this innings to Firebase.');
                  }
                }}>
                <Text style={{ color: Colors.primary, fontWeight: '800', marginTop: 8 }}>Save innings</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  notFound: { color: Colors.textSecondary, textAlign: 'center', marginTop: 100 },
  hero: { paddingTop: 60, paddingBottom: Spacing.base },
  backBtn: { position: 'absolute', top: 55, left: Spacing.base, zIndex: 10 },
  heroContent: { alignItems: 'center', paddingBottom: Spacing.md },
  avatar: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.primary + '66', marginBottom: Spacing.md },
  avatarText: { fontSize: 36, fontWeight: '900', color: Colors.primary },
  playerName: { fontSize: Typography.xxl, fontWeight: '900', color: Colors.textPrimary },
  playerTeam: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 4 },
  heroBadges: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  badge: { backgroundColor: Colors.bgElevated, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border },
  badgeText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
  heroStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: Colors.bgCard, paddingVertical: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.border },
  heroStatItem: { alignItems: 'center' },
  heroStatVal: { fontSize: Typography.xl, fontWeight: '800' },
  heroStatLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  styleRow: { flexDirection: 'row', backgroundColor: Colors.bgCard, padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  styleItem: { flex: 1 },
  styleDiv: { width: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  styleLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
  styleValue: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textSecondary },
  tabUnderline: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: Colors.primary, borderRadius: 1 },
  statsSection: { padding: Spacing.base },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
  statRowAlt: { backgroundColor: Colors.bgCard },
  statLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  statValue: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  input: { backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, color: Colors.textPrimary, padding: Spacing.md, marginBottom: Spacing.sm },
});
