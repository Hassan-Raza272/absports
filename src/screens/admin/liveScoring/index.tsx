import React, { useState, useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, TextInput, Modal, useWindowDimensions, InteractionManager } from 'react-native';
import BackButton from '../../../components/BackButton';
import { showAlert } from '../../../components/PremiumAlert';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../../theme';
import { EasePress, EaseView, scorePressTransition } from '../../../motion';
import { useMatchesStore, useMatchById, usePlayersStore, useAuthStore, useScopeStore, useClubsStore, useTeamsStore, useHubStore } from '../../../store';
import { addPlayer as addRemotePlayer, updatePlayer as updateRemotePlayer } from '../../../firebase';
import { persistMatchUpdate } from '../../../utils/offlineQueue';
import { allOutWickets, legalBallsPerOver, maxDeliveriesPerOver, resolveMatchSettings } from '../../../utils/matchSettings';
import { BattingStyle, BowlingStyle, Match, PlayerRole } from '../../../types';
import {
  BatterCardEntry,
  buildBowlingFromFigures,
  buildLiveBattingCard,
  careerDeltasFromMatch,
  isPlayerOnWinningTeam,
  maxOversPerBowler,
  mergeCareerDelta,
  minBowlersForFullInnings,
  resolveMatchWinnerSide,
  shouldRotateStrike,
  strikeRate,
  suggestPlayerOfMatch,
} from '../../../utils/scoring';
import {
  buildDlsRevision,
  canDecideByDls,
  decideMatchByDls,
  dlsResultSuffix,
  finalizeTeam1Resources,
  formatTargetLabel,
  getChaseTarget,
  getEffectiveOvers,
  minOversForResult,
} from '../../../utils/dls';
import ShotGroundPicker from '../../../components/ShotGroundPicker';
import OverlayCaptureLayer from '../../../components/OverlayCaptureLayer';
import OverlayModeSwitcher from '../../../components/OverlayModeSwitcher';
import ScorebarThemePicker from '../../../components/ScorebarThemePicker';
import { buildOverlayModel, overlayModelFromMatch } from '../../../components/ScoreboardOverlay';
import { useOverlayModeStore } from '../../../store/overlayMode';
import { speakText, stopSpeaking } from '../../../utils/voice';
import { isRtmpStreaming, stopStream, subscribeRtmpStatus } from '../../../native/rtmpStream';
import { canUserGoLiveOnMatch, goLiveDeniedMessage, isUsersOwnMatch } from '../../../utils/account';
import TeamLogoAvatar from '../../../components/TeamLogoAvatar';
import PremiumGoLiveModal from '../../../components/PremiumGoLiveModal';

type ExtraType = 'wide' | 'noBall' | 'bye' | 'legBye' | null;
type DismissalType = 'Bowled' | 'Caught' | 'LBW' | 'Run Out' | 'Stumped' | 'Hit Wicket' | 'Retired Hurt' | null;
type BatterEnd = 'striker' | 'nonStriker';

function deliveriesInCurrentOver(log: string[] | undefined, ballsPerOver: number): number {
  let legal = 0;
  let all = 0;
  (log || []).forEach(raw => {
    const base = (raw.split('→')[0] || '').toLowerCase();
    if (base === 'rh') return;
    const extra = base.startsWith('wd') || base.startsWith('nb');
    all += 1;
    if (!extra) {
      legal += 1;
      if (legal >= ballsPerOver) {
        legal = 0;
        all = 0;
      }
    }
  });
  return all;
}

/** Firebase RTDB may turn arrays into objects or drop empties entirely. */
function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === 'object') return Object.values(value as Record<string, T>);
  return [];
}

/** Animated GO LIVE button: pulsing dot + expanding radar ripple ring + gentle breathe opacity. */
function AnimatedGoLiveButton({ onAir, onPress }: { onAir: boolean; onPress: () => void }) {
  const dotScale = useRef(new Animated.Value(1)).current;
  const ringScale = useRef(new Animated.Value(0.4)).current;
  const ringOpacity = useRef(new Animated.Value(1)).current;
  const pillOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotScale, {
          toValue: 1.4,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(dotScale, {
          toValue: 0.7,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    const runRipple = () => {
      ringScale.setValue(0.4);
      ringOpacity.setValue(0.9);
      Animated.parallel([
        Animated.timing(ringScale, {
          toValue: 2.2,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 1200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setTimeout(runRipple, 300);
      });
    };
    runRipple();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pillOpacity, {
          toValue: 0.8,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pillOpacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [dotScale, ringScale, ringOpacity, pillOpacity]);

  const color = onAir ? Colors.live : '#FFD700';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Animated.View
        style={[
          onAir ? styles.onAirPill : styles.overlayPill,
          { opacity: pillOpacity, flexDirection: 'row', alignItems: 'center', gap: 6 },
        ]}>
        <View style={styles.liveDotWrap}>
          <Animated.View
            style={[
              styles.liveRing,
              {
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
                borderColor: color,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.liveDot,
              {
                backgroundColor: color,
                transform: [{ scale: dotScale }],
              },
            ]}
          />
        </View>
        <Text style={onAir ? styles.onAirLabel : styles.overlayLabel}>
          {onAir ? 'ON AIR' : 'GO LIVE'}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function AdminLiveScoringScreen({ route, navigation }: any) {
  const matchId = route.params?.matchId || 'm1';
  const { width } = useWindowDimensions();
  const scoreBtnSize = width < 360 ? 64 : width < 400 ? 72 : 80;
  const isNarrow = width < 360;
  const isCompact = width < 400;
  const bannerLogoSize = isNarrow ? 46 : isCompact ? 54 : 60;
  const bannerTeamFont = isNarrow ? Typography.base : isCompact ? Typography.lg : Typography.xl;
  const bannerScoreFont = isNarrow ? Typography.xxl : isCompact ? Typography.xxxl : Typography.display;
  const playerNameFont = isNarrow ? Typography.base : Typography.lg;
  const playerStatFont = isNarrow ? Typography.xs : Typography.sm;
  const swapMargin = isNarrow ? 8 : 14;
  const matches = useMatchesStore(state => state.matches);
  const updateMatch = useMatchesStore(state => state.updateMatch);
  const players = usePlayersStore(state => state.players);
  const updatePlayer = usePlayersStore(state => state.updatePlayer);
  const localTeams = useTeamsStore(state => state.teams);
  const hubTeams = useHubStore(state => state.teams);

  const user = useAuthStore(state => state.user);
  const clubs = useClubsStore(state => state.clubs);
  useEffect(() => {
    if (!user) {
      showAlert('Sign in', 'Sign in to score a match.');
      navigation.replace('Main');
    }
  }, [user, navigation]);

  const hubMatch = useMatchById(matchId);
  const match = matches.find(m => m.id === matchId) || hubMatch;
  useEffect(() => {
    if (!match) return;
    if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
      showAlert('Match finished', 'This match is already completed. Scoring is closed.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }
    if (user && !isUsersOwnMatch(user, match, clubs)) {
      showAlert('Access Restricted', 'You can only score matches that you created.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }
  }, [match?.id, match?.status, user, clubs, navigation]);

  // First scorer to open the desk owns Go Live for this match when createdBy was never set.
  useEffect(() => {
    if (!match?.id || !user?.id) return;
    if (match.createdBy) return;
    const patch = { createdBy: user.id };
    updateMatch(match.id, patch);
    persistMatchUpdate(match.id, patch).catch((error: unknown) => {
      console.warn('Could not save match starter for Go Live:', error);
    });
  }, [match?.id, match?.createdBy, user?.id, updateMatch]);

  const [onAir, setOnAir] = useState(false);
  const hydrateOverlayMode = useOverlayModeStore(s => s.hydrate);
  const setScoringCaptureActive = useOverlayModeStore(s => s.setScoringCaptureActive);
  useEffect(() => {
    hydrateOverlayMode();
  }, [hydrateOverlayMode]);
  useEffect(() => {
    setScoringCaptureActive(onAir);
    return () => setScoringCaptureActive(false);
  }, [onAir, setScoringCaptureActive]);
  useEffect(() => {
    let alive = true;
    isRtmpStreaming().then(live => {
      if (alive) setOnAir(live);
    });
    const stop = subscribeRtmpStatus(event => {
      if (event.type === 'success' || event.type === 'started' || event.type === 'connecting') {
        setOnAir(true);
      }
      if (
        event.type === 'stopped' ||
        event.type === 'disconnected' ||
        event.type === 'failed' ||
        event.type === 'authError'
      ) {
        setOnAir(false);
      }
    });
    return () => {
      alive = false;
      stop();
    };
  }, []);

  function requestExit() {
    if (!onAir) {
      navigation.goBack();
      return;
    }
    showAlert(
      'You are live',
      'The camera is still sending to your stream. Stop now, or keep streaming while you leave this screen.',
      [
        { text: 'Keep streaming', onPress: () => navigation.goBack() },
        {
          text: 'Stop & exit',
          style: 'destructive',
          onPress: () => {
            stopStream().finally(() => navigation.goBack());
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  const [showGoLivePremiumModal, setShowGoLivePremiumModal] = useState(false);

  function openBroadcast() {
    if (!canUserGoLiveOnMatch(user, match, clubs)) {
      setShowGoLivePremiumModal(true);
      return;
    }
    navigation.navigate('AdminBroadcast', { matchId });
  }

  function renderGoLiveBtn() {
    if (!isUsersOwnMatch(user, match, clubs) && !onAir) {
      return <View style={{ width: 72 }} />;
    }
    return <AnimatedGoLiveButton onAir={onAir} onPress={openBroadcast} />;
  }

  const [inningsNumber, setInningsNumber] = useState<1 | 2>(match?.currentInnings || 1);

  // Get initial values from match object or default
  const inn = (inningsNumber === 1 ? match?.innings?.first : match?.innings?.second) || {
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
    batting: [],
    bowling: [],
  };
  const savedSession = match?.liveScoring;

  const [runs, setRuns] = useState(inn.runs);
  const [wickets, setWickets] = useState(inn.wickets);
  const [overs, setOvers] = useState(inn.overs);
  const [balls, setBalls] = useState(inn.balls);
  const [ballLog, setBallLog] = useState<string[]>(ensureArray<string>(savedSession?.ballLog));
  const [extras, setExtras] = useState({
    wides: inn.extras?.wides || 0,
    noBalls: inn.extras?.noBalls || 0,
    byes: inn.extras?.byes || 0,
    legByes: inn.extras?.legByes || 0,
  });
  const [extraType, setExtraType] = useState<ExtraType>(null);
  const [pendingRuns, setPendingRuns] = useState<number | null>(null);
  const [isWicket, setIsWicket] = useState(false);
  const [dismissalType, setDismissalType] = useState<DismissalType>(null);
  const [fielderName, setFielderName] = useState('');
  const [showDismissal, setShowDismissal] = useState(false);
  const [dismissedBatter, setDismissedBatter] = useState<BatterEnd>('striker');

  // setup modal & current players state
  const [showSetup, setShowSetup] = useState(!savedSession?.setupComplete);
  const [setupStep, setSetupStep] = useState<'xi' | 'innings'>('innings');
  const [xiTeamA, setXiTeamA] = useState<string[]>(ensureArray<string>(match?.playingXI?.teamA));
  const [xiTeamB, setXiTeamB] = useState<string[]>(ensureArray<string>(match?.playingXI?.teamB));
  const [showRetireModal, setShowRetireModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [replaceFrom, setReplaceFrom] = useState('');
  const [replaceTo, setReplaceTo] = useState('');
  const [battingTeam, setBattingTeam] = useState<'A' | 'B'>(savedSession?.battingTeam || 'A');

  const [strikerName, setStrikerName] = useState(savedSession?.strikerName || '');
  const [nonStrikerName, setNonStrikerName] = useState(savedSession?.nonStrikerName || '');
  const [bowlerName, setBowlerName] = useState(savedSession?.bowlerName || '');

  const [strikerRuns, setStrikerRuns] = useState(savedSession?.strikerRuns || 0);
  const [strikerBalls, setStrikerBalls] = useState(savedSession?.strikerBalls || 0);
  const [strikerFours, setStrikerFours] = useState(savedSession?.strikerFours || 0);
  const [strikerSixes, setStrikerSixes] = useState(savedSession?.strikerSixes || 0);
  const [nonStrikerRuns, setNonStrikerRuns] = useState(savedSession?.nonStrikerRuns || 0);
  const [nonStrikerBalls, setNonStrikerBalls] = useState(savedSession?.nonStrikerBalls || 0);
  const [nonStrikerFours, setNonStrikerFours] = useState(savedSession?.nonStrikerFours || 0);
  const [nonStrikerSixes, setNonStrikerSixes] = useState(savedSession?.nonStrikerSixes || 0);

  const [bowlerOvers, setBowlerOvers] = useState(savedSession?.bowlerOvers || 0);
  const [bowlerBalls, setBowlerBalls] = useState(savedSession?.bowlerBalls || 0);
  const [bowlerRuns, setBowlerRuns] = useState(savedSession?.bowlerRuns || 0);
  const [bowlerWickets, setBowlerWickets] = useState(savedSession?.bowlerWickets || 0);
  const [bowlingFigures, setBowlingFigures] = useState(savedSession?.bowlingFigures || {});
  const [battingCard, setBattingCard] = useState<BatterCardEntry[]>(ensureArray<BatterCardEntry>(savedSession?.battingCard));

  // New batter modal state
  const [showNewBatterModal, setShowNewBatterModal] = useState(false);
  const [newBatterInput, setNewBatterInput] = useState('');
  const [incomingBatterEnd, setIncomingBatterEnd] = useState<BatterEnd>('striker');
  const [dismissedBatterNames, setDismissedBatterNames] = useState<string[]>(ensureArray<string>(savedSession?.dismissedBatterNames));
  const [lastDismissalLabel, setLastDismissalLabel] = useState('');

  // A new bowler is compulsory after every completed over.
  const [showNewBowlerModal, setShowNewBowlerModal] = useState(false);
  const [newBowlerInput, setNewBowlerInput] = useState('');
  const [pendingBowlerChange, setPendingBowlerChange] = useState(false);
  const [showInningsEndModal, setShowInningsEndModal] = useState(false);
  const [matchCompleted, setMatchCompleted] = useState(false);
  const [showShotGround, setShowShotGround] = useState(false);
  const [pendingShotRuns, setPendingShotRuns] = useState<number | null>(null);
  const [playerOfMatch, setPlayerOfMatch] = useState('');
  const playerOfMatchRef = useRef('');
  const choosePlayerOfMatch = (name: string) => {
    playerOfMatchRef.current = name;
    setPlayerOfMatch(name);
  };
  const [showManualPlayerModal, setShowManualPlayerModal] = useState(false);
  const [manualPlayerFor, setManualPlayerFor] = useState<'batter' | 'bowler'>('batter');
  const [voiceOn, setVoiceOn] = useState(false);
  const [manualPlayer, setManualPlayer] = useState({
    name: '', jerseyNumber: '', role: 'Batter' as PlayerRole,
    battingStyle: 'Right-hand Bat' as BattingStyle,
    bowlingStyle: 'N/A' as BowlingStyle, nationality: '',
  });
  const [showWeatherModal, setShowWeatherModal] = useState(false);
  const [weatherTab, setWeatherTab] = useState<'dls' | 'end' | 'abandon'>('dls');
  const [abandonReason, setAbandonReason] = useState<string>('Rain');
  const [abandonNote, setAbandonNote] = useState('');
  const [padFlash, setPadFlash] = useState<string | null>(null);
  const padFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (padFlashTimer.current) clearTimeout(padFlashTimer.current);
  }, []);

  const [dlsOversInput, setDlsOversInput] = useState('');
  const [dlsPreview, setDlsPreview] = useState('');

  const ABANDON_REASONS = [
    'Rain',
    'Bad Light',
    'Unsafe Conditions',
    'Pitch Issues',
    'Crowd / Security',
    'Other',
  ] as const;

  // History stack for infinite undos (persisted on the match so it survives app restarts)
  interface HistoryState {
    inningsNumber: 1 | 2;
    battingTeam: 'A' | 'B';
    runs: number;
    wickets: number;
    overs: number;
    balls: number;
    extras: { wides: number; noBalls: number; byes: number; legByes: number };
    ballLog: string[];
    strikerName: string;
    nonStrikerName: string;
    strikerRuns: number;
    strikerBalls: number;
    strikerFours: number;
    strikerSixes: number;
    nonStrikerRuns: number;
    nonStrikerBalls: number;
    nonStrikerFours: number;
    nonStrikerSixes: number;
    bowlerName: string;
    bowlerOvers: number;
    bowlerBalls: number;
    bowlerRuns: number;
    bowlerWickets: number;
    bowlingFigures: Record<string, { overs: number; balls: number; runs: number; wickets: number }>;
    battingCard: BatterCardEntry[];
    dismissedBatterNames: string[];
  }
  const [history, setHistory] = useState<HistoryState[]>(
    ensureArray<HistoryState>(savedSession?.undoHistory),
  );

  if (!match) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>No match found to score.</Text>
        <BackButton onPress={() => navigation.goBack()} label="Go Back" color={Colors.onPrimary} style={[styles.backBtn, { alignSelf: 'center' }]} />
      </View>
    );
  }

  if (match.status === 'COMPLETED' || match.status === 'ABANDONED') {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>This match is completed. Scoring is closed.</Text>
        <BackButton onPress={() => navigation.goBack()} label="Go Back" color={Colors.onPrimary} style={[styles.backBtn, { alignSelf: 'center' }]} />
      </View>
    );
  }

  // Narrowed for nested scorers below (TS does not retain guards inside closures).
  // Firebase RTDB drops empty `innings: {}`, so always normalize before scoring.
  const currentMatch: Match = {
    ...match,
    innings: match.innings ?? {},
  };

  function saveMatchScore(data: any) {
    updateMatch(currentMatch.id, data);
    // Keep the scoring pad snappy — Firebase sync runs after the UI paint.
    InteractionManager.runAfterInteractions(() => {
      persistMatchUpdate(currentMatch.id, data).catch((error: unknown) => {
        console.warn('Live score was saved locally but could not be synced to Firebase:', error);
      });
    });
  }

  function scoringSession(overrides: Partial<NonNullable<Match['liveScoring']>> = {}) {
    return {
      setupComplete: true,
      battingTeam,
      strikerName,
      nonStrikerName,
      bowlerName,
      strikerRuns,
      strikerBalls,
      strikerFours,
      strikerSixes,
      nonStrikerRuns,
      nonStrikerBalls,
      nonStrikerFours,
      nonStrikerSixes,
      bowlerOvers,
      bowlerBalls,
      bowlerRuns,
      bowlerWickets,
      bowlingFigures: { ...(bowlingFigures || {}) },
      battingCard: [...(battingCard || [])],
      ballLog: [...(ballLog || [])],
      dismissedBatterNames: [...(dismissedBatterNames || [])],
      undoHistory: history,
      updatedAt: Date.now(),
      updatedBy: user?.id,
      ...overrides,
    };
  }

  function snapshotHistory(): HistoryState {
    return {
      inningsNumber,
      battingTeam,
      runs,
      wickets,
      overs,
      balls,
      extras: { ...(extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 }) },
      ballLog: [...(ballLog || [])],
      strikerName,
      nonStrikerName,
      strikerRuns,
      strikerBalls,
      strikerFours,
      strikerSixes,
      nonStrikerRuns,
      nonStrikerBalls,
      nonStrikerFours,
      nonStrikerSixes,
      bowlerName,
      bowlerOvers,
      bowlerBalls,
      bowlerRuns,
      bowlerWickets,
      bowlingFigures: { ...(bowlingFigures || {}) },
      battingCard: [...(battingCard || [])],
      dismissedBatterNames: [...(dismissedBatterNames || [])],
    };
  }

  // Full squad is always available. Playing XI is optional and can grow as names are entered during the match.
  const teamAPlayersAll = players.filter(p => p.teamId === currentMatch.teamA);
  const teamBPlayersAll = players.filter(p => p.teamId === currentMatch.teamB);
  const teamAPlayers = teamAPlayersAll;
  const teamBPlayers = teamBPlayersAll;

  const battingPlayers = battingTeam === 'A' ? teamAPlayers : teamBPlayers;
  const bowlingPlayers = battingTeam === 'A' ? teamBPlayers : teamAPlayers;
  const battingTeamName = battingTeam === 'A' ? currentMatch.teamAName : currentMatch.teamBName;
  const bowlingTeamName = battingTeam === 'A' ? currentMatch.teamBName : currentMatch.teamAName;
  const battingTeamId = battingTeam === 'A' ? currentMatch.teamA : currentMatch.teamB;
  const bowlingTeamId = battingTeam === 'A' ? currentMatch.teamB : currentMatch.teamA;
  const allTeams = [...localTeams, ...hubTeams];
  const battingTeamMeta = allTeams.find(t => t.id === battingTeamId) || allTeams.find(t => t.name === battingTeamName);
  const bowlingTeamMeta = allTeams.find(t => t.id === bowlingTeamId) || allTeams.find(t => t.name === bowlingTeamName);
  const battingLogo =
    (battingTeam === 'A' ? currentMatch.teamALogo : currentMatch.teamBLogo) || battingTeamMeta?.logoURL;
  const bowlingLogo =
    (battingTeam === 'A' ? currentMatch.teamBLogo : currentMatch.teamALogo) || bowlingTeamMeta?.logoURL;
  const battingShort = battingTeamMeta?.shortName || battingTeamName.slice(0, 3).toUpperCase();
  const bowlingShort = bowlingTeamMeta?.shortName || bowlingTeamName.slice(0, 3).toUpperCase();

  /** Firebase RTDB may return arrays as objects — always normalize to a real array. */
  function asNameList(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((n): n is string => typeof n === 'string' && !!n.trim());
    }
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, unknown>).filter(
        (n): n is string => typeof n === 'string' && !!n.trim(),
      );
    }
    return [];
  }

  function asRecordList<T extends Record<string, any>>(value: unknown): T[] {
    if (Array.isArray(value)) return value.filter(Boolean) as T[];
    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, T>).filter(Boolean);
    }
    return [];
  }

  /** Deduplicate player names (case-insensitive), keeping first spelling seen. */
  function uniquePlayerNames(...lists: Array<Array<string | undefined | null> | undefined | null>): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    lists.forEach(list => {
      (list || []).forEach(raw => {
        const name = (raw || '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(name);
      });
    });
    return out;
  }

  /** Pull fielder name from dismissal text like "Caught (Ahmed) b Ahsan". */
  function fielderNameFromOut(out?: string): string | undefined {
    if (!out) return undefined;
    const match = out.match(/\(([^)]+)\)\s*b\s+/i);
    return match?.[1]?.trim() || undefined;
  }

  /**
   * Names added while bowling/fielding in the first innings (overs + catches),
   * so they can be offered as batters in the second innings.
   */
  function firstInningsBowlingSideNames(): string[] {
    const first = currentMatch.innings?.first;
    if (!first) return [];
    const bowlers = asRecordList<{ name?: string }>(first.bowling).map(b => b.name);
    const fielders = asRecordList<{ out?: string }>(first.batting).map(b => fielderNameFromOut(b.out));
    return uniquePlayerNames(bowlers, fielders);
  }

  /**
   * Names added while batting in the first innings, so they can be offered as
   * bowlers when that side fields in the second innings.
   */
  function firstInningsBattingSideNames(): string[] {
    const first = currentMatch.innings?.first;
    if (!first) return [];
    return uniquePlayerNames(
      asRecordList<{ name?: string }>(first.batting).map(b => b.name),
    );
  }

  function toPlayerOptions(
    names: string[],
    squad: typeof battingPlayers,
  ): Array<{ id: string; name: string }> {
    return names.map(name => {
      const player = (squad || []).find(p => p.name.toLowerCase() === name.toLowerCase());
      return { id: player?.id || `name:${name.toLowerCase()}`, name: player?.name || name };
    });
  }

  /**
   * Batter chips: squad + playing XI, and in 2nd innings also first-innings
   * bowlers/fielders who were typed in during overs or catches.
   */
  const availableBatterOptions: Array<{ id: string; name: string }> = (() => {
    const xiNames = asNameList(
      battingTeam === 'A'
        ? (currentMatch.playingXI?.teamA ?? xiTeamA)
        : (currentMatch.playingXI?.teamB ?? xiTeamB),
    );
    const fromFirstInnings = inningsNumber === 2 ? firstInningsBowlingSideNames() : [];
    const names = uniquePlayerNames(
      (battingPlayers || []).map(p => p.name),
      xiNames,
      fromFirstInnings,
    );
    return toPlayerOptions(names, battingPlayers);
  })();

  /**
   * Bowler chips: squad + playing XI + anyone who already bowled this innings,
   * and in 2nd innings also first-innings batters (typed during batting time).
   */
  const availableBowlerOptions: Array<{ id: string; name: string }> = (() => {
    const xiNames = asNameList(
      battingTeam === 'A'
        ? (currentMatch.playingXI?.teamB ?? xiTeamB)
        : (currentMatch.playingXI?.teamA ?? xiTeamA),
    );
    const alreadyBowled = Object.keys(bowlingFigures || {});
    const fromFirstInnings = inningsNumber === 2 ? firstInningsBattingSideNames() : [];
    const names = uniquePlayerNames(
      (bowlingPlayers || []).map(p => p.name),
      xiNames,
      alreadyBowled,
      fromFirstInnings,
    );
    return toPlayerOptions(names, bowlingPlayers);
  })();

  function bowlingFigureFor(name: string) {
    const figures = bowlingFigures || {};
    if (figures[name]) return figures[name];
    const key = Object.keys(figures).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? figures[key] : { overs: 0, balls: 0, runs: 0, wickets: 0 };
  }
  const inningsOversLimit = getEffectiveOvers(currentMatch, inningsNumber);
  const maxBowlerOvers = maxOversPerBowler(inningsOversLimit);
  const minBowlers = minBowlersForFullInnings(inningsOversLimit);
  const matchSettings = resolveMatchSettings(currentMatch);
  const ballsPerOver = legalBallsPerOver(matchSettings);
  const maxDeliveries = maxDeliveriesPerOver(matchSettings);
  const maxWickets = allOutWickets(matchSettings);
  const chaseTarget = getChaseTarget(currentMatch);
  const dlsMinOvers = minOversForResult(currentMatch.dls?.originalOvers ?? currentMatch.overs);

  function buildInningsSummary(params: {
    runs: number; wickets: number; overs: number; balls: number;
    extras: { wides: number; noBalls: number; byes: number; legByes: number };
    figures: Record<string, { overs: number; balls: number; runs: number; wickets: number }>;
    dismissed: BatterCardEntry[];
    sName: string; nsName: string;
    sRuns: number; sBalls: number; sFours: number; sSixes: number;
    nsRuns: number; nsBalls: number; nsFours: number; nsSixes: number;
  }) {
    const batting = buildLiveBattingCard({
      dismissed: params.dismissed,
      strikerName: params.sName,
      nonStrikerName: params.nsName,
      strikerRuns: params.sRuns,
      strikerBalls: params.sBalls,
      strikerFours: params.sFours,
      strikerSixes: params.sSixes,
      nonStrikerRuns: params.nsRuns,
      nonStrikerBalls: params.nsBalls,
      nonStrikerFours: params.nsFours,
      nonStrikerSixes: params.nsSixes,
      players,
    });
    return {
      battingTeam: battingTeam === 'A' ? currentMatch.teamA : currentMatch.teamB,
      runs: params.runs,
      wickets: params.wickets,
      overs: params.overs,
      balls: params.balls,
      extras: {
        wides: params.extras.wides,
        noBalls: params.extras.noBalls,
        byes: params.extras.byes,
        legByes: params.extras.legByes,
        total: params.extras.wides + params.extras.noBalls + params.extras.byes + params.extras.legByes,
      },
      batting,
      bowling: buildBowlingFromFigures(params.figures, players),
    };
  }

  function applyCareerStats(completedMatch: Match) {
    if (completedMatch.liveScoring?.statsApplied) return;
    const deltas = careerDeltasFromMatch(completedMatch);
    deltas.forEach((delta, nameKey) => {
      const player = players.find(p => p.name.toLowerCase() === nameKey);
      if (!player) return;
      const merged = mergeCareerDelta(player, delta);
      updatePlayer(player.id, merged);
      updateRemotePlayer(player.id, merged).catch(() => {});
    });
    saveMatchScore({ liveScoring: { ...completedMatch.liveScoring, statsApplied: true } });
  }

  function openManualPlayerRegistration(forRole: 'batter' | 'bowler') {
    setManualPlayerFor(forRole);
    setManualPlayer({
      name: '', jerseyNumber: '', role: forRole === 'batter' ? 'Batter' : 'Bowler',
      battingStyle: 'Right-hand Bat', bowlingStyle: forRole === 'batter' ? 'N/A' : 'Right-arm Medium',
      nationality: '',
    });
    setShowManualPlayerModal(true);
  }

  async function registerManualPlayer() {
    if (!manualPlayer.name.trim() || !manualPlayer.jerseyNumber.trim()) {
      showAlert('Missing details', 'Player name and jersey number are required. Photo is optional.');
      return;
    }
    const team = manualPlayerFor === 'batter'
      ? (battingTeam === 'A' ? { id: currentMatch.teamA, name: currentMatch.teamAName } : { id: currentMatch.teamB, name: currentMatch.teamBName })
      : (battingTeam === 'A' ? { id: currentMatch.teamB, name: currentMatch.teamBName } : { id: currentMatch.teamA, name: currentMatch.teamAName });
    const name = manualPlayer.name.trim();
    try {
      await addRemotePlayer({
        clubId: currentMatch.clubId || useScopeStore.getState().selectedClubId || '',
        name, teamId: team.id, teamName: team.name,
        jerseyNumber: Number(manualPlayer.jerseyNumber), role: manualPlayer.role,
        battingStyle: manualPlayer.battingStyle, bowlingStyle: manualPlayer.bowlingStyle,
        nationality: manualPlayer.nationality.trim() || '—', dateOfBirth: '2000-01-01',
        battingStats: { matches: 0, innings: 0, runs: 0, balls: 0, notOuts: 0, highScore: 0, average: 0, strikeRate: 0, fours: 0, sixes: 0, fifties: 0, hundreds: 0 },
        bowlingStats: { innings: 0, overs: 0, maidens: 0, runs: 0, wickets: 0, economy: 0, average: 0, bestFigures: '-', fourWickets: 0, fiveWickets: 0 },
        fieldingStats: { catches: 0, stumpings: 0, runOuts: 0 },
      });
      if (manualPlayerFor === 'batter') setNewBatterInput(name);
      else setNewBowlerInput(name);
      setShowManualPlayerModal(false);
      showAlert('Player registered', `${name} was added to ${team.name}.`);
    } catch {
      showAlert('Registration failed', 'Could not add this player to Firebase. Please try again.');
    }
  }

  const formatOver = (o: number, b: number) => `${o}.${b}`;
  const totalRuns = runs;

  function addBall(
    runCount: number,
    extra: ExtraType = null,
    wicket: boolean = false,
    batterOut: BatterEnd = 'striker',
    dismissal: DismissalType = null,
    shotZone?: string,
  ) {
    // 1. Snapshot current state for history (persisted with the ball save)
    const snap = snapshotHistory();
    const nextHistory = [...(history || []), snap];
    setHistory(nextHistory);

    // 2. Compute next states
    const isRetiredHurt = dismissal === 'Retired Hurt';
    const isExtra = extra !== null;
    const widePenalty = extra === 'wide' && matchSettings.countWideExtras ? 1 : 0;
    const noBallPenalty = extra === 'noBall' && matchSettings.countNoBallExtras ? 1 : 0;
    let nextRuns = runs + (isRetiredHurt ? 0 : (runCount + widePenalty + noBallPenalty));
    let nextWickets = wickets;
    let nextOvers = overs;
    let nextBalls = balls;

    const nextExtras = { ...extras };
    if (!isRetiredHurt) {
      if (extra === 'wide') nextExtras.wides += widePenalty + (matchSettings.addWideRunsToBatsman ? 0 : runCount);
      if (extra === 'noBall') nextExtras.noBalls += noBallPenalty;
      if (extra === 'bye') nextExtras.byes += runCount;
      if (extra === 'legBye') nextExtras.legByes += runCount;
      setExtras(nextExtras);
    }

    // Over & delivery logic (retire hurt is not a delivery)
    let isBowlerBall = false;
    let extraEndedOver = false;
    if (!isRetiredHurt && extra !== 'wide' && extra !== 'noBall') {
      isBowlerBall = true;
      const tempBalls = balls + 1;
      if (tempBalls >= ballsPerOver) {
        nextOvers += 1;
        nextBalls = 0;
      } else {
        nextBalls = tempBalls;
      }
    } else if (!isRetiredHurt && (extra === 'wide' || extra === 'noBall') && matchSettings.maxBallsPerOverIncludingExtras) {
      const deliveries = deliveriesInCurrentOver(ballLog, ballsPerOver) + 1;
      if (deliveries >= maxDeliveries) {
        nextOvers += 1;
        nextBalls = 0;
        extraEndedOver = true;
      }
    }

    if (wicket && !isRetiredHurt) {
      nextWickets += 1;
    }

    setRuns(nextRuns);
    setWickets(nextWickets);
    setOvers(nextOvers);
    setBalls(nextBalls);

    // Update Player specific stats
    let nextStrikerRuns = strikerRuns;
    let nextStrikerBalls = strikerBalls;
    let nextStrikerFours = strikerFours;
    let nextStrikerSixes = strikerSixes;
    let nextNonStrikerRuns = nonStrikerRuns;
    let nextNonStrikerBalls = nonStrikerBalls;
    let nextNonStrikerFours = nonStrikerFours;
    let nextNonStrikerSixes = nonStrikerSixes;

    let nextBowlerRuns = bowlerRuns;
    let nextBowlerBalls = bowlerBalls;
    let nextBowlerOvers = bowlerOvers;
    let nextBowlerWickets = bowlerWickets;

    // Bowler runs update
    if (!isRetiredHurt) {
      if (extra === 'wide') {
        nextBowlerRuns += runCount + widePenalty;
      } else if (extra === 'noBall') {
        nextBowlerRuns += runCount + noBallPenalty;
      } else if (extra !== 'bye' && extra !== 'legBye') {
        nextBowlerRuns += runCount;
      }
    }

    // Bowler deliveries faced
    if (isBowlerBall) {
      const tempBowlerBalls = bowlerBalls + 1;
      if (tempBowlerBalls >= ballsPerOver) {
        nextBowlerOvers += 1;
        nextBowlerBalls = 0;
      } else {
        nextBowlerBalls = tempBowlerBalls;
      }
    }

    // Run outs and retired hurt are not credited to the bowler.
    if (wicket && dismissal !== 'Run Out' && !isRetiredHurt) {
      nextBowlerWickets += 1;
    }

    // Striker runs/balls faced (ICC: wides are not balls faced; no-balls are)
    if (!isRetiredHurt) {
      if (extra === 'wide') {
        if (matchSettings.addWideBallsToBatsman) nextStrikerBalls += 1;
        if (matchSettings.addWideRunsToBatsman) nextStrikerRuns += runCount;
      } else {
        nextStrikerBalls += 1;
        if (extra === null || extra === 'noBall') {
          nextStrikerRuns += runCount;
          if (extra === 'noBall' && matchSettings.addNoBallExtrasToBatsman) nextStrikerRuns += noBallPenalty;
          if (runCount === 4) nextStrikerFours += 1;
          if (runCount === 6) nextStrikerSixes += 1;
        }
      }
    }

    // ICC strike rotation (odd completed runs; end of over flips; wide/nb penalty ignored)
    const isOverComplete = (isBowlerBall && nextBalls === 0) || extraEndedOver;
    const shouldRotate = shouldRotateStrike({
      runCount,
      extra,
      overComplete: isOverComplete,
      isNonDelivery: isRetiredHurt,
    });

    let nextStrikerName = strikerName;
    let nextNonStrikerName = nonStrikerName;

    if (shouldRotate) {
      const tempN = nextStrikerName;
      nextStrikerName = nextNonStrikerName;
      nextNonStrikerName = tempN;

      const tempR = nextStrikerRuns;
      nextStrikerRuns = nextNonStrikerRuns;
      nextNonStrikerRuns = tempR;

      const tempB = nextStrikerBalls;
      nextStrikerBalls = nextNonStrikerBalls;
      nextNonStrikerBalls = tempB;

      const tempF = nextStrikerFours;
      nextStrikerFours = nextNonStrikerFours;
      nextNonStrikerFours = tempF;

      const tempS = nextStrikerSixes;
      nextStrikerSixes = nextNonStrikerSixes;
      nextNonStrikerSixes = tempS;
    }

    setStrikerName(nextStrikerName);
    setNonStrikerName(nextNonStrikerName);
    setStrikerRuns(nextStrikerRuns);
    setStrikerBalls(nextStrikerBalls);
    setStrikerFours(nextStrikerFours);
    setStrikerSixes(nextStrikerSixes);
    setNonStrikerRuns(nextNonStrikerRuns);
    setNonStrikerBalls(nextNonStrikerBalls);
    setNonStrikerFours(nextNonStrikerFours);
    setNonStrikerSixes(nextNonStrikerSixes);

    setBowlerRuns(nextBowlerRuns);
    setBowlerBalls(nextBowlerBalls);
    setBowlerOvers(nextBowlerOvers);
    setBowlerWickets(nextBowlerWickets);
    const nextBowlingFigures = {
      ...bowlingFigures,
      [bowlerName]: {
        overs: nextBowlerOvers,
        balls: nextBowlerBalls,
        runs: nextBowlerRuns,
        wickets: nextBowlerWickets,
      },
    };
    setBowlingFigures(nextBowlingFigures);

    const batterWhoWasOut = batterOut === 'striker' ? strikerName : nonStrikerName;
    // Once batters crossed for an odd number, the dismissed batter occupies the
    // opposite end in the post-delivery state.
    const replacementEnd: BatterEnd = batterOut === 'striker'
      ? (shouldRotate ? 'nonStriker' : 'striker')
      : (shouldRotate ? 'striker' : 'nonStriker');

    let nextBattingCard = [...(battingCard || [])];
    let nextDismissedNames = [...(dismissedBatterNames || [])];
    if (wicket) {
      // Final line for the batter who was out (pre-rotation striker faces the ball)
      const dismissedRuns = isRetiredHurt
        ? (batterOut === 'striker' ? strikerRuns : nonStrikerRuns)
        : batterOut === 'striker'
          ? (extra !== 'wide' && (extra === null || extra === 'noBall') ? strikerRuns + runCount : strikerRuns)
          : nonStrikerRuns;
      const dismissedBalls = isRetiredHurt
        ? (batterOut === 'striker' ? strikerBalls : nonStrikerBalls)
        : batterOut === 'striker'
          ? (extra !== 'wide' ? strikerBalls + 1 : strikerBalls)
          : nonStrikerBalls;
      const dismissedFours = isRetiredHurt
        ? (batterOut === 'striker' ? strikerFours : nonStrikerFours)
        : batterOut === 'striker'
          ? ((extra === null || extra === 'noBall') && runCount === 4 ? strikerFours + 1 : strikerFours)
          : nonStrikerFours;
      const dismissedSixes = isRetiredHurt
        ? (batterOut === 'striker' ? strikerSixes : nonStrikerSixes)
        : batterOut === 'striker'
          ? ((extra === null || extra === 'noBall') && runCount === 6 ? strikerSixes + 1 : strikerSixes)
          : nonStrikerSixes;
      const outLabel = dismissal === 'Retired Hurt'
        ? 'retired hurt'
        : dismissal
          ? (fielderName.trim() && (dismissal === 'Caught' || dismissal === 'Run Out' || dismissal === 'Stumped')
            ? `${dismissal} (${fielderName.trim()}) b ${bowlerName}`
            : `${dismissal} b ${bowlerName}`)
          : 'OUT';
      nextBattingCard = [
        ...battingCard,
        {
          playerId: players.find(p => p.name.toLowerCase() === batterWhoWasOut.toLowerCase())?.id || batterWhoWasOut,
          name: batterWhoWasOut,
          runs: dismissedRuns,
          balls: dismissedBalls,
          fours: dismissedFours,
          sixes: dismissedSixes,
          strikeRate: strikeRate(dismissedRuns, dismissedBalls),
          status: dismissal === 'Retired Hurt' ? 'RETIRED_HURT' : 'OUT',
          out: outLabel,
        },
      ];
      nextDismissedNames = dismissal === 'Retired Hurt'
        ? [...(dismissedBatterNames || [])]
        : [...(dismissedBatterNames || []), batterWhoWasOut];
      setBattingCard(nextBattingCard);
      setLastDismissalLabel(outLabel);
    }

    const liveSummary = buildInningsSummary({
      runs: nextRuns, wickets: nextWickets, overs: nextOvers, balls: nextBalls,
      extras: nextExtras, figures: nextBowlingFigures,
      dismissed: nextBattingCard,
      sName: nextStrikerName,
      nsName: nextNonStrikerName,
      sRuns: nextStrikerRuns, sBalls: nextStrikerBalls, sFours: nextStrikerFours, sSixes: nextStrikerSixes,
      nsRuns: nextNonStrikerRuns, nsBalls: nextNonStrikerBalls, nsFours: nextNonStrikerFours, nsSixes: nextNonStrikerSixes,
    });

    const updatedInnings = inningsNumber === 1
      ? { ...currentMatch.innings, first: liveSummary }
      : { ...currentMatch.innings, second: liveSummary };

    const labelBase = isRetiredHurt
      ? 'RH'
      : wicket
        ? (runCount ? `W+${runCount}` : 'W')
        : extra === 'wide' ? `Wd${runCount || ''}` : extra === 'noBall' ? `Nb+${runCount}` : extra === 'bye' ? `B${runCount}` : extra === 'legBye' ? `LB${runCount}` : String(runCount);
    const label = shotZone && !wicket ? `${labelBase}→${shotZone}` : labelBase;
    const nextBallLog = [...(ballLog || []), label];
    const allOut = nextWickets >= maxWickets;
    const oversFinished = nextOvers >= inningsOversLimit && nextBalls === 0;
    const targetToWin = chaseTarget ?? ((currentMatch.innings?.first?.runs || 0) + 1);
    const chaseCompleted = inningsNumber === 2 && nextRuns >= targetToWin;
    const inningsFinished = allOut || oversFinished || chaseCompleted;
    const secondInningsFinished = inningsNumber === 2 && inningsFinished;
    // Stay LIVE until finishMatch confirms Player of the Match — avoids results without PoM.
    const nextStatus: Match['status'] = 'LIVE';
    const dlsTag = dlsResultSuffix(currentMatch);
    const resultText = inningsNumber === 1
      ? undefined
      : chaseCompleted
        ? `${battingTeamName} won by ${maxWickets - nextWickets} wickets${dlsTag}`
        : secondInningsFinished
          ? (nextRuns === targetToWin - 1
            ? `Match tied${dlsTag}`
            : nextRuns >= targetToWin
              ? `${battingTeamName} won by ${maxWickets - nextWickets} wickets${dlsTag}`
              : `${bowlingTeamName} won by ${targetToWin - 1 - nextRuns} runs${dlsTag}`)
          : undefined;

    // Persist manually entered fielders onto the bowling side's XI so they appear
    // as batters when that side bats in the second innings.
    let nextPlayingXI = currentMatch.playingXI;
    if (
      wicket
      && fielderName.trim()
      && (dismissal === 'Caught' || dismissal === 'Run Out' || dismissal === 'Stumped')
    ) {
      nextPlayingXI = playingXIWithNames([], [fielderName.trim()]);
      setXiTeamA(nextPlayingXI.teamA);
      setXiTeamB(nextPlayingXI.teamB);
    }

    saveMatchScore({
      status: nextStatus,
      innings: updatedInnings,
      currentInnings: inningsNumber,
      result: resultText,
      ...(nextPlayingXI ? { playingXI: nextPlayingXI } : {}),
      liveScoring: scoringSession({
        strikerName: nextStrikerName, nonStrikerName: nextNonStrikerName,
        strikerRuns: nextStrikerRuns, strikerBalls: nextStrikerBalls,
        strikerFours: nextStrikerFours, strikerSixes: nextStrikerSixes,
        nonStrikerRuns: nextNonStrikerRuns, nonStrikerBalls: nextNonStrikerBalls,
        nonStrikerFours: nextNonStrikerFours, nonStrikerSixes: nextNonStrikerSixes,
        bowlerOvers: nextBowlerOvers, bowlerBalls: nextBowlerBalls,
        bowlerRuns: nextBowlerRuns, bowlerWickets: nextBowlerWickets,
        bowlingFigures: nextBowlingFigures,
        battingCard: nextBattingCard,
        ballLog: nextBallLog,
        dismissedBatterNames: nextDismissedNames,
        undoHistory: nextHistory,
      }),
    });
    setBallLog(log => [...(log || []), label]);
    if (voiceOn) {
      const spoken = label
        .replace(/^Wd/i, 'Wide ')
        .replace(/^Nb/i, 'No ball ')
        .replace(/^LB/i, 'Leg bye ')
        .replace(/^B(?!\+)/i, 'Bye ')
        .replace(/^W$/i, 'Wicket')
        .replace(/^W\+/i, 'Wicket plus ')
        .replace(/→/g, ' to ');
      const line = `${spoken}. ${nextRuns} for ${nextWickets}`;
      InteractionManager.runAfterInteractions(() => speakText(line));
    }

    setExtraType(null);
    setIsWicket(false);
    setDismissalType(null);
    setShowDismissal(false);

    if (secondInningsFinished) {
      // Defer career-stat write until Player of the Match is confirmed.
      const suggested = suggestPlayerOfMatch({
        ...currentMatch,
        status: 'COMPLETED',
        result: resultText,
        innings: updatedInnings,
      });
      if (suggested) choosePlayerOfMatch(suggested);
      setMatchCompleted(true);
      setShowInningsEndModal(true);
    } else if (inningsFinished) {
      setMatchCompleted(false);
      setShowInningsEndModal(true);
    } else if (wicket) {
      setDismissedBatterNames(nextDismissedNames);
      setIncomingBatterEnd(replacementEnd);
      setPendingBowlerChange(isOverComplete);
      setShowNewBatterModal(true);
    } else if (isOverComplete) {
      setShowNewBowlerModal(true);
    }
  }

  function handleRunPress(r: number) {
    // In wicket mode, runs are only chosen for Run Out (inside the dismissal panel).
    if (isWicket) return;
    // Show ground map for scoring shots so scorers can mark where runs were taken.
    if (r > 0 && extraType !== 'wide') {
      setPendingShotRuns(r);
      setShowShotGround(true);
      return;
    }
    addBall(r, extraType);
    setExtraType(null);
  }

  function confirmShotZone(zoneLabel?: string) {
    if (pendingShotRuns == null) return;
    addBall(pendingShotRuns, extraType, false, 'striker', null, zoneLabel);
    setPendingShotRuns(null);
    setShowShotGround(false);
    setExtraType(null);
  }

  function toggleWicketMode() {
    setIsWicket(prev => {
      const next = !prev;
      if (next) {
        setExtraType(null);
        setShowDismissal(true);
        setDismissalType(null);
        setPendingRuns(0);
        setFielderName('');
        setDismissedBatter('striker');
      } else {
        setShowDismissal(false);
        setDismissalType(null);
        setPendingRuns(null);
        setFielderName('');
      }
      return next;
    });
  }

  function selectDismissalType(d: DismissalType) {
    if (!d) return;
    // Run out can include completed runs before the dismissal; others are 0-run wickets.
    if (d === 'Run Out') {
      setDismissalType(d);
      setPendingRuns(0);
      setFielderName('');
      return;
    }
    if (d === 'Caught' || d === 'Stumped') {
      setDismissalType(d);
      setPendingRuns(0);
      setFielderName('');
      return;
    }
    // Bowled / LBW / Hit Wicket — confirm immediately with 0 runs.
    setDismissalType(d);
    addBall(0, extraType, true, dismissedBatter, d);
    setPendingRuns(null);
    setShowDismissal(false);
    setFielderName('');
    setIsWicket(false);
    setExtraType(null);
  }

  function handleDismissal(type: DismissalType) {
    const needsFielder = type === 'Caught' || type === 'Run Out' || type === 'Stumped';
    if (needsFielder && !fielderName.trim()) {
      showAlert('Select fielder', `Please select who completed the ${type.toLowerCase()}.`);
      return;
    }
    if (type === 'Run Out' && pendingRuns == null) {
      showAlert('Runs completed', 'Select how many runs were completed before the run out.');
      return;
    }
    setDismissalType(type);
    const runsOnWicket = type === 'Run Out' ? (pendingRuns ?? 0) : 0;
    addBall(runsOnWicket, extraType, true, dismissedBatter, type);
    setPendingRuns(null);
    setShowDismissal(false);
    setFielderName('');
    setIsWicket(false);
    setExtraType(null);
  }

  function handleUndo() {
    if (history.length === 0) {
      showAlert('No Actions', 'Nothing left to undo.');
      return;
    }
    const prevSnap = history[history.length - 1];
    const nextHistory = history.slice(0, -1);
    const targetInnings = prevSnap.inningsNumber || inningsNumber;
    const targetBatting = prevSnap.battingTeam || battingTeam;

    // Firebase RTDB drops empty arrays — normalize every list/map from the snapshot.
    const snapBallLog = ensureArray<string>(prevSnap.ballLog);
    const snapBattingCard = ensureArray<BatterCardEntry>(prevSnap.battingCard);
    const snapDismissed = ensureArray<string>(prevSnap.dismissedBatterNames);
    const snapFigures =
      prevSnap.bowlingFigures && typeof prevSnap.bowlingFigures === 'object'
        ? prevSnap.bowlingFigures
        : {};
    const snapExtras = prevSnap.extras || { wides: 0, noBalls: 0, byes: 0, legByes: 0 };

    setInningsNumber(targetInnings);
    setBattingTeam(targetBatting);
    setRuns(prevSnap.runs || 0);
    setWickets(prevSnap.wickets || 0);
    setOvers(prevSnap.overs || 0);
    setBalls(prevSnap.balls || 0);
    setExtras(snapExtras);
    setBallLog(snapBallLog);
    setStrikerName(prevSnap.strikerName || '');
    setNonStrikerName(prevSnap.nonStrikerName || '');
    setStrikerRuns(prevSnap.strikerRuns || 0);
    setStrikerBalls(prevSnap.strikerBalls || 0);
    setStrikerFours(prevSnap.strikerFours || 0);
    setStrikerSixes(prevSnap.strikerSixes || 0);
    setNonStrikerRuns(prevSnap.nonStrikerRuns || 0);
    setNonStrikerBalls(prevSnap.nonStrikerBalls || 0);
    setNonStrikerFours(prevSnap.nonStrikerFours || 0);
    setNonStrikerSixes(prevSnap.nonStrikerSixes || 0);
    setBowlerName(prevSnap.bowlerName || '');
    setBowlerOvers(prevSnap.bowlerOvers || 0);
    setBowlerBalls(prevSnap.bowlerBalls || 0);
    setBowlerRuns(prevSnap.bowlerRuns || 0);
    setBowlerWickets(prevSnap.bowlerWickets || 0);
    setBowlingFigures(snapFigures);
    setBattingCard(snapBattingCard);
    setDismissedBatterNames(snapDismissed);
    setShowNewBatterModal(false);
    setShowNewBowlerModal(false);
    setPendingBowlerChange(false);
    setShowInningsEndModal(false);
    setShowSetup(false);
    setMatchCompleted(false);

    const undoSummary = buildInningsSummary({
      runs: prevSnap.runs || 0, wickets: prevSnap.wickets || 0,
      overs: prevSnap.overs || 0, balls: prevSnap.balls || 0,
      extras: snapExtras, figures: snapFigures, dismissed: snapBattingCard,
      sName: prevSnap.strikerName || '', nsName: prevSnap.nonStrikerName || '',
      sRuns: prevSnap.strikerRuns || 0, sBalls: prevSnap.strikerBalls || 0,
      sFours: prevSnap.strikerFours || 0, sSixes: prevSnap.strikerSixes || 0,
      nsRuns: prevSnap.nonStrikerRuns || 0, nsBalls: prevSnap.nonStrikerBalls || 0,
      nsFours: prevSnap.nonStrikerFours || 0, nsSixes: prevSnap.nonStrikerSixes || 0,
    });
    const updatedInnings = targetInnings === 1
      ? {
          ...currentMatch.innings,
          first: undoSummary,
          // Crossing back from 2nd → 1st clears unfinished second-innings progress.
          ...(inningsNumber === 2 ? { second: undefined } : {}),
        }
      : { ...currentMatch.innings, second: undoSummary };

    saveMatchScore({
      status: 'LIVE',
      innings: updatedInnings,
      currentInnings: targetInnings,
      result: targetInnings === 1 ? undefined : currentMatch.result,
      liveScoring: scoringSession({
        battingTeam: targetBatting,
        strikerName: prevSnap.strikerName || '', nonStrikerName: prevSnap.nonStrikerName || '',
        strikerRuns: prevSnap.strikerRuns || 0, strikerBalls: prevSnap.strikerBalls || 0,
        strikerFours: prevSnap.strikerFours || 0, strikerSixes: prevSnap.strikerSixes || 0,
        nonStrikerRuns: prevSnap.nonStrikerRuns || 0, nonStrikerBalls: prevSnap.nonStrikerBalls || 0,
        nonStrikerFours: prevSnap.nonStrikerFours || 0, nonStrikerSixes: prevSnap.nonStrikerSixes || 0,
        bowlerName: prevSnap.bowlerName || '', bowlerOvers: prevSnap.bowlerOvers || 0,
        bowlerBalls: prevSnap.bowlerBalls || 0, bowlerRuns: prevSnap.bowlerRuns || 0,
        bowlerWickets: prevSnap.bowlerWickets || 0, bowlingFigures: snapFigures,
        battingCard: snapBattingCard,
        ballLog: snapBallLog,
        dismissedBatterNames: snapDismissed,
        undoHistory: nextHistory,
      }),
    });

    setHistory(nextHistory);
  }

  function replacePlayerOnCard() {
    const from = replaceFrom.trim();
    const to = replaceTo.trim();
    if (!from || !to) {
      showAlert('Pick both names', 'Choose who to replace and the incoming player.');
      return;
    }
    const rename = (name: string) => (name.toLowerCase() === from.toLowerCase() ? to : name);
    const nextCard = (battingCard || []).map(row => row.name.toLowerCase() === from.toLowerCase() ? { ...row, name: to } : row);
    const nextDismissed = (dismissedBatterNames || []).map(rename);
    const nextStriker = rename(strikerName);
    const nextNon = rename(nonStrikerName);
    const nextBowler = rename(bowlerName);
    const nextFigures = Object.fromEntries(Object.entries(bowlingFigures || {}).map(([name, fig]) => [rename(name), fig]));
    setBattingCard(nextCard);
    setDismissedBatterNames(nextDismissed);
    setStrikerName(nextStriker);
    setNonStrikerName(nextNon);
    setBowlerName(nextBowler);
    setBowlingFigures(nextFigures);
    saveMatchScore({
      playingXI: {
        teamA: ensureArray<string>(currentMatch.playingXI?.teamA).map(rename),
        teamB: ensureArray<string>(currentMatch.playingXI?.teamB).map(rename),
      },
      liveScoring: scoringSession({
        strikerName: nextStriker,
        nonStrikerName: nextNon,
        bowlerName: nextBowler,
        bowlingFigures: nextFigures,
        battingCard: nextCard,
        dismissedBatterNames: nextDismissed,
      }),
    });
    setShowReplaceModal(false);
    showAlert('Player replaced', `${from} is now ${to} on this scorecard.`);
  }

  function startSecondInnings() {
    const firstSummary = currentMatch.innings?.first || buildInningsSummary({
      runs, wickets, overs, balls, extras, figures: bowlingFigures, dismissed: battingCard,
      sName: strikerName, nsName: nonStrikerName,
      sRuns: strikerRuns, sBalls: strikerBalls, sFours: strikerFours, sSixes: strikerSixes,
      nsRuns: nonStrikerRuns, nsBalls: nonStrikerBalls, nsFours: nonStrikerFours, nsSixes: nonStrikerSixes,
    });
    const nextBattingTeam: 'A' | 'B' = battingTeam === 'A' ? 'B' : 'A';
    const emptyInnings = {
      battingTeam: nextBattingTeam === 'A' ? currentMatch.teamA : currentMatch.teamB,
      runs: 0, wickets: 0, overs: 0, balls: 0,
      extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 },
      batting: [], bowling: [],
    };
    // Keep first-innings end state in undo stack so scorers can reverse into innings 1.
    const bridgedHistory = [...(history || []), snapshotHistory()];
    setHistory(bridgedHistory);
    setInningsNumber(2);
    setBattingTeam(nextBattingTeam);
    setRuns(0); setWickets(0); setOvers(0); setBalls(0);
    setExtras({ wides: 0, noBalls: 0, byes: 0, legByes: 0 });
    setBallLog([]); setDismissedBatterNames([]); setBowlingFigures({}); setBattingCard([]);
    setStrikerName(''); setNonStrikerName(''); setBowlerName('');
    setStrikerRuns(0); setStrikerBalls(0); setStrikerFours(0); setStrikerSixes(0);
    setNonStrikerRuns(0); setNonStrikerBalls(0); setNonStrikerFours(0); setNonStrikerSixes(0);
    setBowlerOvers(0); setBowlerBalls(0); setBowlerRuns(0); setBowlerWickets(0);
    setShowInningsEndModal(false);
    setSetupStep('innings');
    setShowSetup(true);

    const withFirst = { ...currentMatch, innings: { ...currentMatch.innings, first: firstSummary } };
    const dlsNext = currentMatch.dls?.applied
      ? finalizeTeam1Resources(withFirst, firstSummary)
      : currentMatch.dls;
    const targetMatch = { ...withFirst, dls: dlsNext };
    const resultLabel = formatTargetLabel(targetMatch) || `Target: ${(firstSummary.runs || runs) + 1} runs`;

    saveMatchScore({
      status: 'LIVE', currentInnings: 2,
      result: resultLabel,
      dls: dlsNext,
      innings: { ...currentMatch.innings, first: firstSummary, second: emptyInnings },
      liveScoring: scoringSession({
        setupComplete: false, battingTeam: nextBattingTeam,
        strikerName: '', nonStrikerName: '', bowlerName: '',
        strikerRuns: 0, strikerBalls: 0, strikerFours: 0, strikerSixes: 0,
        nonStrikerRuns: 0, nonStrikerBalls: 0, nonStrikerFours: 0, nonStrikerSixes: 0,
        bowlerOvers: 0, bowlerBalls: 0, bowlerRuns: 0, bowlerWickets: 0,
        bowlingFigures: {}, battingCard: [], ballLog: [], dismissedBatterNames: [],
        undoHistory: bridgedHistory,
      }),
    });
  }

  function buildEndMatchResult() {
    const targetToWin = chaseTarget ?? ((currentMatch.innings?.first?.runs || 0) + 1);
    const firstRunsForMargin = targetToWin - 1;
    const dlsTag = dlsResultSuffix(currentMatch);
    return runs === firstRunsForMargin
      ? `Match tied${dlsTag}`
      : runs < firstRunsForMargin
        ? `${bowlingTeamName} won by ${firstRunsForMargin - runs} runs${dlsTag}`
        : `${battingTeamName} won by ${maxWickets - wickets} wickets${dlsTag}`;
  }

  function buildCompletedMatchDraft(result = buildEndMatchResult()): Match {
    return {
      ...currentMatch,
      status: 'COMPLETED',
      result,
      innings: {
        ...currentMatch.innings,
        second: buildInningsSummary({
          runs, wickets, overs, balls, extras, figures: bowlingFigures, dismissed: battingCard,
          sName: strikerName, nsName: nonStrikerName,
          sRuns: strikerRuns, sBalls: strikerBalls, sFours: strikerFours, sSixes: strikerSixes,
          nsRuns: nonStrikerRuns, nsBalls: nonStrikerBalls, nsFours: nonStrikerFours, nsSixes: nonStrikerSixes,
        }),
      },
    };
  }

  function pomCandidatePlayers() {
    const winner = resolveMatchWinnerSide(buildCompletedMatchDraft());
    const roster =
      winner === 'A'
        ? teamAPlayers
        : winner === 'B'
          ? teamBPlayers
          : [...teamAPlayers, ...teamBPlayers];
    return roster.filter((p, i, arr) => arr.findIndex(x => x.name === p.name) === i).slice(0, 16);
  }

  function pomWinnerHint() {
    const winner = resolveMatchWinnerSide(buildCompletedMatchDraft());
    if (winner === 'A') return `Must be from ${currentMatch.teamAName} (winners).`;
    if (winner === 'B') return `Must be from ${currentMatch.teamBName} (winners).`;
    return 'Match tied — pick from either side.';
  }

  function finishMatch(pomOverride?: string) {
    const result = buildEndMatchResult();
    const finalInnings = buildInningsSummary({
      runs, wickets, overs, balls, extras, figures: bowlingFigures, dismissed: battingCard,
      sName: strikerName, nsName: nonStrikerName,
      sRuns: strikerRuns, sBalls: strikerBalls, sFours: strikerFours, sSixes: strikerSixes,
      nsRuns: nonStrikerRuns, nsBalls: nonStrikerBalls, nsFours: nonStrikerFours, nsSixes: nonStrikerSixes,
    });
    const updatedInnings = { ...currentMatch.innings, second: finalInnings };
    const completedDraft: Match = {
      ...currentMatch,
      status: 'COMPLETED',
      result,
      innings: updatedInnings,
    };
    let pom = (pomOverride ?? playerOfMatchRef.current ?? playerOfMatch).trim();
    if (pom && !isPlayerOnWinningTeam(completedDraft, pom)) {
      showAlert('Player of the Match', 'Player of the Match must be from the winning team.');
      const suggested = suggestPlayerOfMatch(completedDraft)?.trim() || '';
      if (suggested) choosePlayerOfMatch(suggested);
      return;
    }
    if (!pom) {
      pom = suggestPlayerOfMatch(completedDraft)?.trim() || '';
    }
    const session = scoringSession({ battingCard, bowlingFigures, statsApplied: false });
    const completed = {
      ...currentMatch,
      status: 'COMPLETED' as const,
      currentInnings: 2 as const,
      result,
      innings: updatedInnings,
      playerOfMatch: pom || undefined,
      liveScoring: session,
    };
    saveMatchScore({
      status: 'COMPLETED',
      currentInnings: 2,
      result,
      innings: updatedInnings,
      playerOfMatch: pom || undefined,
      liveScoring: session,
    });
    applyCareerStats(completed);
    setMatchCompleted(true);
    setShowInningsEndModal(false);
    showAlert(
      'Match complete',
      pom
        ? `Player of the Match: ${pom}. Scorecard, points table, and stats updated.`
        : 'Scorecard, points table, and season stats have been updated.',
    );
    navigation.goBack();
  }

  function openMatchCompleteFlow() {
    const draft = buildCompletedMatchDraft();
    const suggested = suggestPlayerOfMatch(draft);
    if (suggested) choosePlayerOfMatch(suggested);
    setMatchCompleted(true);
    setShowInningsEndModal(true);
  }

  const BallChip = ({ label }: { label: string }) => {
    const base = label.split('→')[0];
    const isW = base === 'W' || base.startsWith('W+');
    const is4 = base === '4';
    const is6 = base === '6';
    const bg = isW ? Colors.loss : is4 ? Colors.accentBlue : is6 ? Colors.win : Colors.bgElevated;
    return (
      <EaseView
        initialAnimate={{ scale: 0.55, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={scorePressTransition}
        style={[styles.ballChip, { backgroundColor: bg + '33', borderColor: bg }]}>
        <Text style={[styles.ballChipText, { color: isW ? Colors.loss : is4 ? Colors.accentBlue : is6 ? Colors.win : Colors.textSecondary }]}>{base}</Text>
      </EaseView>
    );
  };

  function flashPad(key: string) {
    if (padFlashTimer.current) clearTimeout(padFlashTimer.current);
    setPadFlash(key);
    padFlashTimer.current = setTimeout(() => {
      setPadFlash(prev => (prev === key ? null : prev));
    }, 160);
  }

  const ScoreBtn = ({ val, color }: { val: number; color?: string }) => {
    const key = `r${val}`;
    const lit = padFlash === key;
    return (
      <EasePress
        pressScale={0.86}
        transition={scorePressTransition}
        rippleColor={Colors.primary + '55'}
        onPress={() => {
          flashPad(key);
          handleRunPress(val);
        }}>
        <LinearGradient
          colors={
            lit
              ? [Colors.primary + '66', Colors.primary + '33']
              : color
                ? [color + '33', color + '22']
                : Colors.gradCard
          }
          style={[
            styles.scoreBtn,
            { width: scoreBtnSize, height: scoreBtnSize },
            color && { borderColor: color + '66' },
            lit && { borderColor: Colors.primary },
          ]}>
          <Text style={[styles.scoreBtnText, color && { color }, lit && { color: Colors.primary }]}>{val}</Text>
        </LinearGradient>
      </EasePress>
    );
  };

  const ExtraBtn = ({ label, type }: { label: string; type: ExtraType }) => {
    const selected = extraType === type;
    const lit = padFlash === type;
    return (
      <EasePress
        pressScale={0.9}
        transition={scorePressTransition}
        rippleColor={Colors.accentOrange + '55'}
        onPress={() => {
          flashPad(type || 'extra');
          setExtraType(extraType === type ? null : type);
        }}>
        <LinearGradient
          colors={
            selected || lit
              ? ['#FF6D0044', '#FF6D0022']
              : Colors.gradCard
          }
          style={[
            styles.extraBtn,
            (selected || lit) && { borderColor: Colors.accentOrange },
          ]}>
          <Text style={[styles.extraBtnText, (selected || lit) && { color: Colors.accentOrange }]}>{label}</Text>
        </LinearGradient>
      </EasePress>
    );
  };

  function toggleXiPlayer(side: 'A' | 'B', name: string) {
    const setter = side === 'A' ? setXiTeamA : setXiTeamB;
    const current = side === 'A' ? xiTeamA : xiTeamB;
    if (current.some(n => n.toLowerCase() === name.toLowerCase())) {
      setter(current.filter(n => n.toLowerCase() !== name.toLowerCase()));
      return;
    }
    if (current.length >= 11) {
      showAlert('Playing XI full', 'You can select a maximum of 11 players per team.');
      return;
    }
    setter([...current, name]);
  }

  function skipPlayingXI() {
    saveMatchScore({
      playingXI: { teamA: xiTeamA, teamB: xiTeamB },
      liveScoring: scoringSession({ setupComplete: false }),
    });
    setSetupStep('innings');
  }

  function playingXIWithNames(battingNames: string[], bowlingNames: string[]) {
    const teamA = [...(currentMatch.playingXI?.teamA || xiTeamA)];
    const teamB = [...(currentMatch.playingXI?.teamB || xiTeamB)];
    const add = (list: string[], name: string) => {
      const n = name.trim();
      if (!n) return;
      if (!list.some(x => x.toLowerCase() === n.toLowerCase())) list.push(n);
    };
    const batList = battingTeam === 'A' ? teamA : teamB;
    const bowlList = battingTeam === 'A' ? teamB : teamA;
    battingNames.forEach(n => add(batList, n));
    bowlingNames.forEach(n => add(bowlList, n));
    return { teamA, teamB };
  }

  function confirmPlayingXI() {
    saveMatchScore({
      playingXI: { teamA: xiTeamA, teamB: xiTeamB },
      liveScoring: scoringSession({ setupComplete: false }),
    });
    setSetupStep('innings');
  }

  function handleRetireHurt(end: BatterEnd) {
    setShowRetireModal(false);
    setIsWicket(false);
    setExtraType(null);
    addBall(0, null, true, end, 'Retired Hurt');
  }

  /** Manually swap who faces the next ball (keeps each batter's score intact). */
  function swapStrike() {
    if (!strikerName.trim() || !nonStrikerName.trim()) {
      showAlert('Cannot swap', 'Both striker and non-striker must be set.');
      return;
    }
    const nextStrikerName = nonStrikerName;
    const nextNonStrikerName = strikerName;
    const nextStrikerRuns = nonStrikerRuns;
    const nextStrikerBalls = nonStrikerBalls;
    const nextStrikerFours = nonStrikerFours;
    const nextStrikerSixes = nonStrikerSixes;
    const nextNonStrikerRuns = strikerRuns;
    const nextNonStrikerBalls = strikerBalls;
    const nextNonStrikerFours = strikerFours;
    const nextNonStrikerSixes = strikerSixes;

    setStrikerName(nextStrikerName);
    setNonStrikerName(nextNonStrikerName);
    setStrikerRuns(nextStrikerRuns);
    setStrikerBalls(nextStrikerBalls);
    setStrikerFours(nextStrikerFours);
    setStrikerSixes(nextStrikerSixes);
    setNonStrikerRuns(nextNonStrikerRuns);
    setNonStrikerBalls(nextNonStrikerBalls);
    setNonStrikerFours(nextNonStrikerFours);
    setNonStrikerSixes(nextNonStrikerSixes);
    setDismissedBatter('striker');

    const summary = buildInningsSummary({
      runs, wickets, overs, balls, extras, figures: bowlingFigures, dismissed: battingCard,
      sName: nextStrikerName, nsName: nextNonStrikerName,
      sRuns: nextStrikerRuns, sBalls: nextStrikerBalls, sFours: nextStrikerFours, sSixes: nextStrikerSixes,
      nsRuns: nextNonStrikerRuns, nsBalls: nextNonStrikerBalls, nsFours: nextNonStrikerFours, nsSixes: nextNonStrikerSixes,
    });
    const updatedInnings = inningsNumber === 1
      ? { ...currentMatch.innings, first: summary }
      : { ...currentMatch.innings, second: summary };

    saveMatchScore({
      innings: updatedInnings,
      liveScoring: scoringSession({
        strikerName: nextStrikerName,
        nonStrikerName: nextNonStrikerName,
        strikerRuns: nextStrikerRuns,
        strikerBalls: nextStrikerBalls,
        strikerFours: nextStrikerFours,
        strikerSixes: nextStrikerSixes,
        nonStrikerRuns: nextNonStrikerRuns,
        nonStrikerBalls: nextNonStrikerBalls,
        nonStrikerFours: nextNonStrikerFours,
        nonStrikerSixes: nextNonStrikerSixes,
      }),
    });
  }

  function openWeatherModal(tab: 'dls' | 'end' | 'abandon' = 'dls') {
    const currentLimit = getEffectiveOvers(currentMatch, inningsNumber);
    const minAllowed = balls > 0 ? overs + 1 : Math.max(overs, 1);
    const suggested = currentLimit > minAllowed ? currentLimit - 1 : minAllowed;
    setDlsOversInput(String(suggested));
    setDlsPreview('');
    setWeatherTab(tab);
    setShowWeatherModal(true);
  }

  function previewDlsRevision() {
    const revised = parseInt(dlsOversInput, 10);
    if (!Number.isFinite(revised) || revised < 1) {
      setDlsPreview('Enter a valid overs number.');
      return;
    }
    const minAllowed = balls > 0 ? overs + 1 : overs;
    if (revised < minAllowed) {
      setDlsPreview(
        balls > 0
          ? `New overs must be at least ${minAllowed} (current over in progress).`
          : `New overs must be at least ${overs} (already bowled).`,
      );
      return;
    }
    if (revised >= (currentMatch.dls?.originalOvers ?? currentMatch.overs) && !currentMatch.dls?.applied && inningsNumber === 1) {
      setDlsPreview('Choose fewer overs than the scheduled match length to apply a rain revision.');
      return;
    }

    const first = currentMatch.innings?.first;
    const team1Score = inningsNumber === 1 ? runs : (first?.runs || 0);
    const team1OversBowled = inningsNumber === 1 ? overs : (first?.overs || 0);
    const team1Balls = inningsNumber === 1 ? balls : (first?.balls || 0);
    const team1Wickets = inningsNumber === 1 ? wickets : (first?.wickets || 0);

    const { previewNote } = buildDlsRevision({
      match: currentMatch,
      inningsNumber,
      revisedOvers: revised,
      team1Score,
      team1OversBowled,
      team1Balls,
      team1Wickets,
      team1InningsComplete: inningsNumber === 2,
      team2OversBowled: inningsNumber === 2 ? overs : 0,
      team2Balls: inningsNumber === 2 ? balls : 0,
      team2Wickets: inningsNumber === 2 ? wickets : 0,
    });
    setDlsPreview(previewNote);
  }

  function applyDlsRevision() {
    const revised = parseInt(dlsOversInput, 10);
    if (!Number.isFinite(revised) || revised < 1) {
      showAlert('Invalid overs', 'Enter how many overs this innings is reduced to.');
      return;
    }
    const minAllowed = balls > 0 ? overs + 1 : overs;
    if (revised < minAllowed) {
      showAlert(
        'Too few overs',
        balls > 0
          ? `At least ${minAllowed} overs are required while this over is in progress.`
          : `${overs} overs have already been bowled.`,
      );
      return;
    }

    const first = currentMatch.innings?.first;
    const team1Score = inningsNumber === 1 ? runs : (first?.runs || 0);
    const team1OversBowled = inningsNumber === 1 ? overs : (first?.overs || 0);
    const team1Balls = inningsNumber === 1 ? balls : (first?.balls || 0);
    const team1Wickets = inningsNumber === 1 ? wickets : (first?.wickets || 0);

    const { dls, previewNote } = buildDlsRevision({
      match: currentMatch,
      inningsNumber,
      revisedOvers: revised,
      team1Score,
      team1OversBowled,
      team1Balls,
      team1Wickets,
      team1InningsComplete: inningsNumber === 2,
      team2OversBowled: inningsNumber === 2 ? overs : 0,
      team2Balls: inningsNumber === 2 ? balls : 0,
      team2Wickets: inningsNumber === 2 ? wickets : 0,
    });

    const liveSummary = buildInningsSummary({
      runs, wickets, overs, balls, extras, figures: bowlingFigures, dismissed: battingCard,
      sName: strikerName, nsName: nonStrikerName,
      sRuns: strikerRuns, sBalls: strikerBalls, sFours: strikerFours, sSixes: strikerSixes,
      nsRuns: nonStrikerRuns, nsBalls: nonStrikerBalls, nsFours: nonStrikerFours, nsSixes: nonStrikerSixes,
    });
    const updatedInnings = inningsNumber === 1
      ? { ...currentMatch.innings, first: liveSummary }
      : { ...currentMatch.innings, second: liveSummary };

    const nextMatch = { ...currentMatch, dls, innings: updatedInnings, currentInnings: inningsNumber };
    const resultLabel = inningsNumber === 2 && dls.revisedTarget != null
      ? formatTargetLabel(nextMatch)
      : currentMatch.result;

    saveMatchScore({
      dls,
      innings: updatedInnings,
      currentInnings: inningsNumber,
      result: resultLabel,
      liveScoring: scoringSession({ undoHistory: history }),
    });
    setShowWeatherModal(false);
    showAlert('DLS applied', previewNote);
  }

  function endMatchWithDls() {
    const first = currentMatch.innings?.first;
    if (inningsNumber !== 2 || !first) {
      showAlert('Not available', 'A DLS result can only be decided during the second innings.');
      return;
    }
    if (!canDecideByDls({
      scheduledOvers: currentMatch.dls?.originalOvers ?? currentMatch.overs,
      team2OversBowled: overs,
      team2Balls: balls,
    })) {
      showAlert(
        'Not enough overs',
        `At least ${dlsMinOvers} overs are required in the second innings for a DLS result. Use Abandon (No Result) instead.`,
      );
      return;
    }

    const { result, parScore, dls } = decideMatchByDls({
      match: currentMatch,
      team1Score: first.runs,
      team1Wickets: first.wickets,
      team1Overs: first.overs,
      team1Balls: first.balls,
      team2Score: runs,
      team2Wickets: wickets,
      team2OversBowled: overs,
      team2Balls: balls,
      battingTeamName,
      bowlingTeamName,
    });

    const liveSummary = buildInningsSummary({
      runs, wickets, overs, balls, extras, figures: bowlingFigures, dismissed: battingCard,
      sName: strikerName, nsName: nonStrikerName,
      sRuns: strikerRuns, sBalls: strikerBalls, sFours: strikerFours, sSixes: strikerSixes,
      nsRuns: nonStrikerRuns, nsBalls: nonStrikerBalls, nsFours: nonStrikerFours, nsSixes: nonStrikerSixes,
    });
    const updatedInnings = { ...currentMatch.innings, second: liveSummary };
    const suggested = suggestPlayerOfMatch({
      ...currentMatch,
      status: 'COMPLETED',
      result,
      dls,
      innings: updatedInnings,
    });
    if (suggested) choosePlayerOfMatch(suggested);

    showAlert(
      'End match (DLS)?',
      `Par score: ${parScore}\nCurrent: ${runs}/${wickets}\n\n${result}`,
      [
        { text: 'Keep Playing', style: 'cancel' },
        {
          text: 'Confirm Result',
          onPress: () => {
            const pom = (suggested || playerOfMatchRef.current || playerOfMatch).trim();
            const draft: Match = {
              ...currentMatch,
              status: 'COMPLETED',
              result,
              dls,
              innings: updatedInnings,
            };
            const safePom =
              pom && isPlayerOnWinningTeam(draft, pom)
                ? pom
                : suggestPlayerOfMatch(draft)?.trim() || '';
            const session = scoringSession({ battingCard, bowlingFigures, statsApplied: false });
            const completed = {
              ...currentMatch,
              status: 'COMPLETED' as const,
              currentInnings: 2 as const,
              result,
              dls,
              innings: updatedInnings,
              playerOfMatch: safePom || undefined,
              liveScoring: session,
            };
            saveMatchScore({
              status: 'COMPLETED',
              currentInnings: 2,
              result,
              dls,
              innings: updatedInnings,
              playerOfMatch: safePom || undefined,
              liveScoring: session,
            });
            applyCareerStats(completed);
            setShowWeatherModal(false);
            setMatchCompleted(true);
            showAlert('Match complete (DLS)', `${result}${safePom ? `\nPlayer of the Match: ${safePom}` : ''}`, [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          },
        },
      ],
    );
  }

  function handleAbandonMatch() {
    const reason = abandonReason === 'Other' && abandonNote.trim()
      ? abandonNote.trim()
      : abandonReason === 'Other'
        ? 'Other'
        : abandonReason;
    const resultText = `Match abandoned — ${reason} · No Result`;

    const liveSummary = buildInningsSummary({
      runs, wickets, overs, balls, extras, figures: bowlingFigures, dismissed: battingCard,
      sName: strikerName, nsName: nonStrikerName,
      sRuns: strikerRuns, sBalls: strikerBalls, sFours: strikerFours, sSixes: strikerSixes,
      nsRuns: nonStrikerRuns, nsBalls: nonStrikerBalls, nsFours: nonStrikerFours, nsSixes: nonStrikerSixes,
    });
    const updatedInnings = inningsNumber === 1
      ? { ...currentMatch.innings, first: liveSummary }
      : { ...currentMatch.innings, second: liveSummary };

    showAlert(
      'Abandon match?',
      `${resultText}\n\nBoth teams will receive 1 point (No Result). This cannot be undone from scoring.`,
      [
        { text: 'Keep Playing', style: 'cancel' },
        {
          text: 'Abandon Match',
          style: 'destructive',
          onPress: () => {
            saveMatchScore({
              status: 'ABANDONED',
              result: resultText,
              innings: updatedInnings,
              currentInnings: inningsNumber,
              liveScoring: scoringSession({
                setupComplete: true,
                undoHistory: history,
              }),
            });
            setShowWeatherModal(false);
            setMatchCompleted(true);
            showAlert('Match abandoned', resultText, [
              { text: 'OK', onPress: () => navigation.goBack() },
            ]);
          },
        },
      ],
    );
  }

  function renderWeatherModal() {
    return (
      <Modal visible={showWeatherModal} transparent animationType="slide" onRequestClose={() => setShowWeatherModal(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} keyboardShouldPersistTaps="handled">
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>☁ Rain / Weather</Text>
            <Text style={styles.modalDesc}>
              Apply ICC DLS to revise the target, decide a DLS result, or abandon as No Result.
            </Text>

            <View style={styles.tabContainer}>
              {([
                { id: 'dls' as const, label: 'Revise (DLS)' },
                { id: 'end' as const, label: 'End (DLS)' },
                { id: 'abandon' as const, label: 'Abandon' },
              ]).map(tab => (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tabButton, weatherTab === tab.id && styles.tabButtonActive]}
                  onPress={() => setWeatherTab(tab.id)}>
                  <Text style={[styles.tabText, weatherTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {weatherTab === 'dls' && (
              <>
                <Text style={styles.fieldLabel}>
                  New max overs for {inningsNumber === 1 ? 'this innings (both sides)' : 'the chase'}
                </Text>
                <Text style={styles.ruleHint}>
                  Scheduled: {currentMatch.dls?.originalOvers ?? currentMatch.overs} ov · Now bowling: {formatOver(overs, balls)} · Limit: {inningsOversLimit} ov
                  {inningsNumber === 2 && chaseTarget != null ? ` · Target: ${chaseTarget}` : ''}
                </Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  placeholder="e.g. 10"
                  placeholderTextColor={Colors.textMuted}
                  value={dlsOversInput}
                  onChangeText={setDlsOversInput}
                />
                {!!dlsPreview && (
                  <View style={styles.dlsPreviewBox}>
                    <Text style={styles.dlsPreviewText}>{dlsPreview}</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.dlsSecondaryBtn} onPress={previewDlsRevision}>
                  <Text style={styles.dlsSecondaryBtnText}>Preview revised target</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dlsConfirmBtn} onPress={applyDlsRevision}>
                  <Text style={styles.dlsConfirmBtnText}>Apply DLS Revision</Text>
                </TouchableOpacity>
              </>
            )}

            {weatherTab === 'end' && (
              <>
                <Text style={styles.modalDesc}>
                  Stop play now and decide the winner using the DLS par score.
                  Requires at least {dlsMinOvers} overs in the second innings.
                </Text>
                {inningsNumber !== 2 ? (
                  <Text style={styles.ruleHint}>Available only during the chase (2nd innings).</Text>
                ) : (
                  <Text style={styles.ruleHint}>
                    Current: {runs}/{wickets} in {formatOver(overs, balls)}
                    {chaseTarget != null ? ` · chasing ${chaseTarget}` : ''}
                  </Text>
                )}
                <TouchableOpacity
                  style={[styles.dlsConfirmBtn, inningsNumber !== 2 && { opacity: 0.45 }]}
                  disabled={inningsNumber !== 2}
                  onPress={endMatchWithDls}>
                  <Text style={styles.dlsConfirmBtnText}>Decide Winner (DLS)</Text>
                </TouchableOpacity>
              </>
            )}

            {weatherTab === 'abandon' && (
              <>
                <Text style={styles.modalDesc}>
                  End as No Result (not enough overs / cannot continue). Both teams get 1 point.
                </Text>
                {ABANDON_REASONS.map(reason => (
                  <TouchableOpacity
                    key={reason}
                    style={[styles.dismissalOption, abandonReason === reason && styles.dismissalOptionActive]}
                    onPress={() => setAbandonReason(reason)}>
                    <Text style={styles.dismissalText}>{reason}</Text>
                  </TouchableOpacity>
                ))}
                {abandonReason === 'Other' && (
                  <TextInput
                    style={styles.textInput}
                    placeholder="Describe the reason…"
                    placeholderTextColor={Colors.textMuted}
                    value={abandonNote}
                    onChangeText={setAbandonNote}
                  />
                )}
                <TouchableOpacity style={styles.abandonConfirmBtn} onPress={handleAbandonMatch}>
                  <Text style={styles.abandonConfirmText}>Confirm Abandon</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => setShowWeatherModal(false)} style={{ alignItems: 'center', paddingTop: Spacing.md }}>
              <Text style={styles.backText}>Keep Playing</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
        </View>
      </Modal>
    );
  }

  // ─── Setup Mode Render ─────────────────────────────────────────────────────────
  if (showSetup) {
    if (setupStep === 'xi') {
      return (
        <View style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
          <LinearGradient colors={Colors.gradHeader} style={styles.header}>
            <BackButton onPress={requestExit} label="Exit Setup" />
            <Text style={{ color: Colors.onPrimary, fontSize: Typography.base, fontWeight: '700' }}>Playing XI (optional)</Text>
            {renderGoLiveBtn()}
          </LinearGradient>

          <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
            <View style={styles.setupCard}>
              <Text style={styles.setupTitle}>📋 Playing XI (optional)</Text>
              <Text style={styles.ruleHint}>
                You can skip this and name players as the match goes — type them in, or register them during scoring. Pick anyone from the squad now if you already know them.
              </Text>

              {([
                { side: 'A' as const, name: currentMatch.teamAName, roster: teamAPlayersAll, selected: xiTeamA },
                { side: 'B' as const, name: currentMatch.teamBName, roster: teamBPlayersAll, selected: xiTeamB },
              ]).map(block => (
                <View key={block.side} style={{ marginBottom: Spacing.lg }}>
                  <View style={styles.xiHeaderRow}>
                    <Text style={styles.fieldLabel}>{block.name}</Text>
                    <Text style={[styles.xiCount, block.selected.length === 11 && { color: Colors.win }]}>
                      {block.selected.length}/11
                    </Text>
                  </View>
                  {block.roster.length === 0 && (
                    <Text style={styles.modalDesc}>No registered players yet — names can be added during the match.</Text>
                  )}
                  {block.roster.length > 0 && block.roster.length < 11 && (
                    <TouchableOpacity
                      style={styles.xiWarnBtn}
                      onPress={() => navigation.navigate('AdminPlayers')}>
                      <Text style={styles.xiWarnText}>
                        {block.roster.length} registered — tap to add more, or skip and add during the match
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.xiGrid}>
                    {block.roster.map(p => {
                      const selected = block.selected.some(n => n.toLowerCase() === p.name.toLowerCase());
                      return (
                        <TouchableOpacity
                          key={`${block.side}-${p.id}`}
                          onPress={() => toggleXiPlayer(block.side, p.name)}
                          style={[styles.xiChip, selected && styles.xiChipActive]}>
                          <Text style={[styles.xiChipText, selected && styles.xiChipTextActive]} numberOfLines={1}>
                            {selected ? '✓ ' : ''}{p.name}
                          </Text>
                          <Text style={styles.xiChipRole}>{p.role}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.confirmBtn} onPress={skipPlayingXI}>
                <LinearGradient colors={Colors.gradPrimary} style={styles.btnGrad}>
                  <Text style={styles.confirmBtnText}>Skip — add players during match</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.confirmBtn, { marginTop: Spacing.sm }]} onPress={confirmPlayingXI}>
                <LinearGradient colors={Colors.gradCard} style={styles.btnGrad}>
                  <Text style={[styles.confirmBtnText, { color: Colors.textPrimary }]}>
                    Continue with {xiTeamA.length + xiTeamB.length} selected
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.abandonGhostBtn}
                onPress={() => openWeatherModal('abandon')}
                activeOpacity={0.85}>
                <Text style={styles.abandonGhostText}>Rain / Weather / Cancel</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
          {renderWeatherModal()}
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
        <LinearGradient colors={Colors.gradHeader} style={styles.header}>
          {inningsNumber === 1 ? (
            <BackButton onPress={() => setSetupStep('xi')} label="Optional XI" />
          ) : (
            <BackButton onPress={requestExit} label="Exit" />
          )}
          <Text style={{ color: Colors.onPrimary, fontSize: Typography.base, fontWeight: '700' }}>Live Score Setup</Text>
          {renderGoLiveBtn()}
        </LinearGradient>

        <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <View style={styles.setupCard}>
            <Text style={styles.setupTitle}>🏏 Innings Setup</Text>
            <Text style={styles.ruleHint}>
              Pick from the squad or type names. You can add more batters and bowlers manually as the match goes on.
            </Text>
            
            <Text style={styles.setupLabel}>Batting Team</Text>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, battingTeam === 'A' && styles.tabButtonActive]}
                onPress={() => inningsNumber === 1 && setBattingTeam('A')}
                disabled={inningsNumber === 2}
              >
                <Text style={[styles.tabText, battingTeam === 'A' && styles.tabTextActive]}>{currentMatch.teamAName}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, battingTeam === 'B' && styles.tabButtonActive]}
                onPress={() => inningsNumber === 1 && setBattingTeam('B')}
                disabled={inningsNumber === 2}
              >
                <Text style={[styles.tabText, battingTeam === 'B' && styles.tabTextActive]}>{currentMatch.teamBName}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Striker Batter</Text>
            {inningsNumber === 2 && availableBatterOptions.length > 0 && (
              <Text style={styles.ruleHint}>Includes players added as bowlers/fielders in the first innings.</Text>
            )}
            {availableBatterOptions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                {availableBatterOptions.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.playerChip, strikerName === p.name && styles.playerChipActive]}
                    onPress={() => setStrikerName(p.name)}
                  >
                    <Text style={[styles.playerChipText, strikerName === p.name && styles.playerChipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TextInput
              style={styles.textInput}
              placeholder="Type striker name"
              placeholderTextColor={Colors.textMuted}
              value={strikerName}
              onChangeText={setStrikerName}
            />

            <Text style={styles.fieldLabel}>Non-Striker Batter</Text>
            {availableBatterOptions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                {availableBatterOptions.filter(p => p.name.toLowerCase() !== strikerName.toLowerCase()).map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.playerChip, nonStrikerName === p.name && styles.playerChipActive]}
                    onPress={() => setNonStrikerName(p.name)}
                  >
                    <Text style={[styles.playerChipText, nonStrikerName === p.name && styles.playerChipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TextInput
              style={styles.textInput}
              placeholder="Type non-striker name"
              placeholderTextColor={Colors.textMuted}
              value={nonStrikerName}
              onChangeText={setNonStrikerName}
            />

            <Text style={styles.fieldLabel}>Opening Bowler</Text>
            <Text style={styles.ruleHint}>ICC limited-overs: max {maxBowlerOvers} overs per bowler · at least {minBowlers} bowlers for a full innings</Text>
            {inningsNumber === 2 && availableBowlerOptions.length > 0 && (
              <Text style={styles.ruleHint}>Includes players added as batters in the first innings.</Text>
            )}
            {availableBowlerOptions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.xs }}>
                {availableBowlerOptions.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.playerChip, bowlerName === p.name && styles.playerChipActive]}
                    onPress={() => setBowlerName(p.name)}
                  >
                    <Text style={[styles.playerChipText, bowlerName === p.name && styles.playerChipTextActive]}>{p.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TextInput
              style={styles.textInput}
              placeholder="Type opening bowler name"
              placeholderTextColor={Colors.textMuted}
              value={bowlerName}
              onChangeText={setBowlerName}
            />

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => {
                if (!strikerName.trim() || !nonStrikerName.trim() || !bowlerName.trim()) {
                  showAlert('Missing Info', 'Enter or select striker, non-striker, and opening bowler to start. Other players can be added during the match.');
                  return;
                }
                if (strikerName.trim().toLowerCase() === nonStrikerName.trim().toLowerCase()) {
                  showAlert('Invalid Selection', 'Striker and Non-Striker cannot be the same batter.');
                  return;
                }
                const nextXI = playingXIWithNames(
                  [strikerName.trim(), nonStrikerName.trim()],
                  [bowlerName.trim()],
                );
                setXiTeamA(nextXI.teamA);
                setXiTeamB(nextXI.teamB);
                saveMatchScore({
                  status: 'LIVE',
                  playingXI: nextXI,
                  liveScoring: scoringSession({
                    setupComplete: true,
                    strikerName: strikerName.trim(),
                    nonStrikerName: nonStrikerName.trim(),
                    bowlerName: bowlerName.trim(),
                    strikerFours: 0, strikerSixes: 0, nonStrikerFours: 0, nonStrikerSixes: 0,
                    battingCard: [],
                  }),
                });
                setShowSetup(false);
              }}
            >
              <LinearGradient colors={Colors.gradPrimary} style={styles.btnGrad}>
                <Text style={styles.confirmBtnText}>Confirm & Start Scoring</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.abandonGhostBtn}
              onPress={() => openWeatherModal('dls')}
              activeOpacity={0.85}>
              <Text style={styles.abandonGhostText}>Rain / DLS / Cancel</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        {renderWeatherModal()}
      </View>
    );
  }

  const matchOverlaySnap = overlayModelFromMatch({
    ...currentMatch,
    currentInnings: inningsNumber,
  });

  const overlayModel = buildOverlayModel({
    teamAName: currentMatch.teamAName,
    teamBName: currentMatch.teamBName,
    runs,
    wickets,
    overs,
    balls,
    strikerName,
    strikerRuns,
    strikerBalls,
    strikerFours,
    strikerSixes,
    nonStrikerName,
    nonStrikerRuns,
    nonStrikerBalls,
    nonStrikerFours,
    nonStrikerSixes,
    bowlerName,
    bowlerOvers,
    bowlerBalls,
    bowlerRuns,
    bowlerWickets,
    battingTeamName,
    bowlingTeamName,
    battingTeamLogo: battingLogo,
    bowlingTeamLogo: bowlingLogo,
    ballLog,
    ballsPerOver,
    inningsNumber,
    chaseTarget: inningsNumber === 2 ? chaseTarget : undefined,
    inningsOversLimit,
    battingCard,
    bowlingFigures,
    extras: {
      total: extras.wides + extras.noBalls + extras.byes + extras.legByes,
      wides: extras.wides,
      noBalls: extras.noBalls,
      byes: extras.byes,
      legByes: extras.legByes,
    },
    firstInnings: inningsNumber === 2 ? matchOverlaySnap.firstInnings : undefined,
    matchResult: currentMatch.result,
    playerOfMatch: currentMatch.playerOfMatch || playerOfMatchRef.current || playerOfMatch || undefined,
  });

  // ─── Active Scoring Render ─────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />
      {onAir && <OverlayCaptureLayer model={overlayModel} capture />}

      {/* Header */}
      <LinearGradient colors={Colors.gradHeader} style={styles.header}>
        <BackButton onPress={requestExit} label="Exit Scoring" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {renderGoLiveBtn()}
          <TouchableOpacity
            onPress={() => {
              setVoiceOn(v => {
                const next = !v;
                if (!next) stopSpeaking();
                else speakText('Voice commentary on');
                return next;
              });
            }}
            style={[styles.livePill, !voiceOn && { opacity: 0.55 }]}>
            <Text style={styles.liveLabel}>{voiceOn ? 'VOICE ON' : 'VOICE'}</Text>
          </TouchableOpacity>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveLabel}>LIVE</Text>
          </View>
        </View>
      </LinearGradient>

      {onAir && (
        <View style={styles.overlayModeBar}>
          <ScorebarThemePicker compact />
          <OverlayModeSwitcher compact inningsNumber={inningsNumber} />
        </View>
      )}

      {/* Live Score Banner */}
      <LinearGradient colors={Colors.gradLiveCard} style={styles.scoreBanner}>
        <View style={styles.bannerTeams}>
          <View style={[styles.bannerTeamSide, { maxWidth: width * 0.3 }]}>
            <TeamLogoAvatar
              name={battingTeamName}
              shortName={battingShort}
              logoURL={battingLogo}
              size={bannerLogoSize}
            />
            <Text style={[styles.bannerTeam, { fontSize: bannerTeamFont }]} numberOfLines={2}>
              {battingTeamName}
            </Text>
          </View>
          <View style={styles.bannerScoreBlock}>
            <Text style={[styles.bannerScore, { fontSize: bannerScoreFont }]}>{totalRuns}/{wickets}</Text>
            <Text style={[styles.bannerOver, isNarrow && { fontSize: 11 }]}>{formatOver(overs, balls)} Ov</Text>
          </View>
          <View style={[styles.bannerTeamSide, styles.bannerTeamSideRight, { maxWidth: width * 0.3 }]}>
            <TeamLogoAvatar
              name={bowlingTeamName}
              shortName={bowlingShort}
              logoURL={bowlingLogo}
              size={bannerLogoSize}
            />
            <Text style={[styles.bannerTeam, styles.bannerTeamRight, { fontSize: bannerTeamFont }]} numberOfLines={2}>
              {bowlingTeamName}
            </Text>
          </View>
        </View>
        <View style={styles.ballsRow}>
          <Text style={styles.currentOverLabel}>This over: </Text>
          {!(overlayModel.thisOver || []).length
            ? <Text style={styles.currentOverLabel}>—</Text>
            : overlayModel.thisOver.map((b, i) => <BallChip key={`${b}-${i}`} label={b} />)}
        </View>
        {(overlayModel.chase || currentMatch.dls?.applied) && (
          <View style={styles.dlsBanner}>
            <Text style={styles.dlsBannerText}>
              {overlayModel.chase
                ? `${currentMatch.dls?.applied ? 'DLS ' : ''}Target ${overlayModel.chase.target} · Need ${overlayModel.chase.need} from ${overlayModel.chase.ballsLeft} balls`
                : `DLS · Reduced to ${inningsOversLimit} overs`}
            </Text>
          </View>
        )}
      </LinearGradient>

      {/* Current Players display */}
      <LinearGradient colors={Colors.gradCard} style={styles.playersBlock}>
        <Text style={[styles.teamStripLabel, isNarrow && { fontSize: Typography.xs }]} numberOfLines={1}>
          {battingTeamName} · batting
        </Text>
        <View style={styles.battersRow}>
          <View style={styles.playerInfo}>
            <Text style={[styles.playerRole, isNarrow && { fontSize: Typography.xs }]}>🏏 Striker</Text>
            <Text style={[styles.playerName, { fontSize: playerNameFont }]} numberOfLines={1}>{strikerName}</Text>
            <Text style={[styles.playerStat, { fontSize: playerStatFont }]} numberOfLines={1}>
              {strikerRuns} ({strikerBalls}) · 4s:{strikerFours} 6s:{strikerSixes}
            </Text>
          </View>
          <TouchableOpacity
            onPress={swapStrike}
            activeOpacity={0.85}
            style={[styles.swapStrikeBtn, { marginHorizontal: swapMargin }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.swapStrikeIcon}>⇄</Text>
            <Text style={styles.swapStrikeLabel}>Swap</Text>
          </TouchableOpacity>
          <View style={[styles.playerInfo, styles.playerInfoRight]}>
            <Text style={[styles.playerRole, isNarrow && { fontSize: Typography.xs }]}>🏏 Non-Striker</Text>
            <Text style={[styles.playerName, styles.playerNameRight, { fontSize: playerNameFont }]} numberOfLines={1}>
              {nonStrikerName}
            </Text>
            <Text style={[styles.playerStat, styles.playerStatRight, { fontSize: playerStatFont }]} numberOfLines={1}>
              {nonStrikerRuns} ({nonStrikerBalls}) · 4s:{nonStrikerFours} 6s:{nonStrikerSixes}
            </Text>
          </View>
        </View>
        <View style={styles.bowlerRow}>
          <Text style={[styles.playerRole, styles.bowlerTextCenter, isNarrow && { fontSize: Typography.xs }]}>
            ⚾ Bowler · {bowlingTeamName}
          </Text>
          <Text style={[styles.playerName, styles.bowlerTextCenter, { fontSize: playerNameFont }]} numberOfLines={1}>
            {bowlerName}
          </Text>
          <Text style={[styles.playerStat, styles.bowlerTextCenter, { fontSize: playerStatFont }]}>
            {bowlerWickets}-{bowlerRuns} ({formatOver(bowlerOvers, bowlerBalls)})
          </Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: 40 }}>
        {extraType && (
          <View style={styles.extraAlert}>
            <Text style={styles.extraAlertText}>
              Extra: {extraType === 'wide' ? 'WIDE' : extraType === 'noBall' ? 'NO BALL' : extraType === 'bye' ? 'BYE' : 'LEG BYE'} — enter runs taken
            </Text>
            <Text style={styles.extraAlertHint}>
              {extraType === 'wide' || extraType === 'noBall'
                ? 'ICC: automatic +1 does not change strike. Odd additional runs (1, 3…) do.'
                : 'ICC: odd byes / leg-byes (1, 3…) change the strike.'}
            </Text>
          </View>
        )}

        {/* Wicket toggle */}
        <EasePress pressScale={0.96} transition={scorePressTransition} rippleColor={Colors.loss + '44'} onPress={toggleWicketMode}>
          <LinearGradient
            colors={isWicket ? [Colors.loss + '44', Colors.loss + '22'] : Colors.gradCard}
            style={[styles.wicketBtn, isWicket && { borderColor: Colors.loss }]}>
            <Text style={[styles.wicketBtnText, isWicket && { color: Colors.loss }]}>
              {isWicket ? '🔴 WICKET MODE ON — Select dismissal' : '🎳 Mark Wicket'}
            </Text>
          </LinearGradient>
        </EasePress>

        <EasePress
          pressScale={0.96}
          transition={scorePressTransition}
          rippleColor={Colors.accent + '44'}
          onPress={() => { setIsWicket(false); setShowDismissal(false); setExtraType(null); setShowRetireModal(true); }}
          style={{ marginBottom: Spacing.base }}>
          <LinearGradient colors={Colors.gradCard} style={[styles.wicketBtn, { borderColor: Colors.accent + '66' }]}>
            <Text style={[styles.wicketBtnText, { color: Colors.accent }]}>🤕 Retire Hurt</Text>
          </LinearGradient>
        </EasePress>

        {/* Dismissal type selection */}
        {showDismissal && (
          <View style={styles.dismissalBlock}>
            <Text style={styles.dismissalTitle}>Select Dismissal Type</Text>
            <Text style={styles.dismissalHint}>Who is out?</Text>
            <View style={styles.dismissedBatterRow}>
              <TouchableOpacity
                onPress={() => setDismissedBatter('striker')}
                style={[styles.dismissedBatterButton, dismissedBatter === 'striker' && styles.dismissedBatterButtonActive]}>
                <Text style={styles.dismissedBatterText}>Striker: {strikerName}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setDismissedBatter('nonStriker')}
                style={[styles.dismissedBatterButton, dismissedBatter === 'nonStriker' && styles.dismissedBatterButtonActive]}>
                <Text style={styles.dismissedBatterText}>Non-striker: {nonStrikerName}</Text>
              </TouchableOpacity>
            </View>
            {(['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket'] as DismissalType[]).map(d => (
              <TouchableOpacity
                key={d!}
                onPress={() => selectDismissalType(d)}
                style={[styles.dismissalOption, dismissalType === d && styles.dismissalOptionActive]}>
                <Text style={styles.dismissalText}>{d}</Text>
              </TouchableOpacity>
            ))}

            {dismissalType === 'Run Out' && (
              <View style={styles.runOutRunsBlock}>
                <Text style={styles.dismissalHint}>Runs completed before run out</Text>
                <View style={styles.runOutRunsRow}>
                  {[0, 1, 2, 3, 4, 5, 6].map(r => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setPendingRuns(r)}
                      style={[styles.runOutRunChip, pendingRuns === r && styles.runOutRunChipActive]}>
                      <Text style={[styles.runOutRunChipText, pendingRuns === r && styles.runOutRunChipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {(dismissalType === 'Caught' || dismissalType === 'Run Out' || dismissalType === 'Stumped') && (
              <View style={styles.fielderPicker}>
                <Text style={styles.dismissalHint}>Select fielder who completed the {dismissalType.toLowerCase()}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  {availableBowlerOptions.map(player => (
                    <TouchableOpacity key={player.id} onPress={() => setFielderName(player.name)} style={[styles.playerChip, fielderName === player.name && styles.playerChipActive]}>
                      <Text style={[styles.playerChipText, fielderName === player.name && styles.playerChipTextActive]}>{player.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput style={styles.textInput} placeholder="Or enter fielder name" placeholderTextColor={Colors.textMuted} value={fielderName} onChangeText={setFielderName} />
                <TouchableOpacity onPress={() => handleDismissal(dismissalType)} style={styles.fielderConfirm}>
                  <Text style={styles.fielderConfirmText}>
                    Confirm {dismissalType}{dismissalType === 'Run Out' ? ` (${pendingRuns ?? 0} run${(pendingRuns ?? 0) === 1 ? '' : 's'})` : ''}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Runs grid — hidden while picking a non-run-out wicket */}
        {!isWicket && (
          <>
            <View style={styles.runsGrid}>
              <ScoreBtn val={0} />
              <ScoreBtn val={1} />
              <ScoreBtn val={2} />
              <ScoreBtn val={3} />
              <ScoreBtn val={4} color={Colors.accentBlue} />
              <ScoreBtn val={5} />
              <ScoreBtn val={6} color={Colors.win} />
            </View>

            <View style={styles.extrasRow}>
              <ExtraBtn label="Wide" type="wide" />
              <ExtraBtn label="No Ball" type="noBall" />
              <ExtraBtn label="Bye" type="bye" />
              <ExtraBtn label="Leg Bye" type="legBye" />
            </View>
          </>
        )}

        {/* Undo button */}
        <EasePress pressScale={0.97} transition={scorePressTransition} rippleColor={Colors.primary + '44'} onPress={handleUndo} style={styles.undoBtn}>
          <Text style={styles.undoBtnText}>↩ Undo Last Ball ({history.length} left)</Text>
        </EasePress>
        <EasePress
          pressScale={0.97}
          transition={scorePressTransition}
          rippleColor={Colors.primary + '44'}
          onPress={() => { setReplaceFrom(strikerName); setReplaceTo(''); setShowReplaceModal(true); }}
          style={styles.undoBtn}>
          <Text style={styles.undoBtnText}>⇄ Replace player on scorecard</Text>
        </EasePress>
        <Text style={{ color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginBottom: Spacing.sm }}>
          {ballsPerOver}-ball overs · {maxWickets} wkts{matchSettings.lastManStands ? ' · last man stands' : ''}
          {matchSettings.maxBallsPerOverIncludingExtras ? ` · max ${matchSettings.maxBallsPerOverIncludingExtras} del/over` : ''}
        </Text>

        <TouchableOpacity
          onPress={() => openWeatherModal('dls')}
          activeOpacity={0.85}
          style={styles.abandonBtn}>
          <Text style={styles.abandonBtnText}>☁ Rain / DLS / Weather</Text>
        </TouchableOpacity>

        {/* Extras Summary card */}
        <LinearGradient colors={Colors.gradCard} style={styles.extrasSummary}>
          <Text style={styles.extrasSummaryTitle}>Extras</Text>
          <View style={styles.extrasSummaryRow}>
            <Text style={styles.extSumItem}>Wd: {extras.wides}</Text>
            <Text style={styles.extSumItem}>Nb: {extras.noBalls}</Text>
            <Text style={styles.extSumItem}>B: {extras.byes}</Text>
            <Text style={styles.extSumItem}>Lb: {extras.legByes}</Text>
            <Text style={[styles.extSumItem, { color: Colors.primary }]}>Total: {extras.wides + extras.noBalls + extras.byes + extras.legByes}</Text>
          </View>
        </LinearGradient>
      </ScrollView>

      <Modal visible={showReplaceModal} transparent animationType="slide" onRequestClose={() => setShowReplaceModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Replace player</Text>
            <Text style={styles.modalDesc}>Fix a wrong name on the live scorecard.</Text>
            <Text style={{ color: Colors.textSecondary, marginBottom: 6 }}>Replace</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
              {[strikerName, nonStrikerName, bowlerName, ...(battingCard || []).map(b => b.name)].filter(Boolean).filter((n, i, arr) => arr.indexOf(n) === i).map(name => (
                <TouchableOpacity key={name} onPress={() => setReplaceFrom(name)} style={[styles.playerChip, replaceFrom === name && styles.playerChipActive]}>
                  <Text style={[styles.playerChipText, replaceFrom === name && styles.playerChipTextActive]}>{name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={{ color: Colors.textSecondary, marginBottom: 6 }}>With</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
              {[...teamAPlayersAll, ...teamBPlayersAll].filter((p, i, arr) => arr.findIndex(x => x.id === p.id) === i).map(p => (
                <TouchableOpacity key={`rep-${p.id}`} onPress={() => setReplaceTo(p.name)} style={[styles.playerChip, replaceTo === p.name && styles.playerChipActive]}>
                  <Text style={[styles.playerChipText, replaceTo === p.name && styles.playerChipTextActive]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput style={styles.textInput} placeholder="Or type incoming name" placeholderTextColor={Colors.textMuted} value={replaceTo} onChangeText={setReplaceTo} />
            <TouchableOpacity onPress={replacePlayerOnCard} style={styles.fielderConfirm}>
              <Text style={styles.fielderConfirmText}>Replace</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowReplaceModal(false)} style={{ marginTop: Spacing.sm, alignItems: 'center' }}>
              <Text style={{ color: Colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Select New Batter Modal */}
      <Modal visible={showNewBatterModal} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🎳 Wicket! Select New Batter</Text>
            <Text style={styles.modalDesc}>Select the incoming batter. They will take the {incomingBatterEnd === 'striker' ? 'striker’s' : 'non-striker’s'} end.</Text>

            {availableBatterOptions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.base }}>
                {availableBatterOptions
                  .filter(p => ![strikerName, nonStrikerName, ...(dismissedBatterNames || [])].some(name => name.toLowerCase() === p.name.toLowerCase()))
                  .map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.playerChip, newBatterInput.toLowerCase() === p.name.toLowerCase() && styles.playerChipActive]}
                      onPress={() => setNewBatterInput(p.name)}
                    >
                      <Text style={[styles.playerChipText, newBatterInput.toLowerCase() === p.name.toLowerCase() && styles.playerChipTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
            )}

            <TextInput
              style={styles.textInput}
              placeholder="Or type new batter name manually..."
              placeholderTextColor={Colors.textMuted}
              value={newBatterInput}
              onChangeText={setNewBatterInput}
            />

            <TouchableOpacity
              style={styles.confirmBtn}
              onPress={() => {
                const nameClean = newBatterInput.trim();
                if (!nameClean) {
                  showAlert('Error', 'Please select or enter the next batter.');
                  return;
                }
                if ([strikerName, nonStrikerName, ...(dismissedBatterNames || [])].some(name => name.toLowerCase() === nameClean.toLowerCase())) {
                  showAlert('Error', 'Choose a batter who has not already batted or been dismissed.');
                  return;
                }
                
                const nextStrikerName = incomingBatterEnd === 'striker' ? nameClean : strikerName;
                const nextNonStrikerName = incomingBatterEnd === 'nonStriker' ? nameClean : nonStrikerName;
                const nextStrikerRuns = incomingBatterEnd === 'striker' ? 0 : strikerRuns;
                const nextStrikerBalls = incomingBatterEnd === 'striker' ? 0 : strikerBalls;
                const nextNonStrikerRuns = incomingBatterEnd === 'nonStriker' ? 0 : nonStrikerRuns;
                const nextNonStrikerBalls = incomingBatterEnd === 'nonStriker' ? 0 : nonStrikerBalls;
                setStrikerName(nextStrikerName);
                setStrikerRuns(nextStrikerRuns);
                setStrikerBalls(nextStrikerBalls);
                setStrikerFours(incomingBatterEnd === 'striker' ? 0 : strikerFours);
                setStrikerSixes(incomingBatterEnd === 'striker' ? 0 : strikerSixes);
                setNonStrikerName(nextNonStrikerName);
                setNonStrikerRuns(nextNonStrikerRuns);
                setNonStrikerBalls(nextNonStrikerBalls);
                setNonStrikerFours(incomingBatterEnd === 'nonStriker' ? 0 : nonStrikerFours);
                setNonStrikerSixes(incomingBatterEnd === 'nonStriker' ? 0 : nonStrikerSixes);

                const nextStrikerFours = incomingBatterEnd === 'striker' ? 0 : strikerFours;
                const nextStrikerSixes = incomingBatterEnd === 'striker' ? 0 : strikerSixes;
                const nextNonStrikerFours = incomingBatterEnd === 'nonStriker' ? 0 : nonStrikerFours;
                const nextNonStrikerSixes = incomingBatterEnd === 'nonStriker' ? 0 : nonStrikerSixes;

                const summary = buildInningsSummary({
                  runs, wickets, overs, balls, extras, figures: bowlingFigures, dismissed: battingCard,
                  sName: nextStrikerName, nsName: nextNonStrikerName,
                  sRuns: nextStrikerRuns, sBalls: nextStrikerBalls, sFours: nextStrikerFours, sSixes: nextStrikerSixes,
                  nsRuns: nextNonStrikerRuns, nsBalls: nextNonStrikerBalls, nsFours: nextNonStrikerFours, nsSixes: nextNonStrikerSixes,
                });
                const updatedInnings = inningsNumber === 1
                  ? { ...currentMatch.innings, first: summary }
                  : { ...currentMatch.innings, second: summary };

                const nextXI = playingXIWithNames([nameClean], []);
                setXiTeamA(nextXI.teamA);
                setXiTeamB(nextXI.teamB);
                saveMatchScore({
                  playingXI: nextXI,
                  innings: updatedInnings,
                  liveScoring: scoringSession({
                    strikerName: nextStrikerName, nonStrikerName: nextNonStrikerName,
                    strikerRuns: nextStrikerRuns, strikerBalls: nextStrikerBalls,
                    strikerFours: nextStrikerFours, strikerSixes: nextStrikerSixes,
                    nonStrikerRuns: nextNonStrikerRuns, nonStrikerBalls: nextNonStrikerBalls,
                    nonStrikerFours: nextNonStrikerFours, nonStrikerSixes: nextNonStrikerSixes,
                  }),
                });

                setNewBatterInput('');
                setShowNewBatterModal(false);
                if (pendingBowlerChange) {
                  setPendingBowlerChange(false);
                  setShowNewBowlerModal(true);
                }
              }}
            >
              <LinearGradient colors={Colors.gradPrimary} style={styles.btnGrad}>
                <Text style={styles.confirmBtnText}>Confirm Batter</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* A scorer must nominate a bowler before the next over can begin. */}
      <Modal visible={showNewBowlerModal} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>End of over — Select new bowler</Text>
            <Text style={styles.modalDesc}>
              Choose the bowler for {formatOver(overs, balls)}. ICC rule: max {maxBowlerOvers} overs per bowler
              (min. {minBowlers} different bowlers for a full {currentMatch.overs}-over innings). Same bowler cannot bowl consecutive overs.
            </Text>
            {availableBowlerOptions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.base }}>
                {availableBowlerOptions
                  .filter(p => {
                    const fig = bowlingFigureFor(p.name);
                    return p.name.toLowerCase() !== bowlerName.toLowerCase() && (fig.overs || 0) < maxBowlerOvers;
                  })
                  .map(p => {
                    const fig = bowlingFigureFor(p.name);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[styles.playerChip, newBowlerInput.toLowerCase() === p.name.toLowerCase() && styles.playerChipActive]}
                        onPress={() => setNewBowlerInput(p.name)}
                      >
                        <Text style={[styles.playerChipText, newBowlerInput.toLowerCase() === p.name.toLowerCase() && styles.playerChipTextActive]}>
                          {p.name} ({formatOver(fig.overs || 0, fig.balls || 0)}-{fig.runs || 0})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            )}
            <TextInput style={styles.textInput} placeholder="Or type new bowler name..." placeholderTextColor={Colors.textMuted} value={newBowlerInput} onChangeText={setNewBowlerInput} />
            <TouchableOpacity style={styles.confirmBtn} onPress={() => {
              const nameClean = newBowlerInput.trim();
              if (!nameClean) { showAlert('Select a bowler', 'Choose or enter the bowler for the next over.'); return; }
              if (nameClean.toLowerCase() === bowlerName.toLowerCase()) { showAlert('Invalid bowler', 'The same bowler cannot bowl consecutive overs.'); return; }
              const priorFigure = bowlingFigureFor(nameClean);
              if (priorFigure.overs >= maxBowlerOvers) { showAlert('Bowling limit reached', `${nameClean} has completed their maximum of ${maxBowlerOvers} overs.`); return; }
              const nextXI = playingXIWithNames([], [nameClean]);
              setXiTeamA(nextXI.teamA);
              setXiTeamB(nextXI.teamB);
              setBowlerName(nameClean);
              setBowlerOvers(priorFigure.overs);
              setBowlerBalls(priorFigure.balls);
              setBowlerRuns(priorFigure.runs);
              setBowlerWickets(priorFigure.wickets);
              saveMatchScore({
                playingXI: nextXI,
                liveScoring: scoringSession({
                  bowlerName: nameClean, bowlerOvers: priorFigure.overs, bowlerBalls: priorFigure.balls,
                  bowlerRuns: priorFigure.runs, bowlerWickets: priorFigure.wickets,
                }),
              });
              setNewBowlerInput('');
              setShowNewBowlerModal(false);
            }}>
              <LinearGradient colors={Colors.gradPrimary} style={styles.btnGrad}><Text style={styles.confirmBtnText}>Start Next Over</Text></LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showShotGround} transparent animationType="fade" onRequestClose={() => { setShowShotGround(false); setPendingShotRuns(null); }}>
        <View style={[styles.modalBackdrop, { paddingHorizontal: Spacing.sm }]}>
          <View style={[styles.modalCard, { maxHeight: '92%', paddingHorizontal: Spacing.sm, overflow: 'visible', width: '100%' }]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ alignItems: 'stretch' }}
              bounces={false}>
              <ShotGroundPicker
                runs={pendingShotRuns || 0}
                strikerName={strikerName}
                onSelect={(_id, label) => confirmShotZone(label)}
                onSkip={() => confirmShotZone()}
                onCancel={() => { setShowShotGround(false); setPendingShotRuns(null); }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showInningsEndModal} transparent animationType="slide" onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{matchCompleted ? '🏆 Match Complete' : `🏏 ${inningsNumber === 1 ? 'First' : 'Second'} Innings Complete`}</Text>
            <Text style={styles.modalDesc}>
              {battingTeamName} finished on {runs}/{wickets} in {formatOver(overs, balls)} overs.
              {inningsNumber === 1
                ? (currentMatch.dls?.applied
                  ? ` DLS chase will be set for ${currentMatch.dls.team2Overs} overs.`
                  : ` Target: ${runs + 1} runs.`)
                : ''}
            </Text>
            {matchCompleted && (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={styles.fieldLabel}>Player of the Match</Text>
                <Text style={styles.modalDesc}>{pomWinnerHint()}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
                  {pomCandidatePlayers().map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.playerChip, playerOfMatch === p.name && styles.playerChipActive]}
                      onPress={() => choosePlayerOfMatch(p.name)}>
                      <Text style={[styles.playerChipText, playerOfMatch === p.name && styles.playerChipTextActive]}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput
                  style={styles.textInput}
                  placeholder="Or type a winner-team player name"
                  placeholderTextColor={Colors.textMuted}
                  value={playerOfMatch}
                  onChangeText={choosePlayerOfMatch}
                />
              </View>
            )}
            {!matchCompleted && inningsNumber === 1 ? (
              <TouchableOpacity style={styles.confirmBtn} onPress={startSecondInnings}>
                <LinearGradient colors={Colors.gradPrimary} style={styles.btnGrad}><Text style={styles.confirmBtnText}>Start Second Innings</Text></LinearGradient>
              </TouchableOpacity>
            ) : !matchCompleted ? (
              <TouchableOpacity style={styles.confirmBtn} onPress={openMatchCompleteFlow}>
                <LinearGradient colors={Colors.gradPrimary} style={styles.btnGrad}><Text style={styles.confirmBtnText}>Select Player of the Match</Text></LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.confirmBtn} onPress={() => finishMatch(playerOfMatchRef.current || playerOfMatch)}>
                <LinearGradient colors={Colors.gradPrimary} style={styles.btnGrad}>
                  <Text style={styles.confirmBtnText}>
                    {(playerOfMatchRef.current || playerOfMatch).trim()
                      ? `Confirm · PoM ${playerOfMatchRef.current || playerOfMatch}`
                      : 'Complete without PoM'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={showRetireModal} transparent animationType="slide" onRequestClose={() => setShowRetireModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🤕 Retire Hurt</Text>
            <Text style={styles.modalDesc}>
              Does not count as a wicket. The batter may return later. Choose who is leaving the crease.
            </Text>
            <TouchableOpacity style={styles.dismissalOption} onPress={() => handleRetireHurt('striker')}>
              <Text style={styles.dismissalText}>Striker: {strikerName} ({strikerRuns})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dismissalOption} onPress={() => handleRetireHurt('nonStriker')}>
              <Text style={styles.dismissalText}>Non-striker: {nonStrikerName} ({nonStrikerRuns})</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowRetireModal(false)} style={{ alignItems: 'center', paddingTop: Spacing.md }}>
              <Text style={styles.backText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {renderWeatherModal()}

      <Modal visible={showManualPlayerModal} transparent animationType="slide" onRequestClose={() => setShowManualPlayerModal(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.registrationScroll} keyboardShouldPersistTaps="handled">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Register {manualPlayerFor === 'batter' ? 'Batter' : 'Bowler'}</Text>
              <Text style={styles.modalDesc}>This player will be added to the team roster. Player photo is optional and can be added later from Player List.</Text>
              <TextInput style={styles.textInput} placeholder="Full name *" placeholderTextColor={Colors.textMuted} value={manualPlayer.name} onChangeText={name => setManualPlayer(prev => ({ ...prev, name }))} />
              <TextInput style={styles.textInput} placeholder="Jersey number *" keyboardType="number-pad" placeholderTextColor={Colors.textMuted} value={manualPlayer.jerseyNumber} onChangeText={jerseyNumber => setManualPlayer(prev => ({ ...prev, jerseyNumber }))} />
              <Text style={styles.fieldLabel}>Role</Text>
              <View style={styles.registrationChips}>{(['Batter', 'Bowler', 'All-rounder', 'Wicketkeeper'] as PlayerRole[]).map(role => <TouchableOpacity key={role} onPress={() => setManualPlayer(prev => ({ ...prev, role }))} style={[styles.playerChip, manualPlayer.role === role && styles.playerChipActive]}><Text style={[styles.playerChipText, manualPlayer.role === role && styles.playerChipTextActive]}>{role}</Text></TouchableOpacity>)}</View>
              <Text style={styles.fieldLabel}>Batting style</Text>
              <View style={styles.registrationChips}>{(['Right-hand Bat', 'Left-hand Bat'] as BattingStyle[]).map(battingStyle => <TouchableOpacity key={battingStyle} onPress={() => setManualPlayer(prev => ({ ...prev, battingStyle }))} style={[styles.playerChip, manualPlayer.battingStyle === battingStyle && styles.playerChipActive]}><Text style={[styles.playerChipText, manualPlayer.battingStyle === battingStyle && styles.playerChipTextActive]}>{battingStyle}</Text></TouchableOpacity>)}</View>
              <Text style={styles.fieldLabel}>Bowling style</Text>
              <View style={styles.registrationChips}>{(['N/A', 'Right-arm Fast', 'Right-arm Medium', 'Right-arm Off-spin', 'Right-arm Leg-spin', 'Left-arm Fast', 'Left-arm Medium', 'Left-arm Spin'] as BowlingStyle[]).map(bowlingStyle => <TouchableOpacity key={bowlingStyle} onPress={() => setManualPlayer(prev => ({ ...prev, bowlingStyle }))} style={[styles.playerChip, manualPlayer.bowlingStyle === bowlingStyle && styles.playerChipActive]}><Text style={[styles.playerChipText, manualPlayer.bowlingStyle === bowlingStyle && styles.playerChipTextActive]}>{bowlingStyle}</Text></TouchableOpacity>)}</View>
              <TextInput style={styles.textInput} placeholder="Nationality" placeholderTextColor={Colors.textMuted} value={manualPlayer.nationality} onChangeText={nationality => setManualPlayer(prev => ({ ...prev, nationality }))} />
              <TouchableOpacity style={styles.confirmBtn} onPress={registerManualPlayer}><LinearGradient colors={Colors.gradPrimary} style={styles.btnGrad}><Text style={styles.confirmBtnText}>Register & Select Player</Text></LinearGradient></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowManualPlayerModal(false)} style={styles.cancelRegistration}><Text style={styles.backText}>Cancel</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <PremiumGoLiveModal
        visible={showGoLivePremiumModal}
        onClose={() => setShowGoLivePremiumModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  errorContainer: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: Typography.base, color: Colors.textSecondary, marginBottom: Spacing.md },
  backBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.22)',
  },
  backText: { color: Colors.textSecondary, fontSize: Typography.sm },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  overlayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  overlayLabel: { fontSize: Typography.xs, fontWeight: '800', color: Colors.onPrimary },
  onAirPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.onPrimary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.onPrimary,
  },
  onAirLabel: { fontSize: Typography.xs, fontWeight: '800', color: Colors.live },
  liveDotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.onPrimary },
  liveRing: { position: 'absolute', width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.onPrimary },
  liveLabel: { fontSize: Typography.xs, fontWeight: '800', color: Colors.onPrimary },
  overlayModeBar: {
    paddingHorizontal: Spacing.base,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  scoreBanner: { paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.base, borderBottomWidth: 1, borderBottomColor: Colors.border },
  bannerTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm, gap: Spacing.xs },
  bannerTeamSide: { flex: 1, alignItems: 'center', gap: 8, minWidth: 0 },
  bannerTeamSideRight: { alignItems: 'center' },
  bannerTeam: {
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    width: '100%',
  },
  bannerTeamRight: { textAlign: 'center' },
  bannerScoreBlock: { alignItems: 'center', flexShrink: 0, paddingHorizontal: Spacing.sm, minWidth: 88 },
  bannerScore: { fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.8 },
  bannerOver: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '700', marginTop: 2 },
  ballsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  currentOverLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  ballChip: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ballChipText: { fontSize: Typography.xs, fontWeight: '800' },
  playersBlock: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  teamStripLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  battersRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bowlerRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  playerInfo: { flex: 1, minWidth: 0 },
  playerInfoRight: { alignItems: 'flex-end' },
  swapStrikeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary + '18',
    borderWidth: 1,
    borderColor: Colors.primary + '55',
    minWidth: 52,
    flexShrink: 0,
  },
  swapStrikeIcon: { color: Colors.primary, fontSize: 18, fontWeight: '900', lineHeight: 20 },
  swapStrikeLabel: { color: Colors.primary, fontSize: 9, fontWeight: '800', marginTop: 2, letterSpacing: 0.4 },
  playerRole: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600' },
  playerName: { fontWeight: '800', color: Colors.textPrimary, marginTop: 3 },
  playerNameRight: { textAlign: 'right' },
  playerStat: { color: Colors.primary, marginTop: 3, fontWeight: '700' },
  playerStatRight: { textAlign: 'right' },
  bowlerTextCenter: { textAlign: 'center', width: '100%' },
  extraAlert: { backgroundColor: Colors.accentOrange + '22', borderWidth: 1, borderColor: Colors.accentOrange, padding: Spacing.sm, borderRadius: Radius.md, marginBottom: Spacing.sm },
  extraAlertText: { color: Colors.accentOrange, fontSize: Typography.sm, fontWeight: '600', textAlign: 'center' },
  extraAlertHint: { color: Colors.accentOrange, fontSize: Typography.xs, textAlign: 'center', marginTop: 4, opacity: 0.9 },
  wicketBtn: { borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.base, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center' },
  wicketBtnText: { fontSize: Typography.base, fontWeight: '700', color: Colors.textSecondary },
  dismissalBlock: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.base, marginBottom: Spacing.base, borderWidth: 1, borderColor: Colors.loss + '44' },
  dismissalTitle: { fontSize: Typography.base, fontWeight: '700', color: Colors.loss, marginBottom: Spacing.sm },
  dismissalHint: { fontSize: Typography.xs, color: Colors.textSecondary, marginBottom: Spacing.xs },
  dismissedBatterRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  dismissedBatterButton: { flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.sm },
  dismissedBatterButtonActive: { borderColor: Colors.loss, backgroundColor: Colors.loss + '18' },
  dismissedBatterText: { color: Colors.textPrimary, fontSize: Typography.xs, fontWeight: '600' },
  dismissalOption: { paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  dismissalOptionActive: { backgroundColor: Colors.loss + '16', paddingHorizontal: Spacing.sm, borderRadius: Radius.sm },
  dismissalText: { fontSize: Typography.base, color: Colors.textPrimary },
  runOutRunsBlock: { marginTop: Spacing.sm, marginBottom: Spacing.sm },
  runOutRunsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  runOutRunChip: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
  },
  runOutRunChipActive: { borderColor: Colors.loss, backgroundColor: Colors.loss + '22' },
  runOutRunChipText: { color: Colors.textSecondary, fontWeight: '800', fontSize: Typography.base },
  runOutRunChipTextActive: { color: Colors.loss },
  fielderPicker: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  fielderConfirm: { backgroundColor: Colors.primary, borderRadius: Radius.md, alignItems: 'center', padding: Spacing.sm },
  fielderConfirmText: { color: '#fff', fontSize: Typography.sm, fontWeight: '800' },
  runsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.base, justifyContent: 'center' },
  scoreBtn: { width: 80, height: 80, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: Colors.border },
  scoreBtnText: { fontSize: Typography.xxxl, fontWeight: '900', color: Colors.textPrimary },
  extrasRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base, justifyContent: 'center' },
  extraBtn: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border },
  extraBtnText: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textSecondary },
  undoBtn: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.md, alignItems: 'center', marginBottom: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  undoBtnText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
  abandonBtn: {
    backgroundColor: Colors.nr + '14',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.base,
    borderWidth: 1,
    borderColor: Colors.nr + '55',
  },
  abandonBtnText: { fontSize: Typography.base, color: Colors.nr, fontWeight: '700' },
  abandonGhostBtn: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.nr + '44',
    backgroundColor: Colors.nr + '10',
  },
  abandonGhostText: { color: Colors.nr, fontWeight: '700', fontSize: Typography.sm },
  abandonConfirmBtn: {
    marginTop: Spacing.base,
    backgroundColor: Colors.loss,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  abandonConfirmText: { color: '#fff', fontWeight: '800', fontSize: Typography.base },
  dlsBanner: {
    marginTop: Spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.accent + '22',
    borderWidth: 1,
    borderColor: Colors.accent + '66',
  },
  dlsBannerText: {
    color: Colors.accent,
    fontWeight: '800',
    fontSize: Typography.xs,
    textAlign: 'center',
  },
  dlsPreviewBox: {
    backgroundColor: Colors.bgElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent + '55',
    marginBottom: Spacing.sm,
  },
  dlsPreviewText: {
    color: Colors.textPrimary,
    fontSize: Typography.sm,
    lineHeight: 20,
    fontWeight: '600',
  },
  dlsSecondaryBtn: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accent + '66',
    alignItems: 'center',
    backgroundColor: Colors.accent + '12',
  },
  dlsSecondaryBtnText: { color: Colors.accent, fontWeight: '800', fontSize: Typography.sm },
  dlsConfirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
  },
  dlsConfirmBtnText: { color: Colors.onPrimary, fontWeight: '800', fontSize: Typography.base },
  extrasSummary: { borderRadius: Radius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  extrasSummaryTitle: { fontSize: Typography.sm, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm },
  extrasSummaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  extSumItem: { fontSize: Typography.sm, color: Colors.textSecondary },

  // Setup Styles
  setupCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.md },
  setupTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.base },
  setupLabel: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '700', marginBottom: Spacing.xs },
  tabContainer: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  tabButton: { flex: 1, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bgElevated, alignItems: 'center' },
  tabButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '15' },
  tabText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: Colors.primary, fontWeight: '700' },
  fieldLabel: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: '700', marginTop: Spacing.md, marginBottom: Spacing.xs },
  ruleHint: { fontSize: Typography.xs, color: Colors.accent, marginBottom: Spacing.sm, lineHeight: 16 },
  playerChip: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgElevated, marginRight: Spacing.xs, marginBottom: Spacing.xs },
  playerChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '20' },
  playerChipText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
  playerChipTextActive: { color: Colors.primary, fontWeight: '700' },
  textInput: { backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.md, color: Colors.textPrimary, fontSize: Typography.sm, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md },
  registerPlayerBtn: { alignSelf: 'flex-start', marginTop: -Spacing.xs, marginBottom: Spacing.sm },
  registerPlayerText: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '700' },
  confirmBtn: { marginTop: Spacing.base, height: 50, borderRadius: Radius.md, overflow: 'hidden' },
  btnGrad: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: Typography.base, fontWeight: '800', color: Colors.onPrimary },

  // Wicket Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'center', padding: Spacing.base },
  registrationScroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.xl },
  registrationChips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: Spacing.sm },
  cancelRegistration: { alignItems: 'center', paddingTop: Spacing.md },
  modalCard: { backgroundColor: Colors.bgCard, borderRadius: Radius.lg, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: Typography.lg, fontWeight: '800', color: Colors.loss, marginBottom: Spacing.xs },
  modalDesc: { fontSize: Typography.sm, color: Colors.textSecondary, marginBottom: Spacing.base },
  xiHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  xiCount: { fontSize: Typography.base, fontWeight: '900', color: Colors.accent },
  xiWarnBtn: {
    backgroundColor: Colors.accentOrange + '18',
    borderWidth: 1,
    borderColor: Colors.accentOrange + '55',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  xiWarnText: { color: Colors.accentOrange, fontSize: Typography.xs, fontWeight: '700' },
  xiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  xiChip: {
    width: '48%',
    padding: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
    marginBottom: 4,
  },
  xiChipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '22' },
  xiChipText: { color: Colors.textSecondary, fontSize: Typography.xs, fontWeight: '700' },
  xiChipTextActive: { color: Colors.primary },
  xiChipRole: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
});
