import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../theme';

type Chip<T extends string> = { key: T; label: string; accent?: string };

type Props<T extends string> = {
  value: T;
  options: Chip<T>[];
  onChange: (value: T) => void;
};

export default function FilterChips<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}>
      {options.map(option => {
        const active = value === option.key;
        const color = option.accent || Colors.primary;
        return (
          <TouchableOpacity
            key={option.key}
            activeOpacity={0.85}
            onPress={() => onChange(option.key)}
            style={[
              styles.chip,
              active && { backgroundColor: color + '22', borderColor: color },
            ]}>
            {option.accent ? (
              <View style={[styles.dot, { backgroundColor: active ? color : Colors.textMuted }]} />
            ) : null}
            <Text style={[styles.label, active && { color }]} numberOfLines={1}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 0,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    flexGrow: 0,
    flexShrink: 0,
  },
  dot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  label: {
    fontSize: Typography.sm,
    lineHeight: Typography.sm + 4,
    fontWeight: '800',
    color: Colors.textSecondary,
    flexShrink: 0,
  },
});
