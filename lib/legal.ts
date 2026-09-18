/**
 * Public URLs both app stores link to from the listing and the app itself.
 *
 * These must be live and reachable before submission — Apple and Google both
 * check them. Point them at wherever the clinic hosts the documents in
 * docs/privacy-policy.md and docs/terms.md.
 */
export const PRIVACY_POLICY_URL = 'https://jordanxcclinic.com/app-privacy';
export const TERMS_URL = 'https://jordanxcclinic.com/app-terms';
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
