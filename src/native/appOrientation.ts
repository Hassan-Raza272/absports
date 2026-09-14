import { NativeModules, Platform } from 'react-native';

type AppOrientationNative = {
  lockLandscape?: () => void;
  lockPortrait?: () => void;
};

const AppOrientation = NativeModules.AppOrientation as AppOrientationNative | undefined;

/** Lock the device into landscape while the video player is open. */
export function lockLandscape() {
  try {
    AppOrientation?.lockLandscape?.();
  } catch {
    // Native module may be unavailable until a rebuild; layout fallback still applies.
  }
}

/** Restore portrait after the video player closes. */
export function lockPortrait() {
  try {
    if (Platform.OS === 'android') {
      AppOrientation?.lockPortrait?.();
    }
  } catch {
    // no-op
  }
}
