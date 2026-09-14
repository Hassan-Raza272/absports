declare module 'react-native-tts' {
  type TtsEvent = string;
  interface TtsOptions {
    iosVoiceId?: string;
    rate?: number;
    androidParams?: {
      KEY_PARAM_PAN?: number;
      KEY_PARAM_VOLUME?: number;
      KEY_PARAM_STREAM?: string;
    };
  }

  const Tts: {
    getInitStatus: () => Promise<void>;
    setDefaultLanguage: (lang: string) => Promise<void> | void;
    setDefaultRate: (rate: number, skipTransform?: boolean) => Promise<void> | void;
    setDefaultPitch: (pitch: number) => Promise<void> | void;
    speak: (text: string, options?: TtsOptions) => void | Promise<void>;
    stop: (onWordBoundary?: boolean) => Promise<boolean | void>;
    requestInstallEngine: () => Promise<void>;
    addEventListener: (type: TtsEvent, handler: (event: any) => void) => void;
    removeEventListener: (type: TtsEvent, handler: (event: any) => void) => void;
  };

  export default Tts;
}
