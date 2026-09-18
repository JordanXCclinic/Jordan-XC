export type AppRole = 'admin' | 'coach' | 'athlete' | 'private_client' | 'parent';

export type Audience = 'everyone' | 'clinic' | 'private' | 'coaches';

export type MeetingMode = 'in_person' | 'video' | 'phone';

export type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  date_of_birth: string | null;
  phone: string | null;
  graduation_year: number | null;
  onboarded_at: string | null;
};

export const PROFILE_COLUMNS =
  'id, full_name, role, date_of_birth, phone, graduation_year, onboarded_at';

/**
 * The intake form. Everything here is optional except the athlete it belongs to.
 *
 * Injuries are the only health information the app holds. Medical conditions,
 * allergies and medication are gathered by the coach directly from parents and
 * deliberately never enter this database.
 */
export type AthleteProfile = {
  athlete_id: string;
  school: string | null;
  grade: string | null;
  goals: string | null;
  current_injuries: string | null;
  injury_history: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  updated_at: string;
};

export const ATHLETE_PROFILE_COLUMNS =
  'athlete_id, school, grade, goals, current_injuries, injury_history, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship, updated_at';

export type PersonalBest = {
  id: string;
  athlete_id: string;
  event: string;
  result_seconds: number;
  recorded_on: string | null;
  meet_name: string | null;
};

export const PERSONAL_BEST_COLUMNS =
  'id, athlete_id, event, result_seconds, recorded_on, meet_name';

export type Practice = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  location_name: string;
  meeting_point: string | null;
  notes: string | null;
  status: 'scheduled' | 'moved' | 'cancelled';
  audience: Audience;
};

export const PRACTICE_COLUMNS =
  'id, starts_at, ends_at, location_name, meeting_point, notes, status, audience';

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  published_at: string | null;
  created_at: string;
};

export const ANNOUNCEMENT_COLUMNS = 'id, title, body, audience, published_at, created_at';

export type Post = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  category: string | null;
  hero_image_url: string | null;
  video_url: string | null;
  published_at: string | null;
};

export const POST_COLUMNS =
  'id, title, slug, summary, body, category, hero_image_url, video_url, published_at';

export type TrainingPlan = {
  id: string;
  name: string;
  description: string | null;
  audience: Audience;
};

export const TRAINING_PLAN_COLUMNS = 'id, name, description, audience';

export type Workout = {
  id: string;
  plan_id: string;
  week_number: number;
  day_of_week: number;
  title: string;
  description: string | null;
  distance_miles: number | null;
  intensity: string | null;
};

export const WORKOUT_COLUMNS =
  'id, plan_id, week_number, day_of_week, title, description, distance_miles, intensity';

export type MeetingSlot = {
  id: string;
  starts_at: string;
  duration_minutes: number;
  mode: MeetingMode;
  location: string | null;
  notes: string | null;
  booked_for: string | null;
  booked_by: string | null;
  booked_at: string | null;
  topic: string | null;
};

export const MEETING_SLOT_COLUMNS =
  'id, starts_at, duration_minutes, mode, location, notes, booked_for, booked_by, booked_at, topic';

export type Photo = {
  id: string;
  storage_path: string;
  caption: string | null;
  taken_on: string | null;
  created_at: string;
};

export const PHOTO_COLUMNS = 'id, storage_path, caption, taken_on, created_at';

export type InviteCode = {
  id: string;
  code: string;
  role: AppRole;
  full_name: string;
  season: string;
  redeemed_at: string | null;
  expires_at: string | null;
};

export const INVITE_CODE_COLUMNS =
  'id, code, role, full_name, season, redeemed_at, expires_at';

export type WorkoutLog = {
  id: string;
  athlete_id: string;
  workout_id: string | null;
  logged_on: string;
  distance_miles: number | null;
  duration_seconds: number | null;
  effort: number | null;
  notes: string | null;
};

export const WORKOUT_LOG_COLUMNS =
  'id, athlete_id, workout_id, logged_on, distance_miles, duration_seconds, effort, notes';

export const isCoach = (role: AppRole | undefined): boolean =>
  role === 'admin' || role === 'coach';

/** Roles that have training of their own, as opposed to watching someone else's. */
export const isAthlete = (role: AppRole | undefined): boolean =>
  role === 'athlete' || role === 'private_client';

export const isParent = (role: AppRole | undefined): boolean => role === 'parent';

export const MEETING_MODE_LABELS: Record<MeetingMode, string> = {
  in_person: 'In person',
  video: 'Video call',
  phone: 'Phone call',
};

export const AUDIENCE_LABELS: Record<Audience, string> = {
  everyone: 'Everyone',
  clinic: 'Clinic athletes',
  private: 'One-on-one clients',
  coaches: 'Coaches only',
};

/** Events a clinic runner actually races, in the order a coach would list them. */
export const PB_EVENTS = ['800m', '1600m', 'Mile', '3200m', '2 Mile', '5K'] as const;

export const GRADES = ['5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] as const;
