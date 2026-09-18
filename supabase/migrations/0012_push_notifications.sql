-- Push notifications.
--
-- An announcement nobody sees is not an announcement, and "practice moved to
-- 7am" is exactly the message that has to arrive before someone drives to the
-- old time. This adds the token, the per-category preferences, and one function
-- that decides who a push actually goes to.

alter table profiles
  add column push_token text,
  add column notification_prefs jsonb not null default
    '{"announcements": true, "practices": true, "workouts": true, "learn": false, "meetings": true}'::jsonb;

-- Self-service, like name and phone. Role stays function-only.
grant update (push_token, notification_prefs) on profiles to authenticated;

create index on profiles (push_token) where push_token is not null;

/**
 * Tokens to push a given item to.
 *
 * The audience rule lives in can_see_audience() and is called here rather than
 * restated, so a push can never reach someone who cannot open the thing it is
 * telling them about. Preferences are checked on top: a category switched off
 * means no push, but the row is still visible in the app.
 */
create or replace function push_recipients(p_audience audience, p_pref text)
returns table (profile_id uuid, push_token text)
language sql stable security definer set search_path = public as $$
  select p.id, p.push_token
    from profiles p
   where p.push_token is not null
     and can_see_audience(p.id, p_audience)
     and coalesce((p.notification_prefs ->> p_pref)::boolean, false);
$$;

-- Only the service role, from an Edge Function, may enumerate tokens. This must
-- never be reachable with the anon key: it would hand any signed-in athlete a
-- list of push tokens for the whole clinic.
revoke all on function push_recipients(audience, text) from public, anon, authenticated;
