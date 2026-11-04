-- Notifications for training.
--
-- Training is not posted to an audience like an announcement: a plan is
-- assigned to particular runners. So the people who hear about it are the
-- runners on the plan and their parents, each with workout notifications on.
--
--   - Assigning a plan tells that runner: "New training plan".
--   - Adding or changing a workout in an assigned plan tells everyone on it:
--     "Training updated".
--
-- A coach edits several workouts in a row, so each runner hears about a plan at
-- most once in 30 minutes. plan_notices records when each runner was last told
-- about each plan; the functions below read and stamp it in the same call.
-- Being assigned counts, so filling in the week straight after assigning it
-- does not send a second notification.
--
-- Both functions list push tokens and are callable only by the service role,
-- from the notify Edge Function, like push_recipients().

create table plan_notices (
  plan_id uuid not null references training_plans on delete cascade,
  athlete_id uuid not null references profiles on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (plan_id, athlete_id)
);

-- Nobody reads or writes this from the app: only the functions below.
alter table plan_notices enable row level security;

-- The runners given, and every parent linked to them, with workout
-- notifications on. A parent of two runners on the same plan is told once.
create or replace function training_push_targets(p_athletes uuid[])
returns table (profile_id uuid, push_token text)
language sql stable security definer set search_path = public as $$
  select distinct on (p.push_token) p.id, p.push_token
    from profiles p
   where p.push_token is not null
     and coalesce((p.notification_prefs ->> 'workouts')::boolean, false)
     and (
       p.id = any(p_athletes)
       or exists (select 1 from guardian_links g
                   where g.guardian_id = p.id and g.athlete_id = any(p_athletes))
     )
   order by p.push_token, p.id;
$$;

create or replace function assignment_recipients(p_assignment uuid)
returns table (profile_id uuid, push_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_plan uuid;
  v_athlete uuid;
begin
  select a.plan_id, a.athlete_id into v_plan, v_athlete
    from plan_assignments a
   where a.id = p_assignment;
  if not found then
    return;
  end if;

  insert into plan_notices (plan_id, athlete_id, sent_at)
  values (v_plan, v_athlete, now())
  on conflict on constraint plan_notices_pkey do update set sent_at = excluded.sent_at;

  return query select * from training_push_targets(array[v_athlete]);
end;
$$;

create or replace function workout_recipients(p_plan uuid)
returns table (profile_id uuid, push_token text)
language plpgsql security definer set search_path = public as $$
declare
  v_due uuid[];
begin
  select coalesce(array_agg(a.athlete_id), '{}') into v_due
    from plan_assignments a
    left join plan_notices n on n.plan_id = a.plan_id and n.athlete_id = a.athlete_id
   where a.plan_id = p_plan
     and (n.sent_at is null or n.sent_at < now() - interval '30 minutes');

  if cardinality(v_due) = 0 then
    return;
  end if;

  insert into plan_notices (plan_id, athlete_id, sent_at)
  select p_plan, unnest(v_due), now()
  on conflict on constraint plan_notices_pkey do update set sent_at = excluded.sent_at;

  return query select * from training_push_targets(v_due);
end;
$$;

revoke all on function training_push_targets(uuid[]) from public, anon, authenticated;
revoke all on function assignment_recipients(uuid) from public, anon, authenticated;
revoke all on function workout_recipients(uuid) from public, anon, authenticated;
