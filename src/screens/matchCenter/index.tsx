import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../theme';
import {
  useAuthStore,
  useClubsStore,
  useHubStore,
  useMatchById,
  useMatchesStore,
  usePublicFeedStore,
  useTeamsStore,
} from '../../store';
import BackButton from '../../components/BackButton';
import PremiumIcon from '../../components/PremiumIcon';
import TeamLogoAvatar from '../../components/TeamLogoAvatar';
import { matchShareMessage, shareText } from '../../utils/share';
import {
  buildOverBuckets,
  buildPartnershipsAndFow,
  buildWagonShots,
  cumulativeRuns,
} from '../../utils/matchAnalytics';
import { buildSuperStars } from '../../utils/mvp';
import { legalBallsPerOver, resolveMatchSettings } from '../../utils/matchSettings';
import {
  buildCommentaryFromBallLog,
  buildMatchVoiceSummary,
  CommentaryBall,
  parseBallLabel,
} from '../../utils/commentary';
import { speakText, stopSpeaking } from '../../utils/voice';
import { formatTargetLabel, getChaseTarget, getEffectiveOvers } from '../../utils/dls';
import { canUserGoLiveOnMatch, isUsersOwnMatch } from '../../utils/account';
import { SkeletonMatchCenter } from '../../components/Skeleton';
import PremiumGoLiveModal from '../../components/PremiumGoLiveModal';
import ScreenScaffold from '../../components/ScreenScaffold';
import { listenMatch } from '../../firebase';
import { Match } from '../../types';

type Tab = 'Summary' | 'Scorecard' | 'Commentary' | 'Insights' | 'Info';

function shortLabel(name?: string) {
  if (!name) return 'TM';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

function BallPill({ ball }: { ball: Pick<CommentaryBall, 'runs' | 'wicket' | 'label' | 'extra'> }) {
  const parsed = parseBallLabel(ball.label || String(ball.runs));
  const lower = parsed.base.toLowerCase();
  const label = ball.wicket
    ? 'W'
    : lower.startsWith('wd')
      ? 'wd'
      : lower.startsWith('nb')
        ? 'nb'
        : lower.startsWith('lb')
          ? 'lb'
          : /^b\d*$/i.test(parsed.base)
            ? 'b'
            : String(ball.runs);

  const isBoundary4 = !ball.wicket && !ball.extra && ball.runs === 4;
  const isBoundary6 = !ball.wicket && !ball.extra && ball.runs === 6;
  const isWicket = Boolean(ball.wicket);
  const isExtra = Boolean(ball.extra);
  const isDot = !ball.wicket && !ball.extra && ball.runs === 0;

  let pillBg = 'rgba(255,255,255,0.12)';
  let pillBorder = 'rgba(255,255,255,0.22)';
  let pillTextColor = '#F8FAFC';

  if (isWicket) {
    pillBg = '#EF4444';
    pillBorder = '#DC2626';
    pillTextColor = '#FFFFFF';
  } else if (isBoundary6) {
    pillBg = '#10B981';
    pillBorder = '#059669';
    pillTextColor = '#FFFFFF';
  } else if (isBoundary4) {
    pillBg = '#3B82F6';
    pillBorder = '#2563EB';
    pillTextColor = '#FFFFFF';
  } else if (isExtra) {
    pillBg = '#F59E0B';
    pillBorder = '#D97706';
    pillTextColor = '#FFFFFF';
  } else if (isDot) {
    pillBg = 'rgba(255,255,255,0.08)';
    pillBorder = 'rgba(255,255,255,0.15)';
    pillTextColor = '#94A3B8';
  }

  return (
    <View style={[styles.ballPill, { backgroundColor: pillBg, borderColor: pillBorder }]}>
      <Text style={[styles.ballPillText, { color: pillTextColor }]}>
        {isDot ? '•' : label}
      </Text>
    </View>
  );
}

export default function MatchCenterScreen({ route, navigation }: any) {
  const { matchId } = route.params;
  const seedMatch = route.params?.match as Match | undefined;
  const storeMatch = useMatchById(matchId);
  const [remoteMatch, setRemoteMatch] = useState<Match | null>(null);
  const [remoteChecked, setRemoteChecked] = useState(false);
  const match = storeMatch || remoteMatch || seedMatch;
  const feedReady = usePublicFeedStore(state => state.ready);
  const matchesReady = useMatchesStore(state => state.ready);
  const hubReady = useHubStore(state => state.ready);
  const user = useAuthStore(state => state.user);
  const clubs = useClubsStore(state => state.clubs);
  const localTeams = useTeamsStore(state => state.teams);
  const hubTeams = useHubStore(state => state.teams);
  const clubName = clubs.find(c => c.id === match?.clubId)?.name;
  const [tab, setTab] = useState<Tab>(match?.status === 'COMPLETED' ? 'Summary' : 'Scorecard');
  const [voiceOn, setVoiceOn] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const lastSpokenLen = useRef(0);

  useEffect(() => {
    if (!matchId) {
      setRemoteChecked(true);
      return;
    }
    setRemoteChecked(false);
    const unsub = listenMatch(matchId, next => {
      setRemoteMatch(next);
      setRemoteChecked(true);
    });
    return unsub;
  }, [matchId]);

  useEffect(() => {
    if (match?.status === 'LIVE') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [match?.status, pulse]);

  const [showGoLivePremiumModal, setShowGoLivePremiumModal] = useState(false);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const logos = useMemo(() => {
    if (!match) return { a: undefined, b: undefined, aShort: '', bShort: '' };
    const all = [...(localTeams || []), ...(hubTeams || [])];
    const find = (id?: string, name?: string) =>
      all.find(t => t.id === id) ||
      all.find(t => t.name === name) ||
      all.find(t => t.shortName && name && t.shortName.toLowerCase() === name.toLowerCase()) ||
      all.find(t => name && t.name && t.name.toLowerCase() === name.toLowerCase());
    const teamA = find(match.teamA, match.teamAName);
    const teamB = find(match.teamB, match.teamBName);
    return {
      a: match.teamALogo || teamA?.logoURL,
      b: match.teamBLogo || teamB?.logoURL,
      aShort: teamA?.shortName || shortLabel(match.teamAName),
      bShort: teamB?.shortName || shortLabel(match.teamBName),
    };
  }, [localTeams, hubTeams, match]);

  const inn1 = match?.innings?.first;
  const inn2 = match?.innings?.second;
  const session = match?.liveScoring;
  const commentary = useMemo(
    () => buildCommentaryFromBallLog(session?.ballLog || []),
    [session?.ballLog],
  );
  const settings = resolveMatchSettings(match);
  const overBuckets = useMemo(
    () => buildOverBuckets(session?.ballLog || [], legalBallsPerOver(settings)),
    [session?.ballLog, settings],
  );
  const wagon = useMemo(() => buildWagonShots(session?.ballLog || []), [session?.ballLog]);
  const stars = useMemo(() => (match ? buildSuperStars(match) : []), [match]);
  const inn1Analytics = useMemo(
    () => (match ? buildPartnershipsAndFow(match, 1) : { partnerships: [], fow: [] }),
    [match],
  );
  const inn2Analytics = useMemo(
    () => (match ? buildPartnershipsAndFow(match, 2) : { partnerships: [], fow: [] }),
    [match],
  );
  const runCurve = useMemo(() => cumulativeRuns(overBuckets), [overBuckets]);

  useEffect(() => {
    if (!voiceOn || !match) return;
    const logLen = session?.ballLog?.length || 0;
    if (logLen > 0 && logLen !== lastSpokenLen.current) {
      const latest = commentary[commentary.length - 1];
      if (latest && logLen > lastSpokenLen.current) {
        speakText(`${latest.over}.${latest.ball}. ${latest.desc}`);
      }
      lastSpokenLen.current = logLen;
    }
  }, [voiceOn, match, session?.ballLog, commentary]);

  if (!match) {
    if (!remoteChecked || !feedReady || !matchesReady || !hubReady) {
      return (
        <ScreenScaffold title="Match" showScope={false}>
          <SkeletonMatchCenter />
        </ScreenScaffold>
      );
    }
    return (
      <ScreenScaffold title="Match" showScope={false}>
        <Text style={{ color: Colors.textSecondary, padding: Spacing.base }}>Match not found.</Text>
      </ScreenScaffold>
    );
  }

  const isLive = match.status === 'LIVE';
  const firstBattingTeam = inn1?.battingTeam === match.teamB ? 'B' : 'A';
  const firstTeamName = firstBattingTeam === 'A' ? match.teamAName : match.teamBName;
  const secondTeamName = firstBattingTeam === 'A' ? match.teamBName : match.teamAName;
  const firstTeamLogo = firstBattingTeam === 'A' ? logos.a : logos.b;
  const firstTeamShort = firstBattingTeam === 'A' ? logos.aShort : logos.bShort;
  const secondTeamLogo = firstBattingTeam === 'A' ? logos.b : logos.a;
  const secondTeamShort = firstBattingTeam === 'A' ? logos.bShort : logos.aShort;

  const liveInn = match.currentInnings === 2 ? inn2 : inn1;
  const liveBalls = liveInn ? (liveInn.overs || 0) * 6 + (liveInn.balls || 0) : 0;
  const crr = liveBalls > 0 && liveInn ? (liveInn.runs * 6) / liveBalls : 0;
  const target = getChaseTarget(match) ?? (inn1?.runs || 0) + 1;
  const chasing = match.currentInnings === 2 && inn1 && inn2;
  const runsNeeded = chasing ? Math.max(0, target - (inn2?.runs || 0)) : 0;
  const chaseOvers = getEffectiveOvers(match, 2);
  const ballsLeft = chasing ? Math.max(0, chaseOvers * 6 - ((inn2?.overs || 0) * 6 + (inn2?.balls || 0))) : 0;
  const rrr = chasing && ballsLeft > 0 ? (runsNeeded * 6) / ballsLeft : 0;

  function voiceSummaryText() {
    return buildMatchVoiceSummary({
      status: match!.status,
      teamAName: match!.teamAName,
      teamBName: match!.teamBName,
      firstTeamName,
      secondTeamName,
      inn1: inn1 || null,
      inn2: inn2 || null,
      currentInnings: match!.currentInnings,
      result: match!.result,
      oversLimit: match!.overs,
      strikerName: session?.strikerName,
      strikerRuns: session?.strikerRuns,
      nonStrikerName: session?.nonStrikerName,
      nonStrikerRuns: session?.nonStrikerRuns,
      bowlerName: session?.bowlerName,
    });
  }

  async function toggleVoice() {
    if (voiceOn) {
      setVoiceOn(false);
      await stopSpeaking();
      return;
    }
    setVoiceOn(true);
    lastSpokenLen.current = session?.ballLog?.length || 0;
    await speakText(voiceSummaryText());
  }

  async function speakScoreNow() {
    await speakText(voiceSummaryText());
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        contentContainerStyle={{ paddingBottom: 90 }}>

        {/* Top Hero Score Panel with Modern Sports Broadcast Design */}
        <LinearGradient
          colors={['#E03A58', '#C41A3B', '#800F2F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          
          {/* Header Action Bar */}
          <View style={styles.topRow}>
            <View style={styles.backCircle}>
              <BackButton onPress={() => navigation.goBack()} color="#FFFFFF" iconOnly />
            </View>
            <View style={styles.voiceRow}>
              {isLive && isUsersOwnMatch(user, match, clubs) && (
                <TouchableOpacity
                  onPress={() => {
                    if (canUserGoLiveOnMatch(user, match, clubs)) {
                      navigation.navigate('AdminBroadcast', { matchId: match.id });
                    } else {
                      setShowGoLivePremiumModal(true);
                    }
                  }}
                  style={styles.overlayBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <View style={styles.broadcastDot} />
                  <Text style={styles.overlayBtnText}>Go Live</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => shareText(`${match.teamAName} vs ${match.teamBName}`, matchShareMessage(match, clubName))}
                style={styles.actionPill}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <PremiumIcon name="explore" size={13} color="#FFFFFF" />
                <Text style={styles.actionPillText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={toggleVoice}
                style={[styles.voiceToggle, voiceOn && styles.voiceToggleOn]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <PremiumIcon
                  name={voiceOn ? 'volume' : 'volume-mute'}
                  size={13}
                  color={voiceOn ? '#10B981' : '#FFFFFF'}
                />
                <Text style={[styles.voiceToggleText, voiceOn && { color: '#10B981' }]}>
                  {voiceOn ? 'LIVE VOICE' : 'VOICE'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Live / Match Status Badge */}
          <View style={styles.liveMetaRow}>
            {isLive ? (
              <View style={styles.liveBadgeContainer}>
                <Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            ) : (
              <View style={[styles.liveBadgeContainer, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                <Text style={[styles.liveBadgeText, { color: '#E2E8F0' }]}>{match.status}</Text>
              </View>
            )}
            <View style={styles.matchPillBadge}>
              <Text style={styles.matchPillText}>Match {match.matchNumber || '—'}</Text>
            </View>
            {match.overs ? (
              <View style={styles.oversPillBadge}>
                <Text style={styles.oversPillText}>{match.overs} Overs</Text>
              </View>
            ) : null}
            {clubName ? (
              <View style={styles.clubPillBadge}>
                <Text style={styles.clubPillText} numberOfLines={1}>{clubName}</Text>
              </View>
            ) : null}
          </View>

          {/* Teams and Scores Hero Section with Team Logos */}
          <View style={styles.matchHeroCard}>
            {/* Team A (First Batting Team) */}
            <View style={styles.teamHeroCol}>
              <View style={styles.teamLogoWrapper}>
                <TeamLogoAvatar
                  name={firstTeamName}
                  shortName={firstTeamShort}
                  logoURL={firstTeamLogo}
                  size={58}
                />
              </View>
              <Text style={styles.teamNameText} numberOfLines={1}>
                {firstTeamName}
              </Text>
              {inn1 ? (
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreLargeText}>{inn1.runs}/{inn1.wickets}</Text>
                  <Text style={styles.oversSmallText}>{inn1.overs}.{inn1.balls} ov</Text>
                </View>
              ) : (
                <View style={styles.yetToBatPill}>
                  <Text style={styles.yetToBatText}>Yet to bat</Text>
                </View>
              )}
            </View>

            {/* Center VS & Run Rates */}
            <View style={styles.midHeroCol}>
              <LinearGradient colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.06)']} style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </LinearGradient>
              {isLive && liveBalls > 0 ? (
                <View style={styles.crrContainer}>
                  <Text style={styles.crrLabel}>CRR</Text>
                  <Text style={styles.crrNumber}>{crr.toFixed(2)}</Text>
                </View>
              ) : null}
            </View>

            {/* Team B (Second Team) */}
            <View style={styles.teamHeroCol}>
              <View style={styles.teamLogoWrapper}>
                <TeamLogoAvatar
                  name={secondTeamName}
                  shortName={secondTeamShort}
                  logoURL={secondTeamLogo}
                  size={58}
                />
              </View>
              <Text style={styles.teamNameText} numberOfLines={1}>
                {secondTeamName}
              </Text>
              {inn2 ? (
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreLargeText}>{inn2.runs}/{inn2.wickets}</Text>
                  <Text style={styles.oversSmallText}>{inn2.overs}.{inn2.balls} ov</Text>
                </View>
              ) : (
                <View style={styles.yetToBatPill}>
                  <Text style={styles.yetToBatText}>Yet to bat</Text>
                </View>
              )}
            </View>
          </View>

          {/* Chasing / Target Status Bar */}
          {isLive && chasing && (
            <LinearGradient
              colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.06)']}
              style={styles.targetBanner}>
              <Text style={styles.targetBannerText}>
                🎯 Target <Text style={{ fontWeight: '900', color: '#FBBF24' }}>{target}</Text> · Need <Text style={{ fontWeight: '900', color: '#FFFFFF' }}>{runsNeeded}</Text> from <Text style={{ fontWeight: '900', color: '#FFFFFF' }}>{ballsLeft}</Text> b
                {match.dls?.applied ? ' · DLS' : ''}
              </Text>
              <View style={styles.rrrBadge}>
                <Text style={styles.rrrBadgeText}>RRR {rrr.toFixed(2)}</Text>
              </View>
            </LinearGradient>
          )}

          {isLive && match.currentInnings === 2 && inn1 && !inn2 && (
            <View style={styles.targetBanner}>
              <Text style={styles.targetBannerText}>
                {formatTargetLabel(match)}
              </Text>
            </View>
          )}

          {/* Current Players Live Pitch Cards (Striker, Non-Striker, Bowler) */}
          {isLive && session?.setupComplete && (
            <View style={styles.livePlayersGrid}>
              {/* Striker */}
              <View style={[styles.playerCard, styles.strikerCard]}>
                <View style={styles.playerCardHeader}>
                  <View style={styles.strikerDot} />
                  <Text style={styles.playerRoleText}>Striker 🏏</Text>
                </View>
                <Text style={styles.playerNameText} numberOfLines={1}>
                  {session.strikerName}*
                </Text>
                <Text style={styles.playerScoreHighlight}>
                  {session.strikerRuns} <Text style={styles.playerBallsSub}>({session.strikerBalls || 0})</Text>
                </Text>
                <Text style={styles.playerSubStat}>
                  SR: {session.strikerBalls ? (((session.strikerRuns || 0) * 100) / session.strikerBalls).toFixed(0) : '0'} · {session.strikerFours || 0}x4, {session.strikerSixes || 0}x6
                </Text>
              </View>

              {/* Non-Striker */}
              <View style={styles.playerCard}>
                <View style={styles.playerCardHeader}>
                  <Text style={styles.playerRoleText}>Non-Striker</Text>
                </View>
                <Text style={styles.playerNameText} numberOfLines={1}>
                  {session.nonStrikerName}
                </Text>
                <Text style={styles.playerScoreHighlight}>
                  {session.nonStrikerRuns} <Text style={styles.playerBallsSub}>({session.nonStrikerBalls || 0})</Text>
                </Text>
                <Text style={styles.playerSubStat}>
                  SR: {session.nonStrikerBalls ? (((session.nonStrikerRuns || 0) * 100) / session.nonStrikerBalls).toFixed(0) : '0'}
                </Text>
              </View>

              {/* Bowler */}
              <View style={[styles.playerCard, styles.bowlerCard]}>
                <View style={styles.playerCardHeader}>
                  <Text style={styles.playerRoleText}>Bowler ⚾</Text>
                </View>
                <Text style={styles.playerNameText} numberOfLines={1}>
                  {session.bowlerName}
                </Text>
                <Text style={styles.playerScoreHighlight}>
                  {session.bowlerWickets}/{session.bowlerRuns}
                </Text>
                <Text style={styles.playerSubStat}>
                  {session.bowlerOvers}.{session.bowlerBalls} ov · Eco {(session.bowlerOvers || session.bowlerBalls) ? (((session.bowlerRuns || 0) * 6) / ((session.bowlerOvers || 0) * 6 + (session.bowlerBalls || 0))).toFixed(1) : '0.0'}
                </Text>
              </View>
            </View>
          )}

          {/* This Over Ball Trail */}
          {isLive && (session?.ballLog?.length || 0) > 0 && (
            <View style={styles.overTrailRow}>
              <Text style={styles.overTrailLabel}>This over:</Text>
              <View style={styles.ballPillList}>
                {session!.ballLog.slice(-6).map((label, i) => {
                  const parsed = parseBallLabel(label);
                  return (
                    <BallPill
                      key={`${label}-${i}`}
                      ball={{
                        label,
                        runs: parsed.runs,
                        wicket: parsed.wicket,
                        extra: parsed.extra,
                      }}
                    />
                  );
                })}
              </View>
            </View>
          )}

          {/* Match Result Banner */}
          {match.result && (
            <View style={styles.resultBannerHero}>
              <Text style={styles.resultBannerTitle}>🏆 {match.result}</Text>
              {match.playerOfMatch ? (
                <Text style={styles.resultBannerSub}>
                  ⭐ Player of the Match: <Text style={{ fontWeight: '800', color: '#FBBF24' }}>{match.playerOfMatch}</Text>
                </Text>
              ) : null}
            </View>
          )}

          {/* Toss Text */}
          {match.toss && (
            <View style={styles.tossRow}>
              <Text style={styles.tossText}>
                🪙 Toss: <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{match.toss.winner}</Text> opted to {match.toss.decision}
              </Text>
            </View>
          )}
        </LinearGradient>

        {/* Horizontal Scrollable Tabs Navigation */}
        <View style={styles.tabsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsScrollContent}>
            {(['Summary', 'Scorecard', 'Commentary', 'Insights', 'Info'] as Tab[]).map(t => {
              const isActive = tab === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.tabPillBtn, isActive && styles.tabPillBtnActive]}
                  onPress={() => setTab(t)}>
                  <Text style={[styles.tabPillLabel, isActive && styles.tabPillLabelActive]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Tab Content Screens */}
        <View style={{ padding: Spacing.base }}>
        
        {/* SUMMARY TAB */}
        {tab === 'Summary' && (
          <View style={{ gap: Spacing.md }}>
            {match.status === 'COMPLETED' && (
              <View style={styles.summaryResultCard}>
                <Text style={styles.summaryResultHeading}>MATCH RESULT</Text>
                <Text style={styles.summaryResultTitle}>🏆 {match.result || 'Match completed'}</Text>
                {match.playerOfMatch ? (
                  <View style={styles.pomContainer}>
                    <Text style={styles.pomHeading}>PLAYER OF THE MATCH</Text>
                    <Text style={styles.pomName}>⭐ {match.playerOfMatch}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Innings Summaries */}
            {[
              { innings: inn1, teamName: firstTeamName, logo: firstTeamLogo, short: firstTeamShort },
              { innings: inn2, teamName: secondTeamName, logo: secondTeamLogo, short: secondTeamShort },
            ]
              .filter(item => Boolean(item.innings))
              .map(({ innings, teamName, logo, short }, index) => {
                const topBatters = [...(innings?.batting || [])]
                  .sort((a: any, b: any) => (b.runs || 0) - (a.runs || 0) || (b.balls || 0) - (a.balls || 0))
                  .slice(0, 3);
                const topBowlers = [...(innings?.bowling || [])]
                  .sort((a: any, b: any) => (b.wickets || 0) - (a.wickets || 0) || (a.runs || 0) - (b.runs || 0))
                  .slice(0, 3);
                const pomKey = (match.playerOfMatch || '').trim().toLowerCase();

                return (
                  <View key={`${teamName}-${index}`} style={styles.summaryCard}>
                    <View style={styles.summaryHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                        <TeamLogoAvatar name={teamName} shortName={short} logoURL={logo} size={36} />
                        <Text style={styles.summaryTeamTitle} numberOfLines={1}>{teamName}</Text>
                      </View>
                      <View style={styles.summaryScoreBadge}>
                        <Text style={styles.summaryScoreText}>
                          {innings?.runs}-{innings?.wickets} ({innings?.overs}.{innings?.balls})
                        </Text>
                      </View>
                    </View>

                    <View style={styles.summaryDivider} />

                    {topBatters.length === 0 ? (
                      <Text style={styles.emptyNote}>No batting figures yet.</Text>
                    ) : (
                      topBatters.map((b: any, i: number) => {
                        const batPom = pomKey && String(b.name || '').toLowerCase() === pomKey;
                        const bowlPom = pomKey && String(topBowlers[i]?.name || '').toLowerCase() === pomKey;
                        return (
                          <View key={`${b.name}-${i}`} style={styles.summaryStatRow}>
                            <Text style={styles.summaryRankNum}>{i + 1}</Text>
                            <Text style={[styles.summaryBatterText, batPom && { color: Colors.primary }]} numberOfLines={1}>
                              {batPom ? '⭐ ' : ''}{b.name}{b.status === 'NOT_OUT' ? '*' : ''}
                            </Text>
                            <Text style={styles.summaryStatFigure}>{b.runs} ({b.balls})</Text>
                            <View style={styles.summaryVerticalDivider} />
                            <Text style={[styles.summaryBowlerText, bowlPom && { color: Colors.primary }]} numberOfLines={1}>
                              {bowlPom ? '⭐ ' : ''}{topBowlers[i]?.name || '—'}
                            </Text>
                            <Text style={styles.summaryStatFigure}>
                              {topBowlers[i] ? `${topBowlers[i].wickets}-${topBowlers[i].runs}` : '—'}
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                );
              })}

            {stars.length > 0 && (
              <View style={styles.summaryResultCard}>
                <Text style={styles.summaryResultHeading}>MATCH MVPs & SUPER STARS</Text>
                {stars.map((s, i) => (
                  <Text key={s.name} style={styles.superStarLine}>
                    {i + 1}. {s.name} · <Text style={{ fontWeight: '800', color: Colors.primary }}>{s.points} pts</Text> · {s.detail}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* SCORECARD TAB */}
        {tab === 'Scorecard' && (
          <View style={{ gap: Spacing.lg }}>
            {inn1 && (
              <View style={styles.scorecardInningsCard}>
                {/* Team Header */}
                <View style={styles.scorecardInningsHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <TeamLogoAvatar name={firstTeamName} shortName={firstTeamShort} logoURL={firstTeamLogo} size={36} />
                    <Text style={styles.inningsHeaderName}>{firstTeamName} Innings</Text>
                  </View>
                  <View style={styles.inningsHeaderScorePill}>
                    <Text style={styles.inningsHeaderScoreText}>
                      {inn1.runs}/{inn1.wickets} ({inn1.overs}.{inn1.balls} ov)
                    </Text>
                  </View>
                </View>

                {/* Batting Table */}
                <View style={styles.tableCard}>
                  <View style={styles.tableHeadRow}>
                    <Text style={[styles.tableHeadCol, { flex: 2.2, textAlign: 'left', paddingLeft: 8 }]}>Batter</Text>
                    <Text style={styles.tableHeadCol}>R</Text>
                    <Text style={styles.tableHeadCol}>B</Text>
                    <Text style={styles.tableHeadCol}>4s</Text>
                    <Text style={styles.tableHeadCol}>6s</Text>
                    <Text style={styles.tableHeadCol}>SR</Text>
                  </View>

                  {(inn1.batting && inn1.batting.length > 0 ? inn1.batting : []).map((b: any, i: number) => {
                    const isNotOut = !b.out && b.status === 'NOT_OUT';
                    return (
                      <View key={i} style={[styles.tableDataRow, i % 2 === 1 && styles.tableDataRowAlt]}>
                        <View style={{ flex: 2.2, paddingLeft: 8 }}>
                          <Text style={[styles.playerCellText, match.playerOfMatch === b.name && { color: Colors.primary }]}>
                            {match.playerOfMatch === b.name ? '⭐ ' : ''}{b.name}{isNotOut ? '*' : ''}
                          </Text>
                          {b.out ? (
                            <Text style={styles.dismissalText}>{b.out}</Text>
                          ) : isNotOut ? (
                            <Text style={styles.notOutBadge}>not out</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.tableDataCol, { fontWeight: '900', color: Colors.textPrimary }]}>{b.runs}</Text>
                        <Text style={styles.tableDataCol}>{b.balls}</Text>
                        <Text style={styles.tableDataCol}>{b.fours ?? 0}</Text>
                        <Text style={styles.tableDataCol}>{b.sixes ?? 0}</Text>
                        <Text style={styles.tableDataCol}>
                          {typeof b.strikeRate === 'number' ? b.strikeRate.toFixed(1) : (b.balls ? ((b.runs * 100) / b.balls).toFixed(1) : '0.0')}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Extras Summary */}
                <View style={styles.extrasContainer}>
                  <Text style={styles.extrasMainText}>
                    Extras: <Text style={{ fontWeight: '800', color: Colors.textPrimary }}>{inn1.extras?.total || 0}</Text>
                  </Text>
                  <Text style={styles.extrasSubText}>
                    (Wd: {inn1.extras?.wides || 0}, Nb: {inn1.extras?.noBalls || 0}, B: {inn1.extras?.byes || 0}, Lb: {inn1.extras?.legByes || 0})
                  </Text>
                </View>

                {/* Bowling Table */}
                <View style={styles.bowlingSection}>
                  <Text style={styles.bowlingSectionTitle}>Bowling</Text>
                  <View style={styles.tableCard}>
                    <View style={styles.tableHeadRow}>
                      <Text style={[styles.tableHeadCol, { flex: 2.2, textAlign: 'left', paddingLeft: 8 }]}>Bowler</Text>
                      <Text style={styles.tableHeadCol}>O</Text>
                      <Text style={styles.tableHeadCol}>M</Text>
                      <Text style={styles.tableHeadCol}>R</Text>
                      <Text style={[styles.tableHeadCol, { color: Colors.primary, fontWeight: '800' }]}>W</Text>
                      <Text style={styles.tableHeadCol}>Eco</Text>
                    </View>

                    {(inn1.bowling && inn1.bowling.length > 0 ? inn1.bowling : []).map((bw: any, i: number) => (
                      <View key={i} style={[styles.tableDataRow, i % 2 === 1 && styles.tableDataRowAlt]}>
                        <Text style={[styles.playerCellText, { flex: 2.2, paddingLeft: 8 }, match.playerOfMatch === bw.name && { color: Colors.primary }]}>
                          {match.playerOfMatch === bw.name ? '⭐ ' : ''}{bw.name}
                        </Text>
                        <Text style={styles.tableDataCol}>{bw.overs}</Text>
                        <Text style={styles.tableDataCol}>{bw.maidens || 0}</Text>
                        <Text style={styles.tableDataCol}>{bw.runs}</Text>
                        <Text style={[styles.tableDataCol, { color: Colors.primary, fontWeight: '900' }]}>{bw.wickets}</Text>
                        <Text style={styles.tableDataCol}>{typeof bw.economy === 'number' ? bw.economy.toFixed(1) : '0.0'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {inn2 && (
              <View style={styles.scorecardInningsCard}>
                {/* Team Header */}
                <View style={styles.scorecardInningsHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
                    <TeamLogoAvatar name={secondTeamName} shortName={secondTeamShort} logoURL={secondTeamLogo} size={36} />
                    <Text style={styles.inningsHeaderName}>{secondTeamName} Innings</Text>
                  </View>
                  <View style={styles.inningsHeaderScorePill}>
                    <Text style={styles.inningsHeaderScoreText}>
                      {inn2.runs}/{inn2.wickets} ({inn2.overs}.{inn2.balls} ov)
                    </Text>
                  </View>
                </View>

                {/* Batting Table */}
                <View style={styles.tableCard}>
                  <View style={styles.tableHeadRow}>
                    <Text style={[styles.tableHeadCol, { flex: 2.2, textAlign: 'left', paddingLeft: 8 }]}>Batter</Text>
                    <Text style={styles.tableHeadCol}>R</Text>
                    <Text style={styles.tableHeadCol}>B</Text>
                    <Text style={styles.tableHeadCol}>4s</Text>
                    <Text style={styles.tableHeadCol}>6s</Text>
                    <Text style={styles.tableHeadCol}>SR</Text>
                  </View>

                  {(inn2.batting || []).map((b: any, i: number) => {
                    const isNotOut = !b.out && b.status === 'NOT_OUT';
                    return (
                      <View key={i} style={[styles.tableDataRow, i % 2 === 1 && styles.tableDataRowAlt]}>
                        <View style={{ flex: 2.2, paddingLeft: 8 }}>
                          <Text style={[styles.playerCellText, match.playerOfMatch === b.name && { color: Colors.primary }]}>
                            {match.playerOfMatch === b.name ? '⭐ ' : ''}{b.name}{isNotOut ? '*' : ''}
                          </Text>
                          {b.out ? (
                            <Text style={styles.dismissalText}>{b.out}</Text>
                          ) : isNotOut ? (
                            <Text style={styles.notOutBadge}>not out</Text>
                          ) : null}
                        </View>
                        <Text style={[styles.tableDataCol, { fontWeight: '900', color: Colors.textPrimary }]}>{b.runs}</Text>
                        <Text style={styles.tableDataCol}>{b.balls}</Text>
                        <Text style={styles.tableDataCol}>{b.fours ?? 0}</Text>
                        <Text style={styles.tableDataCol}>{b.sixes ?? 0}</Text>
                        <Text style={styles.tableDataCol}>
                          {typeof b.strikeRate === 'number' ? b.strikeRate.toFixed(1) : (b.balls ? ((b.runs * 100) / b.balls).toFixed(1) : '0.0')}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Extras Summary */}
                <View style={styles.extrasContainer}>
                  <Text style={styles.extrasMainText}>
                    Extras: <Text style={{ fontWeight: '800', color: Colors.textPrimary }}>{inn2.extras?.total || 0}</Text>
                  </Text>
                  <Text style={styles.extrasSubText}>
                    (Wd: {inn2.extras?.wides || 0}, Nb: {inn2.extras?.noBalls || 0}, B: {inn2.extras?.byes || 0}, Lb: {inn2.extras?.legByes || 0})
                  </Text>
                </View>

                {/* Bowling Table */}
                <View style={styles.bowlingSection}>
                  <Text style={styles.bowlingSectionTitle}>Bowling</Text>
                  <View style={styles.tableCard}>
                    <View style={styles.tableHeadRow}>
                      <Text style={[styles.tableHeadCol, { flex: 2.2, textAlign: 'left', paddingLeft: 8 }]}>Bowler</Text>
                      <Text style={styles.tableHeadCol}>O</Text>
                      <Text style={styles.tableHeadCol}>M</Text>
                      <Text style={styles.tableHeadCol}>R</Text>
                      <Text style={[styles.tableHeadCol, { color: Colors.primary, fontWeight: '800' }]}>W</Text>
                      <Text style={styles.tableHeadCol}>Eco</Text>
                    </View>

                    {(inn2.bowling || []).map((bw: any, i: number) => (
                      <View key={i} style={[styles.tableDataRow, i % 2 === 1 && styles.tableDataRowAlt]}>
                        <Text style={[styles.playerCellText, { flex: 2.2, paddingLeft: 8 }, match.playerOfMatch === bw.name && { color: Colors.primary }]}>
                          {match.playerOfMatch === bw.name ? '⭐ ' : ''}{bw.name}
                        </Text>
                        <Text style={styles.tableDataCol}>{bw.overs}</Text>
                        <Text style={styles.tableDataCol}>{bw.maidens || 0}</Text>
                        <Text style={styles.tableDataCol}>{bw.runs}</Text>
                        <Text style={[styles.tableDataCol, { color: Colors.primary, fontWeight: '900' }]}>{bw.wickets}</Text>
                        <Text style={styles.tableDataCol}>{typeof bw.economy === 'number' ? bw.economy.toFixed(1) : '0.0'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* COMMENTARY TAB */}
        {tab === 'Commentary' && (
          <View style={styles.commentaryContainer}>
            <View style={styles.commentaryHeader}>
              <Text style={styles.commentaryHeaderTitle}>Ball-by-ball</Text>
              <TouchableOpacity onPress={speakScoreNow} style={styles.speakScoreChip}>
                <PremiumIcon name="volume" size={14} color={Colors.primary} />
                <Text style={styles.speakScoreText}>Hear score</Text>
              </TouchableOpacity>
            </View>
            {commentary.length === 0 ? (
              <Text style={styles.emptyNote}>Ball by ball commentary will appear as the match progresses.</Text>
            ) : (
              commentary.slice().reverse().map((b, idx) => (
                <View key={idx} style={styles.commentaryCard}>
                  <View style={[styles.overBadge, {
                    backgroundColor: b.wicket
                      ? '#FEE2E2'
                      : b.extra
                        ? '#FEF3C7'
                        : b.runs >= 4
                          ? '#DBEAFE'
                          : '#F1F5F9',
                  }]}>
                    <Text style={[styles.overBadgeText, {
                      color: b.wicket
                        ? '#DC2626'
                        : b.extra
                          ? '#D97706'
                          : b.runs >= 4
                            ? '#1D4ED8'
                            : '#475569',
                    }]}>
                      {b.over}.{b.ball}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {(b.bowler || b.batsman) ? (
                      <Text style={styles.commentaryMeta}>
                        {b.bowler || 'Bowler'}{b.batsman ? ` to ${b.batsman}` : ''}
                      </Text>
                    ) : null}
                    <Text style={styles.commentaryDesc}>{b.desc}</Text>
                  </View>
                  <BallPill ball={b} />
                </View>
              ))
            )}
          </View>
        )}

        {/* INSIGHTS TAB */}
        {tab === 'Insights' && (
          <View style={{ gap: Spacing.md }}>
            <View style={styles.insightsCard}>
              <Text style={styles.insightsTitle}>Partnerships</Text>
              {inn1Analytics.partnerships.length === 0 && inn2Analytics.partnerships.length === 0 ? (
                <Text style={styles.emptyNote}>No partnerships recorded yet.</Text>
              ) : (
                <>
                  {inn1Analytics.partnerships.map((p, idx) => (
                    <Text key={`p1-${p.wicket}-${idx}-${p.batterA}`} style={styles.insightLine}>
                      {p.wicket}. {p.batterA} & {p.batterB} · <Text style={{ fontWeight: '800', color: Colors.primary }}>{p.runs}</Text> ({p.balls}b)
                    </Text>
                  ))}
                  {inn2Analytics.partnerships.length > 0 && (
                    <>
                      <Text style={[styles.insightsTitle, { fontSize: 13, marginTop: 10 }]}>{secondTeamName} Partnerships</Text>
                      {inn2Analytics.partnerships.map((p, idx) => (
                        <Text key={`p2-${p.wicket}-${idx}-${p.batterA}`} style={styles.insightLine}>
                          {p.wicket}. {p.batterA} & {p.batterB} · <Text style={{ fontWeight: '800', color: Colors.primary }}>{p.runs}</Text> ({p.balls}b)
                        </Text>
                      ))}
                    </>
                  )}
                </>
              )}
            </View>

            <View style={styles.insightsCard}>
              <Text style={styles.insightsTitle}>Fall of Wickets</Text>
              {inn1Analytics.fow.length === 0 && inn2Analytics.fow.length === 0 ? (
                <Text style={styles.emptyNote}>No wickets fallen yet.</Text>
              ) : (
                <>
                  {inn1Analytics.fow.map((f, idx) => (
                    <Text key={`f1-${f.wicket}-${idx}-${f.batter}`} style={styles.insightLine}>
                      {f.score}/{f.wicket} · {f.batter} ({f.overs} ov)
                    </Text>
                  ))}
                  {inn2Analytics.fow.length > 0 && (
                    <>
                      <Text style={[styles.insightsTitle, { fontSize: 13, marginTop: 10 }]}>{secondTeamName} Fall of Wickets</Text>
                      {inn2Analytics.fow.map((f, idx) => (
                        <Text key={`f2-${f.wicket}-${idx}-${f.batter}`} style={styles.insightLine}>
                          {f.score}/{f.wicket} · {f.batter} ({f.overs} ov)
                        </Text>
                      ))}
                    </>
                  )}
                </>
              )}
            </View>

            <View style={styles.insightsCard}>
              <Text style={styles.insightsTitle}>Wagon Wheel</Text>
              {wagon.filter(z => z.count > 0).length === 0 ? (
                <Text style={styles.emptyNote}>Tap shot location while scoring to fill the wagon wheel.</Text>
              ) : (
                <>
                  <View style={styles.wagonRing}>
                    {wagon.filter(z => z.count > 0).map((z, idx) => {
                      const maxRuns = Math.max(1, ...wagon.map(w => w.runs));
                      const intensity = 0.25 + 0.75 * (z.runs / maxRuns);
                      return (
                        <View
                          key={z.zone}
                          style={[
                            styles.wagonSeg,
                            {
                              backgroundColor: `rgba(196,26,59,${intensity.toFixed(2)})`,
                              transform: [{ rotate: `${idx * 40}deg` }],
                            },
                          ]}>
                          <Text style={styles.wagonSegText}>{z.zone.slice(0, 3)}</Text>
                          <Text style={styles.wagonSegVal}>{z.runs}</Text>
                        </View>
                      );
                    })}
                  </View>
                  {wagon.filter(z => z.count > 0).map(z => (
                    <View key={`bar-${z.zone}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ width: 90, color: Colors.textSecondary, fontSize: 11 }}>{z.zone}</Text>
                      <View style={{ flex: 1, height: 10, backgroundColor: Colors.bgElevated, borderRadius: 5, overflow: 'hidden' }}>
                        <View style={{ width: `${Math.min(100, z.runs * 8)}%` as any, height: 10, backgroundColor: Colors.primary, borderRadius: 5 }} />
                      </View>
                      <Text style={{ width: 50, textAlign: 'right', color: Colors.textPrimary, fontSize: 11, fontWeight: '700' }}>{z.runs} ({z.count})</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            <View style={styles.insightsCard}>
              <Text style={styles.insightsTitle}>Over Comparison</Text>
              {overBuckets.length === 0 ? (
                <Text style={styles.emptyNote}>No overs scored yet.</Text>
              ) : (
                overBuckets.map(o => (
                  <View key={o.over} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ width: 44, color: Colors.textSecondary, fontSize: 11 }}>Ov {o.over}</Text>
                    <View style={{ flex: 1, height: 10, backgroundColor: Colors.bgElevated, borderRadius: 5, overflow: 'hidden' }}>
                      <View style={{ width: `${Math.min(100, o.runs * 8)}%` as any, height: 10, backgroundColor: o.wickets ? Colors.loss : Colors.accentBlue, borderRadius: 5 }} />
                    </View>
                    <Text style={{ width: 52, textAlign: 'right', color: Colors.textPrimary, fontSize: 11, fontWeight: '800' }}>
                      {o.runs}{o.wickets ? `/${o.wickets}` : ''}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* INFO TAB */}
        {tab === 'Info' && (
          <View style={styles.infoContainerCard}>
            {[
              { label: 'Venue', value: match.venue },
              {
                label: 'Date',
                value: new Date(match.dateTime).toLocaleDateString('en-PK', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              },
              {
                label: 'Overs',
                value: match.dls?.applied
                  ? `${match.overs} scheduled · DLS ${match.dls.team1Overs}/${match.dls.team2Overs} ov`
                  : `${match.overs} Overs`,
              },
              ...(match.dls?.applied && match.dls.revisedTarget != null
                ? [{ label: 'DLS Target', value: `${match.dls.revisedTarget} runs` }]
                : []),
              ...(match.dls?.parScore != null
                ? [{ label: 'DLS Par', value: String(match.dls.parScore) }]
                : []),
              { label: 'Umpires', value: match.umpires?.join(', ') || 'TBD' },
              { label: 'Toss', value: match.toss ? `${match.toss.winner} won, chose to ${match.toss.decision}` : 'TBD' },
              { label: 'Player of the Match', value: match.playerOfMatch || 'TBD' },
              { label: 'Result', value: match.result || 'TBD' },
            ].map((row, i, rows) => (
              <View key={i} style={[styles.infoRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.borderLight }]}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={[styles.infoValue, row.label === 'Player of the Match' && match.playerOfMatch ? { color: Colors.primary, fontWeight: '800' } : null]}>
                  {row.label === 'Player of the Match' && match.playerOfMatch ? `⭐ ${row.value}` : row.value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
    <PremiumGoLiveModal
      visible={showGoLivePremiumModal}
      onClose={() => setShowGoLivePremiumModal(false)}
    />
  </View>
);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  
  // Hero Container
  hero: {
    paddingTop: Platform.OS === 'ios' ? 54 : 46,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.base,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    ...Shadow.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: Radius.full,
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  broadcastDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  overlayBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionPillText: { color: '#FFFFFF', fontWeight: '800', fontSize: 11 },
  iconCircleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  voiceToggleOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: '#10B981',
  },
  voiceToggleText: { color: '#FFFFFF', fontWeight: '800', fontSize: 10, letterSpacing: 0.5 },

  // Live Meta Row
  liveMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  liveBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  matchPillBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  matchPillText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  oversPillBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  oversPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  clubPillBadge: {
    backgroundColor: 'rgba(196,26,59,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(196,26,59,0.4)',
    maxWidth: 130,
  },
  clubPillText: {
    color: '#FDA4AF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Match Hero Main Card with Glowing Team Logos
  matchHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 24,
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginBottom: Spacing.sm,
  },
  teamHeroCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLogoWrapper: {
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 36,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 5,
  },
  teamNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  scoreContainer: {
    alignItems: 'center',
  },
  scoreLargeText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  oversSmallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 1,
  },
  yetToBatPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  yetToBatText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  midHeroCol: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  vsCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  vsText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#F8FAFC',
    letterSpacing: 1,
  },
  crrContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(196, 26, 59, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.7)',
  },
  crrLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FDA4AF',
    letterSpacing: 0.5,
  },
  crrNumber: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // Target Banner
  targetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: Spacing.sm,
  },
  targetBannerText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  rrrBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rrrBadgeText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
  },

  // Live Players Grid
  livePlayersGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  playerCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  strikerCard: {
    backgroundColor: 'rgba(196, 26, 59, 0.22)',
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  bowlerCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
    borderColor: 'rgba(59, 130, 246, 0.45)',
  },
  playerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  strikerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  playerRoleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playerNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  playerScoreHighlight: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  playerBallsSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  playerSubStat: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },

  // Over Ball Trail
  overTrailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
    marginBottom: 4,
  },
  overTrailLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  ballPillList: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ballPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballPillText: {
    fontSize: 11,
    fontWeight: '900',
  },

  // Result & Toss
  resultBannerHero: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginTop: 6,
  },
  resultBannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  resultBannerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E2E8F0',
    textAlign: 'center',
    marginTop: 3,
  },
  tossRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  tossText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },

  // Horizontal Tab Navigation Bar
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
    ...Shadow.sm,
  },
  tabsScrollContent: {
    paddingHorizontal: Spacing.base,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabPillBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabPillBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadow.sm,
  },
  tabPillLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  tabPillLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Scorecard Screen Styles
  scorecardInningsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: Spacing.base,
    ...Shadow.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scorecardInningsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  inningsHeaderName: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  inningsHeaderScorePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  inningsHeaderScoreText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primary,
  },

  // Table Card
  tableCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tableHeadRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeadCol: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textAlign: 'center',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableDataRowAlt: {
    backgroundColor: '#FFFFFF',
  },
  tableDataCol: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  playerCellText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dismissalText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  notOutBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 1,
  },

  // Extras
  extrasContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
  },
  extrasMainText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  extrasSubText: {
    fontSize: 11,
    color: '#94A3B8',
  },

  // Bowling
  bowlingSection: {
    marginTop: Spacing.md,
  },
  bowlingSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },

  // Summary Tab Styles
  summaryResultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.sm,
  },
  summaryResultHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  summaryResultTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  pomContainer: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  pomHeading: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  pomName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryTeamTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  summaryScoreBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  summaryScoreText: {
    fontSize: 13,
    fontWeight: '900',
    color: Colors.primary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: Spacing.sm,
  },
  summaryStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    gap: 4,
  },
  summaryRankNum: {
    width: 16,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
  },
  summaryBatterText: {
    flex: 1.4,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryBowlerText: {
    flex: 1.4,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  summaryStatFigure: {
    width: 52,
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'right',
  },
  summaryVerticalDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  superStarLine: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    fontWeight: '600',
  },

  // Commentary Styles
  commentaryContainer: {
    gap: Spacing.sm,
  },
  commentaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  commentaryHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.textPrimary,
  },
  speakScoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  speakScoreText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  commentaryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  overBadge: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overBadgeText: {
    fontSize: 12,
    fontWeight: '900',
  },
  commentaryMeta: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    marginBottom: 2,
  },
  commentaryDesc: {
    fontSize: 13,
    color: Colors.textPrimary,
    lineHeight: 18,
  },

  // Insights Styles
  insightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.sm,
  },
  insightsTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  insightLine: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    fontWeight: '600',
  },
  wagonRing: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginVertical: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  wagonSeg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
  },
  wagonSegText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  wagonSegVal: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },

  // Info Tab Styles
  infoContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadow.sm,
  },
  infoRow: {
    paddingVertical: Spacing.md,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptyNote: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 6,
  },
});
