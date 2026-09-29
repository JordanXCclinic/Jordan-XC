import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/**
 * Saving a clinic photo to the phone.
 *
 * No web page is allowed to write into the camera roll; browsers refuse it on
 * purpose. What a page can do is open the system share sheet with the image
 * attached, and on an iPhone that sheet's "Save Image" puts it in Photos —
 * the route every site offering "save photo" takes. The phone builds use the
 * same sheet, which carries the same option, so the button behaves alike on
 * both. A browser with no share sheet, a desktop one, downloads the file.
 *
 * Safari only opens the share sheet from inside the tap that asked for it, and
 * waiting on a download first uses that moment up. So the image is fetched
 * when the photo is opened (prepareWebPhoto), and the tap shares what is
 * already in hand.
 */

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

const prepared = new Map<string, Promise<File>>();

function fileName(takenOn: string | null | undefined, type: string): string {
  const day = (takenOn ?? new Date().toISOString()).slice(0, 10);
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  return `jordan-xc-${day}.${ext}`;
}

/** Web only: start fetching the image so a later tap can share it at once. */
export function prepareWebPhoto(url: string, takenOn?: string | null): void {
  if (Platform.OS !== 'web' || prepared.has(url)) return;
  const pending = fetch(url)
    .then((response) => {
      if (!response.ok) throw new Error(`The photo could not be fetched (${response.status}).`);
      return response.blob();
    })
    .then((blob) => new File([blob], fileName(takenOn, blob.type), { type: blob.type || 'image/jpeg' }));
  // A failed fetch must not stick: the next attempt should try again.
  pending.catch(() => prepared.delete(url));
  prepared.set(url, pending);
}

export async function savePhoto(url: string, takenOn?: string | null): Promise<SaveResult> {
  if (Platform.OS === 'web') return saveOnWeb(url, takenOn);

  const file = new FileSystem.File(FileSystem.Paths.cache, fileName(takenOn, 'image/jpeg'));
  if (file.exists) file.delete();
  const downloaded = await FileSystem.File.downloadFileAsync(url, file);
  await Sharing.shareAsync(downloaded.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg' });
  return 'shared';
}

async function saveOnWeb(url: string, takenOn?: string | null): Promise<SaveResult> {
  prepareWebPhoto(url, takenOn);
  const file = await prepared.get(url)!;

  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (problem) {
      // Closing the sheet without picking anything is not a failure.
      if (problem instanceof DOMException && problem.name === 'AbortError') return 'cancelled';
      // Anything else, most often the tap's moment having passed: fall through
      // to a download rather than leave the person with nothing.
    }
  }

  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(file);
  link.href = objectUrl;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  return 'downloaded';
}
