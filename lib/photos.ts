import type { ImagePickerAsset } from 'expo-image-picker';
import { supabase } from './supabase';

export const PHOTO_BUCKET = 'clinic-photos';

/** Signed links are short-lived on purpose: these are pictures of minors. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * React Native has no Buffer and cannot turn a file:// URI into an ArrayBuffer
 * reliably, so the picker hands back base64 and this decodes it. Small enough
 * not to be worth a dependency.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));

  let byteIndex = 0;
  let buffer = 0;
  let bits = 0;

  for (const char of clean) {
    const value = BASE64_ALPHABET.indexOf(char);
    if (value < 0) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex++] = (buffer >> bits) & 0xff;
    }
  }

  return bytes.subarray(0, byteIndex);
}

const EXTENSION_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
};

function describe(asset: ImagePickerAsset): { extension: string; contentType: string } {
  const raw = asset.fileName?.split('.').pop()?.toLowerCase() ?? '';
  const extension = EXTENSION_TYPES[raw] ? raw : 'jpg';
  return { extension, contentType: EXTENSION_TYPES[extension] ?? 'image/jpeg' };
}

/** Filenames are generated, never taken from the device — they leak real names. */
function storagePath(extension: string): string {
  const now = new Date();
  const unique = `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `${now.getFullYear()}/${unique}.${extension}`;
}

export async function uploadPhoto(
  asset: ImagePickerAsset
): Promise<{ path: string | null; error: string | null }> {
  if (!asset.base64) return { path: null, error: 'That image could not be read.' };

  const { extension, contentType } = describe(asset);
  const path = storagePath(extension);

  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, base64ToBytes(asset.base64), { contentType, upsert: false });

  return error ? { path: null, error: error.message } : { path, error: null };
}

/** Signs a batch in one round trip and returns a path → URL map. */
export async function signPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};

  const { data } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  const map: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}

export async function deletePhoto(id: string, path: string): Promise<string | null> {
  const { error } = await supabase.from('photos').delete().eq('id', id);
  if (error) return error.message;

  // The row is the thing the app reads, so a stranded object is recoverable
  // while a stranded row would render a broken tile.
  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
  return null;
}
