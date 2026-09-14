import React from 'react';
import { Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { requireNativeComponent } from 'react-native';
import { Colors, Typography } from '../theme';

type Props = {
  style?: StyleProp<ViewStyle>;
};

const NativeRtmpCameraView =
  Platform.OS === 'android' ? requireNativeComponent<Props>('RtmpCameraView') : null;

export default function RtmpCameraView({ style }: Props) {
  if (!NativeRtmpCameraView) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={styles.fallbackText}>Camera preview is available on Android.</Text>
      </View>
    );
  }
  return <NativeRtmpCameraView style={style} />;
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: Colors.textSecondary,
    fontSize: Typography.sm,
  },
});
