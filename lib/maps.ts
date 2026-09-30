import { Linking } from 'react-native';

/**
 * Directions to a practice.
 *
 * The coach can give a street address, paste a map link from the share sheet,
 * or give nothing and let the location name stand in — so a family can always
 * tap through, and the coach only adds an address when the name alone would
 * land on the wrong place.
 *
 * Everything that is not a pasted link goes through Google's cross-platform
 * Maps URL: on a phone with Google Maps it opens the app, and anywhere else it
 * opens Google Maps in the browser, so the same link works on iPhone, Android
 * and the web build.
 */

/** Hosts a pasted link may point at. Anything else is not opened as a link. */
const MAP_HOSTS: { host: RegExp; path?: RegExp }[] = [
  { host: /^(www\.)?google\.com$/i, path: /^\/maps(\/|$)/ },
  { host: /^maps\.google\.com$/i },
  { host: /^maps\.app\.goo\.gl$/i },
  { host: /^goo\.gl$/i, path: /^\/maps(\/|$)/ },
  { host: /^maps\.apple\.com$/i },
];

/**
 * Split by hand rather than with URL: React Native's URL is incomplete, and
 * all this needs is the host and the path.
 */
const LINK = /^https:\/\/([^/?#:]+)(\/[^?#]*)?/i;

export function looksLikeLink(text: string): boolean {
  return /^[a-z]+:\/\//i.test(text.trim());
}

/** The pasted link itself when it is a maps link, otherwise null. */
export function asMapLink(text: string): string | null {
  const trimmed = text.trim();
  const match = trimmed.match(LINK);
  if (!match) return null;
  const [, host, path = '/'] = match;
  const allowed = MAP_HOSTS.some(
    (rule) => rule.host.test(host) && (!rule.path || rule.path.test(path))
  );
  return allowed ? trimmed : null;
}

/** Where tapping a practice's location goes. */
export function directionsUrl(place: string, address?: string | null): string {
  const given = address?.trim() ?? '';
  if (given) {
    const link = asMapLink(given);
    if (link) return link;
  }
  // A link that is not a maps link was refused when the practice was saved;
  // if one got in anyway, the location name is the safe thing to search.
  const query = given && !looksLikeLink(given) ? given : place.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Opens directions in the phone's maps app, or a new tab on the web. */
export async function openDirections(place: string, address?: string | null): Promise<void> {
  await Linking.openURL(directionsUrl(place, address));
}
