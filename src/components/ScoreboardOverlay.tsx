import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../theme';
import { Match } from '../types';
import { OverlayGraphicsMode, useOverlayModeStore } from '../store/overlayMode';
import {
  resolveScorebarTheme,
  ScorebarTheme,
  ScorebarThemeId,
} from '../theme/scorebarThemes';
import { getChaseTarget, getEffectiveOvers } from '../utils/dls';
import { legalBallsPerOver, resolveMatchSettings } from '../utils/matchSettings';
import {
  BatterCardEntry,
  BowlerFigure,
  buildBowlingFromFigures,
  buildLiveBattingCard,
} from '../utils/scoring';
import { isBundledCricketLogo, isCustomUploadedLogo } from '../utils/defaultLogo';

const BURST_LOTTIE = {
  FOUR: require('../assets/lottie/four.json'),
  SIX: require('../assets/lottie/six.json'),
  WICKET: require('../assets/lottie/wicket.json'),
} as const;

export type OverlayChase = {
  target: number;
  need: number;
  ballsLeft: number;
};

export type OverlayBatterRow = {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  status: string;
  out?: string;
  onStrike?: boolean;
};

export type OverlayBowlerRow = {
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  active?: boolean;
};

export type OverlayExtras = {
  total: number;
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
};

export type OverlayInningsCard = {
  teamName: string;
  bowlingTeamName: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  battingRows: OverlayBatterRow[];
  bowlingRows: OverlayBowlerRow[];
  extras: OverlayExtras | null;
};

export type OverlaySummaryLine = {
  name: string;
  figure: string;
};

export type OverlayInningsSummary = {
  teamName: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  topBatters: OverlaySummaryLine[];
  topBowlers: OverlaySummaryLine[];
};

export type ScoreboardOverlayModel = {
  teamAName: string;
  teamBName: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  strikerName: string;
  strikerRuns: number;
  strikerBalls: number;
  nonStrikerName: string;
  nonStrikerRuns: number;
  nonStrikerBalls: number;
  bowlerName: string;
  bowlerFigures: string;
  bowlerOvers: string;
  battingTeamName: string;
  bowlingTeamName: string;
  battingTeamLogo?: string;
  bowlingTeamLogo?: string;
  thisOver: string[];
  chase: OverlayChase | null;
  battingRows: OverlayBatterRow[];
  bowlingRows: OverlayBowlerRow[];
  extras: OverlayExtras | null;
  inningsNumber: 1 | 2;
  firstInnings: OverlayInningsCard | null;
  secondInnings: OverlayInningsCard | null;
  matchSummary: {
    inn1: OverlayInningsSummary | null;
    inn2: OverlayInningsSummary | null;
    result?: string;
    playerOfMatch?: string;
  };
};

function shortName(name: string | undefined, max: number) {
  const n = String(name || '').trim();
  if (!n) return '—';
  if (n.length <= max) return n.toUpperCase();
  return `${n.slice(0, max - 1).toUpperCase()}…`;
}

function currentOverLabels(log: string[] | undefined, ballsPerOver = 6): string[] {
  if (!log?.length) return [];
  let legal = 0;
  const over: string[] = [];
  log.forEach(raw => {
    const base = (raw.split('→')[0] || '').trim();
    if (!base || base.toLowerCase() === 'rh') return;
    const extra = base.toLowerCase().startsWith('wd') || base.toLowerCase().startsWith('nb');
    if (legal >= ballsPerOver) {
      legal = 0;
      over.length = 0;
    }
    over.push(base);
    if (!extra) legal += 1;
  });
  return over;
}

function displayBall(label: string): string {
  return label
    .replace(/^Wd/i, 'wd')
    .replace(/^Nb/i, 'nb')
    .replace(/^LB/i, 'lb');
}

function ballTone(label: string): { bg: string; fg: string } {
  const key = label.toLowerCase();
  if (key === 'w' || key.startsWith('w+')) return { bg: 'rgba(244,67,54,0.28)', fg: '#FF8A80' };
  if (key === '6') return { bg: 'rgba(61,220,132,0.22)', fg: '#3DDC84' };
  if (key === '4') return { bg: 'rgba(77,183,255,0.22)', fg: '#4DB7FF' };
  if (key.startsWith('wd') || key.startsWith('nb') || key.startsWith('lb') || /^b\d/.test(key)) {
    return { bg: 'rgba(255,138,61,0.22)', fg: '#FF8A3D' };
  }
  return { bg: 'rgba(247,244,234,0.12)', fg: Colors.textPrimary };
}

type ScorebarBurstKind = 'FOUR' | 'SIX' | 'WICKET';

function parseScorebarBurst(label: string): ScorebarBurstKind | null {
  const key = (label.split('→')[0] || '').trim().toLowerCase();
  if (!key || key === 'rh') return null;
  if (key === 'w' || key.startsWith('w+')) return 'WICKET';
  if (key === '6') return 'SIX';
  if (key === '4') return 'FOUR';
  return null;
}

const BURST_THEME: Record<
  ScorebarBurstKind,
  { colors: string[]; title: string; accent: string }
> = {
  FOUR: {
    colors: ['#0B3D6E', '#1480D6', '#4DB7FF'],
    title: 'FOUR',
    accent: '#E8F6FF',
  },
  SIX: {
    colors: ['#0A4A2A', '#1FA85A', '#3DDC84'],
    title: 'SIX',
    accent: '#E8FFF2',
  },
  WICKET: {
    colors: ['#5A0A12', '#C62828', '#FF5252'],
    title: 'WICKET',
    accent: '#FFE8EA',
  },
};

/** Facebook Live–style flash strip when a boundary or wicket is scored. */
function ScorebarEventBurst({
  thisOver,
  strikerName,
  bowlerName,
  forStream,
  compact,
}: {
  thisOver: string[];
  strikerName: string;
  bowlerName?: string;
  forStream?: boolean;
  compact?: boolean;
}) {
  const [burst, setBurst] = useState<ScorebarBurstKind | null>(null);
  const [lottieKey, setLottieKey] = useState(0);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const lastSeen = useRef('');
  const bootstrapped = useRef(false);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.96);
  const titleScale = useSharedValue(0.85);
  const titleOpacity = useSharedValue(0);
  const subOpacity = useSharedValue(0);

  const clearBurst = () => setBurst(null);

  useEffect(() => {
    if (!thisOver.length) return;
    const last = thisOver[thisOver.length - 1];
    const token = `${thisOver.length}|${last}`;
    if (!bootstrapped.current) {
      bootstrapped.current = true;
      lastSeen.current = token;
      return;
    }
    if (token === lastSeen.current) return;
    lastSeen.current = token;
    const kind = parseScorebarBurst(last);
    if (!kind) return;

    cancelAnimation(opacity);
    cancelAnimation(scale);
    cancelAnimation(titleScale);
    cancelAnimation(titleOpacity);
    cancelAnimation(subOpacity);

    setBurst(kind);
    setLottieKey(k => k + 1);

    opacity.value = 0;
    scale.value = 0.96;
    titleScale.value = 0.85;
    titleOpacity.value = 0;
    subOpacity.value = 0;

    const holdMs = 5000;
    const enterMs = 160;
    const exitMs = 220;

    opacity.value = withSequence(
      withTiming(1, { duration: enterMs, easing: Easing.out(Easing.cubic) }),
      withDelay(
        holdMs,
        withTiming(0, { duration: exitMs, easing: Easing.in(Easing.cubic) }, finished => {
          if (finished) runOnJS(clearBurst)();
        }),
      ),
    );
    scale.value = withSequence(
      withTiming(1.02, { duration: 130, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 140, easing: Easing.inOut(Easing.quad) }),
    );
    titleOpacity.value = withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) });
    titleScale.value = withSequence(
      withTiming(1.06, { duration: 140, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 150, easing: Easing.inOut(Easing.quad) }),
    );
    subOpacity.value = withDelay(80, withTiming(1, { duration: 150 }));
  }, [thisOver, opacity, scale, titleScale, titleOpacity, subOpacity]);

  const hostStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ scale: titleScale.value }],
  }));

  const subStyle = useAnimatedStyle(() => ({
    opacity: subOpacity.value,
  }));

  // Scale type + icons from the live scorebar width (stream is ~1168px content).
  const baseW = box.w > 0 ? box.w : forStream ? 1168 : 360;
  const baseH = box.h > 0 ? box.h : compact ? 120 : 72;
  const titleSize = Math.round(Math.max(22, Math.min(forStream ? 42 : 34, baseW * 0.036)));
  const subSize = Math.round(Math.max(10, Math.min(forStream ? 16 : 13, baseW * 0.013)));
  const iconSize = Math.round(
    Math.max(36, Math.min(baseH * 0.85, forStream ? baseW * 0.065 : baseW * 0.14)),
  );

  if (!burst) {
    return (
      <View
        pointerEvents="none"
        collapsable={false}
        style={styles.burstHost}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
        }}
      />
    );
  }

  const theme = BURST_THEME[burst];
  const sub =
    burst === 'WICKET'
      ? `BY ${(bowlerName || 'BOWLER').toUpperCase()}`
      : `${(strikerName || 'BATTER').toUpperCase()} · BOUNDARY`;

  return (
    <Animated.View
      pointerEvents="none"
      collapsable={false}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== box.w || height !== box.h) setBox({ w: width, h: height });
      }}
      style={[styles.burstHost, forStream && styles.burstHostStream, hostStyle]}>
      <LinearGradient
        colors={theme.colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.burstBar, forStream && styles.burstBarStream]}>
        <View style={styles.burstContent}>
          <LottieView
            key={`l-${lottieKey}-a`}
            source={BURST_LOTTIE[burst]}
            autoPlay
            loop
            speed={1.1}
            resizeMode="contain"
            style={{ width: iconSize, height: iconSize }}
          />
          <View style={styles.burstTextCol}>
            <Animated.Text
              style={[
                styles.burstTitle,
                { fontSize: titleSize, letterSpacing: titleSize * 0.12, lineHeight: titleSize + 4 },
                titleStyle,
              ]}>
              {theme.title}
            </Animated.Text>
            <Animated.Text
              style={[
                styles.burstSub,
                { fontSize: subSize, letterSpacing: subSize * 0.08, lineHeight: subSize + 3 },
                subStyle,
              ]}
              numberOfLines={1}>
              {sub}
            </Animated.Text>
          </View>
          <LottieView
            key={`l-${lottieKey}-b`}
            source={BURST_LOTTIE[burst]}
            autoPlay
            loop
            speed={1.1}
            resizeMode="contain"
            style={{ width: iconSize, height: iconSize }}
          />
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

type ScorecardBatterLike = {
  name: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  strikeRate?: number;
  status?: string;
  out?: string;
};

type ScorecardBowlerLike = {
  name: string;
  overs?: number;
  maidens?: number;
  runs?: number;
  wickets?: number;
  economy?: number;
};

function toOverlayBatterRows(
  rows: ScorecardBatterLike[] | undefined,
  strikerName?: string,
): OverlayBatterRow[] {
  if (!rows?.length) return [];
  const strike = (strikerName || '').trim().toLowerCase();
  return rows.map(b => ({
    name: shortName(b.name, 16),
    runs: b.runs || 0,
    balls: b.balls || 0,
    fours: b.fours ?? 0,
    sixes: b.sixes ?? 0,
    strikeRate:
      typeof b.strikeRate === 'number'
        ? b.strikeRate
        : b.balls
          ? Math.round(((b.runs || 0) * 1000) / b.balls) / 10
          : 0,
    status: b.status || '',
    out: b.out,
    onStrike: !!strike && b.name.toLowerCase() === strike && b.status === 'NOT_OUT',
  }));
}

function toOverlayBowlerRows(
  rows: ScorecardBowlerLike[] | undefined,
  activeBowler?: string,
): OverlayBowlerRow[] {
  if (!rows?.length) return [];
  const active = (activeBowler || '').trim().toLowerCase();
  return rows.map(bw => ({
    name: shortName(bw.name, 16),
    overs: bw.overs || 0,
    maidens: bw.maidens || 0,
    runs: bw.runs || 0,
    wickets: bw.wickets || 0,
    economy: typeof bw.economy === 'number' ? bw.economy : 0,
    active: !!active && bw.name.toLowerCase() === active,
  }));
}

function extrasFromInn(
  extras?: {
    wides?: number;
    noBalls?: number;
    byes?: number;
    legByes?: number;
    total?: number;
  } | null,
): OverlayExtras | null {
  if (!extras) return null;
  const wides = extras.wides || 0;
  const noBalls = extras.noBalls || 0;
  const byes = extras.byes || 0;
  const legByes = extras.legByes || 0;
  const total = extras.total ?? wides + noBalls + byes + legByes;
  return { total, wides, noBalls, byes, legByes };
}

function topSummaryBatters(rows: OverlayBatterRow[], limit = 3): OverlaySummaryLine[] {
  return [...rows]
    .sort((a, b) => b.runs - a.runs || b.balls - a.balls)
    .slice(0, limit)
    .map(b => ({
      name: b.name + (b.status === 'NOT_OUT' ? '*' : ''),
      figure: `${b.runs} (${b.balls})`,
    }));
}

function topSummaryBowlers(rows: OverlayBowlerRow[], limit = 3): OverlaySummaryLine[] {
  return [...rows]
    .sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)
    .slice(0, limit)
    .map(bw => ({
      name: bw.name,
      figure: `${bw.wickets}-${bw.runs}`,
    }));
}

function inningsCardFromParts(input: {
  teamName: string;
  bowlingTeamName: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  battingRows: OverlayBatterRow[];
  bowlingRows: OverlayBowlerRow[];
  extras: OverlayExtras | null;
}): OverlayInningsCard {
  return {
    teamName: shortName(input.teamName, 18),
    bowlingTeamName: shortName(input.bowlingTeamName, 14),
    runs: input.runs,
    wickets: input.wickets,
    overs: input.overs,
    balls: input.balls,
    battingRows: input.battingRows,
    bowlingRows: input.bowlingRows,
    extras: input.extras,
  };
}

function summaryFromCard(card: OverlayInningsCard | null): OverlayInningsSummary | null {
  if (!card) return null;
  return {
    teamName: card.teamName,
    runs: card.runs,
    wickets: card.wickets,
    overs: card.overs,
    balls: card.balls,
    topBatters: topSummaryBatters(card.battingRows),
    topBowlers: topSummaryBowlers(card.bowlingRows),
  };
}

function inningsCardFromMatchInn(params: {
  inn: NonNullable<Match['innings']>['first'] | undefined;
  battingTeamName: string;
  bowlingTeamName: string;
}): OverlayInningsCard | null {
  const inn = params.inn;
  if (!inn) return null;
  return inningsCardFromParts({
    teamName: params.battingTeamName,
    bowlingTeamName: params.bowlingTeamName,
    runs: inn.runs || 0,
    wickets: inn.wickets || 0,
    overs: inn.overs || 0,
    balls: inn.balls || 0,
    battingRows: toOverlayBatterRows(inn.batting),
    bowlingRows: toOverlayBowlerRows(inn.bowling),
    extras: extrasFromInn(inn.extras),
  });
}

export function buildOverlayModel(input: {
  teamAName: string;
  teamBName: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  strikerName?: string;
  strikerRuns?: number;
  strikerBalls?: number;
  strikerFours?: number;
  strikerSixes?: number;
  nonStrikerName?: string;
  nonStrikerRuns?: number;
  nonStrikerBalls?: number;
  nonStrikerFours?: number;
  nonStrikerSixes?: number;
  bowlerName?: string;
  bowlerOvers?: number;
  bowlerBalls?: number;
  bowlerRuns?: number;
  bowlerWickets?: number;
  battingTeamName?: string;
  bowlingTeamName?: string;
  battingTeamLogo?: string;
  bowlingTeamLogo?: string;
  ballLog?: string[];
  ballsPerOver?: number;
  inningsNumber?: number;
  chaseTarget?: number;
  inningsOversLimit?: number;
  battingCard?: BatterCardEntry[];
  bowlingFigures?: Record<string, BowlerFigure>;
  battingRows?: OverlayBatterRow[];
  bowlingRows?: OverlayBowlerRow[];
  extras?: OverlayExtras | null;
  firstInnings?: OverlayInningsCard | null;
  secondInnings?: OverlayInningsCard | null;
  matchResult?: string;
  playerOfMatch?: string;
}): ScoreboardOverlayModel {
  const bpo = input.ballsPerOver || 6;
  const inningsNumber: 1 | 2 = input.inningsNumber === 2 ? 2 : 1;
  const chasing = inningsNumber === 2 && input.chaseTarget != null;
  const faced = (input.overs || 0) * bpo + (input.balls || 0);
  const totalBalls = (input.inningsOversLimit || 0) * bpo;

  let battingRows = input.battingRows || [];
  if (!battingRows.length && (input.battingCard || input.strikerName || input.nonStrikerName)) {
    battingRows = toOverlayBatterRows(
      buildLiveBattingCard({
        dismissed: input.battingCard || [],
        strikerName: input.strikerName || '',
        nonStrikerName: input.nonStrikerName || '',
        strikerRuns: input.strikerRuns || 0,
        strikerBalls: input.strikerBalls || 0,
        strikerFours: input.strikerFours || 0,
        strikerSixes: input.strikerSixes || 0,
        nonStrikerRuns: input.nonStrikerRuns || 0,
        nonStrikerBalls: input.nonStrikerBalls || 0,
        nonStrikerFours: input.nonStrikerFours || 0,
        nonStrikerSixes: input.nonStrikerSixes || 0,
        players: [],
      }),
      input.strikerName,
    );
  }

  let bowlingRows = input.bowlingRows || [];
  if (!bowlingRows.length && input.bowlingFigures) {
    bowlingRows = toOverlayBowlerRows(
      buildBowlingFromFigures(input.bowlingFigures, []),
      input.bowlerName,
    );
  }

  const currentCard = inningsCardFromParts({
    teamName: input.battingTeamName || input.teamAName,
    bowlingTeamName: input.bowlingTeamName || input.teamBName,
    runs: input.runs,
    wickets: input.wickets,
    overs: input.overs,
    balls: input.balls,
    battingRows,
    bowlingRows,
    extras: input.extras ?? null,
  });

  const firstInnings =
    input.firstInnings ?? (inningsNumber === 1 ? currentCard : null);
  const secondInnings =
    input.secondInnings ?? (inningsNumber === 2 ? currentCard : null);

  return {
    teamAName: shortName(input.teamAName, 16),
    teamBName: shortName(input.teamBName, 16),
    runs: input.runs,
    wickets: input.wickets,
    overs: input.overs,
    balls: input.balls,
    strikerName: shortName(input.strikerName, 18),
    strikerRuns: input.strikerRuns || 0,
    strikerBalls: input.strikerBalls || 0,
    nonStrikerName: shortName(input.nonStrikerName, 18),
    nonStrikerRuns: input.nonStrikerRuns || 0,
    nonStrikerBalls: input.nonStrikerBalls || 0,
    bowlerName: shortName(input.bowlerName, 16),
    bowlerFigures: `${input.bowlerWickets || 0}-${input.bowlerRuns || 0}`,
    bowlerOvers: `${input.bowlerOvers || 0}.${input.bowlerBalls || 0}`,
    battingTeamName: shortName(input.battingTeamName || input.teamAName, 18),
    bowlingTeamName: shortName(input.bowlingTeamName || input.teamBName, 14),
    battingTeamLogo: input.battingTeamLogo,
    bowlingTeamLogo: input.bowlingTeamLogo,
    thisOver: currentOverLabels(input.ballLog, bpo),
    chase: chasing
      ? {
          target: input.chaseTarget as number,
          need: Math.max(0, (input.chaseTarget as number) - input.runs),
          ballsLeft: Math.max(0, totalBalls - faced),
        }
      : null,
    battingRows,
    bowlingRows,
    extras: input.extras ?? null,
    inningsNumber,
    firstInnings,
    secondInnings,
    matchSummary: {
      inn1: summaryFromCard(firstInnings),
      inn2: summaryFromCard(secondInnings),
      result: input.matchResult,
      playerOfMatch: input.playerOfMatch,
    },
  };
}

export function overlayModelFromMatch(match: Match): ScoreboardOverlayModel {
  const inningsNumber: 1 | 2 = match.currentInnings === 2 ? 2 : 1;
  const inn = inningsNumber === 2 ? match.innings?.second : match.innings?.first;
  const session = match.liveScoring;
  const bpo = legalBallsPerOver(resolveMatchSettings(match));

  const battingFromInn = toOverlayBatterRows(inn?.batting, session?.strikerName);
  const bowlingFromInn = toOverlayBowlerRows(inn?.bowling, session?.bowlerName);

  const firstBattingName = (() => {
    const id = match.innings?.first?.battingTeam;
    if (id === match.teamB) return match.teamBName;
    if (id === match.teamA) return match.teamAName;
    if (inningsNumber === 2) {
      return session?.battingTeam === 'B' ? match.teamAName : match.teamBName;
    }
    return session?.battingTeam === 'B' ? match.teamBName : match.teamAName;
  })();
  const firstBowlingName = firstBattingName === match.teamAName ? match.teamBName : match.teamAName;
  const secondBattingName = firstBattingName === match.teamAName ? match.teamBName : match.teamAName;
  const secondBowlingName = firstBattingName;

  const firstInnings = inningsCardFromMatchInn({
    inn: match.innings?.first,
    battingTeamName: firstBattingName,
    bowlingTeamName: firstBowlingName,
  });

  let secondInnings = inningsCardFromMatchInn({
    inn: match.innings?.second,
    battingTeamName: secondBattingName,
    bowlingTeamName: secondBowlingName,
  });

  if (inningsNumber === 2) {
    secondInnings = inningsCardFromParts({
      teamName: session?.battingTeam === 'B' ? match.teamBName : match.teamAName,
      bowlingTeamName: session?.battingTeam === 'B' ? match.teamAName : match.teamBName,
      runs: inn?.runs || 0,
      wickets: inn?.wickets || 0,
      overs: inn?.overs || 0,
      balls: inn?.balls || 0,
      battingRows: battingFromInn.length
        ? battingFromInn
        : toOverlayBatterRows(
            buildLiveBattingCard({
              dismissed: (session?.battingCard as BatterCardEntry[]) || [],
              strikerName: session?.strikerName || '',
              nonStrikerName: session?.nonStrikerName || '',
              strikerRuns: session?.strikerRuns || 0,
              strikerBalls: session?.strikerBalls || 0,
              strikerFours: session?.strikerFours || 0,
              strikerSixes: session?.strikerSixes || 0,
              nonStrikerRuns: session?.nonStrikerRuns || 0,
              nonStrikerBalls: session?.nonStrikerBalls || 0,
              nonStrikerFours: session?.nonStrikerFours || 0,
              nonStrikerSixes: session?.nonStrikerSixes || 0,
              players: [],
            }),
            session?.strikerName,
          ),
      bowlingRows: bowlingFromInn.length
        ? bowlingFromInn
        : toOverlayBowlerRows(
            buildBowlingFromFigures(session?.bowlingFigures || {}, []),
            session?.bowlerName,
          ),
      extras: extrasFromInn(inn?.extras),
    });
  }

  return buildOverlayModel({
    teamAName: match.teamAName,
    teamBName: match.teamBName,
    runs: inn?.runs || 0,
    wickets: inn?.wickets || 0,
    overs: inn?.overs || 0,
    balls: inn?.balls || 0,
    strikerName: session?.strikerName,
    strikerRuns: session?.strikerRuns,
    strikerBalls: session?.strikerBalls,
    strikerFours: session?.strikerFours,
    strikerSixes: session?.strikerSixes,
    nonStrikerName: session?.nonStrikerName,
    nonStrikerRuns: session?.nonStrikerRuns,
    nonStrikerBalls: session?.nonStrikerBalls,
    nonStrikerFours: session?.nonStrikerFours,
    nonStrikerSixes: session?.nonStrikerSixes,
    bowlerName: session?.bowlerName,
    bowlerOvers: session?.bowlerOvers,
    bowlerBalls: session?.bowlerBalls,
    bowlerRuns: session?.bowlerRuns,
    bowlerWickets: session?.bowlerWickets,
    battingTeamName: session?.battingTeam === 'B' ? match.teamBName : match.teamAName,
    bowlingTeamName: session?.battingTeam === 'B' ? match.teamAName : match.teamBName,
    battingTeamLogo: session?.battingTeam === 'B' ? match.teamBLogo : match.teamALogo,
    bowlingTeamLogo: session?.battingTeam === 'B' ? match.teamALogo : match.teamBLogo,
    ballLog: session?.ballLog,
    ballsPerOver: bpo,
    inningsNumber,
    chaseTarget: inningsNumber === 2 ? getChaseTarget(match) : undefined,
    inningsOversLimit: getEffectiveOvers(match, inningsNumber),
    battingCard: session?.battingCard as BatterCardEntry[] | undefined,
    bowlingFigures: session?.bowlingFigures,
    battingRows: battingFromInn.length ? battingFromInn : undefined,
    bowlingRows: bowlingFromInn.length ? bowlingFromInn : undefined,
    extras: extrasFromInn(inn?.extras),
    firstInnings,
    secondInnings,
    matchResult: match.result,
    playerOfMatch: match.playerOfMatch,
  });
}

const BAR = {
  // Soft ivory panels + graphite center + emerald badges (not app maroon)
  side: '#FAF8F5',
  sideAlt: '#F1EEE8',
  center: ['#1A2332', '#2A3548'] as string[],
  ink: '#1A2332',
  inkMuted: '#667085',
  accent: '#0F766E',
  accentSoft: '#D8EDE9',
  gold: ['#D4B06A', '#B08A3E'] as string[],
  chipBg: '#EAE6DF',
  chipInk: '#1A2332',
  /** Broadcast TV-style segments (no player photos). */
  segScore: '#9A861F',
  segBatter: '#5C5A18',
  segBatterAlt: '#6B691C',
  segTarget: '#0B0B0B',
  segBowler: '#9B0A66',
};

/** First letter of each of the first up to 3 words (e.g. "Black Lions XI" → "BLX"). */
function teamCode(name: string | undefined): string {
  const parts = String(name || '')
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) {
    return parts[0].slice(0, Math.min(3, parts[0].length)).toUpperCase();
  }
  return parts
    .slice(0, 3)
    .map(part => (part[0] || '').toUpperCase())
    .join('');
}

/** Two-letter initials: first letter of first word + first letter of second word. */
function teamInitials(name: string | undefined): string {
  const parts = String(name || '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (!parts.length) return 'TM';
  if (parts.length === 1) {
    const w = parts[0];
    return (w.length >= 2 ? w.slice(0, 2) : `${w}${w}`).toUpperCase();
  }
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function shortTeamTag(name: string | undefined): string {
  return teamCode(name);
}

function firstNameOnly(name: string | undefined): string {
  const n = String(name || '').trim();
  if (!n || n === '—') return '—';
  return (n.split(/\s+/)[0] || n).toUpperCase();
}

function OverlayTeamInitials({ name, size }: { name: string; size: number }) {
  const letters = teamInitials(name);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1A2332',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.35)',
      }}>
      <Text
        style={{
          color: '#FFFFFF',
          fontWeight: '900',
          fontSize: Math.max(10, Math.round(size * 0.36)),
          letterSpacing: 0.5,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}>
        {letters}
      </Text>
    </View>
  );
}

function OverlayTeamLogo({
  name,
  logoURL,
  size = 44,
  ring = true,
}: {
  name: string;
  logoURL?: string;
  size?: number;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const uri = (logoURL || '').trim();
  const hasRealLogo =
    !!uri &&
    !failed &&
    !isBundledCricketLogo(uri) &&
    (isCustomUploadedLogo(uri) ||
      uri.startsWith('file:') ||
      uri.startsWith('content:') ||
      uri.startsWith('ph://') ||
      uri.startsWith('/'));
  const innerSize = ring ? size - 4 : size;
  const avatar = hasRealLogo ? (
    <Image
      source={{ uri }}
      style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2, backgroundColor: '#E5E7EB' }}
      onError={() => setFailed(true)}
    />
  ) : (
    <OverlayTeamInitials name={name || 'Team'} size={innerSize} />
  );

  if (!ring) {
    return <View style={[styles.teamCircleWrap, { width: size, height: size }]}>{avatar}</View>;
  }
  return (
    <View style={[styles.teamCircleWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <LinearGradient
        colors={['#F5E6A8', '#D4B06A']}
        style={[styles.teamCircleRing, { width: size, height: size, borderRadius: size / 2, padding: 2 }]}>
        <View style={{ borderRadius: (size - 4) / 2, overflow: 'hidden' }}>{avatar}</View>
      </LinearGradient>
    </View>
  );
}

function BroadcastBatterCard({
  onStrike,
  name,
  runs,
  balls,
  alt,
  compact,
  bg,
  forStream,
}: {
  onStrike?: boolean;
  name: string;
  runs: number;
  balls: number;
  alt?: boolean;
  compact?: boolean;
  bg?: string;
  forStream?: boolean;
}) {
  const stream = !!forStream && !compact;
  return (
    <View
      style={[
        styles.bbBatter,
        compact && styles.bbBatterCompact,
        stream && styles.bbBatterStream,
        alt && styles.bbBatterAlt,
        onStrike && styles.bbBatterOn,
        bg ? { backgroundColor: bg } : null,
      ]}>
      <Text
        style={[
          styles.bbBatterName,
          compact && styles.bbBatterNameCompact,
          stream && styles.bbBatterNameStream,
        ]}
        numberOfLines={1}>
        {firstNameOnly(name)}
        {onStrike ? '*' : ''}
      </Text>
      <Text
        style={[
          styles.bbBatterStats,
          compact && styles.bbBatterStatsCompact,
          stream && styles.bbBatterStatsStream,
        ]}>
        {runs} ({balls})
      </Text>
    </View>
  );
}

function BroadcastOverPills({
  balls,
  compact,
  forStream,
}: {
  balls: string[];
  compact?: boolean;
  forStream?: boolean;
}) {
  const stream = !!forStream && !compact;
  return (
    <View style={[styles.bbOverRow, compact && styles.bbOverRowCompact, stream && styles.bbOverRowStream]}>
      {balls.length === 0 ? (
        <Text style={[styles.bbOverEmpty, compact && { fontSize: 10 }, stream && { fontSize: 14 }]}>—</Text>
      ) : (
        balls.slice(-6).map((ball, i) => {
          const key = ball.toLowerCase();
          const six = key === '6';
          const four = key === '4';
          const wicket = key === 'w' || key.startsWith('w+');
          const dot = key === '0' || key === '.' || key === '•';
          const wideOrNb = key.startsWith('wd') || key.startsWith('nb');
          let label = displayBall(ball);
          if (dot) label = '·';
          if (wicket) label = 'W';
          return (
            <View
              key={`${ball}-${i}`}
              style={[
                styles.bbOverPill,
                compact && styles.bbOverPillCompact,
                stream && styles.bbOverPillStream,
                four && styles.bbOverFour,
                six && styles.bbOverSix,
                wicket && styles.bbOverWicket,
                wideOrNb && styles.bbOverExtra,
                dot && styles.bbOverDot,
              ]}>
              <Text
                style={[
                  styles.bbOverPillText,
                  compact && styles.bbOverPillTextCompact,
                  stream && styles.bbOverPillTextStream,
                ]}>
                {label}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function LandscapeBar({
  model,
  forStream,
  compact,
  theme,
}: {
  model: ScoreboardOverlayModel;
  badgeDim?: number;
  forStream?: boolean;
  compact?: boolean;
  theme: ScorebarTheme;
}) {
  const batTag = shortTeamTag(model.battingTeamName);
  const bowlTag = shortTeamTag(model.bowlingTeamName);
  const oversLabel = `${model.overs}.${model.balls}`;
  const targetValue = model.chase?.target;
  const stream = !!forStream && !compact;
  const logoSize = compact ? 22 : stream ? 44 : 36;
  const c = theme.classic;

  return (
    <View style={[styles.shell, forStream && styles.shellStream, { backgroundColor: c.segScore }]} collapsable={false}>
      <View style={[styles.bar, compact && styles.barCompact, stream && styles.barStream]}>
        <View style={[styles.bbScoreSeg, compact && styles.bbScoreSegCompact, { backgroundColor: c.segScore }]}>
          <OverlayTeamLogo
            name={model.battingTeamName}
            logoURL={model.battingTeamLogo}
            size={logoSize}
          />
          <View style={styles.bbScoreText}>
            {!compact && (
              <Text style={[styles.bbMatchup, stream && styles.bbMatchupStream, { color: c.textMuted }]} numberOfLines={1}>
                {batTag} vs {bowlTag}
              </Text>
            )}
            <Text
              style={[
                styles.bbScoreLine,
                compact && styles.bbScoreLineCompact,
                stream && styles.bbScoreLineStream,
                { color: c.text },
              ]}>
              {model.runs}-{model.wickets}
            </Text>
            <Text
              style={[
                styles.bbOversLine,
                compact && styles.bbOversLineCompact,
                stream && styles.bbOversLineStream,
                { color: c.textMuted },
              ]}>
              {oversLabel}
            </Text>
          </View>
        </View>

        <BroadcastBatterCard
          onStrike
          compact={compact}
          forStream={forStream}
          name={model.strikerName}
          runs={model.strikerRuns}
          balls={model.strikerBalls}
          bg={c.segBatter}
        />
        <BroadcastBatterCard
          compact={compact}
          forStream={forStream}
          name={model.nonStrikerName}
          runs={model.nonStrikerRuns}
          balls={model.nonStrikerBalls}
          alt
          bg={c.segBatterAlt}
        />

        <View style={[styles.bbTargetSeg, compact && styles.bbTargetSegCompact, stream && styles.bbTargetSegStream, { backgroundColor: c.segTarget }]}>
          {typeof targetValue === 'number' ? (
            <>
              <Text style={[styles.bbTargetLabel, compact && styles.bbTargetLabelCompact, stream && styles.bbTargetLabelStream]}>
                TARGET
              </Text>
              <Text style={[styles.bbTargetValue, compact && styles.bbTargetValueCompact, stream && styles.bbTargetValueStream]}>
                {targetValue}
              </Text>
              {!!model.chase && !compact && (
                <Text style={[styles.bbTargetNeed, stream && styles.bbTargetNeedStream]} numberOfLines={1}>
                  {model.chase.need} off {model.chase.ballsLeft}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={[styles.bbTargetLabel, compact && styles.bbTargetLabelCompact, stream && styles.bbTargetLabelStream]}>
                VS
              </Text>
              <Text
                style={[
                  styles.bbTargetValueSmall,
                  compact && styles.bbTargetValueSmallCompact,
                  stream && styles.bbTargetValueSmallStream,
                ]}
                numberOfLines={1}>
                {bowlTag}
              </Text>
            </>
          )}
        </View>

        <View style={[styles.bbBowlerSeg, compact && styles.bbBowlerSegCompact, { backgroundColor: c.segBowler }]}>
          <View style={styles.bbBowlerMain}>
            <Text
              style={[styles.bbBowlerName, compact && styles.bbBowlerNameCompact, stream && styles.bbBowlerNameStream]}
              numberOfLines={1}>
              {firstNameOnly(model.bowlerName)}
            </Text>
            <Text style={[styles.bbBowlerFigs, compact && styles.bbBowlerFigsCompact, stream && styles.bbBowlerFigsStream]}>
              {model.bowlerFigures}  {model.bowlerOvers}
            </Text>
            <BroadcastOverPills balls={model.thisOver} compact={compact} forStream={forStream} />
          </View>
          <OverlayTeamLogo
            name={model.bowlingTeamName}
            logoURL={model.bowlingTeamLogo}
            size={logoSize}
          />
        </View>
      </View>
      <ScorebarEventBurst
        thisOver={model.thisOver}
        strikerName={model.strikerName}
        bowlerName={model.bowlerName}
        forStream={forStream}
      />
    </View>
  );
}

function ChaseLandscapeBar({
  model,
  forStream,
  compact,
  theme,
}: {
  model: ScoreboardOverlayModel;
  forStream?: boolean;
  compact?: boolean;
  theme: ScorebarTheme;
}) {
  const ch = theme.chase;
  const team = (model.battingTeamName || model.teamAName || '').trim().toUpperCase() || 'BATTING';
  const need = model.chase?.need;
  const ballsLeft = model.chase?.ballsLeft;
  const target = model.chase?.target;
  const oversLabel = `${model.overs}.${model.balls}`;
  const striker = (model.strikerName || '').trim();
  const nonStriker = (model.nonStrikerName || '').trim();
  const bowler = (model.bowlerName || '').trim();
  const stream = !!forStream && !compact;
  const logoSize = compact ? 20 : stream ? 40 : 30;

  return (
    <View style={[styles.shell, forStream && styles.shellStream, { backgroundColor: 'transparent' }]} collapsable={false}>
      <LinearGradient
        colors={ch.gradient}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.chaseBar, compact && styles.chaseBarCompact, stream && styles.chaseBarStream]}>
        <LinearGradient colors={ch.pill} style={[styles.chasePill, compact && styles.chasePillCompact, stream && styles.chasePillStream]}>
          <View style={styles.chasePillTop}>
            <OverlayTeamLogo
              name={model.battingTeamName || team}
              logoURL={model.battingTeamLogo}
              size={logoSize}
              ring={false}
            />
            <View style={styles.chasePillText}>
              <View style={styles.chasePillTitleRow}>
                <Text
                  style={[styles.chaseTeam, compact && styles.chaseTeamCompact, stream && styles.chaseTeamStream, { color: ch.ink }]}
                  numberOfLines={1}>
                  {team}
                </Text>
                <Text
                  style={[styles.chaseScore, compact && styles.chaseScoreCompact, stream && styles.chaseScoreStream, { color: ch.ink }]}>
                  {model.runs}-{model.wickets}
                </Text>
              </View>
              <Text style={[styles.chaseMeta, stream && styles.chaseMetaStream, { color: ch.inkSoft }]} numberOfLines={1}>
                {typeof target === 'number' ? `TARGET ${target}  ·  ${oversLabel} OV` : `${oversLabel} OV`}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.chaseBatters, compact && styles.chaseBattersCompact]}>
          <View style={styles.chaseBatterCol}>
            <Text
              style={[
                styles.chaseBatterName,
                compact && styles.chaseBatterNameCompact,
                stream && styles.chaseBatterNameStream,
                { color: ch.ink },
              ]}
              numberOfLines={1}>
              {striker ? `${firstNameOnly(striker).toUpperCase()}*` : '—'}
            </Text>
            <Text
              style={[
                styles.chaseBatterStats,
                compact && styles.chaseBatterStatsCompact,
                stream && styles.chaseBatterStatsStream,
                { color: ch.ink },
              ]}>
              {model.strikerRuns} ({model.strikerBalls})
            </Text>
          </View>
          <View style={[styles.chaseBatterDivider, { backgroundColor: ch.inkSoft }]} />
          <View style={styles.chaseBatterCol}>
            <Text
              style={[
                styles.chaseBatterName,
                compact && styles.chaseBatterNameCompact,
                stream && styles.chaseBatterNameStream,
                { color: ch.ink },
              ]}
              numberOfLines={1}>
              {nonStriker ? firstNameOnly(nonStriker).toUpperCase() : '—'}
            </Text>
            <Text
              style={[
                styles.chaseBatterStats,
                compact && styles.chaseBatterStatsCompact,
                stream && styles.chaseBatterStatsStream,
                { color: ch.ink },
              ]}>
              {model.nonStrikerRuns} ({model.nonStrikerBalls})
            </Text>
          </View>
          <View style={styles.chaseThisOver}>
            <Text style={[styles.chaseBowlerLabel, stream && styles.chaseBowlerLabelStream, { color: ch.inkSoft }]}>BALLS</Text>
            <View style={styles.chaseOverRow}>
              {Array.from({ length: 6 }).map((_, i) => {
                const ball = model.thisOver[i];
                return (
                  <View
                    key={`co-${i}`}
                    style={[
                      styles.chaseOverDot,
                      stream && styles.chaseOverDotStream,
                      {
                        backgroundColor: ball ? 'rgba(16,36,16,0.88)' : 'rgba(16,36,16,0.18)',
                      },
                    ]}>
                    {!!ball && (
                      <Text style={[styles.chaseOverDotText, stream && styles.chaseOverDotTextStream]}>
                        {displayBall(ball).slice(0, 2)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {typeof need === 'number' && typeof ballsLeft === 'number' ? (
          <View style={styles.chaseReq}>
            <OverlayTeamLogo
              name={model.bowlingTeamName}
              logoURL={model.bowlingTeamLogo}
              size={compact ? 22 : stream ? 36 : 28}
              ring={false}
            />
            <View style={styles.chaseMid}>
              <Text
                style={[styles.chaseNeedNum, compact && styles.chaseNeedNumCompact, stream && styles.chaseNeedNumStream, { color: ch.ink }]}>
                {need}
              </Text>
              <Text style={[styles.chaseNeedLabel, stream && styles.chaseNeedLabelStream, { color: ch.ink }]}>RUNS</Text>
            </View>
            <Text style={[styles.chaseNeededFrom, stream && styles.chaseNeededFromStream, { color: ch.inkSoft }]}>
              NEEDED{'\n'}FROM
            </Text>
            <View style={styles.chaseMid}>
              <Text
                style={[
                  styles.chaseBallsNum,
                  compact && styles.chaseBallsNumCompact,
                  stream && styles.chaseBallsNumStream,
                  { color: ch.ink },
                ]}>
                {ballsLeft}
              </Text>
              <Text style={[styles.chaseBallsLabel, stream && styles.chaseBallsLabelStream, { color: ch.ink }]}>BALLS</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.chaseBowlerBlock, compact && styles.chaseBowlerBlockCompact]}>
            <OverlayTeamLogo
              name={model.bowlingTeamName}
              logoURL={model.bowlingTeamLogo}
              size={compact ? 22 : stream ? 36 : 28}
              ring={false}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.chaseBowlerLabel, stream && styles.chaseBowlerLabelStream, { color: ch.inkSoft }]}>BOWLER</Text>
              <Text
                style={[
                  styles.chaseBatterName,
                  compact && styles.chaseBatterNameCompact,
                  stream && styles.chaseBatterNameStream,
                  { color: ch.ink },
                ]}
                numberOfLines={1}>
                {bowler ? firstNameOnly(bowler).toUpperCase() : '—'}
              </Text>
              <Text
                style={[
                  styles.chaseBatterStats,
                  compact && styles.chaseBatterStatsCompact,
                  stream && styles.chaseBatterStatsStream,
                  { color: ch.ink },
                ]}>
                {model.bowlerFigures} ({model.bowlerOvers})
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>
      <ScorebarEventBurst
        thisOver={model.thisOver}
        strikerName={model.strikerName}
        bowlerName={model.bowlerName}
        forStream={forStream}
      />
    </View>
  );
}

function AngularLandscapeBar({
  model,
  forStream,
  compact,
  theme,
}: {
  model: ScoreboardOverlayModel;
  forStream?: boolean;
  compact?: boolean;
  theme: ScorebarTheme;
}) {
  const a = theme.angular;
  const faced = Math.max(1, model.overs * 6 + model.balls);
  const remainingBalls = model.chase?.ballsLeft;
  const projected =
    typeof remainingBalls === 'number'
      ? Math.round((model.runs / faced) * (faced + remainingBalls))
      : model.runs;
  const striker = (model.strikerName || '').trim();
  const nonStriker = (model.nonStrikerName || '').trim();
  const bowler = (model.bowlerName || '').trim();
  const stream = !!forStream && !compact;
  const logoSize = compact ? 24 : stream ? 42 : 30;

  return (
    <View style={[styles.shell, forStream && styles.shellStream, { backgroundColor: 'transparent' }]} collapsable={false}>
      <View style={[styles.angularWrap, compact && styles.angularWrapCompact]}>
        <View style={[styles.angularTop, stream && styles.angularTopStream]}>
          <View style={[styles.angularWing, styles.angularWingLeft, stream && styles.angularWingStream, { backgroundColor: a.orange }]}>
            <Text style={[styles.angularPlayer, stream && styles.angularPlayerStream, { color: a.ink }]} numberOfLines={1}>
              {striker ? `${firstNameOnly(striker).toUpperCase()}*` : '—'}
            </Text>
            <Text style={[styles.angularPlayerStats, stream && styles.angularPlayerStatsStream, { color: a.ink }]}>
              {model.strikerRuns} ({model.strikerBalls})*
            </Text>
          </View>

          <View style={[styles.angularCenter, { backgroundColor: a.white }]}>
            <OverlayTeamLogo
              name={model.battingTeamName}
              logoURL={model.battingTeamLogo}
              size={logoSize}
              ring={false}
            />
            <Text
              style={[
                styles.angularMainScore,
                compact && styles.angularMainScoreCompact,
                stream && styles.angularMainScoreStream,
                { color: a.ink },
              ]}>
              {model.runs}-{model.wickets}/{model.overs}.{model.balls}
            </Text>
            <OverlayTeamLogo
              name={model.bowlingTeamName}
              logoURL={model.bowlingTeamLogo}
              size={logoSize}
              ring={false}
            />
          </View>

          <View style={[styles.angularWing, styles.angularWingRight, stream && styles.angularWingStream, { backgroundColor: a.orange }]}>
            <Text
              style={[styles.angularPlayer, styles.angularPlayerRight, stream && styles.angularPlayerStream, { color: a.ink }]}
              numberOfLines={1}>
              {nonStriker ? firstNameOnly(nonStriker).toUpperCase() : '—'}
            </Text>
            <Text
              style={[
                styles.angularPlayerStats,
                styles.angularPlayerRight,
                stream && styles.angularPlayerStatsStream,
                { color: a.ink },
              ]}>
              {model.nonStrikerRuns} ({model.nonStrikerBalls})
            </Text>
          </View>
        </View>

        <View style={[styles.angularBottom, stream && styles.angularBottomStream, { backgroundColor: a.orangeDeep }]}>
          <View style={styles.angularOverCol}>
            <Text style={[styles.angularBottomLabel, stream && styles.angularBottomLabelStream, { color: a.ink }]}>
              This Over
            </Text>
            <View style={styles.angularOverRow}>
              {Array.from({ length: 6 }).map((_, i) => {
                const ball = model.thisOver[i];
                return (
                  <View
                    key={`ao-${i}`}
                    style={[
                      styles.angularOverDot,
                      stream && styles.angularOverDotStream,
                      { backgroundColor: ball ? a.white : 'rgba(255,255,255,0.35)' },
                    ]}>
                    {!!ball && (
                      <Text style={[styles.angularOverDotText, stream && styles.angularOverDotTextStream, { color: a.ink }]}>
                        {displayBall(ball).slice(0, 2)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
          <View style={[styles.angularProjected, { backgroundColor: a.orange }]}>
            <Text style={[styles.angularProjectedText, stream && styles.angularProjectedTextStream, { color: a.ink }]}>
              {typeof remainingBalls === 'number'
                ? `PROJECTED SCORE: ${Number.isFinite(projected) ? projected : model.runs}`
                : model.chase
                  ? `NEED ${model.chase.need} OFF ${model.chase.ballsLeft}`
                  : `SCORE ${model.runs}-${model.wickets}`}
            </Text>
          </View>
          <View style={styles.angularBowlerCol}>
            <Text
              style={[styles.angularBowlerName, stream && styles.angularBowlerNameStream, { color: a.ink }]}
              numberOfLines={1}>
              {bowler ? firstNameOnly(bowler).toUpperCase() : '—'}
            </Text>
            <Text style={[styles.angularBowlerFigs, stream && styles.angularBowlerFigsStream, { color: a.ink }]}>
              {model.bowlerFigures} ({model.bowlerOvers})
            </Text>
          </View>
        </View>
      </View>
      <ScorebarEventBurst
        thisOver={model.thisOver}
        strikerName={model.strikerName}
        bowlerName={model.bowlerName}
        forStream={forStream}
      />
    </View>
  );
}

function PortraitBar({
  model,
  forStream,
}: {
  model: ScoreboardOverlayModel;
  badgeDim?: number;
  forStream?: boolean;
}) {
  const batTag = shortTeamTag(model.battingTeamName);
  const bowlTag = shortTeamTag(model.bowlingTeamName);
  const oversLabel = `${model.overs}.${model.balls}`;
  const targetValue = model.chase?.target;

  return (
    <View style={[styles.shell, forStream && styles.shellStream]} collapsable={false}>
      <View style={styles.bbPortraitCol}>
        <View style={styles.bbScoreSegPortrait}>
          <OverlayTeamLogo name={model.battingTeamName} logoURL={model.battingTeamLogo} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.bbMatchup} numberOfLines={1}>
              {batTag} vs {bowlTag}
            </Text>
            <Text style={styles.bbScoreLine}>
              {model.runs}-{model.wickets}{' '}
              <Text style={styles.bbOversLine}>{oversLabel}</Text>
            </Text>
          </View>
          <View style={styles.bbTargetSegPortrait}>
            {typeof targetValue === 'number' ? (
              <>
                <Text style={styles.bbTargetLabel}>TARGET</Text>
                <Text style={styles.bbTargetValue}>{targetValue}</Text>
              </>
            ) : (
              <Text style={styles.bbTargetValueSmall}>{bowlTag}</Text>
            )}
          </View>
        </View>
        <View style={styles.bbPortraitMid}>
          <BroadcastBatterCard
            onStrike
            name={model.strikerName}
            runs={model.strikerRuns}
            balls={model.strikerBalls}
          />
          <BroadcastBatterCard
            name={model.nonStrikerName}
            runs={model.nonStrikerRuns}
            balls={model.nonStrikerBalls}
            alt
          />
        </View>
        <View style={styles.bbBowlerSegPortrait}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.bbBowlerName} numberOfLines={1}>
              {firstNameOnly(model.bowlerName)}  {model.bowlerFigures}  {model.bowlerOvers}
            </Text>
            <BroadcastOverPills balls={model.thisOver} />
          </View>
          <OverlayTeamLogo name={model.bowlingTeamName} logoURL={model.bowlingTeamLogo} size={36} />
        </View>
      </View>
      <ScorebarEventBurst
        thisOver={model.thisOver}
        strikerName={model.strikerName}
        bowlerName={model.bowlerName}
        forStream={forStream}
        compact
      />
    </View>
  );
}

/** Scorecard panels keep a matching graphite accent (not app maroon). */
const MAROON = ['#1A2332', '#2A3548'];
const MAROON_RICH = ['#243041', '#1A2332'];
const GOLD = BAR.gold;

function ThisOverBlock({ balls, compact, onGold }: { balls: string[]; compact?: boolean; onGold?: boolean }) {
  return (
    <View style={[styles.overBlock, compact && styles.overBlockCompact]}>
      <Text style={[styles.overLabel, onGold && styles.overLabelOnGold]}>THIS OVER</Text>
      <View style={styles.overRow}>
        {balls.length === 0 ? (
          <Text style={[styles.overEmpty, onGold && styles.overEmptyOnGold]}>—</Text>
        ) : (
          balls.map((ball, i) => {
            const tone = ballTone(ball);
            return (
              <View
                key={`${ball}-${i}`}
                style={[
                  styles.overChip,
                  compact && styles.overChipCompact,
                  { backgroundColor: onGold ? 'rgba(0,22,43,0.14)' : tone.bg },
                ]}>
                <Text style={[styles.overChipText, compact && styles.overChipTextCompact, { color: onGold ? Colors.onPrimary : tone.fg }]}>
                  {displayBall(ball)}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

function BowlerBlock({ model, compact }: { model: ScoreboardOverlayModel; compact?: boolean }) {
  return (
    <View style={[styles.bowlerInner, compact && { gap: 1 }]}>
      <Text style={styles.bowlerLabel}>BOWLING</Text>
      <Text style={styles.bowlerName} numberOfLines={compact ? 2 : 1}>{model.bowlerName}</Text>
      <View style={styles.bowlerFiguresRow}>
        <Text style={styles.bowlerFigures}>{model.bowlerFigures}</Text>
        <Text style={styles.bowlerOvers}>({model.bowlerOvers})</Text>
      </View>
    </View>
  );
}

function ScoreBadge({
  runs,
  wickets,
  overs,
  balls,
  dim,
}: {
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  dim: number;
}) {
  const ring = Math.max(2, Math.round(dim * 0.055));
  const inner = Math.max(1, dim - ring * 2);
  const scoreSize = Math.round(dim * 0.34);
  const oversSize = Math.round(dim * 0.20);
  return (
    <View style={[styles.badgeSlot, { width: dim, height: dim }]} collapsable={false}>
      <LinearGradient
        colors={GOLD}
        style={[styles.badgeRing, { width: dim, height: dim, borderRadius: dim / 2, padding: ring }]}>
        <LinearGradient
          colors={MAROON}
          style={[styles.badgeInner, { width: inner, height: inner, borderRadius: inner / 2 }]}>
          <Text
            style={[styles.badgeScore, { fontSize: scoreSize, lineHeight: scoreSize + 2 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}>
            {runs}-{wickets}
          </Text>
          <Text style={[styles.badgeOvers, { fontSize: oversSize, lineHeight: oversSize + 2 }]}>
            {overs}.{balls}
          </Text>
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

function GoldRule() {
  return <LinearGradient colors={GOLD} style={styles.goldRule} />;
}

function ChaseLine({ chase }: { chase: OverlayChase }) {
  return (
    <Text style={styles.chaseText} numberOfLines={1}>
      TARGET {chase.target}   NEED {chase.need} FROM {chase.ballsLeft}
    </Text>
  );
}

function formatOvers(overs: number): string {
  if (Number.isInteger(overs)) return String(overs);
  return overs.toFixed(1).replace(/\.0$/, '');
}

/** Align batting / bowling / summary cards with Classic bar segment colors. */
function themeForPanel(
  theme: ScorebarTheme,
  kind: 'batting' | 'bowling' | 'summary' | 'innings1',
): ScorebarTheme {
  if (theme.id !== 'classic') return theme;
  const c = theme.classic;
  if (kind === 'bowling') {
    return {
      ...theme,
      panel: {
        ...theme.panel,
        side: '#F9EAF2',
        sideAlt: '#F0D6E4',
        center: [c.segBowler, '#6B0848'],
        ink: '#2A0618',
        inkMuted: '#7A4060',
        accent: c.segBowler,
        accentSoft: '#F3D0E2',
        gold: ['#E8A0C8', c.segBowler],
        chipBg: '#F0D6E4',
        chipInk: '#2A0618',
        chaseText: '#FFF5FA',
      },
    };
  }
  if (kind === 'summary') {
    return {
      ...theme,
      panel: {
        ...theme.panel,
        side: '#F6F3E0',
        sideAlt: '#EBE6C4',
        center: [c.segTarget, c.segBowler],
        ink: '#1C1A08',
        inkMuted: '#5A5730',
        accent: c.segScore,
        accentSoft: '#E8E2B0',
        gold: ['#D4B06A', c.segScore],
        chipBg: '#E4DEAE',
        chipInk: '#1C1A08',
        chaseText: '#FFFDF2',
      },
    };
  }
  // batting + 1st innings → olive batter / score segments
  return {
    ...theme,
    panel: {
      ...theme.panel,
      side: '#F6F3E0',
      sideAlt: '#EBE6C4',
      center: [c.segBatter, c.segScore],
      ink: '#1C1A08',
      inkMuted: '#5A5730',
      accent: c.segScore,
      accentSoft: '#E8E2B0',
      gold: ['#D4B06A', c.segScore],
      chipBg: '#E4DEAE',
      chipInk: '#1C1A08',
      chaseText: '#FFFDF2',
    },
  };
}

function PremiumScorecardShell({
  eyebrow,
  teamName,
  model,
  children,
  footer,
  large,
  score,
  hideChase,
  theme,
}: {
  eyebrow: string;
  teamName: string;
  model: ScoreboardOverlayModel;
  children: React.ReactNode;
  footer?: React.ReactNode;
  large?: boolean;
  score?: { runs: number; wickets: number; overs: number; balls: number };
  hideChase?: boolean;
  theme: ScorebarTheme;
}) {
  const p = theme.panel;
  const runs = score?.runs ?? model.runs;
  const wickets = score?.wickets ?? model.wickets;
  const overs = score?.overs ?? model.overs;
  const balls = score?.balls ?? model.balls;
  return (
    <View style={[styles.premiumStage, large && styles.premiumStageLarge]} collapsable={false}>
      <LinearGradient
        colors={[p.side, p.sideAlt]}
        style={[styles.premiumInner, large && styles.premiumInnerLarge, { borderColor: p.accent + '33' }]}>
        <LinearGradient colors={[p.accent + '18', 'transparent']} style={styles.premiumSheen} />

        <View style={[styles.premiumHeader, large && styles.premiumHeaderLarge]}>
          <View style={styles.premiumTitleBlock}>
            <Text style={[styles.premiumEyebrow, large && styles.premiumEyebrowLarge, { color: p.accent }]}>{eyebrow}</Text>
            <Text style={[styles.premiumTeam, large && styles.premiumTeamLarge, { color: p.ink }]} numberOfLines={1}>
              {teamName}
            </Text>
            <Text style={[styles.premiumMatch, large && styles.premiumMatchLarge, { color: p.inkMuted }]} numberOfLines={1}>
              {model.teamAName} vs {model.teamBName}
            </Text>
          </View>
          <LinearGradient colors={p.center} style={[styles.premiumScorePill, large && styles.premiumScorePillLarge]}>
            <Text style={[styles.premiumScore, large && styles.premiumScoreLarge]}>
              {runs}-{wickets}
            </Text>
            <Text style={[styles.premiumOvers, large && styles.premiumOversLarge]}>
              {overs}.{balls} OV
            </Text>
          </LinearGradient>
        </View>

        <LinearGradient colors={[p.accent + '77', p.accent + '14']} style={styles.premiumRule} />

        <View style={[styles.premiumTable, large && styles.premiumTableLarge]}>{children}</View>

        {footer}

        {!hideChase && model.chase ? (
          <LinearGradient colors={p.center} style={styles.premiumChase}>
            <Text style={[styles.chaseText, { color: p.chaseText }]} numberOfLines={1}>
              TARGET {model.chase.target}   NEED {model.chase.need} FROM {model.chase.ballsLeft}
            </Text>
          </LinearGradient>
        ) : null}
      </LinearGradient>
    </View>
  );
}

function BattingScorecardPanel({
  model,
  large,
  theme,
}: {
  model: ScoreboardOverlayModel;
  large?: boolean;
  theme: ScorebarTheme;
}) {
  const rows = model.battingRows;
  const panelTheme = themeForPanel(theme, 'batting');
  const p = panelTheme.panel;
  return (
    <PremiumScorecardShell
      eyebrow="BATTING SCORECARD"
      teamName={model.battingTeamName}
      model={model}
      large={large}
      theme={panelTheme}
      footer={
        model.extras ? (
          <View style={[styles.premiumFooter, large && styles.premiumFooterLarge, { backgroundColor: p.accentSoft }]}>
            <Text style={[styles.premiumFooterLabel, large && styles.premiumFooterLabelLarge, { color: p.accent }]}>EXTRAS</Text>
            <Text style={[styles.premiumFooterValue, large && styles.premiumFooterValueLarge, { color: p.ink }]} numberOfLines={1}>
              {model.extras.total} · Wd {model.extras.wides} · Nb {model.extras.noBalls} · B {model.extras.byes} · Lb {model.extras.legByes}
            </Text>
          </View>
        ) : null
      }>
      <View style={[styles.premiumTableHead, large && styles.premiumTableHeadLarge]}>
        <Text style={[styles.premiumHeadCell, styles.premiumNameCol, large && styles.premiumHeadCellLarge, { color: p.accent }]}>BATTER</Text>
        <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge, { color: p.accent }]}>R</Text>
        <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge, { color: p.accent }]}>B</Text>
        <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge, { color: p.accent }]}>4s</Text>
        <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge, { color: p.accent }]}>6s</Text>
        <Text style={[styles.premiumHeadCell, styles.premiumStatCol, large && styles.premiumHeadCellLarge, large && styles.premiumStatColLarge, { color: p.accent }]}>SR</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={[styles.premiumEmpty, large && styles.premiumEmptyLarge, { color: p.inkMuted }]}>Scorecard updates as balls are scored</Text>
      ) : (
        rows.map((b, i) => (
          <View
            key={`${b.name}-${i}`}
            style={[
              styles.premiumRow,
              large && styles.premiumRowLarge,
              i % 2 === 0 && { backgroundColor: p.sideAlt },
              b.onStrike && { backgroundColor: p.accentSoft, borderColor: p.accent + '55', borderWidth: StyleSheet.hairlineWidth },
            ]}>
            <View style={styles.premiumNameCol}>
              <View style={styles.premiumNameRow}>
                {b.onStrike ? <Text style={[styles.premiumStrike, large && styles.premiumStrikeLarge, { color: p.accent }]}>★</Text> : null}
                <Text
                  style={[
                    styles.premiumName,
                    large && styles.premiumNameLarge,
                    { color: b.onStrike ? p.ink : p.inkMuted },
                    b.onStrike && { fontWeight: '900' },
                  ]}
                  numberOfLines={1}>
                  {b.status === 'NOT_OUT' ? `${b.name}*` : b.name}
                </Text>
              </View>
              <Text style={[styles.premiumSub, large && styles.premiumSubLarge, { color: p.inkMuted }]} numberOfLines={1}>
                {b.out || (b.status === 'NOT_OUT' ? 'not out' : '')}
              </Text>
            </View>
            <Text style={[styles.premiumCell, large && styles.premiumCellLarge, styles.premiumCellStrong, large && styles.premiumCellStrongLarge, { color: p.ink }]}>{b.runs}</Text>
            <Text style={[styles.premiumCell, large && styles.premiumCellLarge, { color: p.inkMuted }]}>{b.balls}</Text>
            <Text style={[styles.premiumCell, large && styles.premiumCellLarge, { color: p.inkMuted }]}>{b.fours}</Text>
            <Text style={[styles.premiumCell, large && styles.premiumCellLarge, { color: p.inkMuted }]}>{b.sixes}</Text>
            <Text style={[styles.premiumCell, styles.premiumStatCol, large && styles.premiumCellLarge, large && styles.premiumStatColLarge, { color: p.inkMuted }]}>
              {b.strikeRate.toFixed(1)}
            </Text>
          </View>
        ))
      )}
    </PremiumScorecardShell>
  );
}

function BowlingScorecardPanel({
  model,
  large,
  theme,
}: {
  model: ScoreboardOverlayModel;
  large?: boolean;
  theme: ScorebarTheme;
}) {
  const rows = model.bowlingRows;
  const panelTheme = themeForPanel(theme, 'bowling');
  const p = panelTheme.panel;
  return (
    <PremiumScorecardShell eyebrow="BOWLING SCORECARD" teamName={model.bowlingTeamName} model={model} large={large} theme={panelTheme}>
      <View style={[styles.premiumTableHead, large && styles.premiumTableHeadLarge]}>
        <Text style={[styles.premiumHeadCell, styles.premiumNameCol, large && styles.premiumHeadCellLarge, { color: p.accent }]}>BOWLER</Text>
        <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge, { color: p.accent }]}>O</Text>
        <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge, { color: p.accent }]}>M</Text>
        <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge, { color: p.accent }]}>R</Text>
        <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge, { color: p.accent }]}>W</Text>
        <Text style={[styles.premiumHeadCell, styles.premiumStatCol, large && styles.premiumHeadCellLarge, large && styles.premiumStatColLarge, { color: p.accent }]}>ECO</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={[styles.premiumEmpty, large && styles.premiumEmptyLarge, { color: p.inkMuted }]}>Bowling figures appear as overs are bowled</Text>
      ) : (
        rows.map((bw, i) => (
          <View
            key={`${bw.name}-${i}`}
            style={[
              styles.premiumRow,
              large && styles.premiumRowLarge,
              i % 2 === 0 && { backgroundColor: p.sideAlt },
              bw.active && { backgroundColor: p.accentSoft, borderColor: p.accent + '55', borderWidth: StyleSheet.hairlineWidth },
            ]}>
            <View style={styles.premiumNameCol}>
              <View style={styles.premiumNameRow}>
                {bw.active ? <Text style={[styles.premiumStrike, large && styles.premiumStrikeLarge, { color: p.accent }]}>★</Text> : null}
                <Text
                  style={[styles.premiumName, large && styles.premiumNameLarge, { color: bw.active ? p.ink : p.inkMuted, fontWeight: bw.active ? '900' : '800' }]}
                  numberOfLines={1}>
                  {bw.active ? `${bw.name}*` : bw.name}
                </Text>
              </View>
            </View>
            <Text style={[styles.premiumCell, large && styles.premiumCellLarge, { color: p.inkMuted }]}>{formatOvers(bw.overs)}</Text>
            <Text style={[styles.premiumCell, large && styles.premiumCellLarge, { color: p.inkMuted }]}>{bw.maidens}</Text>
            <Text style={[styles.premiumCell, large && styles.premiumCellLarge, { color: p.inkMuted }]}>{bw.runs}</Text>
            <Text style={[styles.premiumCell, large && styles.premiumCellLarge, styles.premiumCellStrong, large && styles.premiumCellStrongLarge, { color: p.ink }]}>{bw.wickets}</Text>
            <Text style={[styles.premiumCell, styles.premiumStatCol, large && styles.premiumCellLarge, large && styles.premiumStatColLarge, { color: p.inkMuted }]}>
              {bw.economy.toFixed(1)}
            </Text>
          </View>
        ))
      )}
    </PremiumScorecardShell>
  );
}

function FirstInningsPanel({ model, large, theme }: { model: ScoreboardOverlayModel; large?: boolean; theme: ScorebarTheme }) {
  const panelTheme = themeForPanel(theme, 'innings1');
  const card = model.firstInnings;
  if (!card) {
    return (
      <PremiumScorecardShell
        eyebrow="1ST INNINGS"
        teamName={model.battingTeamName}
        model={model}
        large={large}
        theme={panelTheme}
        hideChase>
        <Text style={[styles.premiumEmpty, large && styles.premiumEmptyLarge, { color: panelTheme.panel.inkMuted }]}>
          First innings scorecard not available yet
        </Text>
      </PremiumScorecardShell>
    );
  }

  return (
    <PremiumScorecardShell
      eyebrow="1ST INNINGS SCORECARD"
      teamName={card.teamName}
      model={model}
      large={large}
      theme={panelTheme}
      hideChase
      score={{ runs: card.runs, wickets: card.wickets, overs: card.overs, balls: card.balls }}
      footer={
        card.extras ? (
          <View style={[styles.premiumFooter, large && styles.premiumFooterLarge, { backgroundColor: panelTheme.panel.accentSoft }]}>
            <Text style={[styles.premiumFooterLabel, large && styles.premiumFooterLabelLarge, { color: panelTheme.panel.accent }]}>EXTRAS</Text>
            <Text style={[styles.premiumFooterValue, large && styles.premiumFooterValueLarge, { color: panelTheme.panel.ink }]} numberOfLines={1}>
              {card.extras.total} · Wd {card.extras.wides} · Nb {card.extras.noBalls} · B {card.extras.byes} · Lb{' '}
              {card.extras.legByes}
            </Text>
          </View>
        ) : null
      }>
      <View style={large ? styles.firstInnSplit : undefined}>
        <View style={large ? styles.firstInnCol : undefined}>
          <Text style={[styles.sectionLabel, large && styles.sectionLabelLarge]}>BATTING</Text>
          <View style={[styles.premiumTableHead, large && styles.premiumTableHeadLarge]}>
            <Text style={[styles.premiumHeadCell, styles.premiumNameCol, large && styles.premiumHeadCellLarge]}>BATTER</Text>
            <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge]}>R</Text>
            <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge]}>B</Text>
            <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge]}>4s</Text>
            <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge]}>6s</Text>
            <Text style={[styles.premiumHeadCell, styles.premiumStatCol, large && styles.premiumHeadCellLarge, large && styles.premiumStatColLarge]}>SR</Text>
          </View>
          {card.battingRows.length === 0 ? (
            <Text style={[styles.premiumEmpty, large && styles.premiumEmptyLarge]}>No batting card</Text>
          ) : (
            card.battingRows.map((b, i) => (
              <View
                key={`inn1-b-${b.name}-${i}`}
                style={[styles.premiumRow, large && styles.premiumRowLarge, i % 2 === 0 && styles.premiumRowAlt]}>
                <View style={styles.premiumNameCol}>
                  <Text style={[styles.premiumName, large && styles.premiumNameLarge]} numberOfLines={1}>
                    {b.status === 'NOT_OUT' ? `${b.name}*` : b.name}
                  </Text>
                  {b.out ? (
                    <Text style={[styles.premiumSub, large && styles.premiumSubLarge]} numberOfLines={1}>
                      {b.out}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.premiumCell, large && styles.premiumCellLarge, styles.premiumCellStrong, large && styles.premiumCellStrongLarge]}>
                  {b.runs}
                </Text>
                <Text style={[styles.premiumCell, large && styles.premiumCellLarge]}>{b.balls}</Text>
                <Text style={[styles.premiumCell, large && styles.premiumCellLarge]}>{b.fours}</Text>
                <Text style={[styles.premiumCell, large && styles.premiumCellLarge]}>{b.sixes}</Text>
                <Text style={[styles.premiumCell, styles.premiumStatCol, large && styles.premiumCellLarge, large && styles.premiumStatColLarge]}>
                  {b.strikeRate.toFixed(1)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={large ? styles.firstInnCol : styles.firstInnBowlBlock}>
          <Text style={[styles.sectionLabel, large && styles.sectionLabelLarge]}>
            BOWLING · {card.bowlingTeamName}
          </Text>
          <View style={[styles.premiumTableHead, large && styles.premiumTableHeadLarge]}>
            <Text style={[styles.premiumHeadCell, styles.premiumNameCol, large && styles.premiumHeadCellLarge]}>BOWLER</Text>
            <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge]}>O</Text>
            <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge]}>M</Text>
            <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge]}>R</Text>
            <Text style={[styles.premiumHeadCell, large && styles.premiumHeadCellLarge]}>W</Text>
            <Text style={[styles.premiumHeadCell, styles.premiumStatCol, large && styles.premiumHeadCellLarge, large && styles.premiumStatColLarge]}>ECO</Text>
          </View>
          {card.bowlingRows.length === 0 ? (
            <Text style={[styles.premiumEmpty, large && styles.premiumEmptyLarge]}>No bowling figures</Text>
          ) : (
            card.bowlingRows.map((bw, i) => (
              <View
                key={`inn1-bw-${bw.name}-${i}`}
                style={[styles.premiumRow, large && styles.premiumRowLarge, i % 2 === 0 && styles.premiumRowAlt]}>
                <View style={styles.premiumNameCol}>
                  <Text style={[styles.premiumName, large && styles.premiumNameLarge]} numberOfLines={1}>
                    {bw.name}
                  </Text>
                </View>
                <Text style={[styles.premiumCell, large && styles.premiumCellLarge]}>{formatOvers(bw.overs)}</Text>
                <Text style={[styles.premiumCell, large && styles.premiumCellLarge]}>{bw.maidens}</Text>
                <Text style={[styles.premiumCell, large && styles.premiumCellLarge]}>{bw.runs}</Text>
                <Text style={[styles.premiumCell, large && styles.premiumCellLarge, styles.premiumCellStrong, large && styles.premiumCellStrongLarge]}>
                  {bw.wickets}
                </Text>
                <Text style={[styles.premiumCell, styles.premiumStatCol, large && styles.premiumCellLarge, large && styles.premiumStatColLarge]}>
                  {bw.economy.toFixed(1)}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    </PremiumScorecardShell>
  );
}

function SummaryInningsBlock({
  label,
  inn,
  large,
  theme,
}: {
  label: string;
  inn: OverlayInningsSummary;
  large?: boolean;
  theme: ScorebarTheme;
}) {
  const p = theme.panel;
  const rows = Math.max(inn.topBatters.length, inn.topBowlers.length, 1);
  return (
    <View style={[styles.summaryBlock, large && styles.summaryBlockLarge, { backgroundColor: p.accentSoft }]}>
      <View style={styles.summaryTitleRow}>
        <View style={styles.summaryTitleLeft}>
          <Text style={[styles.summaryLabel, large && styles.summaryLabelLarge, { color: p.accent }]}>{label}</Text>
          <Text style={[styles.summaryTeam, large && styles.summaryTeamLarge, { color: p.ink }]} numberOfLines={1}>
            {inn.teamName}
          </Text>
        </View>
        <Text style={[styles.summaryScore, large && styles.summaryScoreLarge, { color: p.ink }]}>
          {inn.runs}-{inn.wickets} ({inn.overs}.{inn.balls})
        </Text>
      </View>
      <View style={[styles.summaryLegend, large && styles.summaryLegendLarge]}>
        <Text style={[styles.summaryLegendText, large && styles.summaryLegendTextLarge, { color: p.inkMuted }]}>
          TOP BATTERS
        </Text>
        <Text style={[styles.summaryLegendText, large && styles.summaryLegendTextLarge, { color: p.inkMuted }]}>
          BEST BOWLERS
        </Text>
      </View>
      {Array.from({ length: rows }).map((_, i) => {
        const bat = inn.topBatters[i];
        const bowl = inn.topBowlers[i];
        return (
          <View key={`${label}-${i}`} style={[styles.summaryLine, large && styles.summaryLineLarge]}>
            <Text style={[styles.summaryRank, large && styles.summaryRankLarge, { color: p.accent }]}>{i + 1}</Text>
            <Text style={[styles.summaryName, large && styles.summaryNameLarge, { color: p.ink }]} numberOfLines={1}>
              {bat?.name || '—'}
            </Text>
            <Text style={[styles.summaryFigure, large && styles.summaryFigureLarge, { color: p.inkMuted }]}>
              {bat?.figure || ''}
            </Text>
            <Text style={[styles.summaryName, large && styles.summaryNameLarge, { color: p.ink }]} numberOfLines={1}>
              {bowl?.name || '—'}
            </Text>
            <Text style={[styles.summaryFigure, large && styles.summaryFigureLarge, { color: p.inkMuted }]}>
              {bowl?.figure || ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function MatchSummaryPanel({ model, large, theme }: { model: ScoreboardOverlayModel; large?: boolean; theme: ScorebarTheme }) {
  const { inn1, inn2, result, playerOfMatch } = model.matchSummary;
  const panelTheme = themeForPanel(theme, 'summary');
  const p = panelTheme.panel;
  return (
    <View style={[styles.premiumStage, large && styles.premiumStageLarge]} collapsable={false}>
      <LinearGradient
        colors={[p.side, p.sideAlt]}
        style={[styles.premiumInner, large && styles.premiumInnerLarge, { borderColor: p.accent + '33' }]}>
        <LinearGradient colors={[p.accent + '18', 'transparent']} style={styles.premiumSheen} />

        <View style={[styles.premiumHeader, large && styles.premiumHeaderLarge]}>
          <View style={styles.premiumTitleBlock}>
            <Text style={[styles.premiumEyebrow, large && styles.premiumEyebrowLarge, { color: p.accent }]}>MATCH SUMMARY</Text>
            <Text style={[styles.premiumTeam, large && styles.premiumTeamLarge, { color: p.ink }]} numberOfLines={1}>
              {model.teamAName} vs {model.teamBName}
            </Text>
            {model.chase ? (
              <Text style={[styles.premiumMatch, large && styles.premiumMatchLarge, { color: p.inkMuted }]} numberOfLines={1}>
                Target {model.chase.target} · Need {model.chase.need} from {model.chase.ballsLeft}
              </Text>
            ) : null}
          </View>
        </View>

        <LinearGradient colors={[p.accent + '77', p.accent + '14']} style={styles.premiumRule} />

        <View style={[styles.summaryBody, large && styles.summaryBodyLarge, large && styles.summaryBodySplit]}>
          {inn1 ? <SummaryInningsBlock label="1ST INNINGS" inn={inn1} large={large} theme={panelTheme} /> : null}
          {inn2 ? <SummaryInningsBlock label="2ND INNINGS" inn={inn2} large={large} theme={panelTheme} /> : null}
          {!inn1 && !inn2 ? (
            <Text style={[styles.premiumEmpty, large && styles.premiumEmptyLarge, { color: p.inkMuted }]}>Summary builds as innings progress</Text>
          ) : null}
        </View>

        {result ? (
          <LinearGradient colors={p.center} style={styles.premiumChase}>
            <Text style={[styles.chaseText, { color: p.chaseText }]}>{result}</Text>
            {playerOfMatch ? (
              <Text style={[styles.chaseText, { marginTop: 4, color: p.gold[0] }]}>
                ★ Player of the Match · {playerOfMatch}
              </Text>
            ) : null}
          </LinearGradient>
        ) : model.chase ? (
          <LinearGradient colors={p.center} style={styles.premiumChase}>
            <Text style={[styles.chaseText, { color: p.chaseText }]} numberOfLines={1}>
              TARGET {model.chase.target}   NEED {model.chase.need} FROM {model.chase.ballsLeft}
            </Text>
          </LinearGradient>
        ) : null}
      </LinearGradient>
    </View>
  );
}

export default function ScoreboardOverlay({
  model,
  mode = 'scorebar',
  layoutWidth,
  layoutHeight,
  forStream = false,
  compact = false,
  themeId,
}: {
  model: ScoreboardOverlayModel;
  mode?: OverlayGraphicsMode;
  layoutWidth?: number;
  layoutHeight?: number;
  /** Rounded + inset styling for Facebook capture only — keep ABSScore UI edge-to-edge. */
  forStream?: boolean;
  /** Smaller graphics for the Go Live camera preview so more of the feed stays visible. */
  compact?: boolean;
  /** Override store theme (optional). */
  themeId?: ScorebarThemeId;
}) {
  const storeTheme = useOverlayModeStore(s => s.theme);
  const theme = resolveScorebarTheme(themeId ?? storeTheme);
  const dims = useWindowDimensions();
  const width = layoutWidth ?? dims.width;
  const height = layoutHeight ?? dims.height;
  const portrait = height >= width;
  // Facebook stream capture is 1280×720 — use the larger scorecard there.
  const large = !compact && width >= 1000;

  if (mode === 'batting') {
    return <BattingScorecardPanel model={model} large={large} theme={theme} />;
  }
  if (mode === 'bowling') {
    return <BowlingScorecardPanel model={model} large={large} theme={theme} />;
  }
  if (mode === 'innings1') {
    return <FirstInningsPanel model={model} large={large} theme={theme} />;
  }
  if (mode === 'summary') {
    return <MatchSummaryPanel model={model} large={large} theme={theme} />;
  }

  if (portrait) {
    return <PortraitBar model={model} forStream={forStream} />;
  }

  if (theme.id === 'chase') {
    return <ChaseLandscapeBar model={model} forStream={forStream} compact={compact} theme={theme} />;
  }
  if (theme.id === 'angular') {
    return <AngularLandscapeBar model={model} forStream={forStream} compact={compact} theme={theme} />;
  }

  return <LandscapeBar model={model} forStream={forStream} compact={compact} theme={theme} />;
}

const styles = StyleSheet.create({
  shell: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: BAR.segScore,
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  shellStream: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.35)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
  },
  burstHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 40,
    elevation: 40,
  },
  burstHostStream: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  burstBar: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  burstBarStream: {
    borderRadius: 12,
  },
  burstContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingHorizontal: 16,
  },
  burstTextCol: {
    flexShrink: 1,
    alignItems: 'center',
    minWidth: 0,
    maxWidth: '55%',
  },
  burstTitle: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  burstSub: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.94)',
    fontWeight: '800',
    textAlign: 'center',
  },
  goldRule: {
    height: 1.5,
    width: '100%',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 68,
    width: '100%',
    overflow: 'hidden',
  },
  barCompact: {
    height: 38,
  },
  barStream: {
    height: 92,
  },
  chaseBar: {
    width: '100%',
    minHeight: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
    overflow: 'hidden',
  },
  chaseBarCompact: {
    minHeight: 32,
    paddingVertical: 2,
    paddingHorizontal: 4,
    gap: 3,
    borderRadius: 7,
  },
  chaseBarStream: {
    minHeight: 78,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
    borderRadius: 12,
  },
  chasePill: {
    flex: 1.2,
    minWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  chasePillCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  chasePillStream: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chasePillTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chasePillText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  chasePillTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  chaseTeam: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  chaseTeamCompact: {
    fontSize: 9,
    letterSpacing: 0.3,
  },
  chaseTeamStream: {
    fontSize: 16,
    letterSpacing: 0.7,
  },
  chaseScoreBlock: {
    marginTop: 2,
  },
  chaseScore: {
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 24,
  },
  chaseScoreCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  chaseScoreStream: {
    fontSize: 32,
    lineHeight: 34,
  },
  chaseMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 1,
  },
  chaseMeta: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  chaseMetaStream: {
    fontSize: 14,
    marginTop: 3,
  },
  chaseBatters: {
    flex: 1.35,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  chaseBattersCompact: {
    gap: 4,
    paddingHorizontal: 2,
  },
  chaseBatterCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  chaseBatterDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    opacity: 0.45,
  },
  chaseBatterName: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  chaseBatterNameCompact: {
    fontSize: 9,
    letterSpacing: 0.2,
  },
  chaseBatterNameStream: {
    fontSize: 17,
    letterSpacing: 0.4,
  },
  chaseBatterStats: {
    marginTop: 1,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  chaseBatterStatsCompact: {
    fontSize: 11,
  },
  chaseBatterStatsStream: {
    fontSize: 20,
    marginTop: 2,
  },
  chaseThisOver: {
    flexShrink: 0,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  chaseOverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  chaseOverDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chaseOverDotStream: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  chaseOverDotText: {
    color: '#F4FBE8',
    fontSize: 7,
    fontWeight: '900',
  },
  chaseOverDotTextStream: {
    fontSize: 11,
  },
  chaseReq: {
    flex: 0.95,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    paddingRight: 2,
  },
  chaseMid: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  chaseNeedNum: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  chaseNeedNumCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  chaseNeedNumStream: {
    fontSize: 34,
    lineHeight: 36,
  },
  chaseNeedLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chaseNeedLabelStream: {
    fontSize: 13,
  },
  chaseRight: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingRight: 4,
  },
  chaseNeededFrom: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.4,
    lineHeight: 10,
    textAlign: 'center',
  },
  chaseNeededFromStream: {
    fontSize: 12,
    lineHeight: 14,
  },
  chaseBallsNum: {
    fontSize: 24,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 26,
  },
  chaseBallsNumCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  chaseBallsNumStream: {
    fontSize: 34,
    lineHeight: 36,
  },
  chaseBallsLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  chaseBallsLabelStream: {
    fontSize: 13,
  },
  chaseBowlerBlock: {
    flex: 0.9,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
  },
  chaseBowlerBlockCompact: {
    paddingHorizontal: 2,
    gap: 4,
  },
  chaseBowlerLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 1,
  },
  chaseBowlerLabelStream: {
    fontSize: 12,
  },
  angularWrap: {
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  angularWrapCompact: {
    borderRadius: 3,
  },
  angularTop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 30,
  },
  angularTopStream: {
    minHeight: 56,
  },
  angularWing: {
    flex: 1.1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  angularWingStream: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  angularWingLeft: {
    transform: [{ skewX: '-8deg' }],
    marginRight: -6,
  },
  angularWingRight: {
    transform: [{ skewX: '8deg' }],
    marginLeft: -6,
  },
  angularPlayer: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  angularPlayerStream: {
    fontSize: 20,
    letterSpacing: 0.5,
  },
  angularPlayerRight: {
    textAlign: 'right',
  },
  angularPlayerStats: {
    marginTop: 1,
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  angularPlayerStatsStream: {
    marginTop: 3,
    fontSize: 20,
  },
  angularCenter: {
    flex: 1.35,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    zIndex: 2,
  },
  angularCode: {
    minWidth: 28,
    height: 28,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  angularCodeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  angularMainScore: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  angularMainScoreCompact: {
    fontSize: 14,
  },
  angularMainScoreStream: {
    fontSize: 30,
  },
  angularBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 24,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 6,
  },
  angularBottomStream: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
  },
  angularOverCol: {
    flex: 1.15,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  angularBottomLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  angularBottomLabelStream: {
    fontSize: 15,
  },
  angularOverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  angularOverDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  angularOverDotStream: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  angularOverDotText: {
    fontSize: 8,
    fontWeight: '900',
  },
  angularOverDotTextStream: {
    fontSize: 13,
  },
  angularProjected: {
    flex: 1,
    minWidth: 0,
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  angularProjectedText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  angularProjectedTextStream: {
    fontSize: 16,
    letterSpacing: 0.4,
  },
  angularBowlerCol: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  angularBowlerName: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  angularBowlerNameStream: {
    fontSize: 18,
    letterSpacing: 0.4,
  },
  angularBowlerFigs: {
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  angularBowlerFigsStream: {
    fontSize: 18,
  },
  teamCircleWrap: {
    flexShrink: 0,
  },
  teamCircleRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCircleInner: {
    flex: 1,
    width: '100%',
    backgroundColor: BAR.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamCircleText: {
    color: '#FFFFFF',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bbScoreSeg: {
    flex: 1.15,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    backgroundColor: BAR.segScore,
  },
  bbScoreSegCompact: {
    gap: 5,
    paddingHorizontal: 6,
  },
  bbScoreText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  bbMatchup: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bbMatchupStream: { fontSize: 15 },
  bbScoreLine: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
  },
  bbScoreLineCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  bbScoreLineStream: { fontSize: 32, lineHeight: 34 },
  bbOversLine: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bbOversLineCompact: {
    fontSize: 9,
  },
  bbOversLineStream: { fontSize: 16 },
  bbBatter: {
    flex: 0.95,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: BAR.segBatter,
  },
  bbBatterCompact: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  bbBatterStream: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bbBatterAlt: {
    backgroundColor: BAR.segBatterAlt,
  },
  bbBatterOn: {
    borderLeftWidth: 3,
    borderLeftColor: '#F5E6A8',
  },
  bbBatterName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  bbBatterNameCompact: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  bbBatterNameStream: { fontSize: 20, letterSpacing: 0.6 },
  bbBatterStats: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  bbBatterStatsCompact: {
    marginTop: 0,
    fontSize: 12,
  },
  bbBatterStatsStream: { marginTop: 3, fontSize: 22 },
  bbTargetSeg: {
    flex: 0.7,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: BAR.segTarget,
  },
  bbTargetSegCompact: {
    minWidth: 48,
    paddingHorizontal: 4,
  },
  bbTargetSegStream: { minWidth: 90, paddingHorizontal: 12 },
  bbTargetLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  bbTargetLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.8,
  },
  bbTargetLabelStream: { fontSize: 13, letterSpacing: 1.6 },
  bbTargetValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 30,
  },
  bbTargetValueCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  bbTargetValueStream: { fontSize: 34, lineHeight: 38 },
  bbTargetValueSmall: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  bbTargetValueSmallCompact: {
    fontSize: 11,
  },
  bbTargetValueSmallStream: { fontSize: 20 },
  bbTargetNeed: {
    marginTop: 1,
    color: 'rgba(212,176,106,0.95)',
    fontSize: 10,
    fontWeight: '700',
  },
  bbTargetNeedStream: { fontSize: 14 },
  bbBowlerSeg: {
    flex: 1.35,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    backgroundColor: BAR.segBowler,
  },
  bbBowlerSegCompact: {
    gap: 5,
    paddingHorizontal: 6,
  },
  bbBowlerMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 2,
  },
  bbBowlerName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  bbBowlerNameCompact: {
    fontSize: 10,
  },
  bbBowlerNameStream: { fontSize: 20 },
  bbBowlerFigs: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  bbBowlerFigsCompact: {
    fontSize: 10,
  },
  bbBowlerFigsStream: { fontSize: 20 },
  bbOverRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  bbOverRowCompact: {
    gap: 2,
    marginTop: 1,
  },
  bbOverRowStream: {
    gap: 5,
    marginTop: 4,
  },
  bbOverEmpty: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '800',
  },
  bbOverPill: {
    minWidth: 22,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  bbOverPillCompact: {
    minWidth: 14,
    height: 14,
    paddingHorizontal: 2,
  },
  bbOverPillStream: {
    minWidth: 30,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  bbOverDot: {
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  bbOverFour: {
    backgroundColor: '#1E88E5',
  },
  bbOverSix: {
    backgroundColor: '#2E7D32',
  },
  bbOverWicket: {
    backgroundColor: '#C62828',
  },
  bbOverExtra: {
    backgroundColor: '#EF6C00',
  },
  bbOverPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  bbOverPillTextCompact: {
    fontSize: 7,
  },
  bbOverPillTextStream: {
    fontSize: 14,
  },
  bbPortraitCol: {
    width: '100%',
  },
  bbScoreSegPortrait: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: BAR.segScore,
  },
  bbTargetSegPortrait: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: BAR.segTarget,
    borderRadius: 6,
    minWidth: 64,
  },
  bbPortraitMid: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  bbBowlerSegPortrait: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: BAR.segBowler,
  },
  batters: {
    flex: 1.35,
    minWidth: 0,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 10,
    paddingRight: 12,
    backgroundColor: BAR.side,
  },
  batterStack: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  battingChip: {
    color: BAR.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 1,
    paddingLeft: 4,
  },
  batter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
    paddingVertical: 1,
  },
  batterOn: {
    backgroundColor: 'transparent',
  },
  strikeMark: {
    width: 12,
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(11,28,44,0.25)',
    textAlign: 'center',
  },
  strikeMarkOn: {
    color: BAR.accent,
  },
  bName: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '700',
    color: BAR.inkMuted,
    letterSpacing: 0.2,
  },
  bNameOn: {
    fontWeight: '900',
    color: BAR.ink,
  },
  bRuns: {
    minWidth: 20,
    fontSize: 15,
    fontWeight: '900',
    color: BAR.inkMuted,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  bRunsOn: {
    color: BAR.ink,
  },
  bBalls: {
    minWidth: 34,
    fontSize: 13,
    fontWeight: '700',
    color: BAR.inkMuted,
    textAlign: 'left',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: 'rgba(26,35,50,0.16)',
  },
  badgeSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  badgeRing: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeInner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeScore: {
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  badgeOvers: {
    fontWeight: '800',
    color: '#D4B06A',
    letterSpacing: 0.4,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  centerBlock: {
    flex: 1.05,
    minWidth: 140,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  centerScore: {
    color: '#F7F3EB',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  centerChase: {
    marginTop: 2,
    color: 'rgba(212,176,106,0.95)',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  thisOver: {
    flex: 1.2,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingLeft: 10,
    paddingRight: 8,
  },
  overBlock: {
    gap: 4,
    minWidth: 0,
  },
  overBlockCompact: {
    gap: 3,
  },
  overLabel: {
    color: BAR.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  overLabelOnGold: {
    color: Colors.onPrimary,
    opacity: 0.85,
  },
  overRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  overEmpty: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  overEmptyOnGold: {
    color: Colors.onPrimary,
    opacity: 0.7,
  },
  overEmptyLite: {
    color: BAR.inkMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  overChip: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overChipCompact: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 5,
  },
  overChipText: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },
  overChipTextCompact: {
    fontSize: 13,
  },
  overPill: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BAR.chipBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(26,35,50,0.16)',
  },
  overPillExtra: {
    backgroundColor: BAR.accent,
    borderColor: BAR.accent,
  },
  overPillWicket: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  overPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: BAR.chipInk,
    fontVariant: ['tabular-nums'],
  },
  overPillTextOn: {
    color: '#FFFFFF',
  },
  bowler: {
    flex: 1.2,
    minWidth: 0,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 12,
    paddingRight: 10,
    backgroundColor: BAR.side,
  },
  bowlerStack: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 4,
  },
  bowlerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  bowlerNameLite: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: '800',
    color: BAR.ink,
  },
  bowlerFiguresLite: {
    fontSize: 13,
    fontWeight: '800',
    color: BAR.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  bowlerInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 0,
    width: '100%',
  },
  bowlerLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 1.2,
  },
  bowlerName: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: 0.3,
    textAlign: 'center',
    width: '100%',
  },
  bowlerFiguresRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  bowlerFigures: {
    fontSize: 16,
    fontWeight: '900',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  bowlerOvers: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  portraitTop: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    overflow: 'hidden',
    backgroundColor: BAR.side,
  },
  portraitBatters: {
    flex: 1.5,
    minWidth: 0,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 6,
  },
  portraitBowler: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
    paddingRight: 10,
    paddingVertical: 6,
  },
  portraitBottom: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  portraitBottomLite: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: BAR.sideAlt,
  },
  chaseStrip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chaseText: {
    color: '#F7F3EB',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  premiumStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  premiumStageLarge: {
    paddingHorizontal: 28,
  },
  premiumInner: {
    width: '100%',
    maxWidth: 640,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: BAR.side,
    borderWidth: 1.5,
    borderColor: 'rgba(26,35,50,0.16)',
  },
  premiumInnerLarge: {
    maxWidth: 1100,
    borderRadius: 22,
    borderWidth: 2,
  },
  premiumSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 88,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10,
  },
  premiumHeaderLarge: {
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 16,
  },
  premiumTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  premiumEyebrow: {
    color: BAR.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  premiumEyebrowLarge: {
    fontSize: 13,
    letterSpacing: 2.2,
  },
  premiumTeam: {
    color: BAR.ink,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  premiumTeamLarge: {
    fontSize: 26,
  },
  premiumMatch: {
    color: BAR.inkMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  premiumMatchLarge: {
    fontSize: 13,
    marginTop: 3,
  },
  premiumScorePill: {
    minWidth: 72,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumScorePillLarge: {
    minWidth: 110,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  premiumScore: {
    color: '#F7F3EB',
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  premiumScoreLarge: {
    fontSize: 26,
  },
  premiumOvers: {
    color: '#D4B06A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 1,
    opacity: 0.95,
  },
  premiumOversLarge: {
    fontSize: 12,
    marginTop: 2,
  },
  premiumRule: {
    height: 1.5,
    marginHorizontal: 14,
    borderRadius: 1,
  },
  premiumTable: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 4,
  },
  premiumTableLarge: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  premiumTableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
    marginBottom: 2,
    borderRadius: 8,
    backgroundColor: BAR.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,118,110,0.28)',
  },
  premiumTableHeadLarge: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 4,
    borderRadius: 10,
  },
  premiumHeadCell: {
    width: 28,
    color: BAR.accent,
    fontSize: 9,
    fontWeight: '900',
    textAlign: 'right',
    letterSpacing: 0.5,
  },
  premiumHeadCellLarge: {
    width: 42,
    fontSize: 13,
  },
  premiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 5,
    minHeight: 34,
    borderRadius: 8,
  },
  premiumRowLarge: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 52,
    borderRadius: 10,
  },
  premiumRowAlt: {
    backgroundColor: 'rgba(26,35,50,0.04)',
  },
  premiumRowOn: {
    backgroundColor: 'rgba(15,118,110,0.12)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,118,110,0.35)',
  },
  premiumNameCol: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  premiumStatCol: {
    width: 36,
  },
  premiumStatColLarge: {
    width: 52,
  },
  premiumNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minWidth: 0,
  },
  premiumStrike: {
    color: BAR.accent,
    fontSize: 10,
    fontWeight: '900',
    width: 12,
    textAlign: 'center',
  },
  premiumStrikeLarge: {
    fontSize: 14,
    width: 16,
  },
  premiumName: {
    flex: 1,
    minWidth: 0,
    color: BAR.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.15,
  },
  premiumNameLarge: {
    fontSize: 17,
  },
  premiumNameOn: {
    color: BAR.ink,
    fontWeight: '900',
  },
  premiumSub: {
    color: BAR.inkMuted,
    fontSize: 8,
    fontWeight: '600',
    marginTop: 1,
    letterSpacing: 0.15,
    opacity: 0.85,
  },
  premiumSubLarge: {
    fontSize: 11,
    marginTop: 2,
  },
  premiumCell: {
    width: 28,
    color: BAR.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  premiumCellLarge: {
    width: 42,
    fontSize: 17,
  },
  premiumCellStrong: {
    color: BAR.ink,
    fontWeight: '900',
    fontSize: 12,
  },
  premiumCellStrongLarge: {
    fontSize: 19,
  },
  premiumEmpty: {
    color: BAR.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 14,
    textAlign: 'center',
  },
  premiumEmptyLarge: {
    fontSize: 15,
    paddingVertical: 22,
  },
  premiumFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: BAR.accentSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,118,110,0.22)',
  },
  premiumFooterLarge: {
    marginHorizontal: 20,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 12,
  },
  premiumFooterLabel: {
    color: BAR.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  premiumFooterLabelLarge: {
    fontSize: 11,
  },
  premiumFooterValue: {
    flex: 1,
    minWidth: 0,
    color: BAR.inkMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  premiumFooterValueLarge: {
    fontSize: 14,
  },
  premiumChase: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    color: BAR.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 4,
    marginTop: 2,
    paddingHorizontal: 4,
  },
  sectionLabelLarge: {
    fontSize: 13,
    marginBottom: 6,
  },
  firstInnSplit: {
    flexDirection: 'row',
    gap: 16,
  },
  firstInnCol: {
    flex: 1,
    minWidth: 0,
  },
  firstInnBowlBlock: {
    marginTop: 8,
  },
  summaryBody: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 10,
  },
  summaryBodyLarge: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    gap: 14,
  },
  summaryBodySplit: {
    flexDirection: 'row',
  },
  summaryBlock: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 6,
  },
  summaryBlockLarge: {
    paddingBottom: 0,
  },
  summaryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  summaryTitleLeft: {
    flex: 1,
    minWidth: 0,
  },
  summaryLabel: {
    color: BAR.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  summaryLabelLarge: {
    fontSize: 11,
  },
  summaryTeam: {
    color: BAR.ink,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryTeamLarge: {
    fontSize: 18,
  },
  summaryScore: {
    color: BAR.accent,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  summaryScoreLarge: {
    fontSize: 22,
  },
  summaryLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    marginBottom: 2,
  },
  summaryLegendLarge: {
    paddingHorizontal: 28,
  },
  summaryLegendText: {
    color: BAR.inkMuted,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  summaryLegendTextLarge: {
    fontSize: 11,
  },
  summaryLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 4,
  },
  summaryLineLarge: {
    paddingVertical: 5,
    gap: 6,
  },
  summaryRank: {
    width: 14,
    color: BAR.accent,
    fontSize: 10,
    fontWeight: '800',
  },
  summaryRankLarge: {
    width: 18,
    fontSize: 13,
  },
  summaryName: {
    flex: 1.35,
    color: BAR.inkMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  summaryNameLarge: {
    fontSize: 15,
  },
  summaryFigure: {
    width: 48,
    color: BAR.ink,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  summaryFigureLarge: {
    width: 64,
    fontSize: 15,
  },
});
