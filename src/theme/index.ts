export const Colors = {
  // Cricket-app energy, our own mix: ruby header, jade actions, white pages
  primary: '#C41A3B',
  primaryDark: '#9B1430',
  primaryLight: '#E03A58',
  onPrimary: '#FFFFFF',

  // Jade accent (CTAs, links, success) — not the same teal as typical cricket apps
  accent: '#0D8A78',
  accentOrange: '#E07A3D',
  accentRed: '#C41A3B',
  accentBlue: '#2B7BB4',
  accentPurple: '#6B5B95',

  // Surfaces
  bg: '#F3F4F6',
  bgCard: '#FFFFFF',
  bgElevated: '#EEF0F3',
  bgModal: '#FFFFFF',

  // Text
  textPrimary: '#1C1C1E',
  textSecondary: '#5C6370',
  textMuted: '#8E95A3',
  textAccent: '#0D8A78',

  // Live
  live: '#C41A3B',
  liveGlow: 'rgba(196,26,59,0.16)',

  // Status
  win: '#0D8A78',
  loss: '#C41A3B',
  nr: '#E07A3D',

  // Borders
  border: '#E6E8EE',
  borderLight: '#F0F1F4',

  // Gradients
  gradPrimary: ['#E03A58', '#C41A3B', '#9B1430'] as string[],
  gradDark: ['#FFFFFF', '#F3F4F6', '#EEF0F3'] as string[],
  gradCard: ['#FFFFFF', '#F8F9FB'] as string[],
  gradHeader: ['#D12244', '#C41A3B', '#9B1430'] as string[],
  gradLive: ['#E03A58', '#C41A3B'] as string[],
  gradLiveCard: ['#FDECEF', '#FFFFFF'] as string[],
  gradGold: ['#2BB39E', '#0D8A78', '#0A6B5D'] as string[],
  gradPurple: ['#8B7CB5', '#6B5B95'] as string[],

  overlay: 'rgba(28,28,30,0.45)',
  overlayLight: 'rgba(28,28,30,0.18)',
  transparent: 'transparent',
};

export const StatusBarStyle = 'dark-content' as const;

export const Typography = {
  fontBold: 'System',
  fontSemiBold: 'System',
  fontMedium: 'System',
  fontRegular: 'System',
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 36,
  hero: 48,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  full: 999,
};

export const Shadow = {
  sm: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#1C1C1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#C41A3B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
};
