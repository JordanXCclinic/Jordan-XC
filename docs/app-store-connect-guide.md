# Putting Jordan XC Clinic on the App Store

Everything to fill in on **appstoreconnect.apple.com → Apps → Jordan XC Clinic**,
in order, with the text to paste. Nothing goes public until you press the
release button at the very end.

---

## Before you start

1. **The new build (build 2) must be in TestFlight.** Check in TestFlight on
   your iPhone: install it, sign in, and make sure it opens straight to the app
   with no "Backend not connected" box.
2. **Make a code pair for Apple's reviewer.** Coach → Clinic codes → name it
   `App Review` → Generate codes. Keep the **athlete code** for step 8 below.
   After the app is approved, remove "App Review" from your Roster.
3. **Have the screenshots ready** (in the `store/screenshots` folder):
   - iPhone: the five files starting `iphone-6.9-`
   - iPad: the five files starting `ipad-13-`

---

## 1. App Information (left menu)

| Field | Enter |
|---|---|
| Subtitle | `Training hub for our runners` |
| Category | Primary: **Health & Fitness** · Secondary: **Sports** |
| Content Rights | **No**, it does not contain third-party content |
| Age Rating | Click **Set Up Age Rating** and answer **None** / **No** to every question. It should come out **4+**. |

Click **Save**.

## 2. Pricing and Availability (left menu)

- Price: **Free**
- Availability: **United States** (or all countries, your choice)

Click **Save**.

## 3. App Privacy (left menu)

- Privacy Policy URL: `https://jordanxcclinic.github.io/Jordan-XC/privacy.html`
- Click **Get Started** under Data Types, choose **Yes, we collect data**, and tick:
  - **Contact Info:** Name, Email Address, Phone Number
  - **Health & Fitness:** **Fitness** only (NOT Health)
  - **User Content:** Photos or Videos, Other User Content
  - **Identifiers:** User ID
- For **each** one, answer the same way:
  - Used for: **App Functionality** only
  - Linked to the user's identity: **Yes**
  - Used for tracking: **No**

Click **Publish**.

## 4. The version page (left menu: iOS App → 1.0 Prepare for Submission)

### Screenshots
- **iPhone 6.9" Display:** drag in the five `iphone-6.9-` files, in number order.
- **iPad 13" Display:** drag in the five `ipad-13-` files, in number order.

### Promotional Text
```
Practices, training plans and clinic news, all in one place for Jordan XC Clinic athletes and parents.
```

### Description
```
The Jordan XC Clinic app is where athletes and their families find everything about the cross country clinic in Birmingham, Alabama: the practice schedule, their training, clinic news, and time with the coach.

This app is for families registered with the clinic. You will need the code you were given after registering at jordanxcclinic.com.

FOR ATHLETES
• Today's workout, written by your coach, with the distance and the effort
• Your whole training plan, week by week, with the date of every run
• Log your runs and see your miles for the week, Monday to Sunday
• Practice times and meeting points, with one-tap directions
• Lessons from your coach on warming up, fuelling and racing

FOR PARENTS
• Follow your runner's training, schedule and miles
• No phone? Set your runner up from your own phone and log their runs for them
• More than one runner? Switch between them with one tap
• Practice changes as they happen
• Book a one-on-one time with the coach

FOR COACHES
• Post practices, announcements, lessons and training plans
• Assign training to the whole clinic or one runner
• See who has trained this week

BUILT AROUND YOUNG ATHLETES
Most of our runners are under 18, so the app collects as little as possible. It holds no health information at all. A family's records are visible only to that athlete, their parents and clinic staff. There is no advertising, no tracking and no third-party analytics.

Registration, payment and waivers happen on jordanxcclinic.com. This app is where the season lives afterwards.
```

### Keywords
```
cross country,running,youth,track,workout,coach,team,athlete,practice,birmingham
```

### URLs
- Support URL: `https://jordanxcclinic.com/`
- Marketing URL: `https://jordanxcclinic.com/`

### Build
Click **Add Build** and choose **1.0.0 (2)**. (Not build 1: build 1 is the old one.)

### General App Information
- Copyright: `2026 Jordan Cross Country Clinic`

## 5. App Review Information (same page, near the bottom)

- **Sign-in required:** leave this **unticked**. The reviewer signs in with
  their own Apple Account, so there is no username and password to give;
  the notes below explain how to get in.
- **Contact information:** your first name, last name, phone and
  `will@jordanxcclinic.com`.
- **Notes:** paste this, replacing `ATHLETE-CODE` with the App Review
  athlete code from "Before you start":

```
This app is for families registered with the Jordan Cross Country Clinic, a youth running clinic in Birmingham, Alabama. Registration and payment happen on our website; the app has no purchases.

To review the app:
1. Tap "Continue with Apple" and sign in with any Apple Account.
2. When asked for a clinic code, enter: ATHLETE-CODE
3. Fill in the short profile form (any answers are fine) and tap the button at the bottom to enter the app.

You will see the athlete's view: Home, Schedule (with directions to each practice), Training (workouts, logging a run), Learn, and Me (weekly miles and profile).

The Coach tab appears only for the clinic's coaching staff, who use it to post the schedule, training plans and announcements. Because the app holds information about minors, we do not give staff access to anyone outside the clinic. We are happy to send a screen recording of the coaching tools if that would help.

Account deletion: Me → Settings → Delete my account.
```

## 6. Version Release (same page, bottom)

Choose **Manually release this version**. That way, after Apple approves it,
nothing happens until you press **Release**.

## 7. Submit

Click **Save**, then **Add for Review** (top right), then **Submit for Review**.

Apple usually replies in 1–3 days, by email. If they ask a question or reject
something, send me a screenshot of their message.
