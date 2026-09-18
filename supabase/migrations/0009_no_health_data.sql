-- The app stops holding health information about children altogether.
--
-- Injuries follow medical conditions out of the database. The coach handles
-- both by talking to parents, which is where that conversation belongs. What is
-- left on the intake form is what the app genuinely needs to run a clinic:
-- where an athlete goes to school, what they are aiming at, and who to call.
--
-- This is not only a smaller form. It changes what the clinic has to declare to
-- Apple and Google, and it means a lost phone or a breached database exposes no
-- child's health history, because there is none to expose.

alter table athlete_profiles
  drop column current_injuries,
  drop column injury_history;
