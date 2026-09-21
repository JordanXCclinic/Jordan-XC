# Store submission checklist

What is done in the codebase, what only a human with the developer accounts can
do, and the exact answers to the two privacy questionnaires.

---

## 1. The rejection this app is most likely to get

**The app is behind a clinic code, and an App Review tester has no code.** An
app that cannot be got into is rejected under Guideline 2.1 within a day, and it
is the single most common reason a members-only app bounces.

Before submitting, create a real demo athlete and put this in **App Review
Information → Notes** in App Store Connect, and in the same field on Play
Console:

```
This app is for families registered with the Jordan Cross Country Clinic.

To review it:
1. Tap "Continue with Apple" (or Google) and sign in with any account.
2. When asked for a clinic code, enter:  <DEMO CODE>
3. Complete the short profile form to enter the app.

A demo account with the athlete's view is also available:
  Email:    <demo email>
  Password: <demo password>

The Coach tab is staff-only and hidden for athlete accounts. To review it,
use:
  Email:    <coach demo email>
  Password: <coach demo password>
```

Issue the demo codes from **Coach → Clinic codes**. Keep one unredeemed code in
reserve so a re-review after a rejection is not blocked.

Note that Apple's reviewers must be able to reach the **coach** side too, or
they will flag hidden functionality. Give them a staff login.

---

## 2. Requirements handled in code

| Requirement | Where | Status |
|---|---|---|
| Sign in with Apple offered alongside Google (Guideline 4.8) | `app/sign-in.tsx` | Done |
| Account deletion from inside the app (Guideline 5.1.1(v)) | `app/settings.tsx` → `delete_my_account()` | Done |
| Deletion removes data, not just a flag | `supabase/migrations/0007` + tests | Done, tested |
| Data export | Settings → Export my data | Done |
| Privacy policy reachable in-app | Settings → Privacy | Done — **URL must go live** |
| Terms reachable in-app | Settings → Terms | Done — **URL must go live** |
| Support contact in-app | Settings → Contact the clinic | Done |
| Apple Hide My Email supported and flagged | `lib/legal.ts`, Settings | Done |
| Photo library permission string | `app.json` → expo-image-picker plugin | Done |
| No location, microphone, or contacts access | `app.json` → `blockedPermissions` | Done |
| Export compliance declared (skips the question each upload) | `ITSAppUsesNonExemptEncryption: false` | Done |
| Intake form access by staff is logged | `staff_view_athlete_profile()` | Done, tested |
| **No health data stored at all** | `0008` + `0009`, guarded by a test | Done, tested |
| One family cannot read another's records | RLS + 56 tests | Done, tested |
| One-on-one clients cannot read each other's | `can_see_item()` | Done, tested |
| Text contrast meets AA in both themes | `npm run check:contrast` | Done, checked |
| Crash reports stay in the clinic's own database | `app_errors` | Done |

---

## 3. What only you can do

- [x] **Supabase project** — created, migrations run, Google enabled, head coach
      seeded. Apple is still off; it needs the developer account below.
- [x] **Publish the two documents** — the Pages workflow renders `docs/` into
      `privacy.html` and `terms.html` beside the web build, and `lib/legal.ts`
      points at them. Paste the same two URLs into both store listings.
- [ ] **Apple Developer Program** — $99/year. Enrolling as the business needs a
      D-U-N-S number for the clinic and takes considerably longer than enrolling
      as an individual; either satisfies the stores.
- [ ] **Google Play Console** — $25 one-time. Independent of Apple, so the
      Android side can ship without waiting on any of it.
- [ ] **Sign in with Apple** — a Services ID and a signing key, then
      `node scripts/apple-client-secret.js` to produce the secret Supabase asks
      for. Gated on the developer account. Apple requires this wherever Google
      sign-in is offered, so it is not optional for the App Store.
- [ ] **Add `jordanxc://` to the Supabase redirect URLs** before the first phone
      build. The web build returns to an https address and does not need it; the
      phone builds return to the app's own scheme and will not sign in without
      it.
- [ ] **Fill in `eas.json`** — Apple ID, App Store Connect app ID, Apple Team
      ID, and the Play service-account key. They are placeholders today.
- [ ] **Screenshots** — 6.7" and 6.5" iPhone for Apple, phone and 7" tablet for
      Play. Use the Home, Training, and Schedule screens.
- [ ] **Have the privacy policy and terms read** by whoever handles the clinic's
      paperwork. It describes what the software does, which is the hard part,
      but it is not legal advice. (The app stores no health data at all — see
      migrations 0008 and 0009 — so this is not about medical records.)

---

## 4. Apple privacy nutrition labels

Answer in App Store Connect → App Privacy. Everything below is **linked to the
user's identity** and **not used for tracking**.

| Category | Collected | Purpose |
|---|---|---|
| Contact info — name | Yes | App functionality |
| Contact info — email | Yes | App functionality |
| Contact info — phone | Yes (optional) | App functionality |
| Health & fitness — **health** | **No** — see below | — |
| Health & fitness — **fitness** | **Yes** | App functionality |
| User content — photos | Yes | App functionality |
| User content — other (training notes, goals) | Yes | App functionality |
| Identifiers — user ID | Yes | App functionality |
| Contacts, location, browsing history, search history, purchases, financial info, usage data, diagnostics, advertising data | **No** | — |

**Used for tracking: No. Used for third-party advertising: No. Used for
analytics: No. Diagnostics: No.**

Diagnostics is "No" because crash reports go into the clinic's own `app_errors`
table rather than to a third party. That was a deliberate choice over Sentry:
the privacy policy says there is no outside analytics in this app, and keeping
that true is worth more than native crash coverage. If Sentry is ever added,
diagnostics becomes "Yes" and the policy needs a line about it — in the same
commit, not later.

**Health is "No" only because the app genuinely holds none.** There is no field
anywhere for injuries, medical conditions, allergies, or medication — the coach
handles all of that with parents off the app, and a test asserts the database
has nowhere to put it. If a health field is ever added back, this answer must
change to "Yes" in the same commit.

**Fitness stays "Yes."** Personal best race times and training logs (distance,
duration, and how hard a session felt) are fitness data under both stores'
definitions, and understating that would be worse than declaring it.

The emergency contact is a third party's name and phone number, declared under
contact info along with the athlete's own.

---

## 5. Google Play Data Safety

Play Console → App content → Data safety. The same picture, in Google's words.

- **Is all user data encrypted in transit?** Yes.
- **Do you provide a way for users to request data deletion?** Yes — in-app,
  Settings → Delete my account. Provide the policy URL as the deletion link.

| Data type | Collected | Shared | Optional | Purpose |
|---|---|---|---|---|
| Name | Yes | No | Required | App functionality |
| Email address | Yes | No | Required | App functionality, account management |
| Phone number | Yes | No | Optional | App functionality |
| **Health info** | **No** | — | — | Not collected — see above |
| **Fitness info** | **Yes** | No | Optional | App functionality |
| Photos | Yes | No | Optional | App functionality |
| Other user-generated content | Yes | No | Optional | App functionality |
| User IDs | Yes | No | Required | App functionality, account management |
| Location, financial info, contacts, calendar, app activity, device IDs | No | No | — | — |

Play also requires a **Families / Target audience** declaration. This app's
audience includes children, which brings the Families policy into scope:
declare the target age groups honestly, confirm there is no advertising, and
keep the privacy policy URL accurate.

---

## 6. Age rating

- **Apple:** expect 4+. There is no objectionable content, no ads, no gambling,
  no unrestricted web access. The in-app links to jordanxcclinic.com open in the
  system browser — answer the "unrestricted web access" question **No**, because
  they go to fixed clinic URLs, not an open browser.
- **Google:** complete the content rating questionnaire. Expect Everyone.
- **Do not opt into the Apple Kids Category.** It bans third-party analytics and
  requires a parental gate on every external link, which would fight the rest of
  this app. It is not required just because minors use the app.

---

## 7. User-generated content — a decision to make first

Apple Guideline 1.2 applies to apps where users post content other users see. It
requires a way to report objectionable content, a way to block abusive users,
published contact details, and a commitment to act on reports within 24 hours.

**1.2 is not triggered, and by decision it will stay that way.** Photos are the
clinic's own professional pictures, posted by coaching staff only. There is no
chat, no comments, and no public profiles. Training notes and meeting topics are
written by families but are visible only to staff.

If athlete and parent photo uploads are ever added, 1.2 applies and the app
would need a report button, a block list, and a commitment to act on reports
within 24 hours. Do not open the photo wall up without building those first.

---

## 8. Build and submit

```sh
npx eas build --platform ios --profile production
npx eas build --platform android --profile production

npx eas submit --platform ios --profile production
npx eas submit --platform android --profile production
```

Ship to TestFlight and Play internal testing first, and put the app on a real
iPhone and a real mid-range Android before submitting to review.
