import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import BackButton from '../../components/BackButton';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useMatchesStore, useTeamsStore } from '../../store';
import { buildPointsTable } from '../../utils/scoring';

export default function TeamCompareScreen({ route, navigation }: any) {
  const teams = useTeamsStore(s => s.teams);
  const matches = useMatchesStore(s => s.matches);
  const [aId, setAId] = useState(route.params?.teamId || teams[0]?.id);
  const [bId, setBId] = useState(teams.find(t => t.id !== aId)?.id || teams[1]?.id);
  const table = buildPointsTable(teams, matches);
  const a = teams.find(t => t.id === aId);
  const b = teams.find(t => t.id === bId);
  const aStand = table.find(e => e.teamId === aId);
  const bStand = table.find(e => e.teamId === bId);

  const h2h = useMemo(() => {
    const played = matches.filter(m =>
      m.status === 'COMPLETED' &&
      ((m.teamA === aId && m.teamB === bId) || (m.teamA === bId && m.teamB === aId)),
    );
    let aWins = 0;
    let bWins = 0;
    let nr = 0;
    played.forEach(m => {
      if (/tied|no result/i.test(m.result || '')) nr += 1;
      else if (m.result?.startsWith(a?.name || '')) aWins += 1;
      else if (m.result?.startsWith(b?.name || '')) bWins += 1;
    });
    return { played: played.length, aWins, bWins, nr, recent: played.slice(-5) };
  }, [matches, aId, bId, a?.name, b?.name]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: 4 }} />
        <Text style={styles.title}>Team comparison</Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: Spacing.base }}>
        <View style={styles.pickRow}>
          {teams.map(t => (
            <TouchableOpacity key={`a-${t.id}`} onPress={() => setAId(t.id)} style={[styles.chip, aId === t.id && styles.chipOn]}>
              <Text style={[styles.chipText, aId === t.id && styles.chipTextOn]}>{t.shortName}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.pickRow}>
          {teams.map(t => (
            <TouchableOpacity key={`b-${t.id}`} onPress={() => setBId(t.id)} style={[styles.chip, bId === t.id && styles.chipOn]}>
              <Text style={[styles.chipText, bId === t.id && styles.chipTextOn]}>{t.shortName}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {a && b && (
          <LinearGradient colors={Colors.gradCard} style={styles.card}>
            <Text style={styles.vs}>{a.name} vs {b.name}</Text>
            <Text style={styles.line}>Head to head: {h2h.aWins}-{h2h.bWins}-{h2h.nr} ({h2h.played} matches)</Text>
            <Text style={styles.line}>{a.shortName} table: {aStand?.won || 0}W {aStand?.lost || 0}L · {aStand?.points || 0} pts · NRR {(aStand?.nrr || 0).toFixed(2)}</Text>
            <Text style={styles.line}>{b.shortName} table: {bStand?.won || 0}W {bStand?.lost || 0}L · {bStand?.points || 0} pts · NRR {(bStand?.nrr || 0).toFixed(2)}</Text>
            <Text style={styles.sub}>Recent</Text>
            {h2h.recent.map(m => (
              <Text key={m.id} style={styles.recent}>{m.teamAName} vs {m.teamBName} · {m.result || m.status}</Text>
            ))}
            {h2h.recent.length === 0 && <Text style={styles.recent}>No completed meetings yet.</Text>}
          </LinearGradient>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingTop: 50, padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { color: Colors.onPrimary, fontSize: Typography.xl, fontWeight: '800' },
  pickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.sm },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  chipText: { color: Colors.textSecondary, fontWeight: '700' },
  chipTextOn: { color: Colors.primary },
  card: { padding: Spacing.base, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border },
  vs: { color: Colors.textPrimary, fontWeight: '800', marginBottom: Spacing.sm },
  line: { color: Colors.textSecondary, marginBottom: 4 },
  sub: { color: Colors.textPrimary, fontWeight: '800', marginTop: Spacing.md, marginBottom: 4 },
  recent: { color: Colors.textSecondary, fontSize: Typography.xs, marginBottom: 4 },
});
