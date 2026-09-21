/**
 * Public URLs both app stores link to from the listing and the app itself.
 *
 * These must be live and reachable before submission — Apple and Google both
 * check them, and Settings links to them from inside the app.
 *
 * They point at the published build, which is where docs/privacy-policy.md and
 * docs/terms.md are rendered by the Pages workflow. They were aimed at
 * jordanxcclinic.com/app-privacy first, but nothing is served there, so the
 * in-app links and the store listings were both pointing at nothing. If the
 * clinic later hosts them on its own domain, change these two lines and
 * republish; keep both addresses working, since a store listing may still
 * carry the old one.
 */
export const PRIVACY_POLICY_URL = 'https://jordanxcclinic.github.io/Jordan-XC/privacy.html';
export const TERMS_URL = 'https://jordanxcclinic.github.io/Jordan-XC/terms.html';
export const SUPPORT_EMAIL = 'info@jordanxcclinic.com';

/**
 * Apple's Hide My Email hands the app a relay address instead of the family's
 * own. Mail to it still reaches them, but it will not match the address on the
 * registration site, so staff need to know when they are looking at one.
 */
export const isPrivateRelay = (email: string | null | undefined): boolean =>
  Boolean(email?.toLowerCase().endsWith('@privaterelay.appleid.com'));

export const providerLabel = (provider: string | null | undefined): string =>
  ({ apple: 'Apple', google: 'Google', email: 'Email' })[provider ?? ''] ?? 'your account';
