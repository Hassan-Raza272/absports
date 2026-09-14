import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../theme';
import {
  OverlayGraphicsMode,
  overlayModesForInnings,
  useOverlayModeStore,
} from '../store/overlayMode';

type Props = {
  /** Compact chips for the live-scoring header strip. */
  compact?: boolean;
  /** Dark control-room styling for the Go Live landscape panel. */
  dark?: boolean;
  /** Current innings — 1st Inn option only shows in the 2nd innings. */
  inningsNumber?: 1 | 2;
};

export default function OverlayModeSwitcher({ compact, dark, inningsNumber = 1 }: Props) {
  const mode = useOverlayModeStore(s => s.mode);
  const setMode = useOverlayModeStore(s => s.setMode);
  const options = overlayModesForInnings(inningsNumber);

  React.useEffect(() => {
    if (inningsNumber === 1 && (mode === 'innings1')) {
      setMode('scorebar');
    }
  }, [inningsNumber, mode, setMode]);

  return (
    <View style={[styles.row, compact && styles.rowCompact, dark && styles.rowDark]}>
      {!compact && (
        <Text style={[styles.label, dark && styles.labelDark]}>GRAPHICS</Text>
      )}
      <View style={[styles.chips, compact && styles.chipsCompact, dark && styles.chipsDark]}>
        {options.map(opt => {
          const active = mode === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => setMode(opt.id as OverlayGraphicsMode)}
              style={[
                styles.chip,
                dark && styles.chipDark,
                active && (dark ? styles.chipOnDark : styles.chipOn),
                compact && styles.chipCompact,
              ]}
              activeOpacity={0.85}>
              <Text
                style={[
                  styles.chipText,
                  dark && styles.chipTextDark,
                  active && (dark ? styles.chipTextOnDark : styles.chipTextOn),
                  compact && styles.chipTextCompact,
                ]}>
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
  row: {
    gap: 8,
    marginBottom: Spacing.sm,
  },
  rowCompact: {
    marginBottom: 0,
  },
  rowDark: {
    marginBottom: 4,
  },
  label: {
    color: Colors.primary,
    fontWeight: '800',
    fontSize: Typography.xs,
    letterSpacing: 1,
  },
  labelDark: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipsCompact: {
    gap: 4,
  },
  chipsDark: {
    flexWrap: 'nowrap',
    gap: 3,
  },
  chip: {
    flexGrow: 1,
    flexBasis: '18%',
    minWidth: 64,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
  },
  chipDark: {
    flexGrow: 0,
    flexBasis: undefined,
    minWidth: 0,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: Radius.sm,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipCompact: {
    flexGrow: 0,
    flexBasis: undefined,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '18',
  },
  chipOnDark: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '33',
  },
  chipText: {
    color: Colors.textSecondary,
    fontWeight: '800',
    fontSize: Typography.sm,
  },
  chipTextDark: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    fontSize: 10,
  },
  chipTextCompact: {
    fontSize: 11,
  },
  chipTextOn: {
    color: Colors.primary,
  },
  chipTextOnDark: {
    color: '#fff',
  },
});
