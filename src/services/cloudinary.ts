import { Platform } from 'react-native';
import { CLOUDINARY, isCloudinaryConfigured } from '../config/cloudinary';

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
};

/** True when the URI is a local device file that still needs uploading. */
export function isLocalImageUri(uri?: string | null): boolean {
  if (!uri) return false;
  const value = uri.trim();
  if (!value) return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  return (
    value.startsWith('file://')
    || value.startsWith('content://')
    || value.startsWith('ph://')
    || value.startsWith('/')
  );
}

function guessMimeAndName(uri: string): { type: string; name: string } {
  const clean = uri.split('?')[0].toLowerCase();
  if (clean.endsWith('.png')) return { type: 'image/png', name: 'upload.png' };
  if (clean.endsWith('.webp')) return { type: 'image/webp', name: 'upload.webp' };
  if (clean.endsWith('.heic') || clean.endsWith('.heif')) {
    return { type: 'image/heic', name: 'upload.heic' };
  }
  return { type: 'image/jpeg', name: 'upload.jpg' };
}

/**
 * Upload an image to Cloudinary via unsigned preset.
 * Returns the secure CDN URL to store in Realtime Database.
 */
export async function uploadImageToCloudinary(
  uri: string,
  folder = CLOUDINARY.folder,
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'Cloudinary is not configured. Set cloudName and uploadPreset in src/config/cloudinary.ts',
    );
  }

  const { type, name } = guessMimeAndName(uri);
  const fileUri = Platform.OS === 'ios' && uri.startsWith('file://')
    ? uri
    : uri;

  const form = new FormData();
  form.append('file', {
    uri: fileUri,
    type,
    name,
  } as any);
  form.append('upload_preset', CLOUDINARY.uploadPreset);
  if (folder) form.append('folder', folder);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/image/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: form,
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = json?.error?.message || `Cloudinary upload failed (${response.status})`;
    throw new Error(message);
  }

  const url = json.secure_url || json.url;
  if (!url) {
    throw new Error('Cloudinary did not return an image URL.');
  }

  return {
    url,
    publicId: json.public_id,
    width: json.width,
    height: json.height,
  };
}

/**
 * If uri is local, upload to Cloudinary; if already remote, return as-is.
 */
export async function resolveImageUrl(uri?: string | null, folder?: string): Promise<string | undefined> {
  if (!uri?.trim()) return undefined;
  if (!isLocalImageUri(uri)) return uri.trim();
  const uploaded = await uploadImageToCloudinary(uri.trim(), folder);
  return uploaded.url;
}
