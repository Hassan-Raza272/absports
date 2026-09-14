import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import FilterChips from '../../components/FilterChips';
import EmptyState from '../../components/EmptyState';
import { SkeletonEntityList } from '../../components/Skeleton';
import { useMatchesStore, usePlayersStore, useScopedMatches, useScopeLabels } from '../../store';

type StatTab = 'Batting' | 'Bowling' | 'Fielding';
type Period = 'all' | 'year' | 'q1' | 'q2' | 'q3' | 'q4';

export default function StatisticsScreen({ navigation }: any) {
  const players = usePlayersStore(s => s.players);
  const playersReady = usePlayersStore(s => s.ready);
  const matchesReady = useMatchesStore(s => s.ready);
  const matches = useScopedMatches();
  const { subtitle } = useScopeLabels();
  const [tab, setTab] = useState<StatTab>('Batting');
  const [period, setPeriod] = useState<Period>('all');
  const year = new Date().getFullYear();

  const completed = matches.filter(match => {
    if (match.status !== 'COMPLETED') return false;
    if (period === 'all') return true;
    const d = new Date(match.dateTime);
    if (d.getFullYear() !== year) return false;
    if (period === 'year') return true;
    return period === `q${Math.floor(d.getMonth() / 3) + 1}`;
  });

  const matchBatting = new Map<string, { runs: number; balls: number; fours: number; sixes: number }>();
  const matchBowling = new Map<string, { overs: number; balls: number; runs: number; wickets: number }>();
  completed.forEach(match => {
    [match.innings?.first, match.innings?.second].filter(Boolean).forEach((innings: any) => {
      (innings.batting || []).forEach((batter: any) => {
        const current = matchBatting.get(batter.name) || { runs: 0, balls: 0, fours: 0, sixes: 0 };
        current.runs += batter.runs || 0;
        current.balls += batter.balls || 0;
        current.fours += batter.fours || 0;
        current.sixes += batter.sixes || 0;
        matchBatting.set(batter.name, current);
      });
      (innings.bowling || []).forEach((bowler: any) => {
        const current = matchBowling.get(bowler.name) || { overs: 0, balls: 0, runs: 0, wickets: 0 };
        const full = Math.floor(bowler.overs || 0);
        const fracBalls = Math.round(((bowler.overs || 0) % 1) * 10);
        current.overs += full;
        current.balls += fracBalls;
        if (current.balls >= 6) {
          current.overs += Math.floor(current.balls / 6);
          current.balls %= 6;
        }
        current.runs += bowler.runs || 0;
        current.wickets += bowler.wickets || 0;
        matchBowling.set(bowler.name, current);
      });
    });
  });

  const useMatchSeason = completed.length > 0;
  const seasonPlayers = players.map(player => {
    const batting = matchBatting.get(player.name);
    const bowling = matchBowling.get(player.name);
    if (!useMatchSeason) return player;
    const totalRuns = batting?.runs || 0;
    const totalBalls = batting?.balls || 0;
    const totalWickets = bowling?.wickets || 0;
    const totalBowlingRuns = bowling?.runs || 0;
    const totalBowlingBalls = (bowling?.overs || 0) * 6 + (bowling?.balls || 0);
    return {
      ...player,
      battingStats: {
        ...player.battingStats,
        runs: totalRuns,
        balls: totalBalls,
        fours: batting?.fours || 0,
        sixes: batting?.sixes || 0,
        average: totalRuns,
        strikeRate: totalBalls ? (totalRuns * 100) / totalBalls : 0,
      },
      bowlingStats: {
        ...player.bowlingStats,
        wickets: totalWickets,
        runs: totalBowlingRuns,
        innings: bowling ? 1 : 0,
        economy: totalBowlingBalls ? totalBowlingRuns / (totalBowlingBalls / 6) : 0,
      },
    };
  });

  const orange = [...seasonPlayers].sort((a, b) => (b.battingStats?.runs || 0) - (a.battingStats?.runs || 0))[0];
  const purple = [...seasonPlayers].sort((a, b) => (b.bowlingStats?.wickets || 0) - (a.bowlingStats?.wickets || 0))[0];

  const sections = tab === 'Batting' ? [
    { title: 'Most runs', players: [...seasonPlayers].sort((a, b) => (b.battingStats?.runs || 0) - (a.battingStats?.runs || 0)).slice(0, 8), pv: (p: any) => p.battingStats?.runs || 0, pl: 'Runs', sv: (p: any) => (p.battingStats?.strikeRate || 0).toFixed(1), sl: 'SR', color: Colors.accentOrange },
    { title: 'Most sixes', players: [...seasonPlayers].sort((a, b) => (b.battingStats?.sixes || 0) - (a.battingStats?.sixes || 0)).slice(0, 6), pv: (p: any) => p.battingStats?.sixes || 0, pl: '6s', sv: (p: any) => p.battingStats?.fours || 0, sl: '4s', color: Colors.primary },
    { title: 'Most fours', players: [...seasonPlayers].sort((a, b) => (b.battingStats?.fours || 0) - (a.battingStats?.fours || 0)).slice(0, 6), pv: (p: any) => p.battingStats?.fours || 0, pl: '4s', sv: null, sl: '', color: Colors.accentBlue },
  ] : tab === 'Bowling' ? [
    { title: 'Most wickets', players: [...seasonPlayers].sort((a, b) => (b.bowlingStats?.wickets || 0) - (a.bowlingStats?.wickets || 0)).slice(0, 8), pv: (p: any) => p.bowlingStats?.wickets || 0, pl: 'Wkts', sv: (p: any) => (p.bowlingStats?.economy || 0).toFixed(2), sl: 'Eco', color: Colors.accentPurple },
    { title: 'Best economy', players: [...seasonPlayers].filter(p => (p.bowlingStats?.wickets || 0) > 0 || (p.bowlingStats?.innings || 0) > 0).sort((a, b) => (a.bowlingStats?.economy || 99) - (b.bowlingStats?.economy || 99)).slice(0, 6), pv: (p: any) => (p.bowlingStats?.economy || 0).toFixed(2), pl: 'Eco', sv: null, sl: '', color: Colors.accentBlue },
  ] : [
    { title: 'Most catches', players: [...seasonPlayers].sort((a, b) => (b.fieldingStats?.catches || 0) - (a.fieldingStats?.catches || 0)).slice(0, 6), pv: (p: any) => p.fieldingStats?.catches || 0, pl: 'Ct', sv: null, sl: '', color: Colors.accent },
  ];

    if (!playersReady || !matchesReady) {
    return (
      <ScreenScaffold title="Leaders" subtitle={subtitle}>
        <SkeletonEntityList count={8} />
      </ScreenScaffold>
    );
  }

return (
    <ScreenScaffold
      title="Leaders"
      subtitle={`${subtitle} · ${completed.length} completed`}
      right={
        <TouchableOpacity onPress={() => navigation.navigate('PlayerCompare')}>
          <Text style={styles.link}>Compare</Text>
        </TouchableOpacity>
      }>
      <FilterChips
        value={period}
        onChange={setPeriod}
        options={[
          { key: 'all', label: 'All time' },
          { key: 'year', label: String(year) },
          { key: 'q1', label: 'Q1' },
          { key: 'q2', label: 'Q2' },
          { key: 'q3', label: 'Q3' },
          { key: 'q4', label: 'Q4' },
        ]}
      />
      <FilterChips
        value={tab}
        onChange={setTab}
        options={[
          { key: 'Batting', label: 'Batting', accent: Colors.accentOrange },
          { key: 'Bowling', label: 'Bowling', accent: Colors.accentPurple },
          { key: 'Fielding', label: 'Fielding', accent: Colors.accent },
        ]}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {orange && purple && (
          <View style={styles.caps}>
            <CapCard
              label="Most runs"
              name={orange.name}
              value={`${orange.battingStats?.runs || 0} runs`}
              color={Colors.accentOrange}
              onPress={() => navigation.navigate('PlayerProfile', { playerId: orange.id })}
            />
            <CapCard
              label="Most wickets"
              name={purple.name}
              value={`${purple.bowlingStats?.wickets || 0} wkts`}
              color={Colors.accentPurple}
              onPress={() => navigation.navigate('PlayerProfile', { playerId: purple.id })}
            />
          </View>
        )}

        {sections.map(section => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.players.every(p => section.pv(p) === 0) ? (
              <EmptyState title="No numbers yet" subtitle="Complete a match in this club to fill the leaderboard." />
            ) : (
              section.players.map((p, i) => (
                <TouchableOpacity key={p.id} onPress={() => navigation.navigate('PlayerProfile', { playerId: p.id })}>
                  <LinearGradient
                    colors={i === 0 ? [section.color + '22', Colors.bgCard] : Colors.gradCard}
                    style={styles.row}>
                    <View style={[styles.rank, i === 0 && { backgroundColor: section.color }]}>
                      <Text style={[styles.rankText, i === 0 && { color: Colors.onPrimary }]}>{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.team}>{p.teamName}</Text>
                    </View>
                    <View style={styles.vals}>
                      <Text style={[styles.primary, { color: section.color }]}>{section.pv(p)}</Text>
                      <Text style={styles.lbl}>{section.pl}</Text>
                    </View>
                    {section.sv && (
                      <View style={styles.vals}>
                        <Text style={styles.secondary}>{section.sv(p)}</Text>
                        <Text style={styles.lbl}>{section.sl}</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </ScreenScaffold>
  );
}

function CapCard({ label, name, value, color, onPress }: { label: string; name: string; value: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1 }}>
      <LinearGradient colors={[color + '22', Colors.bgCard]} style={[styles.cap, { borderColor: color + '55' }]}>
        <Text style={[styles.capLabel, { color }]}>{label}</Text>
        <Text style={styles.capName} numberOfLines={1}>{name}</Text>
        <Text style={styles.capVal}>{value}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: { color: Colors.primary, fontWeight: '800', fontSize: 12 },
  scroll: { padding: Spacing.base, paddingBottom: 40 },
  caps: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  cap: { padding: Spacing.md, borderRadius: Radius.xl, borderWidth: 1 },
  capLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  capName: { color: Colors.textPrimary, fontWeight: '900', marginTop: 6 },
  capVal: { color: Colors.textSecondary, fontSize: 12, marginTop: 2, fontWeight: '700' },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { color: Colors.textPrimary, fontWeight: '900', marginBottom: Spacing.sm, fontSize: Typography.base },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
  },
  rank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { color: Colors.textSecondary, fontWeight: '900', fontSize: 12 },
  name: { color: Colors.textPrimary, fontWeight: '800' },
  team: { color: Colors.textSecondary, fontSize: 11, marginTop: 1 },
  vals: { alignItems: 'flex-end', minWidth: 40 },
  primary: { fontWeight: '900', fontSize: Typography.lg },
  secondary: { color: Colors.textSecondary, fontWeight: '800' },
  lbl: { color: Colors.textMuted, fontSize: 9, marginTop: 1 },
});
