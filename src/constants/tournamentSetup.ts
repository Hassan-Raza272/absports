import { BallType, PitchType, TournamentCategory, TournamentMatchKind } from '../types';

export const TOURNAMENT_CATEGORIES: { key: TournamentCategory; label: string }[] = [
  { key: 'open', label: 'OPEN' },
  { key: 'corporate', label: 'CORPORATE' },
  { key: 'community', label: 'COMMUNITY' },
  { key: 'school', label: 'SCHOOL' },
  { key: 'other', label: 'OTHER' },
  { key: 'series', label: 'SERIES' },
  { key: 'college', label: 'COLLEGE' },
  { key: 'university', label: 'UNIVERSITY' },
];

export const BALL_TYPES: { key: BallType; label: string; fill: string }[] = [
  { key: 'tennis', label: 'Tennis', fill: '#0D8A78' },
  { key: 'leather', label: 'Leather', fill: '#C41A3B' },
  { key: 'other', label: 'Other', fill: '#E07A3D' },
];

export const PITCH_TYPES: { key: PitchType; label: string }[] = [
  { key: 'rough', label: 'ROUGH' },
  { key: 'cement', label: 'CEMENT' },
  { key: 'turf', label: 'TURF' },
  { key: 'astroturf', label: 'ASTROTURF' },
  { key: 'matting', label: 'MATTING' },
];

export const MATCH_KINDS: { key: TournamentMatchKind; label: string }[] = [
  { key: 'limited', label: 'Limited Overs' },
  { key: 'box', label: 'Box / Turf Cricket' },
  { key: 'pair', label: 'Pair Cricket' },
  { key: 'test', label: 'Test Match' },
  { key: 'hundred', label: 'The Hundred' },
];

export type BannerVariant =
  | 'league-night'
  | 'chevron-sketch'
  | 'jade-crest'
  | 'burst-kit'
  | 'splash-stroke'
  | 'ruby-cup'
  | 'midnight-oval'
  | 'ember-medal'
  | 'gold-seal'
  | 'navy-spark';

export type BannerPreset = {
  id: string;
  name: string;
  colors: string[];
  variant: BannerVariant;
  ink: string;
};

/** Original AB Sports studio banners — not stock cricket-app artwork. */
export const TOURNAMENT_BANNERS: BannerPreset[] = [
  { id: 'atelier-noir', name: 'League Night', colors: ['#0B1220', '#141C2E', '#1C2740'], variant: 'league-night', ink: '#F6E2B8' },
  { id: 'ivory-crest', name: 'Pavilion Sketch', colors: ['#F3EEE4', '#E9E1D4', '#DDD3C4'], variant: 'chevron-sketch', ink: '#2C241C' },
  { id: 'jade-wicket', name: 'Jade Crest', colors: ['#C8F3EA', '#6ED4C2', '#2BB39E'], variant: 'jade-crest', ink: '#FFFFFF' },
  { id: 'copper-dusk', name: 'Burst Kit', colors: ['#3A3F46', '#4E545C', '#2C3036'], variant: 'burst-kit', ink: '#F4E6D4' },
  { id: 'pearl-line', name: 'Openers', colors: ['#F4F6F8', '#E8EDF2', '#DCE4EA'], variant: 'splash-stroke', ink: '#142033' },
  { id: 'ruby-pavilion', name: 'Ruby Cup', colors: ['#6B1020', '#C41A3B', '#9B1430'], variant: 'ruby-cup', ink: '#F8E7C8' },
  { id: 'midnight-score', name: 'Night Oval', colors: ['#06121F', '#0C1E33', '#14324C'], variant: 'midnight-oval', ink: '#E8D5A8' },
  { id: 'ember-bar', name: 'Ember Medal', colors: ['#1A0C10', '#2C1218', '#3E1A22'], variant: 'ember-medal', ink: '#F2D6C4' },
  { id: 'gold-seal', name: 'Gold Seal', colors: ['#3A2A12', '#C4A15A', '#8C6A2E'], variant: 'gold-seal', ink: '#FFF6E4' },
  { id: 'navy-spark', name: 'Navy Spark', colors: ['#10243A', '#1A3A58', '#0E2A44'], variant: 'navy-spark', ink: '#F4D7A4' },
];

export function formatDay(date: Date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d} / ${m} / ${date.getFullYear()}`;
}

export function toYmd(date: Date) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function matchKindToFormat(kind: TournamentMatchKind): {
  format: 'T20' | 'ODI' | 'TEST' | 'CUSTOM';
  overs: number;
  ballsPerOver: number;
} {
  if (kind === 'test') return { format: 'TEST', overs: 90, ballsPerOver: 6 };
  if (kind === 'hundred') return { format: 'CUSTOM', overs: 20, ballsPerOver: 5 };
  if (kind === 'box') return { format: 'CUSTOM', overs: 8, ballsPerOver: 6 };
  if (kind === 'pair') return { format: 'CUSTOM', overs: 20, ballsPerOver: 6 };
  return { format: 'T20', overs: 20, ballsPerOver: 6 };
}
