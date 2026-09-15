import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Modal, useWindowDimensions } from 'react-native';
import BackButton from '../../../components/BackButton';
import { showAlert } from '../../../components/PremiumAlert';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import { useTeamsStore, usePlayersStore, useMatchesStore, useAuthStore, useScopeLabels, useScopedMatches } from '../../../store';
import { Match } from '../../../types';
import { isSuperAdmin } from '../../../utils/account';
import { EaseEnter, EasePress, EaseScreen } from '../../../motion';
import { SkeletonGrid } from '../../../components/Skeleton';

function StatCard({ label, value, icon, color = Colors.primary, compact, index = 0 }: any) {
  return (
    <EaseEnter index={index} style={compact ? styles.statWrapCompact : styles.statWrap}>
      <LinearGradient colors={Colors.gradCard} style={styles.statCard}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statValue, { color }, compact && { fontSize: Typography.lg }]}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </LinearGradient>
    </EaseEnter>
  );
}

function QuickAction({ icon, label, onPress, color = Colors.primary, width, index = 0 }: any) {
  return (
    <EaseEnter index={index} style={{ width }}>
      <EasePress onPress={onPress}>
        <LinearGradient colors={[color + '22', Colors.bgCard]} style={styles.quickAction}>
          <Text style={styles.qaIcon}>{icon}</Text>
          <Text style={styles.qaLabel}>{label}</Text>
        </LinearGradient>
      </EasePress>
    </EaseEnter>
  );
}

export default function AdminDashboardScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 380;
  const actionWidth = width < 360 ? '100%' : '47%';

  const teams = useTeamsStore(state => state.teams);
  const teamsReady = useTeamsStore(state => state.ready);
  const players = usePlayersStore(state => state.players);
  const playersReady = usePlayersStore(state => state.ready);
  const matchesReady = useMatchesStore(state => state.ready);
  const matches = useScopedMatches();
  const liveMatch = matches.find(m => m.status === 'LIVE') || null;
  const { subtitle } = useScopeLabels();
  const user = useAuthStore(state => state.user);
  const [showMatchPicker, setShowMatchPicker] = useState(false);

  useEffect(() => {
    if (!user) {
      showAlert('Sign in', 'Sign in to open the management panel.');
      navigation.replace('Login');
    }
  }, [user, navigation]);

  const completedMatches = matches.filter(m => m.status === 'COMPLETED').length;
  const scorableMatches = matches
    .filter(m => m.status === 'UPCOMING' || m.status === 'LIVE')
    .sort((a, b) => {
      if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
      if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;
      return a.matchNumber - b.matchNumber;
    });

  function openScoring(match: Match) {
    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      showAlert('Match finished', 'This match is already completed. Scoring is closed.');
      return;
    }
    setShowMatchPicker(false);
    navigation.navigate('AdminLiveScoring', { matchId: match.id });
  }

  function handleStartScoring() {
    if (scorableMatches.length === 0) {
      showAlert('No matches to score', 'Schedule an upcoming match first. Completed matches cannot be scored again.');
      return;
    }
    if (scorableMatches.length === 1) {
      openScoring(scorableMatches[0]);
      return;
    }
    setShowMatchPicker(true);
  }

  function handleMatchRowPress(match: Match) {
    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      navigation.navigate('MatchCenter', { matchId: match.id });
      return;
    }
    openScoring(match);
  }

  return (
    <EaseScreen style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
      <EaseEnter from={{ opacity: 0, translateY: -8 }} to={{ opacity: 1, translateY: 0 }}>
        <LinearGradient colors={Colors.gradHeader} style={styles.header}>
          <View style={{ flex: 1 }}>
            <BackButton onPress={() => navigation.goBack()} label="Home" style={{ marginBottom: 4 }} />
            <Text style={styles.headerTitle}>Scoring desk</Text>
            <Text style={styles.headerSub}>{subtitle}</Text>
          </View>
          <LinearGradient colors={Colors.gradPrimary} style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>
              {isSuperAdmin(user) ? 'SUPER ADMIN' : user?.role === 'admin' ? 'ORGANISER' : 'SCORING'}
            </Text>
          </LinearGradient>
        </LinearGradient>
      </EaseEnter>

      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {!(teamsReady && playersReady && matchesReady) ? (
          <SkeletonGrid count={6} />
        ) : (
          <>
        <View style={[styles.statsRow, isNarrow && styles.statsRowWrap]}>
          <StatCard icon="🏟️" label="Teams" value={teams.length} compact={isNarrow} index={0} />
          <StatCard icon="👤" label="Players" value={players.length} color={Colors.accentBlue} compact={isNarrow} index={1} />
          <StatCard icon="📅" label="Matches" value={matches.length} color={Colors.accent} compact={isNarrow} index={2} />
          <StatCard icon="✅" label="Completed" value={completedMatches} color={Colors.win} compact={isNarrow} index={3} />
        </View>

        {liveMatch && (
          <>
            <Text style={styles.sectionTitle}>🔴 Live Match</Text>
            <TouchableOpacity activeOpacity={0.9} onPress={() => openScoring(liveMatch)}>
              <LinearGradient colors={Colors.gradLiveCard} style={styles.liveCard}>
                <View style={styles.liveCardLeft}>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                  <Text style={styles.liveMatchName}>{liveMatch.teamAName} vs {liveMatch.teamBName}</Text>
                  <Text style={styles.liveMatchSub}>Match {liveMatch.matchNumber}{liveMatch.venue ? ` • ${liveMatch.venue.split(',')[0]}` : ''}</Text>
                </View>
                <LinearGradient colors={Colors.gradLive} style={styles.liveBtn}>
                  <Text style={styles.liveBtnText}>Score ›</Text>
                </LinearGradient>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {isSuperAdmin(user) && (
            <QuickAction icon="👥" label="All Users" color={Colors.primary} width={actionWidth} onPress={() => navigation.navigate('AdminUsers')} />
          )}
          <QuickAction icon="🏆" label="Tournaments" color={Colors.accent} width={actionWidth} onPress={() => navigation.navigate('AdminTournaments')} />
          <QuickAction icon="👥" label="Teams" color={Colors.accentBlue} width={actionWidth} onPress={() => navigation.navigate('AdminTeams')} />
          <QuickAction icon="📅" label="Schedule Match" color={Colors.accent} width={actionWidth} onPress={() => navigation.navigate('CreateMatch')} />
          <QuickAction icon="🏏" label="Start Scoring" color={Colors.live} width={actionWidth} onPress={handleStartScoring} />
        </View>

        {matches.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Matches</Text>
            {matches.map(m => (
              <TouchableOpacity key={m.id} activeOpacity={0.85} onPress={() => handleMatchRowPress(m)}>
                <LinearGradient colors={Colors.gradCard} style={styles.matchItem}>
                  <View style={[styles.statusDot, { backgroundColor: m.status === 'LIVE' ? Colors.live : m.status === 'COMPLETED' ? Colors.textMuted : Colors.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchItemText}>{m.teamAName} vs {m.teamBName}</Text>
                    <Text style={styles.matchItemSub}>Match {m.matchNumber} • {m.status}</Text>
                  </View>
                  <Text style={[styles.matchArrow, m.status === 'COMPLETED' && { color: Colors.textMuted, fontSize: Typography.xs }]}>
                    {m.status === 'COMPLETED' ? 'View' : '›'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </>
        )}
          </>
        )}
      </ScrollView>

      <Modal visible={showMatchPicker} transparent animationType="slide" onRequestClose={() => setShowMatchPicker(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Which match do you want to score?</Text>
            <Text style={styles.pickerSub}>Select a scheduled or live match. Completed matches are hidden.</Text>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {scorableMatches.map(m => (
                <TouchableOpacity key={m.id} activeOpacity={0.85} onPress={() => openScoring(m)} style={styles.pickerRow}>
                  <View style={[styles.statusDot, { backgroundColor: m.status === 'LIVE' ? Colors.live : Colors.accent }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.matchItemText}>{m.teamAName} vs {m.teamBName}</Text>
                    <Text style={styles.matchItemSub}>
                      Match {m.matchNumber} • {m.status} • {m.overs} overs
                      {m.venue ? ` • ${m.venue.split(',')[0]}` : ''}
                    </Text>
                  </View>
                  <Text style={{ color: Colors.primary, fontWeight: '800' }}>Score ›</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => setShowMatchPicker(false)} style={styles.pickerCancel}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </EaseScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 50, paddingBottom: Spacing.base, paddingHorizontal: Spacing.base },
  headerTitle: { fontSize: Typography.xxl, fontWeight: '800', color: Colors.onPrimary },
  headerSub: { fontSize: Typography.sm, color: Colors.onPrimary, opacity: 0.92, marginTop: 2, fontWeight: '600' },
  adminBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full },
  adminBadgeText: { fontSize: Typography.xs, fontWeight: '800', color: Colors.onPrimary, letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  statsRowWrap: { flexWrap: 'wrap' },
  statWrap: { flex: 1, minWidth: 70 },
  statWrapCompact: { minWidth: '47%', flexGrow: 1, flexBasis: '47%' },
  statCard: { alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border },
  statIcon: { fontSize: 20, marginBottom: 4 },
  statValue: { fontSize: Typography.xl, fontWeight: '900' },
  statLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: Typography.base, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  liveCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.base, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.live + '44' },
  liveCardLeft: { flex: 1 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.live + '22', alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full, marginBottom: Spacing.xs },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.live },
  liveText: { fontSize: Typography.xs, fontWeight: '800', color: Colors.live, letterSpacing: 1 },
  liveMatchName: { fontSize: Typography.base, fontWeight: '800', color: Colors.textPrimary },
  liveMatchSub: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  liveBtn: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.full },
  liveBtnText: { fontSize: Typography.sm, fontWeight: '800', color: '#fff' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'space-between' },
  quickAction: { padding: Spacing.base, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  qaIcon: { fontSize: 28, marginBottom: Spacing.xs },
  qaLabel: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  matchItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: Radius.md, marginBottom: Spacing.sm, gap: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  matchItemText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  matchItemSub: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  matchArrow: { fontSize: 22, color: Colors.textMuted },
  pickerBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  pickerCard: { backgroundColor: Colors.bgCard, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, padding: Spacing.base, paddingBottom: Spacing.xl, borderWidth: 1, borderColor: Colors.border },
  pickerTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.xs },
  pickerSub: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: Spacing.base },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerCancel: { marginTop: Spacing.md, alignItems: 'center', padding: Spacing.md },
  pickerCancelText: { color: Colors.textSecondary, fontWeight: '700', fontSize: Typography.base },
});
