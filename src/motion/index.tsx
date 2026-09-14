import React, { useState } from 'react';
import { Pressable, StyleProp, ViewStyle } from 'react-native';
import { EaseView, type AnimateProps, type Transition } from 'react-native-ease';

/** Soft spring for screen / card entrance. */
export const enterTransition: Transition = {
  type: 'spring',
  damping: 18,
  stiffness: 160,
  mass: 1,
};

/** Snappy spring for press feedback. */
export const pressTransition: Transition = {
  type: 'spring',
  damping: 24,
  stiffness: 480,
  mass: 0.7,
};

/** Extra-snappy spring for scoring pad taps. */
export const scorePressTransition: Transition = {
  type: 'spring',
  damping: 20,
  stiffness: 560,
  mass: 0.55,
};

/** Short fade for headers and subtle chrome. */
export const fadeTransition: Transition = {
  type: 'timing',
  duration: 280,
  easing: 'easeOut',
};

type EnterProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Stagger delay index (50ms steps). */
  index?: number;
  from?: AnimateProps;
  to?: AnimateProps;
  transition?: Transition;
};

/** Fade + rise on mount. Use on screen bodies, cards, tiles. */
export function EaseEnter({
  children,
  style,
  index = 0,
  from = { opacity: 0, translateY: 14, scale: 0.98 },
  to = { opacity: 1, translateY: 0, scale: 1 },
  transition,
}: EnterProps) {
  const delay = Math.min(index, 12) * 45;
  const base = transition ?? enterTransition;
  const resolved: Transition =
    base && typeof base === 'object' && 'type' in base && base.type !== 'none'
      ? { ...base, delay: (base.delay || 0) + delay }
      : base;

  return (
    <EaseView
      initialAnimate={from}
      animate={to}
      transition={resolved}
      style={style}>
      {children}
    </EaseView>
  );
}

type PressProps = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  /** How far the child scales down while pressed (default 0.97). */
  pressScale?: number;
  /** Android ripple color; omit for no ripple. */
  rippleColor?: string;
  transition?: Transition;
};

/** Scale-down press feedback around any child. */
export function EasePress({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  hitSlop,
  pressScale = 0.97,
  rippleColor,
  transition = pressTransition,
}: PressProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      android_ripple={rippleColor ? { color: rippleColor, foreground: true, borderless: false } : undefined}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}>
      <EaseView
        animate={{ scale: pressed && !disabled ? pressScale : 1 }}
        transition={transition}
        style={style}>
        {children}
      </EaseView>
    </Pressable>
  );
}

type ScreenProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Full-screen enter: fade chrome, content rises. */
export function EaseScreen({ children, style }: ScreenProps) {
  return (
    <EaseView
      initialAnimate={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fadeTransition}
      style={style}>
      {children}
    </EaseView>
  );
}

export { EaseView };
