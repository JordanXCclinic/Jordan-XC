/**
 * Finding a training plan from the coach's Home tab by typing a runner's name
 * or the plan's. Kept apart from the screen so the matching can be tested.
 */

type Runner = { id: string; full_name: string; role: string };

type Plan = {
  id: string;
  name: string;
  assignments: { athlete_id: string; starts_on: string }[];
};

export type PlanSearchResult =
  /** A runner found by name, and one of their plans (or none yet). */
  | {
      kind: 'runner';
      key: string;
      athleteId: string;
      name: string;
      role: string;
      planId: string | null;
      planName: string | null;
    }
  /** A plan found by its own name. */
  | { kind: 'plan'; key: string; planId: string; name: string; runners: number };

/** Lower case, accents off: "Zoë" is found by typing "zoe". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * Every typed word has to start a word of the name, as in a phone's contacts:
 * "jack b" and "barrett" both find Jack Barrett, "ack" does not.
 */
function matches(text: string, words: string[]): boolean {
  const parts = fold(text).split(/[^a-z0-9]+/).filter(Boolean);
  return words.every((word) => parts.some((part) => part.startsWith(word)));
}

/**
 * What the coach's search finds: runners whose name matches, each with the
 * plan they are on (newest first, one line per plan), then plans whose own
 * name matches. A plan already reached through a runner above is not listed
 * again, so typing "Jack" does not show Jack's plan twice.
 */
export function searchPlans(runners: Runner[], plans: Plan[], query: string): PlanSearchResult[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const plansOf = new Map<string, { id: string; name: string; starts_on: string }[]>();
  for (const plan of plans) {
    for (const assignment of plan.assignments) {
      const list = plansOf.get(assignment.athlete_id) ?? [];
      list.push({ id: plan.id, name: plan.name, starts_on: assignment.starts_on });
      plansOf.set(assignment.athlete_id, list);
    }
  }

  const results: PlanSearchResult[] = [];
  const reached = new Set<string>();

  const found = runners
    .filter((runner) => matches(runner.full_name, words))
    .sort((a, b) => byText(a.full_name, b.full_name));

  for (const runner of found) {
    const theirs = (plansOf.get(runner.id) ?? []).sort((a, b) => b.starts_on.localeCompare(a.starts_on));
    if (theirs.length === 0) {
      results.push({
        kind: 'runner',
        key: runner.id,
        athleteId: runner.id,
        name: runner.full_name,
        role: runner.role,
        planId: null,
        planName: null,
      });
    }
    for (const plan of theirs) {
      reached.add(plan.id);
      results.push({
        kind: 'runner',
        key: `${runner.id}:${plan.id}`,
        athleteId: runner.id,
        name: runner.full_name,
        role: runner.role,
        planId: plan.id,
        planName: plan.name,
      });
    }
  }

  plans
    .filter((plan) => !reached.has(plan.id) && matches(plan.name, words))
    .sort((a, b) => byText(a.name, b.name))
    .forEach((plan) =>
      results.push({
        kind: 'plan',
        key: `plan:${plan.id}`,
        planId: plan.id,
        name: plan.name,
        runners: plan.assignments.length,
      })
    );

  return results;
}
