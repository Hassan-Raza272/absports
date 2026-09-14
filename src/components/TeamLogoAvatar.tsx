import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  bundledCricketLogoSource,
  isBundledCricketLogo,
  isCustomUploadedLogo,
  premiumCrestStyle,
} from '../utils/defaultLogo';

type CrestProps = {
  name: string;
  shortName?: string;
  size: number;
};

/** Always-on local premium crest — never blank, no network required. */
export function PremiumTeamCrest({ name, shortName, size }: CrestProps) {
  const style = useMemo(
    () => premiumCrestStyle(`${shortName || ''} ${name}`.trim() || name),
    [name, shortName],
  );
  return (
    <LinearGradient
      colors={style.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.28)',
      }}>
      <Text
        style={{
          color: style.text,
          fontWeight: '900',
          fontSize: Math.max(12, size * (style.monogram.length > 2 ? 0.28 : 0.34)),
          letterSpacing: style.monogram.length > 2 ? 0.5 : 1,
        }}>
        {style.monogram}
      </Text>
    </LinearGradient>
  );
}

type AvatarProps = {
  name: string;
  shortName?: string;
  logoURL?: string;
  size: number;
};

/**
 * Uploaded photos and bundled cricket crests show as images.
 * Missing / generated / broken URLs get a local monogram crest.
 */
export default function TeamLogoAvatar({ name, shortName, logoURL, size }: AvatarProps) {
  const bundled = bundledCricketLogoSource(logoURL);
  const custom = isCustomUploadedLogo(logoURL) && !isBundledCricketLogo(logoURL);
  const [failed, setFailed] = useState(false);

  if (bundled && !failed) {
    return (
      <Image
        source={bundled}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E5E7EB' }}
        onError={() => setFailed(true)}
      />
    );
  }

  if (custom && logoURL && !failed) {
    return (
      <Image
        source={{ uri: logoURL }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#E5E7EB' }}
        onError={() => setFailed(true)}
      />
    );
  }

  return <PremiumTeamCrest name={name} shortName={shortName} size={size} />;
}
