import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { BannerPreset, BannerVariant, TOURNAMENT_BANNERS } from '../constants/tournamentSetup';

type Props = {
  presetId?: string;
  preset?: BannerPreset;
  style?: ViewStyle;
  compact?: boolean;
};

export default function TournamentBanner({ presetId, preset, style, compact }: Props) {
  const art = preset || TOURNAMENT_BANNERS.find(item => item.id === presetId) || TOURNAMENT_BANNERS[0];
  return (
    <View style={[styles.frame, style]}>
      <LinearGradient colors={art.colors} start={{ x: 0, y: 0.15 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Art variant={art.variant} ink={art.ink} compact={!!compact} />
    </View>
  );
}

function Art({ variant, ink, compact }: { variant: BannerVariant; ink: string; compact: boolean }) {
  const s = compact ? 0.78 : 1;
  switch (variant) {
    case 'league-night':
      return (
        <View style={styles.stage} pointerEvents="none">
          <SparkField color="#F6E2B8" />
          <View style={[styles.heroRow, { transform: [{ scale: s }] }]}>
            <View>
              <Text style={styles.brandOver}>AB SPORTS</Text>
              <Text style={styles.wordmark}>LEAGUE NIGHT</Text>
              <View style={styles.markBar}>
                <View style={[styles.markSeg, { backgroundColor: '#C41A3B' }]} />
                <View style={[styles.markSeg, { backgroundColor: '#F6E2B8', width: 28 }]} />
              </View>
            </View>
            <CrestBadge
              size={74}
              icon="cricket"
              iconColor="#FFFFFF"
              fill={['#E03A58', '#C41A3B']}
              ring="#F6E2B8"
              glow="rgba(196,26,59,0.45)"
            />
          </View>
        </View>
      );
    case 'chevron-sketch':
      return (
        <View style={styles.stage} pointerEvents="none">
          <ChevronField color="rgba(90,70,50,0.14)" />
          <View style={[styles.sketchCard, { transform: [{ scale: s }] }]}>
            <MCI name="cricket" size={42} color="#2C241C" />
            <View style={styles.sketchStumps}>
              {[0, 1, 2].map(i => <View key={i} style={styles.sketchStump} />)}
            </View>
          </View>
        </View>
      );
    case 'jade-crest':
      return (
        <View style={styles.stage} pointerEvents="none">
          <View style={styles.jadeGlow} />
          <View style={{ transform: [{ scale: s }] }}>
            <CrestBadge
              size={82}
              icon="cricket"
              iconColor="#FFFFFF"
              fill={['#0D8A78', '#0A6B5D']}
              ring="rgba(255,255,255,0.92)"
              glow="rgba(255,255,255,0.55)"
            />
          </View>
        </View>
      );
    case 'burst-kit':
      return (
        <View style={styles.stage} pointerEvents="none">
          <Sunburst color="rgba(255,255,255,0.14)" />
          <View style={[styles.kitStack, { transform: [{ scale: s }] }]}>
            <StudioBat />
            <View style={styles.ballWrap}>
              <LeatherBall size={54} />
            </View>
          </View>
        </View>
      );
    case 'splash-stroke':
      return (
        <View style={styles.stage} pointerEvents="none">
          <LinearGradient colors={['#F5C14A', '#E07A3D', 'transparent']} style={styles.splashGold} />
          <LinearGradient colors={['#2BB39E', '#1A6BB5', 'transparent']} style={styles.splashTeal} />
          <View style={styles.paintRows}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.paintStroke, { top: 18 + i * 28, opacity: 0.22 + i * 0.08 }]} />
            ))}
          </View>
          <View style={[styles.splashHero, { transform: [{ scale: s }] }]}>
            <MCI name="cricket" size={86} color="#142033" />
            <View style={styles.splashStumps}>
              <View style={styles.splashBails} />
              <View style={styles.splashStumpCol}>
                {[0, 1, 2].map(i => <View key={i} style={styles.splashStump} />)}
              </View>
            </View>
          </View>
        </View>
      );
    case 'ruby-cup':
      return (
        <View style={styles.stage} pointerEvents="none">
          <SparkField color="#F8E7C8" />
          <View style={{ transform: [{ scale: s }] }}>
            <CrestBadge
              size={86}
              icon="trophy-variant"
              iconColor="#F8E7C8"
              fill={['#3A0C16', '#6B1020']}
              ring="#F8E7C8"
              glow="rgba(248,231,200,0.35)"
            />
          </View>
        </View>
      );
    case 'midnight-oval':
      return (
        <View style={styles.stage} pointerEvents="none">
          <SparkField color="#E8D5A8" dense />
          <View style={[styles.heroRow, { transform: [{ scale: s }] }]}>
            <CrestBadge
              size={78}
              icon="stadium"
              iconColor="#E8D5A8"
              fill={['#0C1E33', '#14324C']}
              ring="#E8D5A8"
              glow="rgba(232,213,168,0.28)"
            />
            <View>
              <Text style={[styles.brandOver, { color: ink }]}>NIGHT OVAL</Text>
              <Text style={[styles.wordmarkSm, { color: ink }]}>FLOODLIT</Text>
            </View>
          </View>
        </View>
      );
    case 'ember-medal':
      return (
        <View style={styles.stage} pointerEvents="none">
          <View style={styles.emberBar} />
          <View style={{ transform: [{ scale: s }] }}>
            <CrestBadge
              size={80}
              icon="medal-outline"
              iconColor="#F2D6C4"
              fill={['#C41A3B', '#6B1020']}
              ring="#F2D6C4"
              glow="rgba(196,26,59,0.4)"
            />
          </View>
        </View>
      );
    case 'gold-seal':
      return (
        <View style={styles.stage} pointerEvents="none">
          <SparkField color="#FFF6E4" />
          <View style={{ transform: [{ scale: s }] }}>
            <CrestBadge
              size={84}
              icon="shield-star"
              iconColor="#3A2A12"
              fill={['#F4E2B0', '#C4A15A']}
              ring="#FFF6E4"
              glow="rgba(255,246,228,0.4)"
            />
          </View>
        </View>
      );
    case 'navy-spark':
      return (
        <View style={styles.stage} pointerEvents="none">
          <SparkField color="#F4D7A4" dense />
          <View style={[styles.heroRow, { transform: [{ scale: s }] }]}>
            <View>
              <Text style={[styles.brandOver, { color: ink }]}>AB SPORTS</Text>
              <Text style={styles.wordmark}>CUP FINAL</Text>
            </View>
            <CrestBadge
              size={74}
              icon="crown"
              iconColor="#10243A"
              fill={['#F4D7A4', '#D4AF77']}
              ring="#FFFFFF"
              glow="rgba(244,215,164,0.4)"
            />
          </View>
        </View>
      );
    default:
      return null;
  }
}

function CrestBadge({
  size = 74,
  icon,
  iconColor,
  fill,
  ring,
  glow,
}: {
  size?: number;
  icon: string;
  iconColor: string;
  fill: string[];
  ring: string;
  glow?: string;
}) {
  const inner = size * 0.78;
  return (
    <View style={{ width: size + 18, height: size + 18, alignItems: 'center', justifyContent: 'center' }}>
      {glow ? <View style={[styles.glow, { width: size + 18, height: size + 18, borderRadius: (size + 18) / 2, backgroundColor: glow }]} /> : null}
      <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: ring }]}>
        <LinearGradient colors={fill} style={{ width: inner, height: inner, borderRadius: inner / 2, alignItems: 'center', justifyContent: 'center' }}>
          <MCI name={icon} size={size * 0.42} color={iconColor} />
        </LinearGradient>
      </View>
    </View>
  );
}

function SparkField({ color, dense }: { color: string; dense?: boolean }) {
  const dots = dense
    ? [
        { t: '12%', l: '8%', s: 3 },
        { t: '22%', l: '16%', s: 4 },
        { t: '18%', r: '12%', s: 3 },
        { t: '68%', l: '10%', s: 3 },
        { t: '72%', r: '18%', s: 4 },
        { t: '40%', l: '6%', s: 2 },
        { t: '48%', r: '8%', s: 2 },
      ]
    : [
        { t: '16%', l: '12%', s: 3 },
        { t: '28%', l: '22%', s: 4 },
        { t: '20%', r: '18%', s: 3 },
        { t: '70%', r: '14%', s: 4 },
        { t: '62%', l: '8%', s: 2 },
      ];
  return (
    <>
      {dots.map((d, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: d.t as any,
            left: d.l as any,
            right: d.r as any,
            width: d.s,
            height: d.s,
            borderRadius: d.s / 2,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />
      ))}
      <MCI name="star-four-points" size={10} color={color} style={{ position: 'absolute', top: 14, right: 28, opacity: 0.9 }} />
      <MCI name="star-four-points" size={8} color={color} style={{ position: 'absolute', bottom: 18, left: 36, opacity: 0.7 }} />
    </>
  );
}

function ChevronField({ color }: { color: string }) {
  return (
    <View style={styles.chevronWrap}>
      {Array.from({ length: 9 }).map((_, row) => (
        <View key={row} style={[styles.chevronRow, { marginLeft: row % 2 ? 14 : 0 }]}>
          {Array.from({ length: 18 }).map((_, col) => (
            <View key={col} style={[styles.chevron, { borderBottomColor: color }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

function Sunburst({ color }: { color: string }) {
  return (
    <View style={styles.burst}>
      {Array.from({ length: 22 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.ray,
            { backgroundColor: color, transform: [{ rotate: `${(360 / 22) * i}deg` }] },
          ]}
        />
      ))}
    </View>
  );
}

function LeatherBall({ size }: { size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#C41A3B',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 8,
      }}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.22,
          height: size * 0.86,
          borderWidth: 2,
          borderColor: '#F3E2C0',
          borderRadius: 20,
          backgroundColor: 'transparent',
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: size * 0.12,
          left: size * 0.16,
          width: size * 0.28,
          height: size * 0.16,
          borderRadius: 12,
          backgroundColor: 'rgba(255,255,255,0.32)',
        }}
      />
    </View>
  );
}

function StudioBat() {
  return (
    <View style={{ transform: [{ rotate: '-32deg' }], alignItems: 'center' }}>
      <View style={styles.handle}>
        <View style={styles.grip} />
        <View style={styles.grip} />
      </View>
      <View style={styles.blade}>
        <View style={styles.grain} />
        <View style={[styles.grain, { left: 16 }]} />
        <View style={styles.rubyStripe} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    justifyContent: 'center',
  },
  stage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brandOver: {
    color: '#8EC8FF',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 2.4,
  },
  wordmark: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  wordmarkSm: {
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 2,
    marginTop: 4,
  },
  markBar: { flexDirection: 'row', gap: 6, marginTop: 8 },
  markSeg: { width: 36, height: 4, borderRadius: 2 },
  glow: { position: 'absolute' },
  ring: {
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  sketchCard: {
    width: 118,
    height: 78,
    borderRadius: 8,
    backgroundColor: '#FBF8F2',
    borderWidth: 1,
    borderColor: 'rgba(44,36,28,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2C241C',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  sketchStumps: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    gap: 4,
  },
  sketchStump: { width: 3, height: 18, backgroundColor: '#2C241C', borderRadius: 1 },
  jadeGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  chevronWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    paddingTop: 4,
  },
  chevronRow: { flexDirection: 'row', marginTop: -6 },
  chevron: {
    width: 0,
    height: 0,
    marginRight: 2,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderBottomWidth: 20,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  burst: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: 10,
    height: 420,
    opacity: 0.9,
  },
  kitStack: {
    width: 160,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballWrap: { position: 'absolute', right: 18, bottom: 8 },
  handle: {
    width: 11,
    height: 26,
    backgroundColor: '#5A3418',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 3,
  },
  grip: { width: 9, height: 2, backgroundColor: '#2A1810', borderRadius: 1 },
  blade: {
    width: 30,
    height: 78,
    backgroundColor: '#E8C9A0',
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#C4A06A',
    overflow: 'hidden',
  },
  grain: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 1.5,
    height: 62,
    backgroundColor: 'rgba(140,90,40,0.28)',
  },
  rubyStripe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    height: 4,
    backgroundColor: '#C41A3B',
  },
  splashGold: {
    position: 'absolute',
    left: -50,
    top: -30,
    width: 230,
    height: 200,
    borderRadius: 110,
    opacity: 0.92,
  },
  splashTeal: {
    position: 'absolute',
    right: -40,
    top: -20,
    width: 250,
    height: 210,
    borderRadius: 120,
    opacity: 0.88,
  },
  paintRows: { ...StyleSheet.absoluteFillObject },
  paintStroke: {
    position: 'absolute',
    left: -20,
    right: -20,
    height: 10,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-4deg' }],
  },
  splashHero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  splashStumps: {
    height: 68,
    width: 26,
    marginBottom: 4,
    justifyContent: 'flex-start',
  },
  splashStumpCol: { flexDirection: 'row', gap: 5, marginTop: 4, height: 58 },
  splashStump: { width: 4, height: 58, backgroundColor: '#142033', borderRadius: 1 },
  splashBails: {
    height: 3,
    backgroundColor: '#142033',
    borderRadius: 1,
  },
  emberBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '46%',
    height: 8,
    backgroundColor: '#C41A3B',
    opacity: 0.9,
  },
});
