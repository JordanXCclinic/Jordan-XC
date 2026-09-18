# Jordan XC Clinic

The mobile app for the Jordan Cross Country Clinic: a summer clinic for
Birmingham-area youth runners, plus a one-on-one coaching tier.

The app is an **information hub, not a storefront**. Registration, payment, and
the liability waiver all happen on [jordanxcclinic.com](https://jordanxcclinic.com/).
The app is where athletes and parents find the schedule, their training, clinic
news, photos, and a time to meet with the coach.

## How people get in

1. Download the app and sign in with **Apple** or **Google**. There are no passwords.
2. Enter the **clinic code** issued after registering on the website. Athletes and
   parents each get their own code, and either can be redeemed first.
3. Fill in the profile: school, grade, personal bests, goals, and an emergency
   contact. No health information is collected — the coach handles that with
   parents directly.

The code carries the role, so it is the code — not the person — that decides
whether someone lands in the athlete app or the coach hub.

## What each role sees

| | Athlete / one-on-one client | Parent | Coach / admin |
|---|---|---|---|
| Home, Schedule, Learn | ✅ | ✅ | ✅ |
| Training plan | their own | their athlete's | writes them |
| Profile | their own | their athlete's | every athlete's |
| Book a meeting | ✅ | for their athlete | posts the times |
| Photos | view | view | post and delete |
| Coach hub | — | — | ✅ |

Parents reach exactly their own athlete's records, through `can_view_athlete()`.
Coaches see everyone. Nobody else sees an athlete at all.

## Getting set up

### 1. Install

```sh
npm install
```

A **development build** is required rather than Expo Go — the app uses native
modules Expo Go does not bundle (the date-time picker in particular).

```sh
npx expo run:ios      # or: npx expo run:android
npm run web           # the web build runs without a native build
```

### 2. Connect Supabase

Copy `.env.example` to `.env` and fill in the project URL and anon key:

```sh
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=…
```

Every screen renders without this — they check `isSupabaseConfigured` and show
an empty state — so the app is explorable before a backend exists.

### 3. Apply the schema

Run the files in `supabase/migrations/` in order, either with the Supabase CLI
(`supabase db push`) or by pasting them into the SQL editor. They create the
tables, the row-level security policies, and the private `clinic-photos` bucket.

### 4. Turn on the sign-in providers

In **Authentication → Providers**, enable Apple and Google, and add the app's
redirect URL (`jordanxc://`) to the allowed list.

### 5. Make yourself a coach

Codes are issued by coaches, and coaches are created by redeeming a code — so
the first one has to be made by hand. Sign in through the app once, then run:

```sql
insert into profiles (id, full_name, role, onboarded_at)
values ('<your auth.users id>', 'Will Jordan', 'admin', now());
```

Reopen the app and the Coach tab is there. From then on, every account —
athlete, parent, or another coach — comes in through a code.

## Running the tests

`supabase/tests/` holds the security tests, which run against a plain Postgres
with no Supabase installed. They cover the boundaries that matter: role
escalation, code reuse, who can see an athlete's intake form, that the schema
holds no health data, and that deleting an account really deletes it. See
[`supabase/tests/README.md`](supabase/tests/README.md).

```sh
npm run typecheck
```

## Layout

```
app/              screens, routed by file (expo-router)
  (tabs)/         Home, Schedule, Training, Learn, Profile
  (tabs)/coach/   the coach hub — staff only
components/       shared UI: Button, Card, Field, Screen…
lib/              theme, types, auth, data helpers
supabase/         migrations and security tests
```

`lib/theme.ts` holds the palette off the clinic logo — navy `#003482`, red
`#C4303F`, grey `#D9D9D9` — along with the type scale and shadows. Screens pick
a role from it rather than a raw colour or font size.
