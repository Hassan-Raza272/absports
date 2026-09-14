import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';
import { MatchSettings } from '../types';
import { DEFAULT_MATCH_SETTINGS } from '../utils/matchSettings';

type Props = {
  value: MatchSettings;
  onChange: (next: MatchSettings) => void;
};

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.toggle, on && styles.toggleOn]}>
      <Text style={[styles.toggleText, on && styles.toggleTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function MatchSettingsForm({ value, onChange }: Props) {
  const v = { ...DEFAULT_MATCH_SETTINGS, ...value };
  const set = (patch: Partial<MatchSettings>) => onChange({ ...v, ...patch });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Match settings</Text>
      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.label}>Balls / over</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={String(v.ballsPerOver)}
            onChangeText={t => set({ ballsPerOver: Math.max(1, Math.min(8, parseInt(t, 10) || 6)) })}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Total wickets</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={String(v.totalWickets)}
            onChangeText={t => set({ totalWickets: Math.max(1, Math.min(11, parseInt(t, 10) || 10)) })}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Max balls / over</Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="—"
            placeholderTextColor={Colors.textMuted}
            value={v.maxBallsPerOverIncludingExtras ? String(v.maxBallsPerOverIncludingExtras) : ''}
            onChangeText={t => set({ maxBallsPerOverIncludingExtras: t ? Math.max(6, Math.min(8, parseInt(t, 10) || 8)) : undefined })}
          />
        </View>
      </View>
      <View style={styles.chips}>
        <Toggle label="Last man stands" on={v.lastManStands} onPress={() => set({ lastManStands: !v.lastManStands })} />
        <Toggle label="Wide extras" on={v.countWideExtras} onPress={() => set({ countWideExtras: !v.countWideExtras })} />
        <Toggle label="No-ball extras" on={v.countNoBallExtras} onPress={() => set({ countNoBallExtras: !v.countNoBallExtras })} />
        <Toggle label="Wide runs to bat" on={v.addWideRunsToBatsman} onPress={() => set({ addWideRunsToBatsman: !v.addWideRunsToBatsman })} />
        <Toggle label="Wide balls to bat" on={v.addWideBallsToBatsman} onPress={() => set({ addWideBallsToBatsman: !v.addWideBallsToBatsman })} />
        <Toggle label="NB extras to bat" on={v.addNoBallExtrasToBatsman} onPress={() => set({ addNoBallExtrasToBatsman: !v.addNoBallExtrasToBatsman })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginTop: Spacing.sm },
  title: { color: Colors.textPrimary, fontWeight: '800', fontSize: Typography.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  field: { flex: 1 },
  label: { color: Colors.textSecondary, fontSize: 10, marginBottom: 4 },
  input: {
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  toggleOn: { borderColor: Colors.primary + '66', backgroundColor: Colors.primary + '22' },
  toggleText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '700' },
  toggleTextOn: { color: Colors.primary },
});
