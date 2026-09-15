-- Jordan XC Clinic — initial schema
-- Roles, athletes/guardians, consent, schedule, attendance, content, training plans.

create type app_role as enum ('admin', 'coach', 'athlete', 'private_client', 'parent');
create type practice_status as enum ('scheduled', 'moved', 'cancelled');
create type attendance_status as enum ('present', 'absent', 'excused');
create type audience as enum ('everyone', 'clinic', 'private', 'coaches');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  role app_role not null default 'athlete',
  date_of_birth date,
  phone text,
  graduation_year int,
  created_at timestamptz not null default now()
);

-- A minor's account is reachable by their guardian; drives consent and visibility.
create table guardian_links (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references profiles on delete cascade,
  guardian_id uuid not null references profiles on delete cascade,
  relationship text,
  created_at timestamptz not null default now(),
  unique (athlete_id, guardian_id)
);

-- Signed once per season. Stored with timestamp and the name typed as signature.
create table consents (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references profiles on delete cascade,
  signed_by uuid not null references profiles on delete restrict,
  season text not null,
  waiver_version text not null,
  signature_name text not null,
  media_release boolean not null default false,
  signed_at timestamptz not null default now(),
  unique (athlete_id, season, waiver_version)
);

create table practices (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_name text not null,
  meeting_point text,
  notes text,
  status practice_status not null default 'scheduled',
  audience audience not null default 'clinic',
  created_by uuid not null references profiles on delete restrict,
  created_at timestamptz not null default now()
);

create table attendance (
  id uuid primary key default gen_random_uuid(),
  practice_id uuid not null references practices on delete cascade,
  athlete_id uuid not null references profiles on delete cascade,
  status attendance_status not null,
  recorded_by uuid not null references profiles on delete restrict,
  recorded_at timestamptz not null default now(),
  unique (practice_id, athlete_id)
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles on delete restrict,
  title text not null,
  body text not null,
  audience audience not null default 'everyone',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- Educational content: articles and videos on training, nutrition, injury prevention.
create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles on delete restrict,
  title text not null,
  slug text not null unique,
  summary text,
  body text not null,
  category text,
  hero_image_url text,
  video_url text,
  audience audience not null default 'everyone',
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table training_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  audience audience not null default 'clinic',
  created_by uuid not null references profiles on delete restrict,
  created_at timestamptz not null default now()
);

create table workouts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references training_plans on delete cascade,
  week_number int not null,
  day_of_week int not null check (day_of_week between 1 and 7),
  title text not null,
  description text,
  distance_miles numeric(5,2),
  intensity text,
  unique (plan_id, week_number, day_of_week)
);

create table plan_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references training_plans on delete cascade,
  athlete_id uuid not null references profiles on delete cascade,
  starts_on date not null,
  assigned_by uuid not null references profiles on delete restrict,
  unique (plan_id, athlete_id)
);

create table workout_logs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references profiles on delete cascade,
  workout_id uuid references workouts on delete set null,
  logged_on date not null,
  distance_miles numeric(5,2),
  duration_seconds int,
  effort int check (effort between 1 and 10),
  notes text,
  created_at timestamptz not null default now()
);

create index on practices (starts_at);
create index on attendance (athlete_id);
create index on plan_assignments (athlete_id);
create index on workout_logs (athlete_id, logged_on desc);

create or replace function is_coach(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = uid and role in ('admin', 'coach'));
$$;

-- Guardians read their own athlete's records; coaches read everything.
create or replace function can_view_athlete(uid uuid, athlete uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select uid = athlete
      or is_coach(uid)
      or exists (select 1 from guardian_links
                 where athlete_id = athlete and guardian_id = uid);
$$;

alter table profiles enable row level security;
alter table guardian_links enable row level security;
alter table consents enable row level security;
alter table practices enable row level security;
alter table attendance enable row level security;
alter table announcements enable row level security;
alter table posts enable row level security;
alter table training_plans enable row level security;
alter table workouts enable row level security;
alter table plan_assignments enable row level security;
alter table workout_logs enable row level security;

create policy profiles_select on profiles for select
  using (can_view_athlete(auth.uid(), id));
create policy profiles_update_self on profiles for update
  using (id = auth.uid() or is_coach(auth.uid()));

create policy guardian_links_select on guardian_links for select
  using (guardian_id = auth.uid() or can_view_athlete(auth.uid(), athlete_id));

create policy consents_select on consents for select
  using (can_view_athlete(auth.uid(), athlete_id));
create policy consents_insert on consents for insert
  with check (signed_by = auth.uid());

create policy practices_select on practices for select using (true);
create policy practices_write on practices for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

create policy attendance_select on attendance for select
  using (can_view_athlete(auth.uid(), athlete_id));
create policy attendance_write on attendance for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

create policy announcements_select on announcements for select
  using (published_at is not null or is_coach(auth.uid()));
create policy announcements_write on announcements for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

create policy posts_select on posts for select
  using (published_at is not null or is_coach(auth.uid()));
create policy posts_write on posts for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

create policy training_plans_select on training_plans for select
  using (is_coach(auth.uid())
     or exists (select 1 from plan_assignments
                where plan_id = training_plans.id and athlete_id = auth.uid()));
create policy training_plans_write on training_plans for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

create policy workouts_select on workouts for select
  using (is_coach(auth.uid())
     or exists (select 1 from plan_assignments
                where plan_id = workouts.plan_id and athlete_id = auth.uid()));
create policy workouts_write on workouts for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

create policy plan_assignments_select on plan_assignments for select
  using (can_view_athlete(auth.uid(), athlete_id));
create policy plan_assignments_write on plan_assignments for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

create policy workout_logs_select on workout_logs for select
  using (can_view_athlete(auth.uid(), athlete_id));
create policy workout_logs_write on workout_logs for all
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
