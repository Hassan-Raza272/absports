import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { showAlert } from '../../../components/PremiumAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import BackButton from '../../../components/BackButton';
import { Colors, Radius, Spacing } from '../../../theme';
import { useAuthStore, useClubsStore, useMatchById } from '../../../store';
import { isOverlayCardMode, useOverlayModeStore } from '../../../store/overlayMode';
import OverlayCaptureLayer from '../../../components/OverlayCaptureLayer';
import OverlayModeSwitcher from '../../../components/OverlayModeSwitcher';
import ScorebarThemePicker from '../../../components/ScorebarThemePicker';
import ScoreboardOverlay, { overlayModelFromMatch } from '../../../components/ScoreboardOverlay';
import RtmpCameraView from '../../../native/RtmpCameraView';
import { lockLandscape, lockPortrait } from '../../../native/appOrientation';
import {
  isRtmpAvailable,
  isRtmpStreaming,
  platformLabel,
  requestBroadcastPermissions,
  startPreview,
  startStream,
  stopStream,
  subscribeRtmpStatus,
  switchCamera,
  adjustZoom,
  getZoomInfo,
  setZoom,
  setMicrophoneMuted,
  isMicrophoneMuted,
  type StreamPlatform,
} from '../../../native/rtmpStream';
import { canUserGoLiveOnMatch, goLiveDeniedMessage } from '../../../utils/account';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

const PLATFORM_STORAGE = 'absscore.streamPlatform';
const FACEBOOK_KEY_STORAGE = 'absscore.facebookStreamUrl';
const YOUTUBE_KEY_STORAGE = 'absscore.youtubeStreamUrl';
const logo = require('../../../assets/logo.png');

function keyStorageFor(platform: StreamPlatform) {
  return platform === 'youtube' ? YOUTUBE_KEY_STORAGE : FACEBOOK_KEY_STORAGE;
}

function platformPlaceholder(platform: StreamPlatform) {
  return platform === 'youtube'
    ? 'rtmp://a.rtmp.youtube.com/live2/xxxx-xxxx'
    : 'rtmps://live-api-s.facebook.com:443/rtmp/xxxx';
}

export default function AdminBroadcastScreen({ route, navigation }: any) {
  const matchId = route.params?.matchId;
  const match = useMatchById(matchId);
  const user = useAuthStore(state => state.user);
  const clubs = useClubsStore(state => state.clubs);
  const overlayMode = useOverlayModeStore(s => s.mode);
  const hydrateOverlayMode = useOverlayModeStore(s => s.hydrate);
  const scoringCaptureActive = useOverlayModeStore(s => s.scoringCaptureActive);
  const insets = useSafeAreaInsets();

  const [platform, setPlatform] = useState<StreamPlatform>('facebook');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('Camera ready');
  const [onAir, setOnAir] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [panelHeight, setPanelHeight] = useState(88);
  const [zoomLabel, setZoomLabel] = useState('1.0×');
  const pinchBaseZoom = useRef(1);
  const platformRef = useRef<StreamPlatform>('facebook');
  platformRef.current = platform;

  const refreshZoomLabel = async () => {
    try {
      const info = await getZoomInfo();
      setZoomLabel(`${info.zoom.toFixed(1)}×`);
    } catch {
      // ignore
    }
  };

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          getZoomInfo()
            .then(info => {
              pinchBaseZoom.current = info.zoom || 1;
            })
            .catch(() => undefined);
        })
        .onUpdate(e => {
          const next = pinchBaseZoom.current * e.scale;
          setZoom(next)
            .then(z => setZoomLabel(`${z.toFixed(1)}×`))
            .catch(() => undefined);
        })
        .runOnJS(true),
    [],
  );

  async function bumpZoom(delta: number) {
    try {
      const z = await adjustZoom(delta);
      setZoomLabel(`${z.toFixed(1)}×`);
    } catch {
      // ignore
    }
  }

  async function loadKeyFor(next: StreamPlatform) {
    const saved = await AsyncStorage.getItem(keyStorageFor(next));
    setUrl(saved || '');
  }

  async function selectPlatform(next: StreamPlatform) {
    if (next === platform || onAir) return;
    setPlatform(next);
    await AsyncStorage.setItem(PLATFORM_STORAGE, next);
    await loadKeyFor(next);
  }

  useEffect(() => {
    lockLandscape();
    StatusBar.setHidden(true, 'fade');
    return () => {
      StatusBar.setHidden(false, 'fade');
      lockPortrait();
    };
  }, []);

  useEffect(() => {
    hydrateOverlayMode();
    refreshZoomLabel();
    isMicrophoneMuted()
      .then(setMicMuted)
      .catch(() => undefined);
  }, [hydrateOverlayMode]);

  useEffect(() => {
    if (!match) return;
    if (!canUserGoLiveOnMatch(user, match, clubs)) {
      showAlert('No Go Live access', goLiveDeniedMessage(user, match, clubs));
      navigation.goBack();
    }
  }, [user, match, clubs, navigation]);

  useEffect(() => {
    (async () => {
      const savedPlatform = await AsyncStorage.getItem(PLATFORM_STORAGE);
      const next: StreamPlatform = savedPlatform === 'youtube' ? 'youtube' : 'facebook';
      setPlatform(next);
      await loadKeyFor(next);
    })();

    isRtmpStreaming().then(live => {
      setOnAir(live);
      if (live) setStatus(`Live on ${platformLabel(platformRef.current)}`);
    });
    const stop = subscribeRtmpStatus(event => {
      const label = platformLabel(platformRef.current);
      if (event.type === 'success') {
        setOnAir(true);
        setStatus(`Live on ${label}`);
      } else if (event.type === 'connecting' || event.type === 'started') {
        setOnAir(true);
        setStatus(event.message || `Connecting to ${label}…`);
      } else if (event.type === 'retrying') {
        setStatus(`Reconnecting… ${event.message || ''}`);
      } else if (event.type === 'failed' || event.type === 'authError') {
        setOnAir(false);
        setStatus(event.message || 'Stream failed');
        showAlert(
          'Stream failed',
          event.message || `${label} rejected the connection. Check the stream key.`,
        );
      } else if (event.type === 'stopped' || event.type === 'disconnected') {
        setOnAir(false);
        setStatus('Stream stopped');
      }
    });
    return stop;
  }, []);

  useEffect(() => {
    if (!isRtmpAvailable()) return;
    requestBroadcastPermissions()
      .then(ok => {
        if (!ok) {
          showAlert('Permissions needed', 'Camera and microphone access are required to go live.');
          return;
        }
        return startPreview();
      })
      .then(() => refreshZoomLabel())
      .catch(err => {
        showAlert('Camera', err?.message || 'Could not start camera preview.');
      });
  }, []);

  if (!match) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No match found.</Text>
      </View>
    );
  }

  const model = overlayModelFromMatch(match);
  const isCard = isOverlayCardMode(overlayMode);
  const inningsNumber: 1 | 2 = match.currentInnings === 2 ? 2 : 1;
  const label = platformLabel(platform);
  const topPad = Math.max(insets.top, 10);
  const sidePad = Math.max(insets.left, insets.right, 16);

  async function handleGoLive() {
    if (!canUserGoLiveOnMatch(user, match, clubs)) {
      showAlert('No Go Live access', goLiveDeniedMessage(user, match, clubs));
      return;
    }
    if (!isRtmpAvailable()) {
      showAlert('Android only', 'In-app live streaming uses the Android camera encoder.');
      return;
    }
    if (!url.trim()) {
      showAlert(
        'Stream key required',
        platform === 'youtube'
          ? 'Paste the YouTube stream key from YouTube Studio → Go live → Stream.'
          : 'Paste the Facebook stream key from Meta Business Suite → Page → Live.',
      );
      return;
    }
    setBusy(true);
    try {
      const granted = await requestBroadcastPermissions();
      if (!granted) {
        showAlert('Permissions needed', 'Allow camera and microphone to go live.');
        return;
      }
      await AsyncStorage.setItem(keyStorageFor(platform), url.trim());
      await AsyncStorage.setItem(PLATFORM_STORAGE, platform);
      await startPreview();
      await startStream(url, platform);
      setOnAir(true);
      setStatus(`Connecting to ${label}…`);
    } catch (err: any) {
      showAlert('Could not go live', err?.message || 'Check the stream key and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    try {
      await stopStream();
      setOnAir(false);
      setStatus('Stream stopped');
    } catch (err: any) {
      showAlert('Stop failed', err?.message || 'Could not stop the stream.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleMic() {
    const next = !micMuted;
    try {
      const applied = await setMicrophoneMuted(next);
      setMicMuted(applied);
      setStatus(applied ? 'Microphone muted' : 'Microphone on');
    } catch {
      showAlert('Microphone', 'Could not change mic mute on this device.');
    }
  }

  function handleBack() {
    lockPortrait();
    navigation.goBack();
  }

  return (
    <View style={styles.container}>
      <StatusBar hidden barStyle="light-content" backgroundColor="#000" />

      <RtmpCameraView style={styles.camera} />

      <GestureDetector gesture={pinchGesture}>
        <View
          style={[styles.zoomTouchArea, { top: topPad + 40, bottom: panelHeight + 4, left: sidePad, right: sidePad + 44 }]}
          collapsable={false}
        />
      </GestureDetector>

      <Image
        source={logo}
        style={[styles.streamLogo, { top: topPad + 4, right: sidePad }]}
        resizeMode="contain"
      />

      <View
        style={[
          styles.overlaySlot,
          isCard ? styles.overlaySlotCard : styles.overlaySlotBar,
          { bottom: isCard ? panelHeight + 6 : panelHeight, left: sidePad, right: sidePad },
        ]}
        pointerEvents="none">
        <ScoreboardOverlay model={model} mode={overlayMode} compact />
      </View>

      <LinearGradient
        colors={['rgba(0,0,0,0.75)', 'rgba(0,0,0,0.2)', 'transparent']}
        style={[styles.topShade, { paddingTop: topPad, paddingHorizontal: sidePad }]}>
        <View style={styles.header}>
          <BackButton
            onPress={handleBack}
            label="Score"
            color="#fff"
            size={14}
            style={styles.headerAction}
          />

          <View style={styles.headerCenter}>
            <View style={[styles.livePill, onAir && styles.livePillOn]}>
              <View style={[styles.liveDot, onAir && styles.liveDotOn]} />
              <Text style={[styles.liveLabel, onAir && styles.liveLabelOn]}>
                {onAir ? `ON AIR · ${label.toUpperCase()}` : 'PREVIEW'}
              </Text>
            </View>
            <Text style={styles.matchTitle} numberOfLines={1}>
              {match.teamAName} vs {match.teamBName}
              <Text style={styles.statusInline}>  ·  {status}</Text>
            </Text>
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={[styles.headerAction, micMuted && styles.headerActionMuted]}
              activeOpacity={0.85}
              onPress={toggleMic}>
              <Icon
                name={micMuted ? 'mic-off-outline' : 'mic-outline'}
                size={14}
                color={micMuted ? Colors.live : '#fff'}
              />
              <Text style={[styles.headerBtn, micMuted && styles.headerBtnMuted]}>
                {micMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerAction}
              activeOpacity={0.85}
              onPress={() => {
                switchCamera()
                  .then(() => refreshZoomLabel())
                  .catch(() => undefined);
              }}>
              <Icon name="camera-reverse-outline" size={14} color="#fff" />
              <Text style={styles.headerBtn}>Flip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.zoomControls, { bottom: panelHeight + 8, right: sidePad }]}>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => bumpZoom(-0.25)} activeOpacity={0.85}>
          <Text style={styles.zoomBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.zoomValue}>{zoomLabel}</Text>
        <TouchableOpacity style={styles.zoomBtn} onPress={() => bumpZoom(0.25)} activeOpacity={0.85}>
          <Text style={styles.zoomBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      <OverlayCaptureLayer model={model} capture={onAir && !scoringCaptureActive} />

      <View
        style={[
          styles.bottomPanel,
          {
            paddingLeft: sidePad,
            paddingRight: sidePad,
            paddingBottom: Math.max(insets.bottom, 6),
          },
        ]}
        onLayout={e => setPanelHeight(Math.ceil(e.nativeEvent.layout.height))}>
        <ScorebarThemePicker dark compact />
        <OverlayModeSwitcher dark inningsNumber={inningsNumber} />

        <View style={styles.panelRow}>
          {!onAir ? (
            <>
              <View style={styles.platformRow}>
                {([
                  { id: 'facebook' as const, name: 'FB', icon: 'logo-facebook' },
                  { id: 'youtube' as const, name: 'YT', icon: 'logo-youtube' },
                ]).map(item => {
                  const active = platform === item.id;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.85}
                      onPress={() => selectPlatform(item.id)}
                      style={[styles.platformChip, active && styles.platformChipOn]}>
                      <Icon
                        name={item.icon as any}
                        size={13}
                        color={active ? '#fff' : 'rgba(255,255,255,0.65)'}
                      />
                      <Text style={[styles.platformChipText, active && styles.platformChipTextOn]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TextInput
                style={styles.keyInput}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={platformPlaceholder(platform)}
                placeholderTextColor="rgba(255,255,255,0.35)"
              />
            </>
          ) : (
            <Text style={styles.hintOnAir} numberOfLines={1}>
              Live to {label} · pinch to zoom · switch graphics above
            </Text>
          )}

          <View style={styles.actionsCol}>
            {onAir ? (
              <TouchableOpacity style={styles.stopBtn} onPress={handleStop} disabled={busy} activeOpacity={0.9}>
                <Icon name="stop-circle" size={16} color="#fff" />
                <Text style={styles.stopText}>{busy ? '…' : 'End'}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.goLiveBtn} onPress={handleGoLive} disabled={busy} activeOpacity={0.9}>
                <LinearGradient colors={Colors.gradLive} style={styles.goLiveGrad}>
                  <Icon name="radio-outline" size={14} color="#fff" />
                  <Text style={styles.goLiveText}>
                    {busy ? '…' : 'Go Live'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {Platform.OS !== 'android' && (
          <Text style={styles.iosNote}>Camera streaming is available on Android.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: {
    ...StyleSheet.absoluteFill,
  },
  zoomTouchArea: {
    position: 'absolute',
    zIndex: 5,
  },
  zoomControls: {
    position: 'absolute',
    zIndex: 22,
    alignItems: 'center',
    gap: 8,
  },
  zoomBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  zoomValue: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 10,
    minWidth: 32,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  streamLogo: {
    position: 'absolute',
    width: 28,
    height: 28,
    zIndex: 20,
    opacity: 0.9,
  },
  overlaySlot: {
    position: 'absolute',
    zIndex: 12,
  },
  overlaySlotBar: {},
  overlaySlotCard: {
    top: 56,
    justifyContent: 'center',
  },
  topShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 6,
    zIndex: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  headerBtn: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.2,
  },
  headerBtnMuted: {
    color: Colors.live,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionMuted: {
    borderColor: Colors.live + '99',
    backgroundColor: Colors.live + '28',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  livePillOn: {
    borderColor: Colors.live,
    backgroundColor: 'rgba(196,26,59,0.28)',
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  liveDotOn: { backgroundColor: Colors.live },
  liveLabel: {
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '800',
    fontSize: 9,
    letterSpacing: 0.9,
  },
  liveLabelOn: { color: '#fff' },
  matchTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  statusInline: {
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '600',
    fontSize: 10,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    elevation: 30,
    paddingTop: 4,
    backgroundColor: 'rgba(8,10,14,0.92)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  panelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  platformRow: {
    flexDirection: 'row',
    gap: 5,
    flexShrink: 0,
  },
  platformChip: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  platformChipOn: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '33',
  },
  platformChipText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    fontSize: 11,
  },
  platformChipTextOn: {
    color: '#fff',
  },
  keyInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: Radius.sm,
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '600',
    height: 32,
  },
  hintOnAir: {
    flex: 1,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '600',
  },
  actionsCol: {
    flexShrink: 0,
  },
  goLiveBtn: { borderRadius: Radius.sm, overflow: 'hidden' },
  goLiveGrad: {
    minHeight: 32,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  goLiveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  stopBtn: {
    backgroundColor: Colors.live,
    minHeight: 32,
    borderRadius: Radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
  },
  stopText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  iosNote: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
  },
  errorText: { color: Colors.textSecondary, textAlign: 'center', marginTop: 80 },
});
