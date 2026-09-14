import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

export type RtmpStatusType =
  | 'started'
  | 'connecting'
  | 'success'
  | 'retrying'
  | 'failed'
  | 'stopped'
  | 'disconnected'
  | 'authError'
  | 'authSuccess'
  | 'bitrate';

export type RtmpStatusEvent = {
  type: RtmpStatusType;
  message?: string;
};

export type StreamPlatform = 'facebook' | 'youtube';

const FACEBOOK_RTMPS = 'rtmps://live-api-s.facebook.com:443/rtmp/';
/** Primary YouTube Live ingest. Full RTMP URLs from Studio are also accepted as-is. */
const YOUTUBE_RTMP = 'rtmp://a.rtmp.youtube.com/live2/';

const { RtmpStreamModule } = NativeModules;
const emitter = RtmpStreamModule ? new NativeEventEmitter(RtmpStreamModule) : null;

let streaming = false;

export function isRtmpAvailable() {
  return Platform.OS === 'android' && !!RtmpStreamModule;
}

export function isLocallyStreaming() {
  return streaming;
}

export function platformIngestBase(platform: StreamPlatform) {
  return platform === 'youtube' ? YOUTUBE_RTMP : FACEBOOK_RTMPS;
}

export function platformLabel(platform: StreamPlatform) {
  return platform === 'youtube' ? 'YouTube' : 'Facebook';
}

/**
 * Accepts a full rtmp(s):// URL, or a bare stream key for the selected platform.
 */
export function normalizeRtmpUrl(input: string, platform: StreamPlatform = 'facebook') {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^rtmps?:\/\//i.test(trimmed)) return trimmed;
  const base = platformIngestBase(platform);
  return `${base}${trimmed.replace(/^\//, '')}`;
}

export async function requestBroadcastPermissions() {
  if (Platform.OS !== 'android') return false;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  return (
    result['android.permission.CAMERA'] === PermissionsAndroid.RESULTS.GRANTED &&
    result['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
  );
}

export async function startPreview() {
  if (!RtmpStreamModule) throw new Error('RTMP streaming is Android-only');
  await RtmpStreamModule.startPreview();
}

export async function startStream(rtmpUrl: string, platform: StreamPlatform = 'facebook') {
  if (!RtmpStreamModule) throw new Error('RTMP streaming is Android-only');
  const url = normalizeRtmpUrl(rtmpUrl, platform);
  if (!url) {
    throw new Error(
      platform === 'youtube'
        ? 'Enter a YouTube stream key or RTMP URL'
        : 'Enter a Facebook stream key or RTMP URL',
    );
  }
  await RtmpStreamModule.startStream(url);
  streaming = true;
}

export async function stopStream() {
  if (!RtmpStreamModule) return;
  await RtmpStreamModule.stopStream();
  streaming = false;
}

export async function updateOverlay(base64Png: string) {
  if (!RtmpStreamModule || !base64Png) return;
  await RtmpStreamModule.updateOverlay(base64Png);
}

export async function switchCamera() {
  if (!RtmpStreamModule) return;
  await RtmpStreamModule.switchCamera();
}

export async function setMicrophoneMuted(muted: boolean): Promise<boolean> {
  if (!RtmpStreamModule) return muted;
  const value = await RtmpStreamModule.setMicrophoneMuted(muted);
  return !!value;
}

export async function isMicrophoneMuted(): Promise<boolean> {
  if (!RtmpStreamModule) return false;
  const value = await RtmpStreamModule.isMicrophoneMuted();
  return !!value;
}

export type ZoomInfo = {
  zoom: number;
  min: number;
  max: number;
};

export async function setZoom(zoom: number): Promise<number> {
  if (!RtmpStreamModule) return 1;
  const value = await RtmpStreamModule.setZoom(zoom);
  return typeof value === 'number' ? value : 1;
}

export async function adjustZoom(delta: number): Promise<number> {
  if (!RtmpStreamModule) return 1;
  const value = await RtmpStreamModule.adjustZoom(delta);
  return typeof value === 'number' ? value : 1;
}

export async function getZoomInfo(): Promise<ZoomInfo> {
  if (!RtmpStreamModule) return { zoom: 1, min: 1, max: 1 };
  const info = await RtmpStreamModule.getZoomInfo();
  return {
    zoom: Number(info?.zoom ?? 1),
    min: Number(info?.min ?? 1),
    max: Number(info?.max ?? 1),
  };
}

export async function isRtmpStreaming() {
  if (!RtmpStreamModule) return false;
  const value = await RtmpStreamModule.isStreaming();
  streaming = !!value;
  return streaming;
}

export function subscribeRtmpStatus(listener: (event: RtmpStatusEvent) => void) {
  if (!emitter) return () => undefined;
  const sub = emitter.addListener('RtmpStreamStatus', (event: RtmpStatusEvent) => {
    if (event?.type === 'success' || event?.type === 'started' || event?.type === 'connecting') {
      streaming = true;
    }
    if (
      event?.type === 'stopped' ||
      event?.type === 'disconnected' ||
      event?.type === 'failed' ||
      event?.type === 'authError'
    ) {
      streaming = false;
    }
    listener(event);
  });
  return () => sub.remove();
}
