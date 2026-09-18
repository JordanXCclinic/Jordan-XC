-- Pinned announcements, and tracking who has worked through a Learn session.

-- ---------------------------------------------------------------------------
-- Pinning.
-- ---------------------------------------------------------------------------

alter table announcements add column pinned boolean not null default false;

-- Pinned items are read first and are usually few, so the index only covers
-- them rather than every announcement the clinic has ever posted.
create index on announcements (pinned, published_at desc) where pinned;

comment on column announcements.pinned is
  'Stays at the top of the family home screen until the coach unpins it. For the
   thing that must not scroll away — a time change, a meet location.';

-- ---------------------------------------------------------------------------
-- Learn completions.
-- ---------------------------------------------------------------------------

create table lesson_completions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts on delete cascade,
  profile_id uuid not null references profiles on delete cascade,
  completed_at timestamptz not null default now(),
  unique (post_id, profile_id)
);

create index on lesson_completions (profile_id);
create index on lesson_completions (post_id);

alter table lesson_completions enable row level security;

-- You mark your own. Staff and a guardian can see whether it was marked, since
-- that is the point of tracking it, but neither can mark it for someone else —
-- a coach ticking it off would make the count meaningless.
create policy lesson_completions_select on lesson_completions for select
  using (can_view_athlete(auth.uid(), profile_id));

create policy lesson_completions_write on lesson_completions for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
