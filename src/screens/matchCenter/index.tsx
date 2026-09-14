import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { useAuthStore, useClubsStore, useHubStore, useMatchById, useMatchesStore, usePublicFeedStore } from '../../store';
import BackButton from '../../components/BackButton';
import PremiumIcon from '../../components/PremiumIcon';
import { matchShareMessage, shareText } from '../../utils/share';
import { buildOverBuckets, buildPartnershipsAndFow, buildWagonShots, cumulativeRuns } from '../../utils/matchAnalytics';
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
import { canUserGoLiveOnMatch } from '../../utils/account';
import { SkeletonMatchCenter } from '../../components/Skeleton';
import ScreenScaffold from '../../components/ScreenScaffold';
import { listenMatch } from '../../firebase';
import { Match } from '../../types';

type Tab = 'Summary' | 'Scorecard' | 'Commentary' | 'Insights' | 'Info';

const BALL_COLORS: Record<string, string> = {
  '4': '#2979FF',
  '6': '#00C853',
  'W': '#F44336',
  'wd': '#FF6D00',
  'nb': '#FF6D00',
  '0': '#4A5568',
};

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
  const bg = BALL_COLORS[label] || (ball.extra ? '#FF6D00' : Colors.bgElevated);
  const color = ball.wicket
    ? Colors.loss
    : ball.extra
      ? Colors.accentOrange
      : ball.runs === 4
        ? Colors.accentBlue
        : ball.runs === 6
          ? Colors.win
          : Colors.textPrimary;
  return (
    <View style={[styles.ballPill, { backgroundColor: bg + '33', borderColor: bg }]}>
      <Text style={[styles.ballPillText, { color }]}>{label}</Text>
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
          Animated.timing(pulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [match?.status, pulse]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

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
  const onDarkHero = !isLive;
  const heroFg = onDarkHero ? Colors.onPrimary : Colors.textPrimary;
  const heroMuted = onDarkHero ? 'rgba(255,255,255,0.92)' : Colors.textSecondary;
  const heroSoft = onDarkHero ? 'rgba(255,255,255,0.88)' : Colors.textMuted;
  const heroIcon = onDarkHero ? Colors.onPrimary : Colors.textSecondary;
  const heroAction = onDarkHero ? Colors.onPrimary : Colors.primary;
  const firstBattingTeam = inn1?.battingTeam === match.teamB ? 'B' : 'A';
  const firstTeamName = firstBattingTeam === 'A' ? match.teamAName : match.teamBName;
  const secondTeamName = firstBattingTeam === 'A' ? match.teamBName : match.teamAName;
  const liveInn = match.currentInnings === 2 ? inn2 : inn1;
  const liveBalls = liveInn ? (liveInn.overs || 0) * 6 + (liveInn.balls || 0) : 0;
  const crr = liveBalls > 0 && liveInn ? ((liveInn.runs * 6) / liveBalls) : 0;
  const target = getChaseTarget(match) ?? ((inn1?.runs || 0) + 1);
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
      <StatusBar barStyle={onDarkHero ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Hero Score Panel */}
      <LinearGradient colors={isLive ? Colors.gradLiveCard : Colors.gradHeader} style={styles.hero}>
        <View style={styles.topRow}>
          <BackButton onPress={() => navigation.goBack()} color={heroFg} style={styles.backBtn} />
          <View style={styles.voiceRow}>
            {isLive && canUserGoLiveOnMatch(user, match, clubs) && (
              <>
                <TouchableOpacity
                  onPress={() => navigation.navigate('AdminBroadcast', { matchId: match.id })}
                  style={styles.overlayBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.overlayBtnText}>Go Live</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              onPress={() => shareText(`${match.teamAName} vs ${match.teamBName}`, matchShareMessage(match, clubName))}
              style={[styles.voiceBtn, onDarkHero && styles.voiceBtnOnDark]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ color: heroAction, fontWeight: '800', fontSize: 11 }}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={speakScoreNow}
              style={[styles.voiceBtn, onDarkHero && styles.voiceBtnOnDark]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <PremiumIcon name="volume" size={18} color={heroIcon} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleVoice}
              style={[styles.voiceToggle, voiceOn && styles.voiceToggleOn, onDarkHero && styles.voiceBtnOnDark]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <PremiumIcon
                name={voiceOn ? 'volume' : 'volume-mute'}
                size={16}
                color={voiceOn ? heroAction : heroIcon}
              />
              <Text style={[styles.voiceToggleText, { color: voiceOn ? heroAction : heroIcon }]}>
                {voiceOn ? 'LIVE VOICE' : 'VOICE'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLive && (
          <View style={styles.liveRow}>
            <LinearGradient colors={['#FF3B30', '#FF6D00']} style={styles.liveBadge}>
              <Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} />
              <Text style={styles.liveText}>LIVE</Text>
            </LinearGradient>
            <Text style={[styles.matchNumText, { color: heroMuted }]}>Match {match.matchNumber}</Text>
          </View>
        )}

        <View style={styles.scoreBlock}>
          <View style={styles.teamScoreBlock}>
            <Text style={[styles.teamNameHero, { color: heroMuted }]}>{firstTeamName}</Text>
            {inn1 ? (
              <>
                <Text style={[styles.bigScore, { color: heroFg }]}>{inn1.runs}/{inn1.wickets}</Text>
                <Text style={[styles.oversText, { color: heroMuted }]}>{inn1.overs}.{inn1.balls} Overs</Text>
              </>
            ) : (
              <Text style={[styles.yetToBat, { color: heroSoft }]}>Yet to bat</Text>
            )}
          </View>
          <View style={styles.vsSep}>
            <Text style={[styles.vsHero, { color: heroSoft }]}>VS</Text>
            {isLive && liveBalls > 0 && <Text style={styles.crrText}>CRR{'\n'}{crr.toFixed(2)}</Text>}
          </View>
          <View style={[styles.teamScoreBlock, { alignItems: 'flex-end' }]}>
            <Text style={[styles.teamNameHero, { color: heroMuted }]}>{secondTeamName}</Text>
            {inn2 ? (
              <>
                <Text style={[styles.bigScore, { color: heroFg }]}>{inn2.runs}/{inn2.wickets}</Text>
                <Text style={[styles.oversText, { color: heroMuted }]}>{inn2.overs}.{inn2.balls} Overs</Text>
              </>
            ) : (
              <Text style={[styles.yetToBat, { color: heroSoft }]}>Yet to bat</Text>
            )}
          </View>
        </View>

        {isLive && chasing && (
          <LinearGradient colors={Colors.gradCard} style={styles.needRow}>
            <Text style={styles.needText}>
              🎯 Target {target} · Need {runsNeeded} from {ballsLeft} balls
              {match.dls?.applied ? ' · DLS' : ''}
            </Text>
            <Text style={styles.rrrText}>RRR: {rrr.toFixed(2)}</Text>
          </LinearGradient>
        )}

        {isLive && match.currentInnings === 2 && inn1 && !inn2 && (
          <Text style={[styles.needText, { textAlign: 'center', marginBottom: Spacing.sm }]}>
            {formatTargetLabel(match)}
          </Text>
        )}

        {isLive && session?.setupComplete && (
          <View style={styles.currentPlayers}>
            <View style={styles.batsmenRow}>
              <View style={styles.batsmanCard}>
                <Text style={styles.batsmanLabel}>⬛ {session.strikerName}</Text>
                <Text style={styles.batsmanScore}>
                  {session.strikerRuns} ({session.strikerBalls})
                </Text>
              </View>
              <View style={styles.batsmanCard}>
                <Text style={styles.batsmanLabel}>{session.nonStrikerName}</Text>
                <Text style={styles.batsmanScore}>
                  {session.nonStrikerRuns} ({session.nonStrikerBalls})
                </Text>
              </View>
              <View style={styles.bowlerCard}>
                <Text style={styles.batsmanLabel}>⚾ {session.bowlerName}</Text>
                <Text style={styles.batsmanScore}>
                  {session.bowlerOvers}.{session.bowlerBalls} • {session.bowlerWickets}/{session.bowlerRuns}
                </Text>
              </View>
            </View>
          </View>
        )}

        {isLive && (session?.ballLog?.length || 0) > 0 && (
          <View style={styles.lastBalls}>
            <Text style={styles.overLabel}>This over: </Text>
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
        )}

        {match.result && (
          <View style={[styles.resultBanner, onDarkHero && styles.resultBannerOnDark]}>
            <Text style={[styles.resultText, { color: heroFg }]}>🏆 {match.result}</Text>
            {match.playerOfMatch ? (
              <Text style={[styles.resultText, { marginTop: 4, color: heroFg }]}>
                ⭐ PoM: {match.playerOfMatch}
              </Text>
            ) : null}
          </View>
        )}

        {match.toss && (
          <Text style={[styles.tossText, { color: heroMuted }]}>Toss: {match.toss.winner} opt to {match.toss.decision}</Text>
        )}
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['Summary', 'Scorecard', 'Commentary', 'Insights', 'Info'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && { color: Colors.primary }]}>{t}</Text>
            {tab === t && <View style={styles.tabBar} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: Spacing.base, paddingBottom: 80 }}>
        {tab === 'Summary' && (
          <View>
            {match.status === 'COMPLETED' && (
              <View style={[styles.winnerCard, { marginBottom: Spacing.md }]}>
                <Text style={styles.winnerLabel}>MATCH RESULT</Text>
                <Text style={styles.winnerResult}>🏆 {match.result || 'Match completed'}</Text>
                <View style={styles.pomRow}>
                  <Text style={styles.pomLabel}>PLAYER OF THE MATCH</Text>
                  <Text style={styles.playerOfMatch}>
                    {match.playerOfMatch ? `⭐ ${match.playerOfMatch}` : 'Not selected yet'}
                  </Text>
                </View>
              </View>
            )}
            <View style={styles.summaryLegend}>
              <Text style={styles.summaryLegendText}>Top scorers</Text>
              <Text style={styles.summaryLegendText}>Best bowlers</Text>
            </View>
            {[{ innings: inn1, teamName: firstTeamName }, { innings: inn2, teamName: secondTeamName }]
              .filter(item => !!item.innings)
              .map(({ innings, teamName }, index) => {
                const topBatters = [...(innings?.batting || [])]
                  .sort((a: any, b: any) => (b.runs || 0) - (a.runs || 0) || (b.balls || 0) - (a.balls || 0))
                  .slice(0, 3);
                const topBowlers = [...(innings?.bowling || [])]
                  .sort((a: any, b: any) => (b.wickets || 0) - (a.wickets || 0) || (a.runs || 0) - (b.runs || 0))
                  .slice(0, 3);
                const pomKey = (match.playerOfMatch || '').trim().toLowerCase();
                return (
                  <View key={`${teamName}-${index}`} style={styles.summaryInnings}>
                    <View style={styles.summaryTitleRow}>
                      <Text style={styles.summaryTeam} numberOfLines={1}>{teamName}</Text>
                      <Text style={styles.summaryScore}>{innings?.runs}-{innings?.wickets} ({innings?.overs}.{innings?.balls})</Text>
                    </View>
                    {topBatters.length === 0 ? (
                      <Text style={styles.dismissal}>No batting figures yet.</Text>
                    ) : (
                      topBatters.map((b: any, i: number) => {
                        const batPom = pomKey && String(b.name || '').toLowerCase() === pomKey;
                        const bowlPom = pomKey && String(topBowlers[i]?.name || '').toLowerCase() === pomKey;
                        return (
                        <View key={`${b.name}-${i}`} style={styles.summaryLine}>
                          <Text style={styles.summaryRank}>{i + 1}</Text>
                          <Text style={[styles.summaryName, batPom && { color: Colors.primary }]} numberOfLines={1}>
                            {batPom ? '⭐ ' : ''}{b.name}{b.status === 'NOT_OUT' ? '*' : ''}
                          </Text>
                          <Text style={styles.summaryFigure}>{b.runs} ({b.balls})</Text>
                          <Text style={[styles.summaryName, bowlPom && { color: Colors.primary }]} numberOfLines={1}>
                            {bowlPom ? '⭐ ' : ''}{topBowlers[i]?.name || '—'}
                          </Text>
                          <Text style={styles.summaryFigure}>
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
              <View style={styles.winnerCard}>
                <Text style={styles.winnerLabel}>SUPER STARS</Text>
                {stars.map((s, i) => (
                  <Text key={s.name} style={styles.playerOfMatch}>{i + 1}. {s.name} · {s.points} pts · {s.detail}</Text>
                ))}
              </View>
            )}
          </View>
        )}
        {tab === 'Scorecard' && (
          <>
            {inn1 && (
              <View>
                <Text style={styles.inningsTitle}>{firstTeamName} Innings</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.col, { flex: 2 }]}>Batter</Text>
                  <Text style={styles.col}>R</Text>
                  <Text style={styles.col}>B</Text>
                  <Text style={styles.col}>4s</Text>
                  <Text style={styles.col}>6s</Text>
                  <Text style={styles.col}>SR</Text>
                </View>
                {(inn1.batting && inn1.batting.length > 0 ? inn1.batting : []).map((b: any, i: number) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <View style={{ flex: 2 }}>
                      <Text style={[styles.playerCell, match.playerOfMatch === b.name && { color: Colors.primary }]}>
                        {match.playerOfMatch === b.name ? '⭐ ' : ''}{b.status === 'NOT_OUT' ? `${b.name}*` : b.name}
                      </Text>
                      {b.out && <Text style={styles.dismissal}>{b.out}</Text>}
                      {!b.out && b.status === 'NOT_OUT' && <Text style={styles.dismissal}>not out</Text>}
                    </View>
                    <Text style={[styles.col, { fontWeight: '700', color: Colors.textPrimary }]}>{b.runs}</Text>
                    <Text style={styles.col}>{b.balls}</Text>
                    <Text style={styles.col}>{b.fours ?? 0}</Text>
                    <Text style={styles.col}>{b.sixes ?? 0}</Text>
                    <Text style={styles.col}>{typeof b.strikeRate === 'number' ? b.strikeRate.toFixed(1) : (b.balls ? ((b.runs * 100) / b.balls).toFixed(1) : '0.0')}</Text>
                  </View>
                ))}
                {(!inn1.batting || inn1.batting.length === 0) && (
                  <Text style={styles.dismissal}>Scorecard will appear as balls are scored.</Text>
                )}
                <View style={styles.extraRow}>
                  <Text style={styles.extraText}>
                    Extras: {inn1.extras?.total || 0} (Wd: {inn1.extras?.wides || 0}, Nb: {inn1.extras?.noBalls || 0}, B: {inn1.extras?.byes || 0}, Lb: {inn1.extras?.legByes || 0})
                  </Text>
                </View>
                <Text style={styles.inningsTitle}>Bowling</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.col, { flex: 2 }]}>Bowler</Text>
                  <Text style={styles.col}>O</Text>
                  <Text style={styles.col}>M</Text>
                  <Text style={styles.col}>R</Text>
                  <Text style={styles.col}>W</Text>
                  <Text style={styles.col}>Eco</Text>
                </View>
                {(inn1.bowling && inn1.bowling.length > 0 ? inn1.bowling : []).map((bw: any, i: number) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.col, { flex: 2, textAlign: 'left', color: match.playerOfMatch === bw.name ? Colors.primary : Colors.textPrimary }]}>
                      {match.playerOfMatch === bw.name ? '⭐ ' : ''}{bw.name}
                    </Text>
                    <Text style={styles.col}>{bw.overs}</Text>
                    <Text style={styles.col}>{bw.maidens || 0}</Text>
                    <Text style={styles.col}>{bw.runs}</Text>
                    <Text style={[styles.col, { color: Colors.accentPurple, fontWeight: '700' }]}>{bw.wickets}</Text>
                    <Text style={styles.col}>{typeof bw.economy === 'number' ? bw.economy.toFixed(1) : '0.0'}</Text>
                  </View>
                ))}
                {inn2 && (
                  <View style={{ marginTop: Spacing.lg }}>
                    <Text style={styles.inningsTitle}>{secondTeamName} Innings</Text>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.col, { flex: 2 }]}>Batter</Text>
                      <Text style={styles.col}>R</Text>
                      <Text style={styles.col}>B</Text>
                      <Text style={styles.col}>4s</Text>
                      <Text style={styles.col}>6s</Text>
                      <Text style={styles.col}>SR</Text>
                    </View>
                    {(inn2.batting || []).map((b: any, i: number) => (
                      <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                        <View style={{ flex: 2 }}>
                          <Text style={[styles.playerCell, match.playerOfMatch === b.name && { color: Colors.primary }]}>
                            {match.playerOfMatch === b.name ? '⭐ ' : ''}{b.status === 'NOT_OUT' ? `${b.name}*` : b.name}
                          </Text>
                          {b.out && <Text style={styles.dismissal}>{b.out}</Text>}
                          {!b.out && b.status === 'NOT_OUT' && <Text style={styles.dismissal}>not out</Text>}
                        </View>
                        <Text style={[styles.col, { fontWeight: '700', color: Colors.textPrimary }]}>{b.runs}</Text>
                        <Text style={styles.col}>{b.balls}</Text>
                        <Text style={styles.col}>{b.fours ?? 0}</Text>
                        <Text style={styles.col}>{b.sixes ?? 0}</Text>
                        <Text style={styles.col}>{typeof b.strikeRate === 'number' ? b.strikeRate.toFixed(1) : (b.balls ? ((b.runs * 100) / b.balls).toFixed(1) : '0.0')}</Text>
                      </View>
                    ))}
                    <Text style={styles.inningsTitle}>Bowling</Text>
                    {(inn2.bowling || []).map((bw: any, i: number) => (
                      <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                        <Text style={[styles.col, { flex: 2, textAlign: 'left', color: match.playerOfMatch === bw.name ? Colors.primary : Colors.textPrimary }]}>
                          {match.playerOfMatch === bw.name ? '⭐ ' : ''}{bw.name}
                        </Text>
                        <Text style={styles.col}>{bw.overs}</Text>
                        <Text style={styles.col}>{bw.maidens || 0}</Text>
                        <Text style={styles.col}>{bw.runs}</Text>
                        <Text style={[styles.col, { color: Colors.accentPurple, fontWeight: '700' }]}>{bw.wickets}</Text>
                        <Text style={styles.col}>{typeof bw.economy === 'number' ? bw.economy.toFixed(1) : '0.0'}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}

        {tab === 'Commentary' && (
          <View>
            <View style={styles.commentaryHeader}>
              <Text style={styles.commentaryHeaderTitle}>Ball-by-ball</Text>
              <TouchableOpacity onPress={speakScoreNow} style={styles.speakScoreChip}>
                <PremiumIcon name="volume" size={14} color={Colors.primary} />
                <Text style={styles.speakScoreText}>Hear score</Text>
              </TouchableOpacity>
            </View>
            {commentary.length === 0 ? (
              <Text style={styles.dismissal}>
                Commentary will appear here as each ball is scored.
              </Text>
            ) : (
              commentary.slice().reverse().map((b, i) => (
                <View key={`${b.over}.${b.ball}-${i}-${b.label}`} style={styles.commentaryRow}>
                  <View style={[styles.overBadge, {
                    backgroundColor: b.wicket
                      ? Colors.loss + '33'
                      : b.extra
                        ? Colors.accentOrange + '22'
                        : b.runs >= 4
                          ? Colors.accentBlue + '22'
                          : Colors.bgElevated,
                  }]}>
                    <Text style={[styles.overBadgeText, {
                      color: b.wicket
                        ? Colors.loss
                        : b.extra
                          ? Colors.accentOrange
                          : b.runs >= 4
                            ? Colors.accentBlue
                            : Colors.textSecondary,
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

        {tab === 'Insights' && (
          <View>
            <Text style={styles.inningsTitle}>Partnerships</Text>
            {inn1Analytics.partnerships.map(p => (
              <Text key={`p1-${p.wicket}`} style={styles.dismissal}>{p.wicket}. {p.batterA} & {p.batterB} · {p.runs} ({p.balls})</Text>
            ))}
            <Text style={styles.inningsTitle}>Fall of wickets</Text>
            {inn1Analytics.fow.map(f => (
              <Text key={`f1-${f.wicket}`} style={styles.dismissal}>{f.score}/{f.wicket} · {f.batter} · {f.overs} ov</Text>
            ))}
            {inn2 && inn2Analytics.fow.length > 0 && inn2Analytics.fow.map(f => (
              <Text key={`f2-${f.wicket}`} style={styles.dismissal}>2nd: {f.score}/{f.wicket} · {f.batter}</Text>
            ))}
            <Text style={styles.inningsTitle}>Wagon wheel</Text>
            {wagon.filter(z => z.count > 0).length === 0 && <Text style={styles.dismissal}>Tap shot location while scoring to fill the wagon wheel.</Text>}
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
                        backgroundColor: `rgba(255,109,0,${intensity.toFixed(2)})`,
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
                <Text style={{ width: 50, textAlign: 'right', color: Colors.textPrimary, fontSize: 11 }}>{z.runs} ({z.count})</Text>
              </View>
            ))}
            <Text style={styles.inningsTitle}>Over comparison</Text>
            {overBuckets.map(o => (
              <View key={o.over} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Text style={{ width: 36, color: Colors.textSecondary, fontSize: 11 }}>Ov {o.over}</Text>
                <View style={{ flex: 1, height: 10, backgroundColor: Colors.bgElevated, borderRadius: 5, overflow: 'hidden' }}>
                  <View style={{ width: `${Math.min(100, o.runs * 8)}%` as any, height: 10, backgroundColor: o.wickets ? Colors.loss : Colors.accentBlue, borderRadius: 5 }} />
                </View>
                <Text style={{ width: 48, textAlign: 'right', color: Colors.textPrimary, fontSize: 11 }}>{o.runs}{o.wickets ? `/${o.wickets}` : ''}</Text>
              </View>
            ))}
            <Text style={styles.inningsTitle}>Runs comparison</Text>
            <View style={styles.runCurveRow}>
              {runCurve.map((total, i) => {
                const max = Math.max(1, ...runCurve);
                const h = Math.max(4, Math.round((total / max) * 72));
                return (
                  <View key={`c-${i}`} style={styles.runCurveCol}>
                    <View style={[styles.runCurveBar, { height: h }]} />
                    <Text style={styles.runCurveLabel}>{i + 1}</Text>
                  </View>
                );
              })}
            </View>
            {runCurve.map((total, i) => (
              <Text key={`ct-${i}`} style={styles.dismissal}>After {i + 1} ov: {total} runs</Text>
            ))}
          </View>
        )}

        {tab === 'Info' && (
          <LinearGradient colors={Colors.gradCard} style={styles.infoCard}>
            {[
              { label: 'Venue', value: match.venue },
              { label: 'Date', value: new Date(match.dateTime).toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) },
              { label: 'Overs', value: match.dls?.applied
                ? `${match.overs} scheduled · DLS ${match.dls.team1Overs}/${match.dls.team2Overs} ov`
                : `${match.overs} Overs` },
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
              <View key={i} style={[styles.infoRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.border }]}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={[styles.infoValue, row.label === 'Player of the Match' && match.playerOfMatch ? { color: Colors.primary, fontWeight: '800' } : null]}>
                  {row.label === 'Player of the Match' && match.playerOfMatch ? `⭐ ${row.value}` : row.value}
                </Text>
              </View>
            ))}
          </LinearGradient>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  hero: { paddingTop: 60, paddingBottom: Spacing.base, paddingHorizontal: Spacing.base },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  backBtn: {},
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  overlayBtn: {
    paddingHorizontal: 10,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '66',
  },
  overlayBtnText: { color: Colors.primary, fontWeight: '800', fontSize: 11 },
  voiceBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  voiceBtnOnDark: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  voiceToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: Radius.full,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  voiceToggleOn: {
    backgroundColor: Colors.primary + '18',
    borderColor: Colors.primary + '66',
  },
  voiceToggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  liveBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.full, gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontSize: Typography.xs, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  matchNumText: { fontSize: Typography.sm, color: Colors.textSecondary },
  scoreBlock: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: Spacing.sm },
  teamScoreBlock: { flex: 1 },
  teamNameHero: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '700', marginBottom: 4 },
  bigScore: { fontSize: Typography.xxxl, fontWeight: '900', color: Colors.textPrimary },
  oversText: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2, fontWeight: '600' },
  yetToBat: { fontSize: Typography.sm, color: Colors.textMuted, marginTop: 8 },
  vsSep: { paddingHorizontal: Spacing.md, alignItems: 'center', marginTop: Spacing.xl },
  vsHero: { fontSize: Typography.sm, color: Colors.textMuted, fontWeight: '700' },
  crrText: { fontSize: Typography.xs, color: Colors.primary, textAlign: 'center', marginTop: 4 },
  needRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.sm },
  needText: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: '600' },
  rrrText: { fontSize: Typography.sm, color: Colors.accentOrange, fontWeight: '700' },
  currentPlayers: { marginBottom: Spacing.sm },
  batsmenRow: { flexDirection: 'row', gap: Spacing.sm },
  batsmanCard: { flex: 1, backgroundColor: Colors.bgElevated, padding: Spacing.sm, borderRadius: Radius.md },
  bowlerCard: { flex: 1, backgroundColor: Colors.bgElevated + '88', padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.accentPurple + '44' },
  batsmanLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 2 },
  batsmanScore: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary },
  lastBalls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  overLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  ballPill: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ballPillText: { fontSize: Typography.xs, fontWeight: '800' },
  resultBanner: { backgroundColor: Colors.primary + '22', padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.primary + '44' },
  resultBannerOnDark: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  resultText: { fontSize: Typography.sm, color: Colors.primary, fontWeight: '700', textAlign: 'center' },
  tossText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border, backgroundColor: Colors.bgCard },
  tab: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textSecondary },
  tabBar: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: Colors.primary, borderRadius: 1 },
  summaryInnings: { paddingBottom: Spacing.lg, marginBottom: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  summaryTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.sm },
  summaryTeam: { flex: 1, fontSize: Typography.lg, color: Colors.primary, fontWeight: '800', textTransform: 'uppercase' },
  summaryScore: { fontSize: Typography.lg, color: Colors.primary, fontWeight: '900' },
  summaryLegend: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm, paddingHorizontal: 28 },
  summaryLegendText: { fontSize: Typography.xs, color: Colors.textMuted, fontWeight: '700', letterSpacing: 0.4 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 4 },
  summaryRank: { width: 18, fontSize: Typography.xs, color: Colors.primary, fontWeight: '800' },
  summaryName: { flex: 1.35, fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600' },
  summaryFigure: { width: 52, fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: '800', textAlign: 'right' },
  winnerCard: { marginTop: Spacing.sm, backgroundColor: Colors.primary + '16', borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.primary + '55', padding: Spacing.base },
  winnerLabel: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '800', letterSpacing: 1 },
  winnerResult: { fontSize: Typography.lg, color: Colors.textPrimary, fontWeight: '900', marginTop: Spacing.xs },
  pomRow: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.primary + '33' },
  pomLabel: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '800', letterSpacing: 1 },
  playerOfMatch: { fontSize: Typography.base, color: Colors.primary, fontWeight: '800', marginTop: 4 },
  inningsTitle: { fontSize: Typography.base, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.sm, marginTop: Spacing.base },
  tableHeader: { flexDirection: 'row', backgroundColor: Colors.bgCard, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm, marginBottom: 2 },
  col: { flex: 1, fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center', fontWeight: '600' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs, borderRadius: Radius.sm },
  tableRowAlt: { backgroundColor: Colors.bgCard },
  playerCell: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: '600' },
  dismissal: { fontSize: Typography.xs, color: Colors.textMuted, marginTop: 1 },
  extraRow: { paddingVertical: Spacing.sm },
  extraText: { fontSize: Typography.xs, color: Colors.textSecondary },
  commentaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  commentaryHeaderTitle: { fontSize: Typography.base, fontWeight: '800', color: Colors.textPrimary },
  speakScoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  speakScoreText: { fontSize: Typography.xs, fontWeight: '800', color: Colors.primary },
  commentaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  overBadge: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  overBadgeText: { fontSize: Typography.xs, fontWeight: '800' },
  commentaryMeta: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 2 },
  commentaryDesc: { fontSize: Typography.sm, color: Colors.textPrimary },
  infoCard: { borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  infoRow: { paddingVertical: Spacing.md },
  infoLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: 4 },
  infoValue: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary },
  wagonRing: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wagonSeg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
  },
  wagonSegText: { color: Colors.textPrimary, fontSize: 9, fontWeight: '800' },
  wagonSegVal: { color: Colors.textPrimary, fontSize: 12, fontWeight: '900' },
  runCurveRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 88,
    marginBottom: Spacing.sm,
    paddingHorizontal: 4,
  },
  runCurveCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  runCurveBar: {
    width: '80%',
    backgroundColor: Colors.accentBlue,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    minHeight: 4,
  },
  runCurveLabel: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },
});
