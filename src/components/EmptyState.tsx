import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Colors, Radius, Spacing, Typography } from '../theme';
import { EaseEnter, EasePress } from '../motion';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ title, subtitle, actionLabel, onAction }: Props) {
  return (
    <EaseEnter style={styles.wrap} from={{ opacity: 0, scale: 0.96 }} to={{ opacity: 1, scale: 1 }}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <EasePress onPress={onAction} style={styles.btn}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </EasePress>
      )}
    </EaseEnter>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.base,
    textAlign: 'center',
  },
  sub: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  btn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent,
  },
  btnText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.sm },
});
