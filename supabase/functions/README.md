# Edge Functions

## `notify`

Sends a push when a coach posts an announcement, a practice, or a Learn session.

It resolves who to send to by calling `push_recipients()`, which calls the same
`can_see_audience()` the row-level policies use. That is deliberate: a push can
never reach someone who could not open the thing it is telling them about, and
the audience rule stays in one place.

### Deploying

```sh
supabase functions deploy notify
```

The function needs no secrets of its own — `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` are injected by the platform.

### Wiring the triggers

In the Supabase dashboard, under **Database → Webhooks**, create one webhook per
table pointing at the function. All three are HTTP POST to the `notify` function
with the service role key as the Authorization header:

| Name | Table | Events |
|---|---|---|
| `notify_announcements` | `announcements` | Insert, Update |
| `notify_practices` | `practices` | Insert, Update |
| `notify_posts` | `posts` | Insert, Update |

Update matters as much as Insert: a coach saves an announcement as a draft and
publishes it later, and publishing is when it becomes news. The function checks
`old_record` so republishing an already-live item does not push twice.

### Before any of this works

Push needs credentials. Run `eas credentials` and let EAS generate the APNs key
for iOS and the FCM v1 service account for Android. Without them Expo accepts
the token and delivers nothing.

### Testing it

```sh
supabase functions serve notify

curl -X POST http://localhost:54321/functions/v1/notify \
  -H 'Content-Type: application/json' \
  -d '{"type":"INSERT","table":"announcements",
       "record":{"title":"Practice moved","body":"7am at Jemison",
                 "audience":"clinic","published_at":"2026-06-01T12:00:00Z"}}'
```

A response of `{"sent":0}` with no error means the wiring is right and nobody
has notifications switched on yet.
