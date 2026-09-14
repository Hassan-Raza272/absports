import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Shadow, Spacing, Typography } from '../theme';
import { PointsTableEntry } from '../types';
import TeamLogoAvatar from './TeamLogoAvatar';

const FORM_COLOR: Record<string, string> = {
  W: Colors.win,
  L: Colors.loss,
  NR: Colors.nr,
};

const RANK_TONES = [
  { bg: ['#F5D76E', '#D4A017'], text: '#3B2F0B' },
  { bg: ['#E8ECF0', '#B8C0CC'], text: '#2C3340' },
  { bg: ['#E8B48A', '#B87333'], text: '#3B2410' },
] as const;

type Props = {
  entries: PointsTableEntry[];
  title?: string;
  subtitle?: string;
  emptyText?: string;
  onShare?: () => void;
  onPressTeam?: (teamId: string) => void;
  /** Highlight first N rows as qualification zone. */
  qualifyCount?: number;
};

export default function PremiumPointsTable({
  entries,
  title = 'Standings',
  subtitle,
  emptyText = 'Enroll teams to see standings.',
  onShare,
  onPressTeam,
  qualifyCount = 3,
}: Props) {
  return (
    <View style={styles.shell}>
      <LinearGradient colors={[Colors.primaryDark, Colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>POINTS TABLE</Text>
          <Text style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        {onShare && (
          <TouchableOpacity onPress={onShare} style={styles.shareBtn} activeOpacity={0.85}>
            <Text style={styles.shareText}>Share</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {entries.length === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        <>
          <View style={styles.colHead}>
            <Text style={[styles.colLabel, styles.colPos]}>#</Text>
            <Text style={[styles.colLabel, styles.colTeam]}>Team</Text>
            <Text style={[styles.colLabel, styles.colStat]}>P</Text>
            <Text style={[styles.colLabel, styles.colStat]}>W</Text>
            <Text style={[styles.colLabel, styles.colStat]}>L</Text>
            <Text style={[styles.colLabel, styles.colStat]}>NR</Text>
            <Text style={[styles.colLabel, styles.colPts]}>Pts</Text>
            <Text style={[styles.colLabel, styles.colNrr]}>NRR</Text>
          </View>

          {entries.map((entry, index) => {
            const qualify = index < qualifyCount;
            const tone = RANK_TONES[index];
            const RowWrap: any = onPressTeam ? TouchableOpacity : View;
            const rowProps = onPressTeam
              ? { activeOpacity: 0.88, onPress: () => onPressTeam(entry.teamId) }
              : {};
            return (
              <RowWrap key={entry.teamId} {...rowProps}>
                <View
                  style={[
                    styles.row,
                    index % 2 === 1 && styles.rowAlt,
                    qualify && styles.rowQualify,
                    index === entries.length - 1 && styles.rowLast,
                  ]}>
                  {tone ? (
                    <LinearGradient colors={[...tone.bg]} style={styles.rankBadge}>
                      <Text style={[styles.rankBadgeText, { color: tone.text }]}>{index + 1}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.rankPlain}>
                      <Text style={styles.rankPlainText}>{index + 1}</Text>
                    </View>
                  )}

                  <View style={styles.teamCell}>
                    <TeamLogoAvatar
                      name={entry.teamName}
                      shortName={entry.shortName}
                      logoURL={entry.teamLogo}
                      size={34}
                    />
                    <View style={styles.teamText}>
                      <Text style={styles.teamName} numberOfLines={1}>
                        {entry.teamName || entry.shortName}
                      </Text>
                      <View style={styles.formRow}>
                        <Text style={styles.short}>{entry.shortName}</Text>
                        {(entry.lastFive || []).slice(-5).map((r, i) => (
                          <View
                            key={`${entry.teamId}-f-${i}`}
                            style={[styles.formDot, { backgroundColor: FORM_COLOR[r] || Colors.textMuted }]}>
                            <Text style={styles.formDotText}>{r === 'NR' ? 'N' : r}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>

                  <Text style={[styles.stat, styles.colStat]}>{entry.played}</Text>
                  <Text style={[styles.stat, styles.colStat, { color: Colors.win }]}>{entry.won}</Text>
                  <Text style={[styles.stat, styles.colStat, { color: Colors.loss }]}>{entry.lost}</Text>
                  <Text style={[styles.stat, styles.colStat]}>{entry.nr}</Text>
                  <Text style={[styles.pts, styles.colPts]}>{entry.points}</Text>
                  <Text
                    style={[
                      styles.nrr,
                      styles.colNrr,
                      { color: entry.nrr >= 0 ? Colors.win : Colors.loss },
                    ]}>
                    {entry.nrr >= 0 ? '+' : ''}
                    {entry.nrr.toFixed(2)}
                  </Text>
                </View>
              </RowWrap>
            );
          })}

          <View style={styles.footer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBar, { backgroundColor: Colors.primary }]} />
              <Text style={styles.footerText}>Top {Math.min(qualifyCount, entries.length)} qualification zone</Text>
            </View>
            <Text style={styles.footerMuted}>Friendlies never count · Sorted by Pts, then NRR</Text>
          </View>
        </>
      )}
    </View>
  );
}

const COL_STAT = 26;
const COL_PTS = 34;
const COL_NRR = 48;

const styles = StyleSheet.create({
  shell: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.base,
    ...Shadow.md,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  kicker: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  title: {
    color: Colors.onPrimary,
    fontWeight: '900',
    fontSize: Typography.lg,
    marginTop: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: Typography.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  shareBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  shareText: {
    color: Colors.onPrimary,
    fontWeight: '800',
    fontSize: Typography.xs,
  },
  empty: {
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.base,
  },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    backgroundColor: Colors.bgElevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  colLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  colPos: { width: 28, textAlign: 'center' },
  colTeam: { flex: 1, paddingLeft: 4 },
  colStat: { width: COL_STAT, textAlign: 'center' },
  colPts: { width: COL_PTS, textAlign: 'center' },
  colNrr: { width: COL_NRR, textAlign: 'right', paddingRight: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowAlt: { backgroundColor: Colors.bgElevated + '88' },
  rowQualify: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  rowLast: { borderBottomWidth: 0 },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  rankBadgeText: { fontWeight: '900', fontSize: 11 },
  rankPlain: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    backgroundColor: Colors.bgElevated,
  },
  rankPlainText: { color: Colors.textMuted, fontWeight: '800', fontSize: 11 },
  teamCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    paddingRight: 4,
  },
  teamText: { flex: 1, minWidth: 0 },
  teamName: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.sm,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  short: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    marginRight: 2,
    textTransform: 'uppercase',
  },
  formDot: {
    width: 12,
    height: 12,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formDotText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '900',
  },
  stat: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: Typography.xs,
  },
  pts: {
    color: Colors.primary,
    fontWeight: '900',
    fontSize: Typography.sm,
  },
  nrr: {
    fontWeight: '800',
    fontSize: 10,
  },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendBar: { width: 3, height: 12, borderRadius: 2 },
  footerText: { color: Colors.textSecondary, fontSize: 11, fontWeight: '700' },
  footerMuted: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
});
