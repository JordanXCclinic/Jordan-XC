-- Clinic photo gallery. These are pictures of minors, so the bucket is private
-- and the app hands out short-lived signed URLs; there is no public link that
-- could be forwarded outside the clinic. Staff upload, everyone in the clinic
-- looks — athletes cannot post pictures of each other.

insert into storage.buckets (id, name, public)
values ('clinic-photos', 'clinic-photos', false)
on conflict (id) do nothing;

create table photos (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  caption text,
  taken_on date,
  practice_id uuid references practices on delete set null,
  audience audience not null default 'clinic',
  uploaded_by uuid not null references profiles on delete restrict,
  created_at timestamptz not null default now()
);

create index on photos (created_at desc);

alter table photos enable row level security;

-- Anyone who has redeemed a code has a profile; that is the clinic.
create policy photos_select on photos for select
  using (exists (select 1 from profiles where id = auth.uid()));
create policy photos_write on photos for all
  using (is_coach(auth.uid())) with check (is_coach(auth.uid()));

-- Storage mirrors the table: clinic members read, staff write.
create policy "clinic photos are readable by members"
  on storage.objects for select
  using (
    bucket_id = 'clinic-photos'
    and exists (select 1 from profiles where id = auth.uid())
  );

create policy "clinic photos are written by staff"
  on storage.objects for insert
  with check (bucket_id = 'clinic-photos' and is_coach(auth.uid()));

create policy "clinic photos are replaced by staff"
  on storage.objects for update
  using (bucket_id = 'clinic-photos' and is_coach(auth.uid()))
  with check (bucket_id = 'clinic-photos' and is_coach(auth.uid()));

create policy "clinic photos are removed by staff"
  on storage.objects for delete
  using (bucket_id = 'clinic-photos' and is_coach(auth.uid()));
