import { useEffect, useState } from 'react';
import { Sheet } from './Sheet';
import { WorkoutLogForm } from './WorkoutLogForm';
import type { Workout } from '../lib/types';

type Props = {
  workout: Workout | null;
  /** A run that is not in the plan — an extra easy day, a weekend long run. */
  freeRun?: boolean;
  athleteId: string;
  onClose: () => void;
  onSaved: () => void;
};

/** Logs a new run: against a planned workout, or one of the athlete's own. */
export function WorkoutLogSheet({ workout, freeRun = false, athleteId, onClose, onSaved }: Props) {
  const open = workout !== null || freeRun;

  // A fresh form each time the sheet opens, so nothing typed last time lingers.
  // Counted rather than unmounted on close, which would empty the sheet while
  // it is still sliding away.
  const [opened, setOpened] = useState(0);
  useEffect(() => {
    if (open) setOpened((count) => count + 1);
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose}>
      <WorkoutLogForm
        key={opened}
        athleteId={athleteId}
        workoutId={workout?.id ?? null}
        workoutTitle={workout?.title ?? null}
        splitCount={workout?.split_count ?? null}
        splitLabel={workout?.split_label ?? null}
        splitLabels={workout?.split_labels ?? null}
        onCancel={onClose}
        onSaved={onSaved}
      />
    </Sheet>
  );
}
