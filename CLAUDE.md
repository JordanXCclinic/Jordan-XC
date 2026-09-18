@AGENTS.md

# Jordan XC Clinic

Mobile app for a summer cross country clinic for Birmingham-area youth runners,
plus a one-on-one coaching tier. Ships to the App Store and Google Play.

**The app is an information hub, not a storefront.** Registration, payment, and
the liability waiver all happen on jordanxcclinic.com. The app exists so athletes
and parents have the schedule, training, and clinic news in one place for the
summer. Do not add signup, checkout, or waiver flows here — if a feature would
duplicate the website, it belongs on the website.

## Stack

- **Expo SDK 57** / React Native 0.86 / React 19.2, TypeScript strict
- **expo-router 57** for file-based routing (versioned with the SDK, not the old 3.x/4.x line)
- **Supabase** for Postgres, auth, and storage; row-level security enforces visibility
- Web target is SPA (`output: "single"`), not static — routes are auth-gated, so
  prerendering them in Node breaks on browser globals and buys nothing.

## Access

Download the app, sign in with Apple or Google, then redeem a clinic code
issued after registering on the website, then fill in the intake form. There are
no passwords. `profiles.onboarded_at` is what says the form is done; the tab
layout redirects to `/profile-setup` until it is set.

The code carries the role, so `profiles.role` is writable only by
`redeem_invite_code()` — a SECURITY DEFINER function. Column-level grants leave
name and phone self-editable and everything else locked. Never add a client
write path to `role`; that reopens a privilege escalation the tests cover.

Athlete and parent codes share a `family_id`, and the guardian link forms
whichever of the two redeems first, so neither has to go first.

`supabase/tests/` runs against a plain Postgres and must stay green.

## Roles

`admin` and `coach` are staff. `athlete` is a clinic participant. `private_client`
is a one-on-one coaching client — a distinct role, not a separate app or login
system. `parent` is a guardian linked to an athlete via `guardian_links`.

`isCoach()` in `lib/types.ts` is the single check for staff permission. The Coach
tab is hidden via `href: null` for everyone else, and the screen re-checks the
role, because hiding a tab is not authorization — RLS is.

## Athletes are minors

Most users are under 18, so visibility is the thing to get right. Guardians reach
their own athlete's records through `can_view_athlete()`; coaches see everyone;
nobody else sees an athlete at all. Never widen athlete visibility without going
through that function. Be conservative about what the app collects — it needs far
less about a minor than a registration system does, and the registration system
already lives elsewhere.

`athlete_profiles` holds what a coach needs at practice — current and past
injuries, and an emergency contact — and it is a separate table, not columns on
`profiles`, so that boundary is one policy rather than a per-column argument.

**Medical conditions, allergies and medication are deliberately not in the app.**
The coach gathers those from parents directly. A test asserts there is no column
to put them in; do not add one back. Injuries stay because they change what a
coach asks an athlete to run today.

Staff reads of an intake form go through `staff_view_athlete_profile()`, which
writes an `audit_log` row. Read the table directly and that record is lost.

Photos are the clinic's own pictures of minors: staff post, the bucket is
private, and the app hands out short-lived signed URLs, never a public link.
Athlete and parent uploads would make this user-generated content and pull in
App Store Guideline 1.2 (reporting, blocking, moderation) — do not add them
without building that first.

## Conventions

- Screens live in `app/`, shared UI in `components/`, data and domain logic in `lib/`.
- Colours, spacing, type, and shadows come from `lib/theme.ts`. Screens pick a
  role (`type.heading`, `colors.primary`) rather than a raw hex or font size.
- Every screen must render before a backend exists — check `isSupabaseConfigured`
  and show an empty state rather than crashing or hanging.
- Schema changes go in `supabase/migrations/` as a new numbered file, never by
  editing an applied migration.
- Run `npm run typecheck` before committing.

## Vocabulary

A **practice** is a scheduled session. A **training plan** contains **workouts**
keyed by week and day, assigned to an athlete via **plan_assignments**. An
**announcement** is time-sensitive clinic news; a **post** is evergreen
educational content (the Learn tab). A **meeting slot** is a time the coach has
opened for a one-on-one; a family claims one through `book_meeting_slot()`,
which locks the row so two families cannot take the same time.
