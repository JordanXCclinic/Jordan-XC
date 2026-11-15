import { dropIndex, moveItem } from '../components/DraggableList';
import { filterRoster, lastName, moveInFull, sortRoster } from '../lib/roster';

const r = (id: string, full_name: string, role: string, graduation_year: number | null = null) => ({
  id,
  full_name,
  role,
  graduation_year,
});

const runners = [
  r('a', 'Avery Lane', 'athlete', 2029),
  r('e', 'Emmy Barrett', 'private_client', 2031),
  r('j', 'Jack Barrett', 'private_client', null),
  r('n', 'Nora Diaz', 'athlete', 2028),
];

describe('roster', () => {
  it('filters to one-on-one or clinic runners', () => {
    expect(filterRoster(runners, 'private').map((x) => x.id)).toEqual(['e', 'j']);
    expect(filterRoster(runners, 'clinic').map((x) => x.id)).toEqual(['a', 'n']);
    expect(filterRoster(runners, 'all')).toHaveLength(4);
  });

  it('sorts by first name, last name and class year', () => {
    expect(sortRoster(runners, 'first', []).map((x) => x.id)).toEqual(['a', 'e', 'j', 'n']);
    expect(sortRoster(runners, 'last', []).map((x) => x.id)).toEqual(['e', 'j', 'n', 'a']);
    expect(sortRoster(runners, 'class', []).map((x) => x.id)).toEqual(['n', 'a', 'e', 'j']);
    expect(lastName('  Nora  Diaz ')).toBe('Diaz');
  });

  it('keeps the dragged order, with anyone new after it A to Z', () => {
    expect(sortRoster(runners, 'custom', ['n', 'j']).map((x) => x.id)).toEqual(['n', 'j', 'a', 'e']);
  });

  it('moves a runner in a filtered view without disturbing the hidden ones', () => {
    const full = ['a', 'e', 'n', 'j'];
    // One-on-one view shows e, j. Drag Jack above Emmy.
    expect(moveInFull(full, ['e', 'j'], 1, 0)).toEqual(['a', 'j', 'e', 'n']);
    // Clinic view shows a, n. Drag Avery below Nora.
    expect(moveInFull(full, ['a', 'n'], 0, 1)).toEqual(['e', 'n', 'a', 'j']);
    expect(moveInFull(full, full, 2, 2)).toBe(full);
  });

  it('drops a dragged row after every row whose middle it passed', () => {
    const middles = [20, 80, 140, 200];
    expect(dropIndex(0, 150, middles)).toBe(2); // row 0 dragged past rows 1 and 2
    expect(dropIndex(3, 10, middles)).toBe(0); // row 3 dragged to the top
    expect(dropIndex(1, 85, middles)).toBe(1); // barely moved
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });
});
