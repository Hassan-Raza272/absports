import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Colors, Radius, Spacing } from '../theme';

type BoneProps = {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Soft shimmer bone used as the building block for all loading placeholders. */
export function Skeleton({ width = '100%', height = 14, radius = Radius.sm, style }: BoneProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [shimmer]);

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-80, 220]) }],
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.15, 0.55, 0.15]),
  }));

  return (
    <View style={[styles.bone, { width, height, borderRadius: radius }, style]}>
      <Animated.View style={[styles.shine, shineStyle]}>
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonMatchCard({ uniform, style }: { uniform?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.matchCard, uniform && styles.matchCardUniform, style]}>
      <View style={styles.rowBetween}>
        <Skeleton width={72} height={18} radius={Radius.full} />
        <Skeleton width={88} height={12} />
      </View>
      <View style={styles.teamRow}>
        <Skeleton width={40} height={40} radius={Radius.full} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={14} />
          <Skeleton width="40%" height={12} />
        </View>
        <Skeleton width={48} height={18} />
      </View>
      <View style={styles.teamRow}>
        <Skeleton width={40} height={40} radius={Radius.full} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="65%" height={14} />
          <Skeleton width="36%" height={12} />
        </View>
        <Skeleton width={48} height={18} />
      </View>
      <Skeleton width="90%" height={12} style={{ marginTop: 4 }} />
    </View>
  );
}

export function SkeletonEntityRow() {
  return (
    <View style={styles.entityRow}>
      <Skeleton width={48} height={48} radius={Radius.full} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="62%" height={14} />
        <Skeleton width="44%" height={12} />
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Skeleton width={36} height={16} />
        <Skeleton width={48} height={10} />
      </View>
    </View>
  );
}

export function SkeletonVideoCard({ width, height }: { width: number; height: number }) {
  return (
    <View style={{ width, gap: 8 }}>
      <Skeleton width={width} height={height} radius={Radius.lg} />
      <Skeleton width="86%" height={12} />
      <Skeleton width="58%" height={10} />
    </View>
  );
}

export function SkeletonMatchList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.pad}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonMatchCard key={i} />
      ))}
    </View>
  );
}

export function SkeletonEntityList({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.pad}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonEntityRow key={i} />
      ))}
    </View>
  );
}

export function SkeletonVideoRail({ count = 3 }: { count?: number }) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - Spacing.base * 2 - 36, screenWidth * 0.72);
  const cardHeight = Math.round(cardWidth * 0.56);
  return (
    <View style={styles.rail}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonVideoCard key={i} width={cardWidth} height={cardHeight} />
      ))}
    </View>
  );
}

export function SkeletonHome() {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth - Spacing.base * 2 - 36, screenWidth * 0.82);
  return (
    <View style={styles.pad}>
      <View style={styles.hero}>
        <Skeleton width={88} height={10} />
        <Skeleton width="55%" height={24} style={{ marginTop: 10 }} />
        <Skeleton width="88%" height={12} style={{ marginTop: 10 }} />
        <View style={styles.heroStats}>
          <Skeleton width="28%" height={36} radius={Radius.md} />
          <Skeleton width="28%" height={36} radius={Radius.md} />
          <Skeleton width="28%" height={36} radius={Radius.md} />
        </View>
      </View>
      <Skeleton width={64} height={14} style={{ marginBottom: Spacing.sm }} />
      <View style={styles.rail}>
        <SkeletonMatchCard uniform style={{ width: cardWidth }} />
        <SkeletonMatchCard uniform style={{ width: cardWidth }} />
      </View>
      <Skeleton width={72} height={14} style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }} />
      <View style={styles.rail}>
        <SkeletonMatchCard uniform style={{ width: cardWidth }} />
        <SkeletonMatchCard uniform style={{ width: cardWidth }} />
      </View>
      <Skeleton width={96} height={14} style={{ marginTop: Spacing.lg, marginBottom: Spacing.sm }} />
      <SkeletonVideoRail count={2} />
    </View>
  );
}

export function SkeletonMatchCenter() {
  return (
    <View style={styles.pad}>
      <View style={styles.hero}>
        <Skeleton width={56} height={16} radius={Radius.full} />
        <View style={[styles.rowBetween, { marginTop: Spacing.lg }]}>
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width={48} height={48} radius={Radius.full} />
            <Skeleton width="70%" height={14} />
          </View>
          <Skeleton width={40} height={18} />
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 8 }}>
            <Skeleton width={48} height={48} radius={Radius.full} />
            <Skeleton width="70%" height={14} />
          </View>
        </View>
        <Skeleton width="50%" height={28} style={{ alignSelf: 'center', marginTop: Spacing.lg }} />
      </View>
      <View style={[styles.rowBetween, { marginVertical: Spacing.md }]}>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} width="22%" height={28} radius={Radius.full} />
        ))}
      </View>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} width="100%" height={18} style={{ marginBottom: 12 }} />
      ))}
    </View>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.gridTile}>
          <Skeleton width={36} height={36} radius={Radius.md} />
          <Skeleton width="78%" height={12} style={{ marginTop: 10 }} />
          <Skeleton width="55%" height={10} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bone: {
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 80,
  },
  pad: {
    padding: Spacing.base,
    paddingBottom: 40,
    gap: Spacing.sm,
  },
  matchCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  matchCardUniform: {
    height: 248,
    marginBottom: 0,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rail: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: -Spacing.base,
    paddingHorizontal: Spacing.base,
  },
  hero: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    padding: Spacing.base,
  },
  gridTile: {
    width: '47%',
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
});
