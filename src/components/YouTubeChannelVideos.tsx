import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { WebView } from 'react-native-webview';
import { Colors, Radius, Spacing, Typography } from '../theme';
import BackButton from './BackButton';
import { SkeletonVideoRail } from './Skeleton';
import PremiumIcon from './PremiumIcon';
import {
  ChannelVideo,
  YOUTUBE_CHANNEL,
  YOUTUBE_EMBED_REFERER,
  youtubeAppUrl,
  youtubeEmbedHtml,
  youtubeLiveUrl,
  youtubeOfficialThumb,
  youtubeWatchUrl,
  liveVideosSeed,
} from '../constants/youtube';
import { YOUTUBE_SCRAPE_JS, YOUTUBE_STREAMS_SCRAPE_JS } from '../services/youtubeScrape';
import { enrichVideosWithOEmbed, ensureSampleVideo } from '../services/youtubeEnrich';
import { lockLandscape, lockPortrait } from '../native/appOrientation';

const RAIL_GAP = 14;
const RAIL_SIDE = Spacing.base;
/** Shared size so Live + Cricket rails look uniform */
const RAIL_CARD_MAX_W = 300;
const RAIL_CARD_WIDTH_RATIO = 0.78;
const THUMB_RATIO = 9 / 16; // 16:9
const TITLE_BLOCK_H = 52; // fixed 2-line title area
const CARD_BODY_PAD_V = 10;

function railCardWidth(screenWidth: number) {
  return Math.min(screenWidth * RAIL_CARD_WIDTH_RATIO, RAIL_CARD_MAX_W);
}

function railThumbHeight(cardWidth: number) {
  return Math.round(cardWidth * THUMB_RATIO);
}

function railCardHeight(cardWidth: number) {
  return railThumbHeight(cardWidth) + TITLE_BLOCK_H;
}

type RailProps = {
  onSeeAll?: () => void;
  limit?: number;
};

function normalizeVideos(raw: any[], opts?: { forceLive?: boolean }): ChannelVideo[] {
  const seen = new Set<string>();
  const out: ChannelVideo[] = [];
  for (const item of raw || []) {
    const id = String(item?.id || '').trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    const title = String(item?.title || 'YouTube video').trim();
    const thumbFromPage = String(item?.thumbnail || '');
    const thumbnail =
      thumbFromPage.includes('ytimg.com') || thumbFromPage.includes('googleusercontent.com')
        ? thumbFromPage
        : youtubeOfficialThumb(id);
    out.push({
      id,
      title,
      duration: item?.duration ? String(item.duration) : undefined,
      views: item?.views ? String(item.views) : undefined,
      publishedAt: item?.publishedAt ? String(item.publishedAt) : undefined,
      isLive: opts?.forceLive ? true : !!item?.isLive,
      thumbnail,
      watchUrl: opts?.forceLive || item?.isLive ? youtubeLiveUrl(id) : youtubeWatchUrl(id),
    });
  }
  return out;
}

/** Hidden WebView that reads YOUR channel Videos tab and posts real video + thumbnail data. */
function ChannelVideosLoader({
  onVideos,
  onError,
}: {
  onVideos: (videos: ChannelVideo[]) => void;
  onError: (message: string) => void;
}) {
  const gotRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!gotRef.current) {
        onError('Could not read your YouTube channel. Check internet and retry.');
      }
    }, 18000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onError]);

  return (
    <WebView
      source={{ uri: YOUTUBE_CHANNEL.mobileVideosUrl }}
      style={styles.hiddenWeb}
      pointerEvents="none"
      javaScriptEnabled
      domStorageEnabled
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
      setSupportMultipleWindows={false}
      userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
      injectedJavaScript={YOUTUBE_SCRAPE_JS}
      onMessage={event => {
        try {
          const payload = JSON.parse(event.nativeEvent.data);
          if (payload?.type !== 'channel-videos' || !Array.isArray(payload.videos)) return;
          const videos = normalizeVideos(payload.videos);
          if (!videos.length) return;
          gotRef.current = true;
          onVideos(ensureSampleVideo(videos));
          enrichVideosWithOEmbed(ensureSampleVideo(videos)).then(enriched => {
            if (enriched.length) onVideos(enriched);
          });
        } catch {
          // ignore
        }
      }}
      onError={() => onError('YouTube page failed to load.')}
      onHttpError={() => onError('YouTube page failed to load.')}
    />
  );
}

/** Hidden WebView that reads YOUR Streams tab (past + current live). */
function ChannelStreamsLoader({
  onVideos,
  onError,
}: {
  onVideos: (videos: ChannelVideo[]) => void;
  onError?: (message: string) => void;
}) {
  const gotRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!gotRef.current) onError?.('Could not load live streams.');
    }, 20000);
    return () => clearTimeout(t);
  }, [onError]);

  return (
    <WebView
      source={{ uri: YOUTUBE_CHANNEL.streamsUrl }}
      style={styles.hiddenWeb}
      pointerEvents="none"
      javaScriptEnabled
      domStorageEnabled
      thirdPartyCookiesEnabled
      sharedCookiesEnabled
      setSupportMultipleWindows={false}
      userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
      injectedJavaScript={YOUTUBE_STREAMS_SCRAPE_JS}
      onMessage={event => {
        try {
          const payload = JSON.parse(event.nativeEvent.data);
          if (payload?.type !== 'channel-streams' || !Array.isArray(payload.videos)) return;
          const scraped = normalizeVideos(payload.videos);
          if (!scraped.length) return;
          gotRef.current = true;
          const merged = mergeLiveLists(liveVideosSeed(), scraped);
          onVideos(merged);
          enrichVideosWithOEmbed(merged).then(enriched => {
            const liveIds = new Set(merged.filter(m => m.isLive).map(m => m.id));
            onVideos(
              enriched.map(v => ({
                ...v,
                isLive: liveIds.has(v.id),
                watchUrl: youtubeLiveUrl(v.id),
              })),
            );
          });
        } catch {
          // ignore
        }
      }}
    />
  );
}

function mergeLiveLists(seed: ChannelVideo[], scraped: ChannelVideo[]): ChannelVideo[] {
  const map = new Map<string, ChannelVideo>();
  [...seed, ...scraped].forEach(v => {
    const prev = map.get(v.id);
    if (!prev) {
      map.set(v.id, {
        ...v,
        watchUrl: youtubeLiveUrl(v.id),
      });
      return;
    }
    map.set(v.id, {
      ...prev,
      ...v,
      isLive: !!(prev.isLive || v.isLive),
      title: v.title && v.title !== 'YouTube video' ? v.title : prev.title,
      thumbnail: v.thumbnail || prev.thumbnail,
      watchUrl: youtubeLiveUrl(v.id),
    });
  });
  return Array.from(map.values());
}

type RailItem =
  | { kind: 'video'; video: ChannelVideo }
  | { kind: 'seeAll' };

/** Professional horizontal carousel — FlatList + soft snap + nested-scroll friendly. */
function SmoothVideoRail({
  videos,
  cardWidth,
  cardHeight,
  stream,
  onPressVideo,
  onSeeAll,
}: {
  videos: ChannelVideo[];
  cardWidth: number;
  cardHeight: number;
  stream?: boolean;
  onPressVideo: (video: ChannelVideo) => void;
  onSeeAll?: () => void;
}) {
  const itemStride = cardWidth + RAIL_GAP;
  const thumbH = railThumbHeight(cardWidth);

  const data = useMemo<RailItem[]>(() => {
    const items: RailItem[] = videos.map(video => ({ kind: 'video', video }));
    if (onSeeAll) items.push({ kind: 'seeAll' });
    return items;
  }, [videos, onSeeAll]);

  const getItemLayout = useCallback(
    (_: ArrayLike<RailItem> | null | undefined, index: number) => ({
      length: cardWidth,
      offset: RAIL_SIDE + index * itemStride,
      index,
    }),
    [cardWidth, itemStride],
  );

  const renderItem = useCallback(
    ({ item }: { item: RailItem }) => {
      if (item.kind === 'seeAll') {
        return (
          <TouchableOpacity
            style={[styles.seeAllCard, { width: cardWidth, height: cardHeight }]}
            onPress={onSeeAll}
            activeOpacity={0.85}>
            <Text style={styles.seeAllText}>All{'\n'}videos</Text>
          </TouchableOpacity>
        );
      }
      return (
        <VideoBannerCard
          video={item.video}
          width={cardWidth}
          height={cardHeight}
          thumbHeight={thumbH}
          stream={stream}
          onPress={() => onPressVideo(item.video)}
        />
      );
    },
    [cardHeight, cardWidth, onPressVideo, onSeeAll, stream, thumbH],
  );

  const keyExtractor = useCallback((item: RailItem, index: number) => {
    if (item.kind === 'seeAll') return 'see-all';
    return item.video.id || `v-${index}`;
  }, []);

  const separator = useCallback(() => <View style={{ width: RAIL_GAP }} />, []);

  return (
    <FlatList
      horizontal
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      getItemLayout={getItemLayout}
      ItemSeparatorComponent={separator}
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      directionalLockEnabled
      snapToInterval={itemStride}
      snapToAlignment="start"
      decelerationRate={Platform.OS === 'ios' ? 0.92 : 0.88}
      bounces
      overScrollMode="never"
      scrollEventThrottle={16}
      removeClippedSubviews={Platform.OS === 'android'}
      windowSize={7}
      initialNumToRender={3}
      maxToRenderPerBatch={4}
      updateCellsBatchingPeriod={50}
      contentContainerStyle={styles.railContent}
      style={styles.rail}
    />
  );
}

function useMyChannelVideos() {
  const [videos, setVideos] = useState<ChannelVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState<ChannelVideo | null>(null);

  const onVideos = useCallback((list: ChannelVideo[]) => {
    setVideos(prev => {
      // Prefer longer list; when same size, prefer list with real titles
      if (list.length > prev.length) return list;
      if (list.length < prev.length) return prev;
      const prevGeneric = prev.filter(v => v.title === 'YouTube video').length;
      const nextGeneric = list.filter(v => v.title === 'YouTube video').length;
      return nextGeneric < prevGeneric ? list : prev.length ? prev : list;
    });
    setLoading(false);
    setError('');
  }, []);

  const onError = useCallback((message: string) => {
    setLoading(false);
    setError(message);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    setError('');
    setVideos([]);
    setTick(t => t + 1);
  }, []);

  return {
    videos,
    loading,
    error,
    reload,
    playing,
    setPlaying,
    loaderKey: tick,
    onVideos,
    onError,
    showLoader: loading || videos.length === 0,
  };
}

/** Horizontal rail of all past (+ current) YouTube Live streams from your channel. */
export function YouTubeLiveRail({ onCountChange }: { onCountChange?: (count: number) => void } = {}) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = railCardWidth(screenWidth);
  const cardHeight = railCardHeight(cardWidth);
  const [videos, setVideos] = useState<ChannelVideo[]>(() => liveVideosSeed());
  const [playing, setPlaying] = useState<ChannelVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    onCountChange?.(videos.length);
  }, [videos.length, onCountChange]);

  const onVideos = useCallback((list: ChannelVideo[]) => {
    setVideos(prev => (list.length >= prev.length ? list : prev));
    setLoading(false);
    setError('');
  }, []);

  const onError = useCallback((message: string) => {
    setLoading(false);
    // Keep seed videos if scrape fails
    setVideos(prev => (prev.length ? prev : liveVideosSeed()));
    if (!liveVideosSeed().length) setError(message);
  }, []);

  useEffect(() => {
    // Enrich seed immediately so first card has a real title
    let cancelled = false;
    enrichVideosWithOEmbed(liveVideosSeed()).then(list => {
      if (cancelled) return;
      setVideos(list.map(v => ({ ...v, watchUrl: youtubeLiveUrl(v.id) })));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <>
      <ChannelStreamsLoader key={tick} onVideos={onVideos} onError={onError} />

      {loading && videos.length === 0 ? (
        <SkeletonVideoRail count={2} />
      ) : null}

      {!!error && videos.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); setError(''); setTick(t => t + 1); }} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {videos.length > 0 ? (
        <>
          <Text style={styles.liveCount}>{videos.length} live stream{videos.length === 1 ? '' : 's'}</Text>
          <SmoothVideoRail
            videos={videos}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            stream
            onPressVideo={setPlaying}
          />
        </>
      ) : null}

      <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />
    </>
  );
}

export default function YouTubeVideoRail({
  onSeeAll,
  onCountChange,
  limit = 24,
}: RailProps & { onCountChange?: (count: number) => void }) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = railCardWidth(screenWidth);
  const cardHeight = railCardHeight(cardWidth);
  const state = useMyChannelVideos();
  const list = useMemo(() => state.videos.slice(0, limit), [state.videos, limit]);

  useEffect(() => {
    onCountChange?.(state.videos.length);
  }, [state.videos.length, onCountChange]);

  return (
    <>
      {state.showLoader ? (
        <View style={styles.stateBox}>
          <ChannelVideosLoader key={state.loaderKey} onVideos={state.onVideos} onError={state.onError} />
          {state.loading ? (
            <SkeletonVideoRail count={3} />
          ) : state.error ? (
            <>
              <Text style={styles.stateText}>{state.error}</Text>
              <TouchableOpacity onPress={state.reload} style={styles.retry}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : (
        <ChannelVideosLoader key={state.loaderKey} onVideos={state.onVideos} onError={state.onError} />
      )}

      {!state.loading && list.length > 0 ? (
        <SmoothVideoRail
          videos={list}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          onPressVideo={state.setPlaying}
          onSeeAll={onSeeAll}
        />
      ) : null}

      <VideoPlayerModal video={state.playing} onClose={() => state.setPlaying(null)} />
    </>
  );
}

export function YouTubeVideoGrid({ limit = 200 }: { limit?: number }) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = (screenWidth - Spacing.base * 2 - RAIL_GAP) / 2;
  const thumbH = railThumbHeight(cardWidth);
  const cardHeight = railCardHeight(cardWidth);
  const state = useMyChannelVideos();
  const list = useMemo(() => state.videos.slice(0, limit), [state.videos, limit]);

  return (
    <>
      <ChannelVideosLoader key={state.loaderKey} onVideos={state.onVideos} onError={state.onError} />

      {state.loading && list.length === 0 ? (
        <SkeletonVideoRail count={4} />
      ) : null}

      {!!state.error && list.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{state.error}</Text>
          <TouchableOpacity onPress={state.reload} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {list.length > 0 ? (
        <>
          <Text style={styles.countLabel}>{list.length} videos from {YOUTUBE_CHANNEL.handle}</Text>
          <View style={styles.grid}>
            {list.map(video => (
              <VideoBannerCard
                key={video.id}
                video={video}
                width={cardWidth}
                height={cardHeight}
                thumbHeight={thumbH}
                compact
                onPress={() => state.setPlaying(video)}
              />
            ))}
          </View>
        </>
      ) : null}

      <VideoPlayerModal video={state.playing} onClose={() => state.setPlaying(null)} />
    </>
  );
}

const VideoBannerCard = memo(function VideoBannerCard({
  video,
  width,
  height,
  thumbHeight,
  onPress,
  compact,
  live,
  stream,
}: {
  video: ChannelVideo;
  width: number;
  height?: number;
  thumbHeight?: number;
  onPress: () => void;
  compact?: boolean;
  live?: boolean;
  stream?: boolean;
}) {
  const thumbH = thumbHeight ?? Math.round(width * (compact ? THUMB_RATIO : THUMB_RATIO));
  const cardH = height ?? thumbH + TITLE_BLOCK_H;
  const [thumb, setThumb] = useState(video.thumbnail || youtubeOfficialThumb(video.id));
  const isLiveNow = live || video.isLive;
  const showStreamBadge = stream || isLiveNow;

  useEffect(() => {
    setThumb(video.thumbnail || youtubeOfficialThumb(video.id));
  }, [video.id, video.thumbnail]);

  return (
    <TouchableOpacity
      style={[styles.card, { width, height: cardH }]}
      onPress={onPress}
      activeOpacity={0.9}>
      <View style={[styles.bannerWrap, { height: thumbH }]}>
        <Image
          source={{ uri: thumb }}
          style={styles.banner}
          resizeMode="cover"
          fadeDuration={Platform.OS === 'android' ? 120 : 0}
          onError={() => setThumb(youtubeOfficialThumb(video.id))}
        />
        {showStreamBadge ? (
          <View style={[styles.liveBadge, !isLiveNow && styles.streamBadge]}>
            {isLiveNow ? <View style={styles.liveDot} /> : null}
            <Text style={styles.liveBadgeText}>{isLiveNow ? 'LIVE' : 'STREAM'}</Text>
          </View>
        ) : video.duration ? (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{video.duration}</Text>
          </View>
        ) : null}
        <View style={styles.playBadge}>
          <PremiumIcon name="play" size={18} color={Colors.onPrimary} />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{video.title}</Text>
      </View>
    </TouchableOpacity>
  );
});

function VideoPlayerModal({ video, onClose }: { video: ChannelVideo | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<'embed' | 'watch'>('embed');
  const isPortrait = height >= width;
  const landW = Math.max(width, height);
  const landH = Math.min(width, height);

  useEffect(() => {
    if (!video) return undefined;
    setMode('embed');
    StatusBar.setHidden(true, 'fade');
    lockLandscape();
    return () => {
      StatusBar.setHidden(false, 'fade');
      lockPortrait();
    };
  }, [video?.id]);

  if (!video) return null;

  async function openInYouTubeApp() {
    const appUrl = youtubeAppUrl(video.id);
    const webUrl = video.isLive ? youtubeLiveUrl(video.id) : youtubeWatchUrl(video.id);
    try {
      const can = await Linking.canOpenURL(appUrl);
      await Linking.openURL(can ? appUrl : webUrl);
    } catch {
      await Linking.openURL(webUrl);
    }
  }

  const shellStyle = isPortrait
    ? {
        width: landW,
        height: landH,
        transform: [{ rotate: '90deg' as const }],
        position: 'absolute' as const,
        top: (height - landH) / 2,
        left: (width - landW) / 2,
      }
    : styles.playerShellLandscape;

  return (
    <Modal
      visible
      animationType="fade"
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.playerRoot}>
        <View style={[styles.playerShell, shellStyle]}>
          <View style={styles.playerHeader}>
            <BackButton onPress={onClose} iconOnly size={22} color="#fff" style={styles.closeBtn} hitSlop={10} />
            <Text style={styles.playerTitle} numberOfLines={1}>{video.title}</Text>
            <TouchableOpacity onPress={openInYouTubeApp} hitSlop={8}>
              <Text style={styles.openYt}>YouTube</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.playerFull}>
            {mode === 'embed' ? (
              <WebView
                key={`${video.id}-embed`}
                source={{
                  html: youtubeEmbedHtml(video.id),
                  baseUrl: YOUTUBE_EMBED_REFERER,
                }}
                style={styles.web}
                javaScriptEnabled
                domStorageEnabled
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                mixedContentMode="always"
                setSupportMultipleWindows={false}
                startInLoadingState
                originWhitelist={['*']}
                userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
                onError={() => setMode('watch')}
                onHttpError={() => setMode('watch')}
              />
            ) : (
              <WebView
                key={`${video.id}-watch`}
                source={{
                  uri: video.isLive ? youtubeLiveUrl(video.id) : youtubeWatchUrl(video.id),
                  headers: { Referer: YOUTUBE_EMBED_REFERER },
                }}
                style={styles.web}
                javaScriptEnabled
                domStorageEnabled
                allowsFullscreenVideo
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                mixedContentMode="always"
                setSupportMultipleWindows={false}
                startInLoadingState
                userAgent="Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
              />
            )}
          </View>
          <View style={styles.playerActions}>
            {mode === 'embed' ? (
              <TouchableOpacity style={styles.switchMode} onPress={() => setMode('watch')}>
                <Text style={styles.switchModeText}>Still Error 153? Open full YouTube page</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.openAppBtn} onPress={openInYouTubeApp}>
              <Text style={styles.openAppText}>Watch in YouTube app</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hiddenWeb: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 220,
    opacity: 0.02,
    zIndex: -1,
  },
  rail: {
    marginHorizontal: -Spacing.base,
    marginBottom: 0,
    flexGrow: 0,
  },
  railContent: {
    paddingHorizontal: RAIL_SIDE,
    paddingBottom: 0,
    alignItems: 'flex-start',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: RAIL_GAP,
    paddingBottom: Spacing.xl,
  },
  countLabel: {
    color: Colors.textSecondary,
    fontWeight: '700',
    marginBottom: Spacing.sm,
    fontSize: Typography.sm,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  bannerWrap: {
    width: '100%',
    backgroundColor: '#111',
    position: 'relative',
  },
  banner: { width: '100%', height: '100%' },
  durationBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  liveBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.live,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveBadgeText: { color: '#fff', fontWeight: '900', fontSize: 11, letterSpacing: 0.6 },
  streamBadge: { backgroundColor: '#333' },
  liveCount: {
    color: Colors.textSecondary,
    fontWeight: '700',
    fontSize: Typography.xs,
    marginBottom: 4,
  },
  playBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    height: TITLE_BLOCK_H,
    paddingHorizontal: 10,
    paddingVertical: CARD_BODY_PAD_V,
    justifyContent: 'center',
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontWeight: '800',
    fontSize: Typography.sm,
    lineHeight: 18,
    height: 36,
  },
  seeAllCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllText: { color: Colors.accent, fontWeight: '900', textAlign: 'center', lineHeight: 20 },
  stateBox: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 80,
  },
  stateText: { color: Colors.textSecondary, fontWeight: '600', textAlign: 'center', paddingHorizontal: Spacing.lg },
  retry: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary + '18',
  },
  retryText: { color: Colors.primary, fontWeight: '800' },
  playerRoot: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  playerShell: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  playerShellLandscape: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  playerHeader: {
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    zIndex: 2,
  },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  playerTitle: { flex: 1, color: '#fff', fontWeight: '800', fontSize: Typography.base },
  openYt: { color: Colors.primaryLight, fontWeight: '800', fontSize: Typography.sm },
  playerFull: { flex: 1, backgroundColor: '#000' },
  web: { flex: 1, backgroundColor: '#000' },
  playerActions: { paddingBottom: Spacing.md, gap: 2 },
  switchMode: { padding: Spacing.sm, alignItems: 'center' },
  switchModeText: { color: 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: Typography.xs },
  openAppBtn: {
    marginHorizontal: Spacing.base,
    marginTop: 4,
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  openAppText: { color: Colors.onPrimary, fontWeight: '900' },
});
