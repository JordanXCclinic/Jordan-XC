@AGENTS.md

# Jordan XC Clinic

Mobile app for a summer cross country clinic for Birmingham-area youth runners,
plus a separate one-on-one coaching tier. Ships to the App Store and Google Play.

## Stack

- **Expo SDK 57** / React Native 0.86 / React 19.2, TypeScript strict
- **expo-router 57** for file-based routing (versioned with the SDK, not the old 3.x/4.x line)
- **Supabase** for Postgres, auth, and storage; row-level security enforces visibility
- Web target is SPA (`output: "single"`), not static — routes are auth-gated, so
  prerendering them in Node breaks on browser globals and buys nothing.

## Roles

`admin` and `coach` are staff. `athlete` is a clinic participant. `private_client`
is a one-on-one coaching client — a distinct role, not a separate app or login
system. `parent` is a guardian linked to an athlete via `guardian_links`.

`isCoach()` in `lib/types.ts` is the single check for staff permission. The Coach
tab is hidden via `href: null` for everyone else, and the screen re-checks the
role, because hiding a tab is not authorization — RLS is.

## Athletes are minors

Most users are under 18. `consents` records a per-season waiver with a typed
signature, timestamp, and a separate media-release flag (the clinic posts to
Instagram). Guardians reach their own athlete's records through `can_view_athlete()`;
coaches see everyone. Never widen athlete visibility without checking that function.

## Conventions

- Screens live in `app/`, shared UI in `components/`, data and domain logic in `lib/`.
- Every screen must render before a backend exists — check `isSupabaseConfigured`
  and show an empty state rather than crashing or hanging.
- Schema changes go in `supabase/migrations/` as a new numbered file, never by
  editing an applied migration.
- Run `npm run typecheck` before committing.

## Vocabulary

A **practice** is a scheduled session. A **training plan** contains **workouts**
keyed by week and day, assigned to an athlete via **plan_assignments**. An
**announcement** is time-sensitive clinic news; a **post** is evergreen
educational content (the Learn tab).
