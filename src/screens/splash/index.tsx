import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Dimensions, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { EaseView } from '../../motion';

const logo = require('../../assets/logo.png');
const { width, height } = Dimensions.get('window');

const LOGO = Math.min(196, width * 0.46);
const RING = LOGO + 36;
const TOTAL_MS = 3600;

interface Props { onFinish: () => void; }

export default function SplashScreen({ onFinish }: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const exitAt = setTimeout(() => setExiting(true), TOTAL_MS - 520);
    const doneAt = setTimeout(onFinish, TOTAL_MS);
    return () => {
      clearTimeout(exitAt);
      clearTimeout(doneAt);
    };
  }, [onFinish]);

  return (
    <EaseView
      animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 1.04 : 1 }}
      transition={{ type: 'timing', duration: 480, easing: 'easeInOut' }}
      style={styles.root}>
      <LinearGradient
        colors={Colors.gradDark}
        locations={[0, 0.45, 1]}
        style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        <View style={styles.vignette} pointerEvents="none" />

        <EaseView
          initialAnimate={{ opacity: 0.22, scale: 0.88 }}
          animate={{ opacity: 0.5, scale: 1.1 }}
          transition={{ type: 'timing', duration: 2200, easing: 'easeInOut', loop: 'reverse' }}
          style={styles.ambientGlow}
          pointerEvents="none"
        />

        <EaseView
          initialAnimate={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 800, easing: 'easeOut', delay: 60 }}
          style={styles.topSheen}
          pointerEvents="none">
          <LinearGradient
            colors={[Colors.primary + '22', 'transparent']}
            style={StyleSheet.absoluteFill}
          />
        </EaseView>

        {/* Orbit stage */}
        <View style={styles.stage} pointerEvents="none">
          <EaseView
            initialAnimate={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 650, easing: 'easeOut', delay: 100 }}
            style={styles.ringSlot}>
            <EaseView
              initialAnimate={{ rotate: 0 }}
              animate={{ rotate: 360 }}
              transition={{ type: 'timing', duration: 16000, easing: 'linear', loop: 'repeat' }}
              style={[styles.ring, styles.ringOuter]}
            />
          </EaseView>

          <EaseView
            initialAnimate={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 650, easing: 'easeOut', delay: 160 }}
            style={styles.ringSlot}>
            <EaseView
              initialAnimate={{ rotate: 0 }}
              animate={{ rotate: -360 }}
              transition={{ type: 'timing', duration: 11000, easing: 'linear', loop: 'repeat' }}
              style={[styles.ring, styles.ringMid]}
            />
          </EaseView>

          <EaseView
            initialAnimate={{ opacity: 0.3, scale: 0.92 }}
            animate={{ opacity: 0.8, scale: 1.06 }}
            transition={{ type: 'timing', duration: 1500, easing: 'easeInOut', loop: 'reverse', delay: 220 }}
            style={styles.pulseHalo}
          />
        </View>

        {/* Logo */}
        <EaseView
          initialAnimate={{ opacity: 0, scale: 0.52, translateY: 26 }}
          animate={{ opacity: 1, scale: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 11, stiffness: 128, mass: 0.95, delay: 140 }}
          style={styles.logoWrap}>
          <EaseView
            initialAnimate={{ scale: 1 }}
            animate={{ scale: 1.03 }}
            transition={{ type: 'timing', duration: 1700, easing: 'easeInOut', loop: 'reverse', delay: 650 }}
            style={styles.logoBreath}>
            <LinearGradient colors={Colors.gradGold} style={styles.logoFrame}>
              <View style={styles.logoInner}>
                <Image source={logo} style={styles.logoImage} resizeMode="contain" />
              </View>
            </LinearGradient>
          </EaseView>
        </EaseView>

        {/* Brand */}
        <EaseView
          initialAnimate={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 540, easing: 'easeOut', delay: 500 }}
          style={styles.brandBlock}>
          <Text style={styles.brand}>AB SPORTS</Text>
          <EaseView
            initialAnimate={{ scaleX: 0.15, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ type: 'timing', duration: 480, easing: 'easeOut', delay: 700 }}
            style={styles.goldRule}
          />
          <Text style={styles.tagline}>CRICKET SCORING PLATFORM</Text>
        </EaseView>

        <EaseView
          initialAnimate={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 480, easing: 'easeOut', delay: 860 }}
          style={styles.subBlock}>
          <Text style={styles.subline}>LIVE · CLUBS · LEAGUES</Text>
        </EaseView>

        {/* Footer loader */}
        <View style={styles.footer}>
          <EaseView
            initialAnimate={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 380, delay: 980 }}
            style={styles.progressTrack}>
            <EaseView
              initialAnimate={{ scaleX: 0.06 }}
              animate={{ scaleX: 1 }}
              transition={{ type: 'timing', duration: 2300, easing: 'easeInOut', delay: 1050 }}
              transformOrigin={{ x: 0, y: 0.5 }}
              style={styles.progressFillWrap}>
              <LinearGradient
                colors={Colors.gradPrimary}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.progressFill}
              />
            </EaseView>
          </EaseView>
          <EaseView
            initialAnimate={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 420, delay: 1080 }}>
            <Text style={styles.watermark}>SCORE ANY CLUB · ANY LEAGUE</Text>
          </EaseView>
        </View>
      </LinearGradient>
    </EaseView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  ambientGlow: {
    position: 'absolute',
    width: width * 0.95,
    height: width * 0.95,
    borderRadius: width * 0.475,
    backgroundColor: Colors.primary + '18',
    top: height * 0.16,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.3,
  },
  stage: {
    position: 'absolute',
    width: RING + 52,
    height: RING + 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSlot: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderRadius: Radius.full,
    borderWidth: 1.5,
  },
  ringOuter: {
    width: RING + 42,
    height: RING + 42,
    borderColor: Colors.primary + '38',
  },
  ringMid: {
    width: RING + 12,
    height: RING + 12,
    borderColor: Colors.primary + '66',
  },
  pulseHalo: {
    width: RING - 10,
    height: RING - 10,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary + '16',
    borderWidth: 1,
    borderColor: Colors.primary + '44',
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  logoBreath: { alignItems: 'center', justifyContent: 'center' },
  logoFrame: {
    width: LOGO + 10,
    height: LOGO + 10,
    borderRadius: (LOGO + 10) / 2,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: LOGO,
    height: LOGO,
    borderRadius: LOGO / 2,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: { width: LOGO - 4, height: LOGO - 4 },
  brandBlock: {
    alignItems: 'center',
    marginTop: Spacing.xl,
    zIndex: 2,
  },
  brand: {
    color: Colors.textPrimary,
    fontSize: Typography.xxxl,
    fontWeight: '900',
    letterSpacing: 4,
  },
  goldRule: {
    width: 72,
    height: 2,
    borderRadius: 1,
    backgroundColor: Colors.primary,
    marginVertical: Spacing.md,
  },
  tagline: {
    color: Colors.primary,
    fontSize: Typography.xs,
    fontWeight: '900',
    letterSpacing: 2.6,
  },
  subBlock: { marginTop: Spacing.sm, zIndex: 2 },
  subline: {
    color: Colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.2,
  },
  footer: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  progressTrack: {
    width: Math.min(180, width * 0.42),
    height: 3,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary + '24',
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  progressFillWrap: {
    height: 3,
    width: '100%',
  },
  progressFill: {
    height: 3,
    width: '100%',
    borderRadius: Radius.full,
  },
  watermark: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
  },
});
