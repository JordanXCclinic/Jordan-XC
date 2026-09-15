-- Minimal stand-in for the Supabase primitives the migrations rely on.
create role anon;
create role authenticated;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;

create schema auth;
create table auth.users (id uuid primary key);
grant usage on schema auth to anon, authenticated;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
