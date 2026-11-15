/**
 * Arranging the coach's roster: which runners show, and in what order. Kept
 * apart from the screen so the rules can be tested on their own.
 */

export type RosterSort = 'custom' | 'first' | 'last' | 'class';
export type RosterFilter = 'all' | 'private' | 'clinic';

type Runner = {
  id: string;
  full_name: string;
  role: string;
  graduation_year: number | null;
};

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** "Emmy Barrett" → "Barrett"; a single name is its own last name. */
export function lastName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1] ?? '';
}

export function filterRoster<R extends Runner>(runners: R[], filter: RosterFilter): R[] {
  if (filter === 'private') return runners.filter((r) => r.role === 'private_client');
  if (filter === 'clinic') return runners.filter((r) => r.role === 'athlete');
  return runners;
}

/**
 * The roster in the chosen order. "custom" is the coach's own dragged order;
 * anyone not placed yet (new to the roster) follows, A to Z.
 */
export function sortRoster<R extends Runner>(runners: R[], sort: RosterSort, customOrder: string[]): R[] {
  const list = runners.slice();
  if (sort === 'first') return list.sort((a, b) => byText(a.full_name, b.full_name));
  if (sort === 'last')
    return list.sort((a, b) => byText(lastName(a.full_name), lastName(b.full_name)) || byText(a.full_name, b.full_name));
  if (sort === 'class')
    // Soonest to graduate first; no year at the end.
    return list.sort(
      (a, b) =>
        (a.graduation_year ?? Number.MAX_SAFE_INTEGER) - (b.graduation_year ?? Number.MAX_SAFE_INTEGER) ||
        byText(a.full_name, b.full_name)
    );

  const place = new Map(customOrder.map((id, index) => [id, index]));
  return list.sort((a, b) => {
    const pa = place.get(a.id);
    const pb = place.get(b.id);
    if (pa !== undefined && pb !== undefined) return pa - pb;
    if (pa !== undefined) return -1;
    if (pb !== undefined) return 1;
    return byText(a.full_name, b.full_name);
  });
}

/**
 * The whole roster's new order after a drag in a filtered view: the dragged
 * runner moves to just before, or just after, the runner it was dropped on,
 * and everyone the filter hides keeps their place.
 *
 * @param full every runner's id in the current custom order
 * @param visible the ids on screen, in that same order
 */
export function moveInFull(full: string[], visible: string[], from: number, to: number): string[] {
  const dragged = visible[from];
  const target = visible[to];
  if (dragged === undefined || target === undefined || from === to) return full;
  const next = full.filter((id) => id !== dragged);
  const at = next.indexOf(target);
  next.splice(to > from ? at + 1 : at, 0, dragged);
  return next;
}
