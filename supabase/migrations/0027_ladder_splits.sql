-- Ladder workouts: a distance for each rep.
--
-- 0026 gave a workout one rep distance ("6" of "800m"). A ladder runs a
-- different distance each rep — 400, 800, 1200, 800, 400 — so the coach can
-- now list them in order instead. split_count stays the number of reps, so a
-- runner still gets one box each; split_labels, when set, names every rep and
-- must have exactly that many entries. split_label is for the same-distance
-- case and is left empty for a ladder.

alter table workouts
  add column split_labels text[]
    constraint workouts_split_labels_valid check (
      split_labels is null
      or (
        cardinality(split_labels) = split_count
        and array_position(split_labels, null) is null
        and char_length(array_to_string(split_labels, ',')) <= 400
      )
    );

comment on column workouts.split_labels is
  'Each rep''s distance, in order, for a ladder: {400,800,1200,800,400}. Null when every rep is the same.';
