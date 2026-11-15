-- Each coach's own order for the roster.
--
-- The coach drags runners into the order that suits them, and it follows
-- them to any phone or the website. One row per runner per coach, so one
-- coach's order never rearranges another's. Runners with no row (new to the
-- roster) are listed after the placed ones, A to Z.
--
-- Only the coach themselves reads or writes their rows. A runner or parent
-- never sees it: it says nothing about them except where a coach keeps them.

create table roster_order (
  coach_id uuid not null references profiles on delete cascade,
  athlete_id uuid not null references profiles on delete cascade,
  position int not null check (position >= 0),
  primary key (coach_id, athlete_id)
);

alter table roster_order enable row level security;

create policy roster_order_own on roster_order for all
  using (coach_id = auth.uid() and is_coach(auth.uid()))
  with check (coach_id = auth.uid() and is_coach(auth.uid()));

grant select, insert, update, delete on roster_order to authenticated;
