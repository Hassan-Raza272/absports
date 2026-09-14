import React from 'react';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';

export type PremiumIconName =
  | 'home'
  | 'fixtures'
  | 'teams'
  | 'points'
  | 'stats'
  | 'players'
  | 'admin'
  | 'club'
  | 'menu'
  | 'sign-out'
  | 'sign-in'
  | 'chevron'
  | 'bell'
  | 'volume'
  | 'volume-mute'
  | 'explore'
  | 'more'
  | 'compare'
  | 'spark'
  | 'quick'
  | 'profile'
  | 'heart'
  | 'play'
  | 'flag-check'
  | 'person'
  | 'camera'
  | 'warning'
  | 'check'
  | 'image'
  | 'back';

const MAP: Record<PremiumIconName, string> = {
  home: 'home-outline',
  fixtures: 'calendar-outline',
  teams: 'shield-outline',
  points: 'trophy-outline',
  stats: 'stats-chart-outline',
  players: 'people-outline',
  admin: 'settings-outline',
  club: 'flag-outline',
  menu: 'menu-outline',
  'sign-out': 'log-out-outline',
  'sign-in': 'log-in-outline',
  chevron: 'chevron-forward',
  bell: 'notifications-outline',
  volume: 'volume-high-outline',
  'volume-mute': 'volume-mute-outline',
  explore: 'compass-outline',
  more: 'grid-outline',
  compare: 'swap-horizontal-outline',
  spark: 'sparkles-outline',
  quick: 'flash-outline',
  profile: 'person-circle-outline',
  heart: 'heart-outline',
  play: 'play-circle-outline',
  'flag-check': 'flag-outline',
  person: 'person-outline',
  camera: 'camera-outline',
  warning: 'warning-outline',
  check: 'checkmark-circle-outline',
  image: 'image-outline',
  back: 'chevron-back',
};

type Props = {
  name: PremiumIconName;
  size?: number;
  color?: string;
};

/** Premium Ionicons used across drawer + headers. */
export default function PremiumIcon({ name, size = 20, color = Colors.primary }: Props) {
  return <Icon name={MAP[name]} size={size} color={color} />;
}
