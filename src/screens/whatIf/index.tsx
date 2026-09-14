import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput } from 'react-native';
import BackButton from '../../components/BackButton';
import { showAlert } from '../../components/PremiumAlert';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useScopeLabels, useTeamsStore, useTournamentMatches, useTournamentsStore } from '../../store';
import { applyWhatIf, HypotheticalResult } from '../../utils/whatIf';
import { updateTournament } from '../../firebase';
import { buildPointsTable } from '../../utils/scoring';

export default function WhatIfScreen({ navigation }: any) {
  const teams = useTeamsStore(s => s.teams);
  const matches = useTournamentMatches();
  const tournament = useTournamentsStore(s => s.tournament);
  const { subtitle } = useScopeLabels();
  const remaining = matches.filter(m => m.status === 'UPCOMING');
  const [picks, setPicks] = useState<Record<string, HypotheticalResult['winnerId']>>({});
  const [overrides, setOverrides] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(tournament?.pointsOverrides || {}).map(([k, v]) => [k, String(v)])),
  );

  const table = useMemo(() => {
    const hypothetical = Object.entries(picks).map(([matchId, winnerId]) => ({ matchId, winnerId }));
    return applyWhatIf(teams, matches, hypothetical);
  }, [teams, matches, picks]);

  const liveTable = useMemo(
    () => buildPointsTable(teams, matches, { pointsConfig: tournament?.pointsConfig, overrides: tournament?.pointsOverrides }),
    [teams, matches, tournament],
  );

  function setPick(matchId: string, winnerId: HypotheticalResult['winnerId']) {
    setPicks(prev => ({ ...prev, [matchId]: winnerId }));
  }

  async function saveOverrides() {
    if (!tournament) return;
    const parsed: Record<string, number> = {};
    Object.entries(overrides).forEach(([teamId, raw]) => {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n) && n !== 0) parsed[teamId] = n;
    });
    try {
      await updateTournament(tournament.id, { pointsOverrides: parsed });
      showAlert('Saved', 'Custom points will be added on top of auto standings.');
    } catch {
      showAlert('Save failed', 'Could not update points overrides.');
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} style={{ marginBottom: 4 }} />
        <Text style={styles.title}>Points possibilities</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </LinearGradient>
      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 80 }}>
        <Text style={styles.section}>Current table</Text>
        {liveTable.map((e, i) => (
          <Text key={e.teamId} style={styles.line}>{i + 1}. {e.shortName} · {e.points} pts · NRR {e.nrr.toFixed(2)}</Text>
        ))}

        <Text style={styles.section}>What if remaining matches…</Text>
        {remaining.length === 0 && <Text style={styles.muted}>No upcoming fixtures to simulate.</Text>}
        {remaining.map(match => (
          <LinearGradient key={match.id} colors={Colors.gradCard} style={styles.card}>
            <Text style={styles.match}>{match.teamAName} vs {match.teamBName}</Text>
            <View style={styles.row}>
              {[
                { id: match.teamA, label: match.teamAName },
                { id: match.teamB, label: match.teamBName },
                { id: 'tie' as const, label: 'Tie' },
                { id: 'nr' as const, label: 'NR' },
              ].map(opt => (
                <TouchableOpacity key={String(opt.id)} onPress={() => setPick(match.id, opt.id)} style={[styles.chip, picks[match.id] === opt.id && styles.chipOn]}>
                  <Text style={[styles.chipText, picks[match.id] === opt.id && styles.chipTextOn]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </LinearGradient>
        ))}

        <Text style={styles.section}>Projected table</Text>
        {table.map((e, i) => (
          <Text key={e.teamId} style={styles.line}>{i + 1}. {e.shortName} · {e.points} pts · NRR {e.nrr.toFixed(2)}</Text>
        ))}

        <Text style={styles.section}>Edit points (bonus / penalty)</Text>
        {teams.map(team => (
          <View key={team.id} style={styles.overrideRow}>
            <Text style={styles.overrideName}>{team.shortName}</Text>
            <TextInput
              style={styles.overrideInput}
              keyboardType="numbers-and-punctuation"
              placeholder="+0"
              placeholderTextColor={Colors.textMuted}
              value={overrides[team.id] || ''}
              onChangeText={v => setOverrides(prev => ({ ...prev, [team.id]: v }))}
            />
          </View>
        ))}
        <TouchableOpacity onPress={saveOverrides} style={styles.save}>
          <Text style={styles.saveText}>Save point adjustments</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { paddingTop: 50, padding: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { color: Colors.onPrimary, fontSize: Typography.xl, fontWeight: '800' },
  sub: { color: Colors.onPrimary, opacity: 0.9, marginTop: 2 },
  section: { color: Colors.textPrimary, fontWeight: '800', marginTop: Spacing.lg, marginBottom: Spacing.sm },
  line: { color: Colors.textSecondary, marginBottom: 4 },
  muted: { color: Colors.textSecondary },
  card: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm },
  match: { color: Colors.textPrimary, fontWeight: '700', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: Radius.full, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border },
  chipOn: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  chipText: { color: Colors.textSecondary, fontSize: Typography.xs, fontWeight: '700' },
  chipTextOn: { color: Colors.primary },
  overrideRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  overrideName: { width: 64, color: Colors.textPrimary, fontWeight: '700' },
  overrideInput: { flex: 1, backgroundColor: Colors.bgElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, color: Colors.textPrimary, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  save: { marginTop: Spacing.md, backgroundColor: Colors.primary + '22', borderRadius: Radius.md, padding: Spacing.md, alignItems: 'center' },
  saveText: { color: Colors.primary, fontWeight: '800' },
});
