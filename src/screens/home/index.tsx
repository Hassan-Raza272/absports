import React, { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import ScreenScaffold from '../../components/ScreenScaffold';
import MatchScoreCard from '../../components/MatchScoreCard';
import EmptyState from '../../components/EmptyState';
import PremiumIcon from '../../components/PremiumIcon';
import { SkeletonHome } from '../../components/Skeleton';
import YouTubeVideoRail, { YouTubeLiveRail } from '../../components/YouTubeChannelVideos';
import { YOUTUBE_CHANNEL } from '../../constants/youtube';
import {
  useAuthStore,
  useClubsStore,
  usePublicFeedStore,
} from '../../store';
import { EasePress } from '../../motion';
import { Match } from '../../types';

const HOME_MATCH_LIMIT = 3;
const RAIL_GAP = 12;

function shuffleTake<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export default function HomeScreen({ navigation }: any) {
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clubs = useClubsStore(s => s.clubs);
  const user = useAuthStore(s => s.user);
  const publicLive = usePublicFeedStore(s => s.liveMatches);
  const publicUpcoming = usePublicFeedStore(s => s.upcomingMatches);
  const publicCompleted = usePublicFeedStore(s => s.completedMatches);
  const feedReady = usePublicFeedStore(s => s.ready);
  const isSignedIn = !!user;
  // Extra end padding so last rails clear the tab bar even if inset is off.
  const bottomPad = 56 + Math.max(insets.bottom, 8);
  const [liveStreamCount, setLiveStreamCount] = useState(0);
  const [cricketVideoCount, setCricketVideoCount] = useState(0);
  const onLiveStreamCount = useCallback((n: number) => setLiveStreamCount(n), []);
  const onCricketVideoCount = useCallback((n: number) => setCricketVideoCount(n), []);

  const clubNameById = useMemo(() => {
    const map = new Map<string, string>();
    clubs.forEach(c => map.set(c.id, c.name));
    return map;
  }, [clubs]);

  function labelFor(match: Match) {
    return clubNameById.get(match.clubId || '') || 'AB Sports';
  }

  function openScorecard(match: Match) {
    // Home lives under Tabs → Drawer → Stack; walk up so MatchCenter (root stack) opens.
    let nav: any = navigation;
    let target = navigation;
    while (nav) {
      const names: string[] | undefined = nav.getState?.()?.routeNames;
      if (names?.includes('MatchCenter')) target = nav;
      nav = nav.getParent?.();
    }
    target.navigate('MatchCenter', { matchId: match.id, match });
  }

  const live = publicLive.slice(0, HOME_MATCH_LIMIT);
  const upcoming = useMemo(() => {
    const sorted = [...publicUpcoming].sort((a, b) =>
      String(a.dateTime || '').localeCompare(String(b.dateTime || '')),
    );
    return shuffleTake(sorted, Math.min(6, sorted.length))
      .sort((a, b) => String(a.dateTime || '').localeCompare(String(b.dateTime || '')))
      .slice(0, HOME_MATCH_LIMIT);
  }, [publicUpcoming]);
  const results = useMemo(() => {
    const sorted = [...publicCompleted].sort((a, b) =>
      String(b.dateTime || '').localeCompare(String(a.dateTime || '')),
    );
    return shuffleTake(sorted.slice(0, 12), Math.min(HOME_MATCH_LIMIT, sorted.length));
  }, [publicCompleted]);

  const cardWidth = Math.min(screenWidth - Spacing.base * 2 - 36, Math.max(260, screenWidth * 0.82));
  const snapInterval = cardWidth + RAIL_GAP;

  if (!feedReady) {
    return (
      <ScreenScaffold title={user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'AB Sports'}>
        <SkeletonHome />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold title={user?.name ? `Hi, ${user.name.split(' ')[0]}` : 'AB Sports'}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        scrollEventThrottle={16}>
        <LinearGradient colors={Colors.gradHeader} style={styles.hero}>
          <Text style={styles.kicker}>AB SPORTS</Text>
          <Text style={styles.heroTitle}>Live cricket</Text>
          <Text style={styles.heroSub}>Follow teams and tournaments to see their matches here.</Text>
          {isSignedIn && (
            <EasePress onPress={() => navigation.navigate('AdminDashboard')} style={styles.scoreCta}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <PremiumIcon name="play" size={16} color={Colors.onPrimary} />
                <Text style={styles.scoreCtaText}>Score match</Text>
              </View>
            </EasePress>
          )}
          <View style={styles.heroStats}>
            <HeroStat label="Live" value={String(publicLive.length)} hot={publicLive.length > 0} />
            <HeroStat label="Upcoming" value={String(publicUpcoming.length)} />
            <HeroStat label="Results" value={String(publicCompleted.length)} />
          </View>
        </LinearGradient>

        <Section
          title="Live"
          count={publicLive.length}
          onPress={() => navigation.navigate('Discover', { initialFilter: 'all' })}
        />
        {live.length === 0 ? (
          <EmptyState
            title="No live games"
            subtitle="When a match goes live, it appears here."
            actionLabel={isSignedIn ? 'Score match' : 'Discover'}
            onAction={() => navigation.navigate(isSignedIn ? 'AdminDashboard' : 'Discover')}
          />
        ) : (
          <MatchRail
            matches={live}
            cardWidth={cardWidth}
            snapInterval={snapInterval}
            labelFor={labelFor}
            onPress={openScorecard}
          />
        )}

        <Section
          title="Up next"
          count={publicUpcoming.length}
          onPress={() => navigation.navigate('Discover', { initialFilter: 'all' })}
        />
        {upcoming.length === 0 ? (
          <Text style={styles.muted}>No upcoming matches across the network yet.</Text>
        ) : (
          <MatchRail
            matches={upcoming}
            cardWidth={cardWidth}
            snapInterval={snapInterval}
            labelFor={labelFor}
            onPress={openScorecard}
          />
        )}

        <Section
          title="Latest results"
          count={publicCompleted.length}
          onPress={() => navigation.navigate('Discover', { initialFilter: 'all' })}
        />
        {results.length === 0 ? (
          <Text style={styles.muted}>Results from completed matches appear here.</Text>
        ) : (
          <MatchRail
            matches={results}
            cardWidth={cardWidth}
            snapInterval={snapInterval}
            labelFor={labelFor}
            onPress={openScorecard}
          />
        )}

        <Section
          title="Live Stream Videos"
          count={liveStreamCount}
          onPress={() => Linking.openURL(YOUTUBE_CHANNEL.streamsUrl)}
        />
        <YouTubeLiveRail onCountChange={onLiveStreamCount} />

        <Section
          title="Cricket Videos"
          count={cricketVideoCount}
          onPress={() => navigation.navigate('ChannelVideos')}
        />
        <YouTubeVideoRail
          limit={24}
          onCountChange={onCricketVideoCount}
        />
      </ScrollView>
    </ScreenScaffold>
  );
}

function MatchRail({
  matches,
  cardWidth,
  snapInterval,
  labelFor,
  onPress,
}: {
  matches: Match[];
  cardWidth: number;
  snapInterval: number;
  labelFor: (match: Match) => string;
  onPress: (match: Match) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      directionalLockEnabled
      decelerationRate={0.92}
      snapToInterval={snapInterval}
      snapToAlignment="start"
      disableIntervalMomentum={false}
      bounces
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.railContent}
      style={styles.rail}>
      {matches.map((match, index) => (
        <View key={match.id} style={[styles.railCard, { width: cardWidth }]}>
          <MatchScoreCard
            match={match}
            uniform
            index={index}
            clubName={labelFor(match)}
            onPress={() => onPress(match)}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function HeroStat({ label, value, hot }: { label: string; value: string; hot?: boolean }) {
  return (
    <View style={styles.heroStat}>
      <Text style={[styles.heroVal, hot && { color: '#FFE08A' }]}>{value}</Text>
      <Text style={styles.heroLbl}>{label}</Text>
    </View>
  );
}

function Section({
  title,
  count = 0,
  onPress,
}: {
  title: string;
  count?: number;
  onPress?: () => void;
}) {
  const showSeeAll = !!onPress && count > 2;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {showSeeAll && (
        <TouchableOpacity onPress={onPress} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.base },
  hero: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  kicker: { color: Colors.onPrimary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, opacity: 0.95 },
  heroTitle: { color: Colors.onPrimary, fontWeight: '900', fontSize: Typography.xxl, marginTop: 4 },
  heroSub: { color: Colors.onPrimary, marginTop: 6, fontWeight: '600', lineHeight: 20, opacity: 0.95 },
  scoreCta: {
    marginTop: Spacing.md,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    borderRadius: Radius.full,
  },
  scoreCtaText: { color: Colors.onPrimary, fontWeight: '900', fontSize: Typography.sm },
  heroStats: { flexDirection: 'row', marginTop: Spacing.lg, gap: Spacing.sm },
  heroStat: { flex: 1, alignItems: 'center' },
  heroVal: { color: Colors.onPrimary, fontWeight: '900', fontSize: Typography.xl },
  heroLbl: { color: Colors.onPrimary, fontSize: 10, marginTop: 2, fontWeight: '700', opacity: 0.9 },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sectionTitle: { color: Colors.textPrimary, fontWeight: '900', fontSize: Typography.base },
  seeAll: {
    color: Colors.accent,
    fontWeight: '800',
    fontSize: Typography.sm,
    textDecorationLine: 'underline',
  },
  muted: { color: Colors.textSecondary, fontSize: Typography.sm, marginBottom: Spacing.xs },
  rail: {
    marginHorizontal: -Spacing.base,
    marginBottom: 0,
    overflow: 'visible',
  },
  railContent: {
    paddingHorizontal: Spacing.base,
    gap: RAIL_GAP,
  },
  railCard: {
    overflow: 'visible',
  },
});
