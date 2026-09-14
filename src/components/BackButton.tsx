import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle, StyleProp, TextStyle } from 'react-native';
import { Colors, Typography } from '../theme';
import PremiumIcon from './PremiumIcon';

type Props = {
  onPress: () => void;
  /** Defaults to "Back". Pass a destination label like "Home" or "Dashboard". */
  label?: string;
  color?: string;
  /** Icon only — for compact headers that already have a title beside the control. */
  iconOnly?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  hitSlop?: number;
};

/** Shared navigation back control: chevron + label (or icon-only). */
export default function BackButton({
  onPress,
  label = 'Back',
  color = Colors.onPrimary,
  iconOnly = false,
  size = 22,
  style,
  textStyle,
  hitSlop = 12,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={hitSlop}
      style={[styles.row, style]}
      accessibilityRole="button"
      accessibilityLabel={label || 'Back'}>
      <PremiumIcon name="back" size={size} color={color} />
      {!iconOnly && !!label && <Text style={[styles.label, { color }, textStyle]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontSize: Typography.sm,
    fontWeight: '700',
  },
});
