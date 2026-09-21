-- Mileage ranges on a planned workout.
--
-- A coach writing "4-6 miles" had nowhere to put it: distance_miles is one
-- number, so the editor refused the dash. This adds the far end of the range
-- and leaves the existing column as the near end, which keeps every workout
-- already written valid and every query reading distance_miles correct.
--
-- It stays two numbers rather than becoming free text so the app can still
-- display mileage consistently and add up a week of it later. Anything that is
-- not a distance — intervals, time-based runs — belongs in description or
-- intensity, which already take any text.

alter table workouts add column distance_miles_max numeric(5,2);

-- A far end with no near end is meaningless, and a range that does not go
-- upwards is a typo rather than a range. Both are rejected here as well as in
-- the editor, because the editor is not the only thing that can write a row.
alter table workouts add constraint workouts_distance_range_valid check (
  distance_miles_max is null
  or (distance_miles is not null and distance_miles_max > distance_miles)
);

comment on column workouts.distance_miles is
  'Planned distance. The near end of the range when distance_miles_max is set.';
comment on column workouts.distance_miles_max is
  'Far end of a planned range, e.g. 6 for "4-6 miles". Null for a single distance.';
