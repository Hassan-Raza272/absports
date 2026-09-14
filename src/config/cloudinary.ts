/**
 * Cloudinary unsigned upload config (client-side).
 *
 * Setup (Cloudinary Console → Settings → Upload → Upload presets):
 * 1. Create a preset with Signing mode = Unsigned
 * 2. Optionally set Folder = abs-score
 * 3. Paste your cloud name + preset name below
 */
export const CLOUDINARY = {
  cloudName: 'ankgahhz',
  uploadPreset: 'j7z1d8oq',
  folder: 'abs-score',
};

export function isCloudinaryConfigured(): boolean {
  return (
    !!CLOUDINARY.cloudName
    && !CLOUDINARY.cloudName.startsWith('YOUR_')
    && !!CLOUDINARY.uploadPreset
    && !CLOUDINARY.uploadPreset.startsWith('YOUR_')
  );
}
