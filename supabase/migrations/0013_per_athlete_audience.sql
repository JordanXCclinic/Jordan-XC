-- One-on-one content is for one athlete, not for "the one-on-one clients".
--
-- A single 'private' bucket meant every private client saw every other private
-- client's announcements, practices and photos. Their training was already
-- separate, because a plan is assigned to a named athlete — but everything else
-- was shared between people who have no connection to each other and are paying
-- for individual coaching.
--
-- A row can now name the athlete it is for. When it does, that beats the
-- audience: only that athlete, their guardians, and staff ever see it.

alter table announcements add column audience_athlete_id uuid references profiles on delete cascade;
alter table practices    add column audience_athlete_id uuid references profiles on delete cascade;
alter table posts        add column audience_athlete_id uuid references profiles on delete cascade;
alter table photos       add column audience_athlete_id uuid references profiles on delete cascade;

create index on announcements (audience_athlete_id);
create index on practices (audience_athlete_id);
create index on posts (audience_athlete_id);
create index on photos (audience_athlete_id);

comment on column announcements.audience_athlete_id is
  'When set, this is for that athlete alone and the audience column is ignored.';

/**
 * Whether a row reaches someone: the audience rule, plus the athlete a row may
 * be pinned to.
 *
 * can_view_athlete() is reused for the pinned case rather than restated, so a
 * private announcement reaches exactly the people who can already see that
 * athlete's records — the athlete, their guardians, and staff.
 */
create or replace function can_see_item(uid uuid, aud audience, target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when uid is null then false
    when is_coach(uid) then true
    -- Named athlete wins. A row for Lena is not for "one-on-one clients".
    when target is not null then can_view_athlete(uid, target)
    else can_see_audience(uid, aud)
  end;
$$;

drop policy practices_select on practices;
create policy practices_select on practices for select
  using (can_see_item(auth.uid(), audience, audience_athlete_id));

drop policy announcements_select on announcements;
create policy announcements_select on announcements for select
  using (
    (published_at is not null and can_see_item(auth.uid(), audience, audience_athlete_id))
    or is_coach(auth.uid())
  );

drop policy posts_select on posts;
create policy posts_select on posts for select
  using (
    (published_at is not null and can_see_item(auth.uid(), audience, audience_athlete_id))
    or is_coach(auth.uid())
  );

drop policy photos_select on photos;
create policy photos_select on photos for select
  using (can_see_item(auth.uid(), audience, audience_athlete_id));

-- Push has to follow the same rule, or a notification would announce something
-- the person cannot open.
--
-- The two-argument version is dropped rather than left alongside: with a
-- defaulted third parameter the old call would match both and Postgres refuses
-- it as ambiguous.
drop function if exists push_recipients(audience, text);

create or replace function push_recipients(p_audience audience, p_pref text, p_athlete uuid default null)
returns table (profile_id uuid, push_token text)
language sql stable security definer set search_path = public as $$
  select p.id, p.push_token
    from profiles p
   where p.push_token is not null
     and can_see_item(p.id, p_audience, p_athlete)
     and coalesce((p.notification_prefs ->> p_pref)::boolean, false);
$$;

revoke all on function push_recipients(audience, text, uuid) from public, anon, authenticated;
