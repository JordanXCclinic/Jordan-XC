-- One-on-one meetings. The coach publishes open times and a family claims one,
-- rather than trading messages about when everyone is free. A slot is open while
-- booked_for is null; claiming it is a single atomic update.

create type meeting_mode as enum ('in_person', 'video', 'phone');

create table meeting_slots (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  duration_minutes int not null default 30 check (duration_minutes between 5 and 240),
  mode meeting_mode not null default 'in_person',
  location text,
  notes text,
  created_by uuid not null references profiles on delete restrict,
  created_at timestamptz not null default now(),

  -- Booking. booked_for is the athlete the meeting is about; booked_by is
  -- whoever claimed it, which for a younger runner is usually the parent.
  booked_for uuid references profiles on delete cascade,
  booked_by uuid references profiles on delete set null,
  booked_at timestamptz,
  topic text,

  constraint meeting_slots_booking_complete
    check ((booked_for is null) = (booked_at is null))
);

create index on meeting_slots (starts_at);
create index on meeting_slots (booked_for);

alter table meeting_slots enable row level security;

-- Families see open times and their own bookings. They must not see which other
-- athletes are meeting the coach, so a booked slot is visible only to that
-- athlete's side and to staff.
create policy meeting_slots_select on meeting_slots for select
  using (
    is_coach(auth.uid())
    or booked_for is null
    or can_view_athlete(auth.uid(), booked_for)
  );

-- Only staff create or delete slots; booking happens through the functions below
-- so a family can never write an arbitrary row.
create policy meeting_slots_write on meeting_slots for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

create or replace function book_meeting_slot(
  p_slot uuid,
  p_athlete uuid,
  p_topic text default null
) returns meeting_slots
language plpgsql security definer set search_path = public as $$
declare
  v_slot meeting_slots%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  -- An athlete books for themselves; a guardian books for their own athlete.
  if not can_view_athlete(auth.uid(), p_athlete) then
    raise exception 'You can only book a meeting for your own athlete';
  end if;

  -- Locking here is what stops two families claiming the same time.
  select * into v_slot from meeting_slots where id = p_slot for update;

  if not found then
    raise exception 'That time is no longer available';
  end if;

  if v_slot.booked_for is not null then
    raise exception 'That time has already been taken';
  end if;

  if v_slot.starts_at < now() then
    raise exception 'That time has already passed';
  end if;

  update meeting_slots
     set booked_for = p_athlete,
         booked_by = auth.uid(),
         booked_at = now(),
         topic = nullif(btrim(coalesce(p_topic, '')), '')
   where id = p_slot
  returning * into v_slot;

  return v_slot;
end;
$$;

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

  -- Cancelling releases the time back to the pool rather than deleting it.
  update meeting_slots
     set booked_for = null, booked_by = null, booked_at = null, topic = null
   where id = p_slot
  returning * into v_slot;

  return v_slot;
end;
$$;

revoke all on function book_meeting_slot(uuid, uuid, text) from public, anon;
revoke all on function cancel_meeting_booking(uuid) from public, anon;
grant execute on function book_meeting_slot(uuid, uuid, text) to authenticated;
grant execute on function cancel_meeting_booking(uuid) to authenticated;
