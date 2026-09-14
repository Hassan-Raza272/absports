import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ScorebarThemeId,
  SCOREBAR_THEME_OPTIONS,
  resolveScorebarTheme,
} from '../theme/scorebarThemes';

export type OverlayGraphicsMode =
  | 'scorebar'
  | 'batting'
  | 'bowling'
  | 'innings1'
  | 'summary';

const MODE_STORAGE_KEY = 'absscore.overlayGraphicsMode';
const THEME_STORAGE_KEY = 'absscore.scorebarTheme';

const VALID_MODES: OverlayGraphicsMode[] = [
  'scorebar',
  'batting',
  'bowling',
  'innings1',
  'summary',
];

const VALID_THEMES: ScorebarThemeId[] = ['classic', 'chase', 'angular'];

interface OverlayModeState {
  mode: OverlayGraphicsMode;
  theme: ScorebarThemeId;
  hydrated: boolean;
  /** Live Scoring is pushing overlays from local ball-by-ball state. */
  scoringCaptureActive: boolean;
  setMode: (mode: OverlayGraphicsMode) => void;
  setTheme: (theme: ScorebarThemeId) => void;
  setScoringCaptureActive: (active: boolean) => void;
  hydrate: () => Promise<void>;
}

export const OVERLAY_MODE_OPTIONS: { id: OverlayGraphicsMode; label: string; secondInningsOnly?: boolean }[] = [
  { id: 'scorebar', label: 'Score' },
  { id: 'batting', label: 'Batting' },
  { id: 'bowling', label: 'Bowling' },
  { id: 'innings1', label: '1st Inn', secondInningsOnly: true },
  { id: 'summary', label: 'Summary' },
];

export { SCOREBAR_THEME_OPTIONS, resolveScorebarTheme };
export type { ScorebarThemeId };

export function overlayModesForInnings(inningsNumber: 1 | 2) {
  return OVERLAY_MODE_OPTIONS.filter(
    opt => !opt.secondInningsOnly || inningsNumber === 2,
  );
}

export function isOverlayCardMode(mode: OverlayGraphicsMode) {
  return mode === 'batting' || mode === 'bowling' || mode === 'innings1' || mode === 'summary';
}

export const useOverlayModeStore = create<OverlayModeState>(set => ({
  mode: 'scorebar',
  theme: 'classic',
  hydrated: false,
  scoringCaptureActive: false,
  setMode: mode => {
    set({ mode });
    AsyncStorage.setItem(MODE_STORAGE_KEY, mode).catch(() => {});
  },
  setTheme: theme => {
    set({ theme });
    AsyncStorage.setItem(THEME_STORAGE_KEY, theme).catch(() => {});
  },
  setScoringCaptureActive: active => set({ scoringCaptureActive: active }),
  hydrate: async () => {
    try {
      const [savedMode, savedTheme] = await Promise.all([
        AsyncStorage.getItem(MODE_STORAGE_KEY),
        AsyncStorage.getItem(THEME_STORAGE_KEY),
      ]);
      const next: Partial<OverlayModeState> = { hydrated: true };
      if (savedMode && (VALID_MODES as string[]).includes(savedMode)) {
        next.mode = savedMode as OverlayGraphicsMode;
      }
      if (savedTheme && (VALID_THEMES as string[]).includes(savedTheme)) {
        next.theme = savedTheme as ScorebarThemeId;
      }
      set(next);
      return;
    } catch {
      // keep defaults
    }
    set({ hydrated: true });
  },
}));
