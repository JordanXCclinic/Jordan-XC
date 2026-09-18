-- Store-compliance groundwork.
--
-- Apple requires that an account created in the app can be deleted from inside
-- the app (Guideline 5.1.1(v)), and both stores expect a real export/erasure
-- path for a family's data. This migration adds the three server-side pieces
-- the app cannot do from the client: deleting the auth user, assembling an
-- export, and recording who read a minor's medical information.

-- ---------------------------------------------------------------------------
-- Audit log. Reading a child's medical record is an event worth keeping.
-- ---------------------------------------------------------------------------

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index on audit_log (record_id, created_at desc);
create index on audit_log (actor_id, created_at desc);

alter table audit_log enable row level security;

-- Staff can read the trail; nobody writes it from the client. Entries are
-- inserted by the SECURITY DEFINER functions below, which run as the owner.
create policy audit_log_select on audit_log for select
  using (is_coach(auth.uid()));

revoke insert, update, delete on audit_log from authenticated, anon;

-- ---------------------------------------------------------------------------
-- Guardian consent for a minor's medical fields.
-- ---------------------------------------------------------------------------

alter table athlete_profiles
  add column guardian_consent_by uuid references profiles on delete set null,
  add column guardian_consent_at timestamptz;

comment on column athlete_profiles.guardian_consent_at is
  'When a guardian confirmed the health information may be held. Recorded, and
   shown to staff, but not yet enforced as a precondition for saving — that is a
   product decision the clinic owner has to make.';

-- ---------------------------------------------------------------------------
-- Staff reads of an intake form go through this, so they can be logged.
-- ---------------------------------------------------------------------------

create or replace function staff_view_athlete_profile(p_athlete uuid)
returns athlete_profiles
language plpgsql security definer set search_path = public as $$
declare
  v_profile athlete_profiles%rowtype;
begin
  if not can_view_athlete(auth.uid(), p_athlete) then
    raise exception 'You cannot view that athlete';
  end if;

  select * into v_profile from athlete_profiles where athlete_id = p_athlete;

  -- Only staff reads are noteworthy. A family reading their own record is not
  -- an access event, and logging it would bury the reads that matter.
  if is_coach(auth.uid()) then
    insert into audit_log (actor_id, action, table_name, record_id)
    values (auth.uid(), 'read', 'athlete_profiles', p_athlete);
  end if;

  return v_profile;
end;
$$;

revoke all on function staff_view_athlete_profile(uuid) from public, anon;
grant execute on function staff_view_athlete_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Export. A family can take their data with them.
-- ---------------------------------------------------------------------------

create or replace function export_my_data()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid();
  v_out jsonb;
begin
  if v_id is null then
    raise exception 'Not signed in';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'account', (select to_jsonb(p) from profiles p where p.id = v_id),
    'athlete_profile', (select to_jsonb(a) from athlete_profiles a where a.athlete_id = v_id),
    'personal_bests', coalesce((select jsonb_agg(to_jsonb(b)) from personal_bests b where b.athlete_id = v_id), '[]'::jsonb),
    'workout_logs', coalesce((select jsonb_agg(to_jsonb(l)) from workout_logs l where l.athlete_id = v_id), '[]'::jsonb),
    'attendance', coalesce((select jsonb_agg(to_jsonb(t)) from attendance t where t.athlete_id = v_id), '[]'::jsonb),
    'meetings', coalesce((select jsonb_agg(to_jsonb(m)) from meeting_slots m where m.booked_for = v_id), '[]'::jsonb),
    'guardian_links', coalesce((select jsonb_agg(to_jsonb(g)) from guardian_links g
                                 where g.guardian_id = v_id or g.athlete_id = v_id), '[]'::jsonb)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function export_my_data() from public, anon;
grant execute on function export_my_data() to authenticated;

-- ---------------------------------------------------------------------------
-- Deletion. Apple requires this to be reachable from inside the app, and to
-- actually remove the account rather than deactivate it.
-- ---------------------------------------------------------------------------

create or replace function delete_my_account()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := auth.uid();
  v_role app_role;
  v_heir uuid;
begin
  if v_id is null then
    raise exception 'Not signed in';
  end if;

  select role into v_role from profiles where id = v_id;
  if v_role is null then
    -- Signed in but never redeemed a code: nothing of ours to unpick.
    delete from auth.users where id = v_id;
    return;
  end if;

  if is_coach(v_id) then
    -- Practices, announcements, plans and codes are the clinic's records, not
    -- the coach's, and they are referenced with ON DELETE RESTRICT so they
    -- cannot be silently destroyed. Hand them to another member of staff.
    select id into v_heir
      from profiles
     where role in ('admin', 'coach') and id <> v_id
     order by created_at
     limit 1;

    if v_heir is null then
      raise exception 'You are the only coach on this clinic. Add another coach before deleting your account, so the schedule, plans and announcements are not lost.';
    end if;

    update practices set created_by = v_heir where created_by = v_id;
    update attendance set recorded_by = v_heir where recorded_by = v_id;
    update announcements set author_id = v_heir where author_id = v_id;
    update posts set author_id = v_heir where author_id = v_id;
    update training_plans set created_by = v_heir where created_by = v_id;
    update plan_assignments set assigned_by = v_heir where assigned_by = v_id;
    update invite_codes set created_by = v_heir where created_by = v_id;
    update photos set uploaded_by = v_heir where uploaded_by = v_id;
    update meeting_slots set created_by = v_heir where created_by = v_id;
  end if;

  insert into audit_log (actor_id, action, table_name, record_id, metadata)
  values (null, 'delete_account', 'profiles', v_id,
          jsonb_build_object('role', v_role, 'reassigned_to', v_heir));

  -- Everything personal hangs off profiles or auth.users by ON DELETE CASCADE:
  -- the intake form, personal bests, training logs, attendance, guardian links,
  -- and any meeting booked for them.
  delete from auth.users where id = v_id;
end;
$$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
