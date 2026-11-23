import { searchPlans } from '../lib/planSearch';

const runners = [
  { id: 'jack', full_name: 'Jack Barrett', role: 'athlete' },
  { id: 'emmy', full_name: 'Emmy Barrett', role: 'athlete' },
  { id: 'henry', full_name: 'Henry Price', role: 'private_client' },
  { id: 'zoe', full_name: 'Zoë Adams', role: 'athlete' },
];

const plans = [
  {
    id: 'p-jack',
    name: 'Jack Barrett - Jordan XC Clinic',
    assignments: [{ athlete_id: 'jack', starts_on: '2026-11-09' }],
  },
  {
    id: 'p-indoor',
    name: 'Henry Price - Indoor Track 2026-27',
    assignments: [{ athlete_id: 'henry', starts_on: '2026-11-09' }],
  },
  {
    id: 'p-summer',
    name: 'Summer base',
    assignments: [
      { athlete_id: 'henry', starts_on: '2026-06-01' },
      { athlete_id: 'emmy', starts_on: '2026-06-01' },
    ],
  },
  { id: 'p-empty', name: 'Winter strength', assignments: [] },
];

const keys = (query: string) => searchPlans(runners, plans, query).map((r) => r.key);

describe('searchPlans', () => {
  it('finds nothing until something is typed', () => {
    expect(searchPlans(runners, plans, '   ')).toEqual([]);
  });

  it('matches the start of any word of a name, in any case', () => {
    expect(keys('JACK')).toEqual(['jack:p-jack']);
    expect(keys('barr')).toEqual(['emmy:p-summer', 'jack:p-jack']);
    expect(keys('jack b')).toEqual(['jack:p-jack']);
    expect(keys('ack')).toEqual([]);
  });

  it('ignores accents', () => {
    expect(keys('zoe')).toEqual(['zoe']);
  });

  it('lists a runner once per plan, newest first, and says when there is none', () => {
    expect(keys('henry')).toEqual(['henry:p-indoor', 'henry:p-summer']);
    expect(searchPlans(runners, plans, 'zoe')[0]).toMatchObject({ kind: 'runner', planId: null });
  });

  it('finds plans by their own name, without repeating one a runner already reached', () => {
    expect(keys('indoor')).toEqual(['plan:p-indoor']);
    expect(searchPlans(runners, plans, 'winter')).toEqual([
      { kind: 'plan', key: 'plan:p-empty', planId: 'p-empty', name: 'Winter strength', runners: 0 },
    ]);
    // Jack's plan is named after him, but it shows once, under Jack.
    expect(keys('jack')).not.toContain('plan:p-jack');
  });
});
