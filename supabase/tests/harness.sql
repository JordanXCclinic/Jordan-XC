-- Minimal stand-in for the Supabase primitives the migrations rely on.
-- Roles are cluster-wide, so they survive dropping the test database.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

create schema auth;
-- The columns a SQL-created user is given (see 0019, accounts a parent
-- manages for a runner without a phone). Supabase's table has more; these are
-- the ones that statement names.
create table auth.users (
  id uuid primary key,
  instance_id uuid,
  aud varchar(255),
  role varchar(255),
  email varchar(255),
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  confirmation_token varchar(255),
  recovery_token varchar(255),
  email_change_token_new varchar(255),
  email_change varchar(255),
  created_at timestamptz,
  updated_at timestamptz
);
grant usage on schema auth to anon, authenticated;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Storage stand-in. The photo migration creates a bucket and policies on
-- storage.objects; these are the few columns those statements touch.
create schema storage;
grant usage on schema storage to anon, authenticated;

create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets,
  name text,
  owner uuid
);

alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated;
