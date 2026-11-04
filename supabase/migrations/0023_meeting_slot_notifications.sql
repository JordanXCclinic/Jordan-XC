-- Notifications when the coach opens meeting times.
--
-- Open meeting times are visible to every family (0005), so a new one goes to
-- every athlete, one-on-one client and parent who has meeting notifications on.
-- Staff are left out: they are the ones adding the times.
--
-- The coach adds times one at a time, often several in a sitting. One push per
-- time would be five buzzes for five times, so only the first time in a
-- sitting is announced: a slot created within 30 minutes of an earlier one
-- sends nothing. Slots created in the same instant are told apart by id, so
-- exactly one of them is "first".
--
-- Called only by the notify Edge Function with the service role, like
-- push_recipients(). It must never be reachable with the anon key: it lists
-- push tokens.

create or replace function meeting_slot_recipients(p_slot uuid)
returns table (profile_id uuid, push_token text)
language sql stable security definer set search_path = public as $$
  with slot as (
    select s.id, s.created_at
      from meeting_slots s
     where s.id = p_slot
       and s.booked_for is null
       and s.starts_at > now()
  ),
  first_in_sitting as (
    select slot.id
      from slot
     where not exists (
       select 1
         from meeting_slots earlier
        where earlier.id <> slot.id
          and earlier.created_at >= slot.created_at - interval '30 minutes'
          and (earlier.created_at < slot.created_at
               or (earlier.created_at = slot.created_at and earlier.id < slot.id))
     )
  )
  select p.id, p.push_token
    from profiles p, first_in_sitting
   where p.push_token is not null
     and p.role in ('athlete', 'private_client', 'parent')
     and coalesce((p.notification_prefs ->> 'meetings')::boolean, false);
$$;

revoke all on function meeting_slot_recipients(uuid) from public, anon, authenticated;
