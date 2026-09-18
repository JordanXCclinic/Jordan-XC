-- Crash reports, kept in the clinic's own database.
--
-- The obvious answer is Sentry, and for an app with native crashes to chase it
-- would be the right one. It is the wrong trade here: this app's privacy policy
-- says there is no third-party analytics in it, both stores are told the same,
-- and adding an SDK that ships diagnostics off to another company would make
-- that untrue and change the declarations. A table the clinic already owns
-- catches the JavaScript errors families actually hit, and costs nothing in
-- either privacy or paperwork.
--
-- If native crash coverage is ever needed, Sentry is the upgrade — but the
-- store answers for diagnostics have to change in the same commit.

create table app_errors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles on delete set null,
  message text not null,
  stack text,
  route text,
  platform text,
  app_version text,
  created_at timestamptz not null default now()
);

create index on app_errors (created_at desc);

alter table app_errors enable row level security;

-- Anyone signed in can report the error they just hit; nobody can read the
-- reports but staff, and nobody can edit or delete them at all.
create policy app_errors_insert on app_errors for insert
  with check (profile_id is null or profile_id = auth.uid());

create policy app_errors_select on app_errors for select
  using (is_coach(auth.uid()));

revoke update, delete on app_errors from authenticated, anon;
