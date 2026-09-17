import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './auth';
import { isSupabaseConfigured, supabase } from './supabase';
import { PROFILE_COLUMNS, isAthlete, isParent, type Profile } from './types';

type AthleteState = {
  /** Who this user may look at: themselves, or the athletes they guard. */
  athletes: Profile[];
  activeAthleteId: string | null;
  activeAthlete: Profile | null;
  setActiveAthleteId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AthleteContext = createContext<AthleteState | undefined>(undefined);

/**
 * Resolves the athlete whose training, profile, and meetings the screens show.
 * An athlete is always looking at themselves. A parent may guard more than one
 * runner, so they pick, and the choice is shared across every tab.
 */
export function AthleteProvider({ children }: { children: ReactNode }) {
  const { profile, role, session } = useAuth();
  const [athletes, setAthletes] = useState<Profile[]>([]);
  const [activeAthleteId, setActiveAthleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const userId = session?.user?.id;

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !userId || !profile) {
      setAthletes([]);
      setLoading(false);
      return;
    }

    if (isAthlete(role)) {
      setAthletes([profile]);
      setActiveAthleteId(profile.id);
      setLoading(false);
      return;
    }

    if (!isParent(role)) {
      // Staff work from the roster screens, not from a single active athlete.
      setAthletes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Two queries rather than an embedded join: guardian_links has two foreign
    // keys into profiles, and naming the right one is easy to get subtly wrong.
    const { data: links } = await supabase
      .from('guardian_links')
      .select('athlete_id')
      .eq('guardian_id', userId);

    const ids = (links ?? []).map((link: { athlete_id: string }) => link.athlete_id);
    if (ids.length === 0) {
      setAthletes([]);
      setLoading(false);
      return;
    }

    const { data: rows } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .in('id', ids)
      .order('full_name');

    const list = (rows as Profile[] | null) ?? [];
    setAthletes(list);
    setActiveAthleteId((current) =>
      current && list.some((athlete) => athlete.id === current) ? current : (list[0]?.id ?? null)
    );
    setLoading(false);
  }, [userId, profile, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<AthleteState>(
    () => ({
      athletes,
      activeAthleteId,
      activeAthlete: athletes.find((athlete) => athlete.id === activeAthleteId) ?? null,
      setActiveAthleteId,
      loading,
      refresh: load,
    }),
    [athletes, activeAthleteId, loading, load]
  );

  return <AthleteContext.Provider value={value}>{children}</AthleteContext.Provider>;
}

export function useAthlete(): AthleteState {
  const context = useContext(AthleteContext);
  if (!context) throw new Error('useAthlete must be used inside AthleteProvider');
  return context;
}
