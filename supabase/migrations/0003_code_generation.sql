-- Coaches issue codes from the app after a family registers on the website.

-- 10 characters from a 16-symbol alphabet with no I, O, 0 or 1, so a code read
-- off a phone or copied out of an email is not ambiguous. ~1.1e12 combinations,
-- and every code is single-use.
create or replace function random_code() returns text
language sql volatile as $$
  with source as (select replace(gen_random_uuid()::text, '-', '') as hex)
  select string_agg(
           substr('ABCDEFGHJKLMNPQR', ('x' || substr(hex, i, 1))::bit(4)::int + 1, 1),
           '' order by i
         )
    from source, generate_series(1, 10) as i;
$$;

-- Issues an athlete code and a parent code sharing one family_id, so the
-- guardian link forms regardless of which of the two signs in first.
create or replace function create_family_codes(
  p_full_name text,
  p_season text,
  p_athlete_role app_role default 'athlete',
  p_expires_at timestamptz default null
)
returns table (athlete_code text, parent_code text)
language plpgsql security definer set search_path = public as $$
declare
  v_family uuid := gen_random_uuid();
  v_athlete text;
  v_parent text;
  v_name text := btrim(coalesce(p_full_name, ''));
begin
  if not is_coach(auth.uid()) then
    raise exception 'Only coaches can create invite codes';
  end if;

  if v_name = '' then
    raise exception 'An athlete name is required';
  end if;

  if p_athlete_role not in ('athlete', 'private_client') then
    raise exception 'Codes pair a parent with an athlete or a one-on-one client';
  end if;

  loop
    v_athlete := random_code();
    exit when not exists (select 1 from invite_codes where code = v_athlete);
  end loop;

  loop
    v_parent := random_code();
    exit when not exists (select 1 from invite_codes where code = v_parent);
  end loop;

  insert into invite_codes (code, role, full_name, season, family_id, expires_at, created_by)
  values
    (v_athlete, p_athlete_role, v_name, p_season, v_family, p_expires_at, auth.uid()),
    (v_parent, 'parent', v_name || ' (parent)', p_season, v_family, p_expires_at, auth.uid());

  athlete_code := v_athlete;
  parent_code := v_parent;
  return next;
end;
$$;

revoke all on function create_family_codes(text, text, app_role, timestamptz) from public, anon;
grant execute on function create_family_codes(text, text, app_role, timestamptz) to authenticated;
