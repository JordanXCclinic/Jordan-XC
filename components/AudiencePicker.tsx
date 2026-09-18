import { useEffect, useState } from 'react';
import { ChipSelect } from './Field';
import { useTheme } from '../lib/appearance';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { AUDIENCE_LABELS, PROFILE_COLUMNS, type Audience, type Profile } from '../lib/types';

/** Everyone in the one-on-one programme, as opposed to one named client. */
const ALL_PRIVATE = 'all';

type Props = {
  audience: Audience;
  onAudienceChange: (next: Audience) => void;
  /** The single athlete this is for, or null for the whole audience. */
  athleteId: string | null;
  onAthleteChange: (next: string | null) => void;
  /** Some things are never addressed to staff — a practice, for instance. */
  allowCoachesOnly?: boolean;
};

/**
 * Who a post is for.
 *
 * Choosing "One-on-one" then reveals which client, because one-on-one athletes
 * are individual clients rather than a group — a note written for Lena is not
 * for Maya, and defaulting to the whole programme is how they end up reading
 * each other's coaching.
 */
export function AudiencePicker({
  audience,
  onAudienceChange,
  athleteId,
  onAthleteChange,
  allowCoachesOnly = true,
}: Props) {
  const c = useTheme();
  const [clients, setClients] = useState<Profile[]>([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('role', 'private_client')
      .order('full_name')
      .then(({ data }) => setClients((data as Profile[] | null) ?? []));
  }, []);

  const audiences = (Object.keys(AUDIENCE_LABELS) as Audience[])
    .filter((value) => allowCoachesOnly || value !== 'coaches')
    .map((value) => ({ value, label: AUDIENCE_LABELS[value] }));

  return (
    <>
      <ChipSelect
        label="Who sees it"
        options={audiences}
        value={audience}
        onChange={(next) => {
          onAudienceChange(next);
          // Leaving the one-on-one programme clears the athlete, so a note
          // cannot stay pinned to Lena after being switched to the clinic.
          if (next !== 'private') onAthleteChange(null);
        }}
      />

      {audience === 'private' ? (
        <ChipSelect
          label="Which client"
          options={[
            { value: ALL_PRIVATE, label: 'Everyone one-on-one' },
            ...clients.map((client) => ({ value: client.id, label: client.full_name })),
          ]}
          value={athleteId ?? ALL_PRIVATE}
          onChange={(next) => onAthleteChange(next === ALL_PRIVATE ? null : next)}
          hint={
            athleteId
              ? 'Only this athlete, their parents, and clinic staff will see it.'
              : 'Every one-on-one client will see this. Pick a name to keep it to one.'
          }
        />
      ) : null}
    </>
  );
}
