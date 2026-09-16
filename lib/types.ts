export type AppRole = 'admin' | 'coach' | 'athlete' | 'private_client' | 'parent';

export type Audience = 'everyone' | 'clinic' | 'private' | 'coaches';

export type Profile = {
  id: string;
  full_name: string;
  role: AppRole;
  date_of_birth: string | null;
  phone: string | null;
  graduation_year: number | null;
};

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

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  published_at: string | null;
};

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

export type InviteCode = {
  id: string;
  code: string;
  role: AppRole;
  full_name: string;
  season: string;
  redeemed_at: string | null;
  expires_at: string | null;
};

export const isCoach = (role: AppRole | undefined): boolean =>
  role === 'admin' || role === 'coach';
