-- The intake form an athlete (or their guardian) fills in after redeeming a code.
-- This is the one place the app holds health information about a minor, so it is
-- a separate table behind can_view_athlete() rather than columns on profiles:
-- the athlete, their linked guardians, and staff. Nobody else, ever.

alter table profiles add column onboarded_at timestamptz;

-- Self-service columns stay explicitly granted; role is still function-only.
grant update (onboarded_at) on profiles to authenticated;

create table athlete_profiles (
  athlete_id uuid primary key references profiles on delete cascade,
  school text,
  grade text,
  goals text,
  injury_history text,
  medical_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles on delete set null
);

create table personal_bests (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references profiles on delete cascade,
  event text not null,
  result_seconds int not null check (result_seconds > 0),
  recorded_on date,
  meet_name text,
  created_at timestamptz not null default now(),
  -- One current best per event. Running a faster time updates the row.
  unique (athlete_id, event)
);

create index on personal_bests (athlete_id);

alter table athlete_profiles enable row level security;
alter table personal_bests enable row level security;

-- can_view_athlete() is already the athlete, their guardians, and staff, which
-- is exactly who may read and edit an intake form. Parents fill these in for
-- younger runners, so write access matches read access.
create policy athlete_profiles_select on athlete_profiles for select
  using (can_view_athlete(auth.uid(), athlete_id));
create policy athlete_profiles_insert on athlete_profiles for insert
  with check (can_view_athlete(auth.uid(), athlete_id));
create policy athlete_profiles_update on athlete_profiles for update
  using (can_view_athlete(auth.uid(), athlete_id))
  with check (can_view_athlete(auth.uid(), athlete_id));

create policy personal_bests_select on personal_bests for select
  using (can_view_athlete(auth.uid(), athlete_id));
create policy personal_bests_write on personal_bests for all
  using (can_view_athlete(auth.uid(), athlete_id))
  with check (can_view_athlete(auth.uid(), athlete_id));

create or replace function touch_athlete_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger athlete_profiles_touch
  before insert or update on athlete_profiles
  for each row execute function touch_athlete_profile();
