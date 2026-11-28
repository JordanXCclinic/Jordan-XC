-- Calls the coach has already arranged.
--
-- The coach often sets up a one-on-one call by text rather than through open
-- times. A call like that is entered as a meeting_slots row that is booked from
-- the start: booked_for the runner, booked_by the coach, with set_by_coach
-- marking it. It shows on the runner's Home tab and in their family's meetings,
-- and to nobody else: the select policy (0005) already limits a booked slot to
-- staff and to that runner's side through can_view_athlete(). Only staff write
-- meeting_slots, so only staff can set the flag.

alter table meeting_slots add column set_by_coach boolean not null default false;

alter table meeting_slots add constraint meeting_slots_set_by_coach_is_booked
  check (not set_by_coach or booked_for is not null);

comment on column meeting_slots.set_by_coach is
  'A call the coach arranged with the family directly and entered already booked. The coach changes or removes it; the family does not cancel it from the app.';

-- A family cancelling such a call would turn a time the coach set aside for
-- them into an open time every family could book. They change it with the
-- coach instead, the way they arranged it.
create or replace function cancel_meeting_booking(p_slot uuid)
returns meeting_slots
language plpgsql security definer set search_path = public as $$
declare
  v_slot meeting_slots%rowtype;
begin
  select * into v_slot from meeting_slots where id = p_slot for update;

  if not found or v_slot.booked_for is null then
    raise exception 'That meeting is not booked';
  end if;

  if not can_view_athlete(auth.uid(), v_slot.booked_for) then
    raise exception 'You cannot cancel someone else''s meeting';
  end if;

  if v_slot.set_by_coach and not is_coach(auth.uid()) then
    raise exception 'Coach set up this call. Text Coach to change it';
  end if;

  -- Cancelling releases the time back to the pool rather than deleting it.
  update meeting_slots
     set booked_for = null, booked_by = null, booked_at = null, topic = null,
         set_by_coach = false
   where id = p_slot
  returning * into v_slot;

  return v_slot;
end;
$$;

revoke all on function cancel_meeting_booking(uuid) from public, anon;
grant execute on function cancel_meeting_booking(uuid) to authenticated;

-- New open times are announced once per sitting (0023). A call the coach
-- entered was never an open time, so it must not count as the start of a
-- sitting, or the open times added after it would go out to nobody.
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
          and not earlier.set_by_coach
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
