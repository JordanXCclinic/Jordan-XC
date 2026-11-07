-- Splits for interval workouts.
--
-- The coach marks a workout as one with splits and says how many reps and of
-- what ("6" of "800m"). A runner logging it then enters each rep's time, kept
-- in order as seconds on their log. Pace is not stored anywhere: it is
-- distance over time, worked out wherever a run is shown.
--
-- Up to 30 reps, which covers any track session. A split is a positive number
-- of seconds and none may be missing, so the list reads in rep order.

alter table workouts
  add column split_count smallint
    constraint workouts_split_count_range check (split_count between 1 and 30),
  add column split_label text
    constraint workouts_split_label_length check (char_length(split_label) <= 40);

comment on column workouts.split_count is
  'How many rep times a runner enters when logging this workout. Null: no splits.';
comment on column workouts.split_label is
  'What each rep is, shown beside the boxes, like "800m" or "1 mile".';

alter table workout_logs
  add column split_seconds int[]
    constraint workout_logs_split_seconds_valid check (
      split_seconds is null
      or (
        cardinality(split_seconds) between 1 and 30
        and array_position(split_seconds, null) is null
        and 0 < all (split_seconds)
      )
    );

comment on column workout_logs.split_seconds is
  'Each rep''s time in seconds, in rep order, for a workout with splits.';
