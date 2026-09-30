-- A map address on a practice, so a family can tap the location and get
-- directions instead of copying the name into a maps app by hand.
--
-- location_name stays what it was — the short name people say, "Jemison
-- Trail" — and this is where the coach puts what a maps app needs: a street
-- address, or a Google or Apple Maps link pasted straight from the share
-- sheet. It is optional: left empty, the app searches the location name,
-- which is usually right for a well-known trail and never worse than nothing.
--
-- No new policy: practices are written by staff and read under the existing
-- audience rules, and this column rides along with the rest of the row.

alter table practices add column map_address text;

-- Long enough for any address or share link; short enough that nobody pastes
-- a paragraph of directions here instead of into notes.
alter table practices add constraint practices_map_address_length check (
  map_address is null or char_length(map_address) <= 500
);

comment on column practices.map_address is
  'Street address or maps link used for directions. Null means search location_name.';
