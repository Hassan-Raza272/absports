import { Image, ImageSourcePropType } from 'react-native';

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
  const id = String(uri).slice(BUNDLED_PREFIX.length);
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
 * Pick a random cricket crest from the local pack when the user skips a logo upload.
 * Stored as `bundled:cricket-logo-N` so every device can render it offline.
 */
export function randomPremiumTeamLogo(_teamName?: string): string {
  const id = CRICKET_LOGO_IDS[Math.floor(Math.random() * CRICKET_LOGO_IDS.length)];
  return `${BUNDLED_PREFIX}${id}`;
}
