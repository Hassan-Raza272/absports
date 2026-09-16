import { Image, ImageSourcePropType } from 'react-native';
import { useHubStore, useTeamsStore } from '../store';
import { Team } from '../types';

/** Deep sports-club palettes — navy, crimson, jade, gold, charcoal (not pastel). */
const PRO_PALETTES = [
  { bg: ['#0B1F3A', '#1A3A6B'], hex: '0B1F3A', text: '#FFFFFF' },
  { bg: ['#7A1024', '#C41A3B'], hex: 'C41A3B', text: '#FFFFFF' },
  { bg: ['#064E3B', '#0D8A78'], hex: '0D8A78', text: '#FFFFFF' },
  { bg: ['#1C1917', '#44403C'], hex: '1C1917', text: '#F5F5F4' },
  { bg: ['#1E3A5F', '#2B7BB4'], hex: '1E3A5F', text: '#FFFFFF' },
  { bg: ['#3B1F0B', '#92400E'], hex: '92400E', text: '#FEF3C7' },
  { bg: ['#14532D', '#166534'], hex: '14532D', text: '#FFFFFF' },
  { bg: ['#4C0519', '#9F1239'], hex: '9F1239', text: '#FFF1F2' },
  { bg: ['#0C4A6E', '#0369A1'], hex: '0C4A6E', text: '#FFFFFF' },
  { bg: ['#292524', '#57534E'], hex: '44403C', text: '#FAFAF9' },
  { bg: ['#4C1D95', '#6B21A8'], hex: '6B21A8', text: '#FFFFFF' },
  { bg: ['#78350F', '#B45309'], hex: 'B45309', text: '#FFFBEB' },
] as const;

/** Cricket crest pack used when a team is created without uploading a logo. */
const CRICKET_LOGO_PACK: Record<string, ImageSourcePropType> = {
  'cricket-logo-1': require('../assets/cricket-logos/cricket-logo-1.jpg'),
  'cricket-logo-2': require('../assets/cricket-logos/cricket-logo-2.jpg'),
  'cricket-logo-3': require('../assets/cricket-logos/cricket-logo-3.jpg'),
  'cricket-logo-4': require('../assets/cricket-logos/cricket-logo-4.jpg'),
  'cricket-logo-5': require('../assets/cricket-logos/cricket-logo-5.jpg'),
  'cricket-logo-6': require('../assets/cricket-logos/cricket-logo-6.jpg'),
  'cricket-logo-7': require('../assets/cricket-logos/cricket-logo-7.jpg'),
  'cricket-logo-8': require('../assets/cricket-logos/cricket-logo-8.jpg'),
};

const CRICKET_LOGO_IDS = Object.keys(CRICKET_LOGO_PACK);
const BUNDLED_PREFIX = 'bundled:';

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Extract 1–3 letter monogram from a team name / seed. */
export function teamMonogram(seed: string): string {
  const clean = (seed || '')
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .trim();
  if (!clean) return 'AB';

  const compact = clean.replace(/\s+/g, '');
  if (compact.length <= 3 && /^[A-Za-z0-9]+$/.test(compact)) {
    return compact.slice(0, 3).toUpperCase();
  }

  const parts = clean.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 3) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}${parts[2][0] || ''}`.toUpperCase();
  }
  if (parts.length === 2) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

export function premiumCrestStyle(seed: string) {
  const clean = (seed || '').trim() || 'team';
  const palette = PRO_PALETTES[hashSeed(clean) % PRO_PALETTES.length];
  return {
    monogram: teamMonogram(clean),
    colors: [...palette.bg] as string[],
    text: palette.text,
    hex: palette.hex,
  };
}

export function isBundledCricketLogo(uri?: string | null): boolean {
  return !!uri && uri.startsWith(BUNDLED_PREFIX);
}

export function bundledCricketLogoSource(uri?: string | null): ImageSourcePropType | null {
  if (!isBundledCricketLogo(uri)) return null;
  const rawId = String(uri).slice(BUNDLED_PREFIX.length);
  const id = rawId.split('#')[0].split('?')[0];
  return CRICKET_LOGO_PACK[id] || null;
}

/** Local file URI for a bundled crest (useful when uploading to Cloudinary). */
export function bundledCricketLogoFileUri(uri?: string | null): string | null {
  const source = bundledCricketLogoSource(uri);
  if (!source) return null;
  const resolved = Image.resolveAssetSource(source as number);
  return resolved?.uri || null;
}

export function isCustomUploadedLogo(uri?: string | null): boolean {
  if (!uri) return false;
  const u = uri.trim().toLowerCase();
  if (isBundledCricketLogo(uri)) return true;
  if (!u.startsWith('http')) return false;
  // Generated placeholders — UI draws a local crest instead
  if (u.includes('dicebear.com') || u.includes('ui-avatars.com') || u.includes('api.dicebear')) {
    return false;
  }
  return true;
}

/**
 * Remote URL for storage / sharing.
 * Uses ui-avatars for reliable initials badges (legacy fallback only).
 */
export function defaultLogoURL(seed: string, _kind: 'team' | 'club' = 'team'): string {
  const clean = (seed || '').trim() || `team-${Date.now()}`;
  const style = premiumCrestStyle(clean);
  const params = new URLSearchParams({
    name: style.monogram,
    background: style.hex,
    color: style.text.replace('#', ''),
    size: '256',
    bold: 'true',
    rounded: 'true',
    format: 'png',
  });
  return `https://ui-avatars.com/api/?${params.toString()}`;
}

/**
 * Pick a unique cricket crest from the local pack when the user skips a logo upload.
 * Checks existing teams so every newly created team is assigned a UNIQUE, non-duplicate logo.
 */
export function randomPremiumTeamLogo(
  seed?: string,
  existingTeamsOrLogos?: (Team | string | null | undefined)[],
): string {
  const cleanSeed = (seed || '').trim() || `team-${Date.now()}`;

  // 1. Collect all logo URLs currently in use
  const usedLogos = new Set<string>();

  if (existingTeamsOrLogos) {
    for (const item of existingTeamsOrLogos) {
      if (typeof item === 'string' && item.trim()) {
        usedLogos.add(item.trim());
      } else if (item && typeof item === 'object' && item.logoURL) {
        usedLogos.add(item.logoURL.trim());
      }
    }
  }

  try {
    const localTeams = useTeamsStore?.getState?.()?.teams || [];
    const hubTeams = useHubStore?.getState?.()?.teams || [];
    for (const t of [...localTeams, ...hubTeams]) {
      if (t?.logoURL) {
        usedLogos.add(t.logoURL.trim());
      }
    }
  } catch {
    // Fallback if store is uninitialized
  }

  // Normalize used logos to extract base bundled IDs (e.g. 'cricket-logo-1')
  const usedBundledIds = new Set<string>();
  usedLogos.forEach(logo => {
    if (isBundledCricketLogo(logo)) {
      const rawId = logo.slice(BUNDLED_PREFIX.length).split('#')[0].split('?')[0];
      usedBundledIds.add(rawId);
    }
  });

  // 2. Find unused bundled cricket logo IDs
  const unusedIds = CRICKET_LOGO_IDS.filter(id => !usedBundledIds.has(id));

  if (unusedIds.length > 0) {
    // Pick an unused logo deterministically using the seed hash
    const hashIndex = Math.abs(hashSeed(cleanSeed)) % unusedIds.length;
    const selectedId = unusedIds[hashIndex];
    return `${BUNDLED_PREFIX}${selectedId}`;
  }

  // 3. If all 8 bundled logos are already assigned, append a unique tag to guarantee uniqueness
  const baseIndex = Math.abs(hashSeed(cleanSeed)) % CRICKET_LOGO_IDS.length;
  const baseId = CRICKET_LOGO_IDS[baseIndex];
  const uniqueTag = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return `${BUNDLED_PREFIX}${baseId}#${uniqueTag}`;
}
