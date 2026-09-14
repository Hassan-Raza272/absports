/** Shared TV-style scoreboard themes for preview + Facebook/YouTube overlays. */

export type ScorebarThemeId = 'classic' | 'chase' | 'angular';

export type ScorebarTheme = {
  id: ScorebarThemeId;
  label: string;
  hint: string;
  /** Card / batting / bowling / summary panels */
  panel: {
    side: string;
    sideAlt: string;
    center: string[];
    ink: string;
    inkMuted: string;
    accent: string;
    accentSoft: string;
    gold: string[];
    chipBg: string;
    chipInk: string;
    chaseText: string;
  };
  /** Classic segmented bar colors */
  classic: {
    segScore: string;
    segBatter: string;
    segBatterAlt: string;
    segTarget: string;
    segBowler: string;
    text: string;
    textMuted: string;
  };
  /** Chase / target lime→green bar */
  chase: {
    gradient: string[];
    pill: string[];
    ink: string;
    inkSoft: string;
  };
  /** Angular orange broadcast bar */
  angular: {
    orange: string;
    orangeDeep: string;
    orangeSoft: string;
    white: string;
    ink: string;
    inkMuted: string;
  };
};

export const SCOREBAR_THEMES: Record<ScorebarThemeId, ScorebarTheme> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    hint: 'Olive · purple segments',
    panel: {
      side: '#F6F3E0',
      sideAlt: '#EBE6C4',
      center: ['#5C5A18', '#9A861F'],
      ink: '#1C1A08',
      inkMuted: '#5A5730',
      accent: '#9A861F',
      accentSoft: '#E8E2B0',
      gold: ['#D4B06A', '#9A861F'],
      chipBg: '#E4DEAE',
      chipInk: '#1C1A08',
      chaseText: '#FFFDF2',
    },
    classic: {
      segScore: '#9A861F',
      segBatter: '#5C5A18',
      segBatterAlt: '#6B691C',
      segTarget: '#0B0B0B',
      segBowler: '#9B0A66',
      text: '#FFFFFF',
      textMuted: 'rgba(255,255,255,0.88)',
    },
    chase: {
      gradient: ['#D4E84A', '#5FBF3A', '#1F8A3A'],
      pill: ['#F4F28A', '#C8E24A'],
      ink: '#102410',
      inkSoft: 'rgba(16,36,16,0.75)',
    },
    angular: {
      orange: '#F18A1C',
      orangeDeep: '#E07010',
      orangeSoft: '#FFB35A',
      white: '#FFFFFF',
      ink: '#1A1208',
      inkMuted: 'rgba(26,18,8,0.72)',
    },
  },
  chase: {
    id: 'chase',
    label: 'Chase',
    hint: 'Lime · emerald target',
    panel: {
      side: '#F4FBE8',
      sideAlt: '#E4F5C8',
      center: ['#1B5E20', '#2E7D32'],
      ink: '#143016',
      inkMuted: '#4A6B3E',
      accent: '#2E7D32',
      accentSoft: '#DCEED0',
      gold: ['#C6E23A', '#8BC34A'],
      chipBg: '#E8F5D0',
      chipInk: '#143016',
      chaseText: '#F7FFF0',
    },
    classic: {
      segScore: '#9A861F',
      segBatter: '#5C5A18',
      segBatterAlt: '#6B691C',
      segTarget: '#0B0B0B',
      segBowler: '#9B0A66',
      text: '#FFFFFF',
      textMuted: 'rgba(255,255,255,0.88)',
    },
    chase: {
      gradient: ['#E8F25A', '#7ED321', '#1B8A3A'],
      pill: ['#FFF59D', '#DCE775'],
      ink: '#102410',
      inkSoft: 'rgba(16,36,16,0.78)',
    },
    angular: {
      orange: '#F18A1C',
      orangeDeep: '#E07010',
      orangeSoft: '#FFB35A',
      white: '#FFFFFF',
      ink: '#1A1208',
      inkMuted: 'rgba(26,18,8,0.72)',
    },
  },
  angular: {
    id: 'angular',
    label: 'Angular',
    hint: 'Orange · white broadcast',
    panel: {
      side: '#FFF8F0',
      sideAlt: '#FFE8D0',
      center: ['#E07010', '#C45A08'],
      ink: '#1A1208',
      inkMuted: '#7A5A38',
      accent: '#E07010',
      accentSoft: '#FFE0BC',
      gold: ['#FFB35A', '#F18A1C'],
      chipBg: '#FFE8D0',
      chipInk: '#1A1208',
      chaseText: '#FFF8F0',
    },
    classic: {
      segScore: '#9A861F',
      segBatter: '#5C5A18',
      segBatterAlt: '#6B691C',
      segTarget: '#0B0B0B',
      segBowler: '#9B0A66',
      text: '#FFFFFF',
      textMuted: 'rgba(255,255,255,0.88)',
    },
    chase: {
      gradient: ['#E8F25A', '#7ED321', '#1B8A3A'],
      pill: ['#FFF59D', '#DCE775'],
      ink: '#102410',
      inkSoft: 'rgba(16,36,16,0.78)',
    },
    angular: {
      orange: '#F5A020',
      orangeDeep: '#E8840E',
      orangeSoft: '#FFC46A',
      white: '#FFFFFF',
      ink: '#1A1208',
      inkMuted: 'rgba(26,18,8,0.75)',
    },
  },
};

export const SCOREBAR_THEME_OPTIONS = (
  Object.values(SCOREBAR_THEMES) as ScorebarTheme[]
).map(t => ({ id: t.id, label: t.label, hint: t.hint }));

export function resolveScorebarTheme(id?: ScorebarThemeId | null): ScorebarTheme {
  return SCOREBAR_THEMES[id || 'classic'] || SCOREBAR_THEMES.classic;
}
