import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import BackButton from '../../components/BackButton';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { usePlayersStore } from '../../store';
import { Player } from '../../types';

function Stat({ label, a, b }: { label: string; a: string | number; b: string | number }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statA}>{a}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statB}>{b}</Text>
    </View>
  );
}

export default function PlayerCompareScreen({ route, navigation }: any) {
  const players = usePlayersStore(s => s.players);
  const initial = route.params?.playerId;
  const [leftId, setLeftId] = useState(initial || players[0]?.id);
  const [rightId, setRightId] = useState(players.find(p => p.id !== leftId)?.id || players[1]?.id);
  const left = players.find(p => p.id === leftId);
  const right = players.find(p => p.id === rightId);

  const picker = (selected: string | undefined, onPick: (id: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
      {players.map(p => (
        <TouchableOpacity key={p.id} onPress={() => onPick(p.id)} style={[styles.chip, selected === p.id && styles.chipOn]}>
          <Text style={[styles.chipText, selected === p.id && styles.chipTextOn]}>{p.name.split(' ')[0]}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const rows = useMemo(() => {
    if (!left || !right) return [];
    const L = left as Player;
    const R = right as Player;
    return [
      ['Matches', L.battingStats.matches, R.battingStats.matches],
      ['Runs', L.battingStats.runs, R.battingStats.runs],
      ['Average', L.battingStats.average.toFixed(1), R.battingStats.average.toFixed(1)],
      ['Strike rate', L.battingStats.strikeRate.toFixed(1), R.battingStats.strikeRate.toFixed(1)],
      ['High score', L.battingStats.highScore, R.battingStats.highScore],
      ['Wickets', L.bowlingStats.wickets, R.bowlingStats.wickets],
      ['Economy', L.bowlingStats.economy.toFixed(2), R.bowlingStats.economy.toFixed(2)],
      ['Best', L.bowlingStats.bestFigures, R.bowlingStats.bestFigures],
    ] as Array<[string, string | number, string | number]>;
  }, [left, right]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: 4 }} />
        <Text style={styles.title}>Player comparison</Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: Spacing.base }}>
        {picker(leftId, setLeftId)}
        {picker(rightId, setRightId)}
        {left && right ? (
          <LinearGradient colors={Colors.gradCard} style={styles.card}>
            <View style={styles.names}>
              <Text style={styles.name}>{left.name}</Text>
              <Text style={styles.vs}>VS</Text>
              <Text style={[styles.name, { textAlign: 'right' }]}>{right.name}</Text>
            </View>
            {rows.map(([label, a, b]) => <Stat key={label} label={label} a={a} b={b} />)}
          </LinearGradient>
        ) : (
          <Text style={{ color: Colors.textSecondary }}>Need at least two players in this club.</Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingTop: 50, padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { color: Colors.onPrimary, fontSize: Typography.xl, fontWeight: '800' },
  chip: { marginRight: 6, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  chipText: { color: Colors.textSecondary, fontWeight: '700', fontSize: Typography.xs },
  chipTextOn: { color: Colors.primary },
  card: { padding: Spacing.base, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  names: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  name: { flex: 1, color: Colors.textPrimary, fontWeight: '800' },
  vs: { color: Colors.textMuted, fontWeight: '800', paddingHorizontal: Spacing.sm },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statA: { flex: 1, color: Colors.primary, fontWeight: '800' },
  statLabel: { width: 90, textAlign: 'center', color: Colors.textSecondary, fontSize: Typography.xs },
  statB: { flex: 1, textAlign: 'right', color: Colors.accent, fontWeight: '800' },
});
