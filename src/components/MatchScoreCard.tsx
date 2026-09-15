import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors, Radius, Shadow, Spacing, Typography } from '../theme';
import { Match } from '../types';
import {
  currentRunRate,
  formatMatchWhen,
  formatOvers,
  formatScore,
  inningsForTeam,
  isFriendly,
  liveStatusLine,
  matchKindLabel,
} from '../utils/matchDisplay';
import { matchShareMessage, shareText } from '../utils/share';
import { EaseEnter, EasePress } from '../motion';
import TeamLogoAvatar from './TeamLogoAvatar';
import { useHubStore, useTeamsStore } from '../store';

type Props = {
  match: Match;
  clubName?: string;
  compact?: boolean;
  /** Fixed layout so horizontal rails share one card height. */
  uniform?: boolean;
  index?: number;
  style?: ViewStyle;
  onPress: () => void;
  /** When set, shows a Delete action next to Share (e.g. My Matches). */
  onDelete?: () => void;
};

const STATUS: Record<string, { label: string; color: string }> = {
  LIVE: { label: 'LIVE', color: Colors.live },
  UPCOMING: { label: 'UP NEXT', color: Colors.accent },
  COMPLETED: { label: 'RESULT', color: Colors.primary },
  ABANDONED: { label: 'ABANDONED', color: Colors.textMuted },
};

function shortLabel(name?: string) {
  const clean = (name || '').trim();
  if (!clean) return 'XI';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return clean.slice(0, 10);
  return parts.map(p => p[0]).join('').slice(0, 4).toUpperCase() || clean.slice(0, 8);
}

export default function MatchScoreCard({
  match,
  clubName,
  compact,
  uniform,
  index = 0,
  style,
  onPress,
  onDelete,
}: Props) {
  const localTeams = useTeamsStore(s => s.teams);
  const hubTeams = useHubStore(s => s.teams);

  const logos = useMemo(() => {
    const all = [...localTeams, ...hubTeams];
    const find = (id?: string, name?: string) =>
      all.find(t => t.id === id) ||
      all.find(t => t.name === name) ||
      all.find(t => t.shortName && name && t.shortName.toLowerCase() === name.toLowerCase());
    const teamA = find(match.teamA, match.teamAName);
    const teamB = find(match.teamB, match.teamBName);
    return {
      a: match.teamALogo || teamA?.logoURL,
      b: match.teamBLogo || teamB?.logoURL,
      aShort: teamA?.shortName || shortLabel(match.teamAName),
      bShort: teamB?.shortName || shortLabel(match.teamBName),
    };
  }, [localTeams, hubTeams, match.teamA, match.teamB, match.teamAName, match.teamBName, match.teamALogo, match.teamBLogo]);

  const status = STATUS[match.status] || STATUS.UPCOMING;
  const teamA = inningsForTeam(match, match.teamA);
  const teamB = inningsForTeam(match, match.teamB);
  const liveInn = match.currentInnings === 2 ? match.innings?.second : match.innings?.first;
  const crr = match.status === 'LIVE' ? currentRunRate(liveInn) : null;
  const logoSize = uniform ? 44 : compact ? 40 : 48;
  const isLive = match.status === 'LIVE';

  return (
    <EaseEnter index={index} style={uniform ? styles.uniformWrap : undefined}>
      <EasePress onPress={onPress} style={uniform ? styles.uniformPress : undefined}>
        <LinearGradient
          colors={isLive ? Colors.gradLiveCard : Colors.gradCard}
          style={[
            styles.card,
            isLive ? styles.liveCard : styles.idleCard,
            compact && styles.compact,
            uniform && styles.uniformCard,
            style,
          ]}>
          <View style={styles.top}>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: status.color + '18', borderColor: status.color + '55' }]}>
                {isLive && <View style={styles.liveDot} />}
                <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
              </View>
              <View style={[styles.badge, styles.kindBadge]}>
                <Text style={styles.kind}>{isFriendly(match) ? 'FRIENDLY' : matchKindLabel(match)}</Text>
              </View>
            </View>
            <View style={styles.topActions}>
              {!!onDelete && (
                <TouchableOpacity
                  style={styles.iconBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={onDelete}>
                  <Icon name="trash-outline" size={16} color={Colors.loss} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.iconBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={e => {
                  e?.stopPropagation?.();
                  shareText(`${match.teamAName} vs ${match.teamBName}`, matchShareMessage(match, clubName));
                }}>
                <Icon name="share-outline" size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.teams, uniform && styles.teamsUniform]}>
            <View style={[styles.side, uniform && styles.sideUniform]}>
              <TeamLogoAvatar
                name={match.teamAName}
                shortName={logos.aShort}
                logoURL={logos.a}
                size={logoSize}
              />
              <Text style={[styles.team, uniform && styles.teamUniform]} numberOfLines={2}>
                {match.teamAName}
              </Text>
              {teamA ? (
                <>
                  <Text style={[styles.score, uniform && styles.scoreUniform]}>{formatScore(teamA)}</Text>
                  <Text style={[styles.overs, uniform && styles.centerText]}>{formatOvers(teamA)}</Text>
                </>
              ) : (
                <Text style={[styles.pending, uniform && styles.pendingUniform]}>
                  {match.status === 'UPCOMING' ? 'Yet to play' : 'Yet to bat'}
                </Text>
              )}
            </View>

            <View style={[styles.mid, uniform && styles.midUniform]}>
              <View style={[styles.vsRing, isLive && styles.vsRingLive]}>
                <Text style={[styles.vs, isLive && styles.vsLive]}>VS</Text>
              </View>
              {(uniform || crr) && (
                <Text style={[styles.crr, !crr && styles.crrHidden]} numberOfLines={1}>
                  {crr ? `CRR ${crr}` : ' '}
                </Text>
              )}
            </View>

            <View style={[styles.side, styles.sideRight, uniform && styles.sideUniform]}>
              <TeamLogoAvatar
                name={match.teamBName}
                shortName={logos.bShort}
                logoURL={logos.b}
                size={logoSize}
              />
              <Text style={[styles.team, styles.teamRight, uniform && styles.teamUniform]} numberOfLines={2}>
                {match.teamBName}
              </Text>
              {teamB ? (
                <>
                  <Text style={[styles.score, styles.scoreRight, uniform && styles.scoreUniform]}>{formatScore(teamB)}</Text>
                  <Text style={[styles.overs, styles.oversRight, uniform && styles.centerText]}>{formatOvers(teamB)}</Text>
                </>
              ) : (
                <Text style={[styles.pending, styles.pendingRight, uniform && styles.pendingUniform]}>
                  {match.status === 'UPCOMING' ? 'Yet to play' : 'Yet to bat'}
                </Text>
              )}
            </View>
          </View>

          <Text style={styles.line} numberOfLines={uniform ? 1 : 2}>{liveStatusLine(match)}</Text>
          {(uniform || (match.status === 'COMPLETED' && !!match.playerOfMatch)) && (
            <Text style={[styles.pom, !match.playerOfMatch && styles.pomHidden]} numberOfLines={1}>
              {match.status === 'COMPLETED' && match.playerOfMatch
                ? `Player of the Match · ${match.playerOfMatch}`
                : ' '}
            </Text>
          )}
          <View style={styles.foot}>
            <View style={styles.footItem}>
              <Icon name="location-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.meta} numberOfLines={1}>{(match.venue || 'TBD').split(',')[0]}</Text>
            </View>
            <View style={[styles.footItem, styles.footRight]}>
              <Icon name="time-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.meta}>{formatMatchWhen(match.dateTime)}</Text>
            </View>
          </View>
        </LinearGradient>
      </EasePress>
    </EaseEnter>
  );
}

const styles = StyleSheet.create({
  uniformWrap: { flex: 1 },
  uniformPress: { flex: 1 },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  idleCard: {
    borderColor: Colors.border,
    ...Shadow.md,
  },
  liveCard: {
    borderColor: Colors.live + '40',
    shadowColor: Colors.live,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 6,
  },
  uniformCard: {
    flexGrow: 1,
    marginBottom: 0,
    padding: Spacing.md,
    justifyContent: 'space-between',
    minHeight: 268,
  },
  compact: { padding: Spacing.md },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1, paddingRight: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  kindBadge: {
    backgroundColor: Colors.bgElevated,
    borderColor: Colors.border,
  },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.live },
  kind: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, letterSpacing: 0.5 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  teamsUniform: {
    alignItems: 'center',
  },
  side: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-start',
    gap: 6,
  },
  sideUniform: {
    alignItems: 'center',
  },
  sideRight: { alignItems: 'flex-end' },
  team: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.sm,
    lineHeight: 16,
    minHeight: 32,
  },
  teamUniform: {
    textAlign: 'center',
    width: '100%',
  },
  teamRight: { textAlign: 'right' },
  score: {
    color: Colors.textPrimary,
    fontWeight: '900',
    fontSize: Typography.xxl,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  scoreRight: { textAlign: 'right' },
  scoreUniform: { fontSize: Typography.xl, textAlign: 'center' },
  overs: { color: Colors.textSecondary, fontSize: Typography.xs, fontWeight: '700' },
  oversRight: { textAlign: 'right' },
  pending: {
    color: Colors.textMuted,
    fontSize: Typography.sm,
    marginTop: 4,
    fontWeight: '700',
  },
  pendingRight: { textAlign: 'right' },
  pendingUniform: { textAlign: 'center' },
  centerText: { textAlign: 'center' },
  mid: {
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    paddingTop: 8,
  },
  midUniform: {
    paddingTop: 0,
    alignSelf: 'center',
  },
  vsRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vsRingLive: {
    backgroundColor: Colors.live + '12',
    borderColor: Colors.live + '44',
  },
  vs: {
    color: Colors.textMuted,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1.2,
  },
  vsLive: { color: Colors.live },
  crr: {
    color: Colors.primary,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    minHeight: 14,
  },
  crrHidden: { color: 'transparent' },
  line: {
    color: Colors.textSecondary,
    fontSize: Typography.xs,
    marginBottom: 2,
    minHeight: 16,
    fontWeight: '600',
  },
  pom: {
    color: Colors.primary,
    fontSize: Typography.xs,
    fontWeight: '800',
    marginBottom: Spacing.xs,
    minHeight: 16,
  },
  pomHidden: { color: 'transparent' },
  foot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: 4,
  },
  footItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  footRight: { flexShrink: 0 },
  meta: { color: Colors.textMuted, fontSize: 11, flexShrink: 1, fontWeight: '600' },
});
