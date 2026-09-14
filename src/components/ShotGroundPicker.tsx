import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';

export const SHOT_ZONES = [
  { id: 'fine-leg', label: 'Fine\nLeg', short: 'Fine Leg' },
  { id: 'square-leg', label: 'Square\nLeg', short: 'Square Leg' },
  { id: 'mid-wicket', label: 'Mid\nWicket', short: 'Mid Wicket' },
  { id: 'long-on', label: 'Long\nOn', short: 'Long On' },
  { id: 'long-off', label: 'Long\nOff', short: 'Long Off' },
  { id: 'cover', label: 'Cover', short: 'Cover' },
  { id: 'point', label: 'Point', short: 'Point' },
  { id: 'third-man', label: 'Third\nMan', short: 'Third Man' },
] as const;

export type ShotZoneId = (typeof SHOT_ZONES)[number]['id'];

type Props = {
  runs: number;
  strikerName: string;
  onSelect: (zoneId: ShotZoneId, zoneLabel: string) => void;
  onSkip: () => void;
  onCancel: () => void;
};

/** Wagon-wheel style ground: tap the side where the shot went. */
export default function ShotGroundPicker({ runs, strikerName, onSelect, onSkip, onCancel }: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const [availWidth, setAvailWidth] = useState(0);
  // Fit inside the modal card (backdrop + card padding), never wider than parent.
  const size = Math.min(
    availWidth > 0 ? availWidth : Math.max(windowWidth - 72, 220),
    300,
  );
  const radius = size / 2;
  const zoneSize = size * 0.24;
  // Keep zone circles fully inside the ground so left/right aren't clipped.
  const dist = radius * 0.56;

  return (
    <View
      style={styles.wrap}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - availWidth) > 1) setAvailWidth(w);
      }}>
      <Text style={styles.title}>Where did the shot go?</Text>
      <Text style={styles.sub}>
        {strikerName || 'Batter'} · {runs} run{runs === 1 ? '' : 's'} — tap the ground area
      </Text>

      <View style={[styles.ground, { width: size, height: size, borderRadius: radius }]}>
        <View style={[styles.pitch, { width: size * 0.12, height: size * 0.38 }]} />
        <View style={styles.creaseRow}>
          <Text style={styles.creaseLabel}>Bowling</Text>
        </View>
        <Text style={styles.centerLabel}>🏏</Text>

        {SHOT_ZONES.map((zone, index) => {
          const angle = (index * 45 - 90) * (Math.PI / 180);
          const x = radius + Math.cos(angle) * dist - zoneSize / 2;
          const y = radius + Math.sin(angle) * dist - zoneSize / 2;
          return (
            <TouchableOpacity
              key={zone.id}
              activeOpacity={0.75}
              onPress={() => onSelect(zone.id, zone.short)}
              style={[
                styles.zone,
                {
                  width: zoneSize,
                  height: zoneSize,
                  borderRadius: zoneSize / 2,
                  left: x,
                  top: y,
                },
              ]}>
              <Text style={styles.zoneText} numberOfLines={2}>{zone.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip location</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'stretch', width: '100%' },
  title: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: Spacing.md, textAlign: 'center', paddingHorizontal: Spacing.xs },
  ground: {
    backgroundColor: '#1B5E20',
    borderWidth: 3,
    borderColor: '#A5D6A7',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    alignSelf: 'center',
  },
  pitch: {
    position: 'absolute',
    backgroundColor: '#C4A35A',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#8D6E63',
    zIndex: 1,
  },
  creaseRow: { position: 'absolute', top: '18%', zIndex: 1 },
  creaseLabel: { fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: '700' },
  centerLabel: { fontSize: 22, zIndex: 1 },
  zone: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  zoneText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 11,
  },
  actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs, flexWrap: 'wrap', justifyContent: 'center' },
  skipBtn: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary + '22',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
  },
  skipText: { color: Colors.primary, fontWeight: '700', fontSize: Typography.sm },
  cancelBtn: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm },
  cancelText: { color: Colors.textMuted, fontWeight: '600', fontSize: Typography.sm },
});
