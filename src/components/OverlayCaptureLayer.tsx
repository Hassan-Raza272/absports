import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import ScoreboardOverlay, { ScoreboardOverlayModel } from './ScoreboardOverlay';
import { isOverlayCardMode, OverlayGraphicsMode, useOverlayModeStore } from '../store/overlayMode';
import { updateOverlay } from '../native/rtmpStream';

/** Landscape 16:9 encode size for Facebook / YouTube. */
const STREAM_W = 1280;
const STREAM_H = 720;
/**
 * Capture at 2× stream pixels, then native code downscales to 1280×720.
 * 1× captures look soft on Live after platform recompression.
 */
const CAPTURE_SCALE = 2;
const RENDER_W = STREAM_W * CAPTURE_SCALE;
const RENDER_H = STREAM_H * CAPTURE_SCALE;
const STREAM_LOGO = 72;
const HEARTBEAT_MS = 100;
const logo = require('../assets/logo.png');

type Props = {
  model: ScoreboardOverlayModel;
  capture?: boolean;
  mode?: OverlayGraphicsMode;
};

/**
 * Off-screen stream capture only. Never paints on the ABSScore UI — Broadcast /
 * Live Scoring show their own single preview ScoreboardOverlay.
 */
export default function OverlayCaptureLayer({ model, capture = true, mode: modeProp }: Props) {
  const storeMode = useOverlayModeStore(s => s.mode);
  const theme = useOverlayModeStore(s => s.theme);
  const mode = modeProp ?? storeMode;
  const shotRef = useRef<ViewShotRef>(null);
  const busy = useRef(false);
  const pending = useRef(false);
  const [laidOut, setLaidOut] = useState(false);
  const key = `${JSON.stringify(model)}:${mode}:${theme}:${RENDER_W}x${RENDER_H}`;

  const captureAndSend = useCallback(async () => {
    if (!capture || !laidOut || !shotRef.current?.capture) return;
    if (busy.current) {
      pending.current = true;
      return;
    }
    busy.current = true;
    pending.current = false;
    try {
      const uri = await shotRef.current.capture();
      if (typeof uri === 'string' && uri.length > 0) {
        updateOverlay(uri).catch(() => undefined);
      }
    } catch {
      // First frames can fail before native layout; heartbeat retries.
    } finally {
      busy.current = false;
      if (pending.current) {
        pending.current = false;
        requestAnimationFrame(() => {
          captureAndSend();
        });
      }
    }
  }, [capture, laidOut]);

  useLayoutEffect(() => {
    if (!capture || !laidOut) return;
    const asap = setTimeout(captureAndSend, 16);
    const soon = setTimeout(captureAndSend, 80);
    const settled = setTimeout(captureAndSend, 220);
    return () => {
      clearTimeout(asap);
      clearTimeout(soon);
      clearTimeout(settled);
    };
  }, [capture, captureAndSend, key, laidOut]);

  useEffect(() => {
    if (!capture || !laidOut) return;
    const tick = setInterval(captureAndSend, HEARTBEAT_MS);
    return () => clearInterval(tick);
  }, [capture, captureAndSend, laidOut]);

  if (!capture) return null;

  const isCard = isOverlayCardMode(mode);

  return (
    // Clip to nothing so this tree can never stack a second modal on the phone UI.
    <View style={styles.host} pointerEvents="none" collapsable={false}>
      <ViewShot
        ref={shotRef}
        options={{
          format: 'png',
          result: 'base64',
          quality: 1,
          // Cap output at exactly 2× stream size (avoids huge density bitmaps + soft upscales).
          width: RENDER_W,
          height: RENDER_H,
        }}
        style={styles.capture}
        onLayout={() => setLaidOut(true)}>
        <View style={styles.frame} collapsable={false} pointerEvents="none">
          {/*
            Design the overlay at 1280×720, then scale from top-left into a 2×
            canvas so glyphs/pills are painted with 2× pixels before encode.
          */}
          <View
            style={styles.streamStage}
            collapsable={false}
            renderToHardwareTextureAndroid
            shouldRasterizeIOS>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
            <View style={isCard ? styles.centerStage : styles.scoreboard} collapsable={false}>
              <ScoreboardOverlay
                model={model}
                mode={mode}
                themeId={theme}
                layoutWidth={STREAM_W}
                layoutHeight={STREAM_H}
                forStream
              />
            </View>
          </View>
        </View>
      </ViewShot>
    </View>
  );
}

const styles = StyleSheet.create({
  // Parked far off-screen so it never stacks a second modal on ABSScore UI.
  // Must stay opacity 1 so Android can still snapshot for Facebook/YouTube.
  host: {
    position: 'absolute',
    left: -5000,
    top: -5000,
    width: RENDER_W,
    height: RENDER_H,
    opacity: 1,
    zIndex: -9999,
    elevation: 0,
    overflow: 'hidden',
  },
  capture: {
    width: RENDER_W,
    height: RENDER_H,
  },
  frame: {
    width: RENDER_W,
    height: RENDER_H,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  streamStage: {
    width: STREAM_W,
    height: STREAM_H,
    backgroundColor: 'transparent',
    transform: [{ scale: CAPTURE_SCALE }],
    transformOrigin: 'top left',
  },
  logo: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: STREAM_LOGO,
    height: STREAM_LOGO,
    zIndex: 3,
  },
  scoreboard: {
    position: 'absolute',
    left: 56,
    right: 56,
    bottom: 18,
  },
  centerStage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
});
