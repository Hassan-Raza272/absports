import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius } from '../theme';
import {
  SCOREBAR_THEME_OPTIONS,
  ScorebarThemeId,
  resolveScorebarTheme,
} from '../theme/scorebarThemes';
import { useOverlayModeStore } from '../store/overlayMode';

type Props = {
  dark?: boolean;
  compact?: boolean;
};

export default function ScorebarThemePicker({ dark, compact }: Props) {
  const theme = useOverlayModeStore(s => s.theme);
  const setTheme = useOverlayModeStore(s => s.setTheme);

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Text style={[styles.label, dark && styles.labelDark]}>SCOREBAR</Text>
      <View style={styles.row}>
        {SCOREBAR_THEME_OPTIONS.map(opt => {
          const active = theme === opt.id;
          const swatch = resolveScorebarTheme(opt.id);
          const colors =
            opt.id === 'chase'
              ? swatch.chase.gradient
              : opt.id === 'angular'
                ? [swatch.angular.orangeSoft, swatch.angular.orange, swatch.angular.orangeDeep]
                : [swatch.classic.segScore, swatch.classic.segBatter, swatch.classic.segBowler];
          return (
            <TouchableOpacity
              key={opt.id}
              activeOpacity={0.85}
              onPress={() => setTheme(opt.id as ScorebarThemeId)}
              style={[
                styles.chip,
                compact && styles.chipCompact,
                dark && styles.chipDark,
                active && (dark ? styles.chipOnDark : styles.chipOn),
              ]}>
              <LinearGradient
                colors={colors}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.swatch, compact && styles.swatchCompact]}
              />
              <Text
                style={[
                  styles.chipTitle,
                  compact && styles.chipTitleCompact,
                  dark && styles.chipTitleDark,
                  active && styles.chipTitleOn,
                ]}
                numberOfLines={1}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  wrapCompact: { marginBottom: 2 },
  label: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 1,
    marginBottom: 3,
  },
  labelDark: { color: 'rgba(255,255,255,0.5)', fontSize: 8 },
  row: { flexDirection: 'row', gap: 4 },
  chip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  chipCompact: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    gap: 3,
  },
  chipDark: {
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '14',
  },
  chipOnDark: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '33',
  },
  swatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  swatchCompact: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  chipTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: 10,
  },
  chipTitleCompact: { fontSize: 9 },
  chipTitleDark: { color: 'rgba(255,255,255,0.85)' },
  chipTitleOn: { color: '#fff' },
});
