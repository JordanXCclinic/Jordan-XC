import { isAthlete, isCoach, isHeadCoach, isParent } from '../lib/types';
import { isPrivateRelay, providerLabel } from '../lib/legal';

describe('who counts as staff', () => {
  it('treats admin and coach as staff, and nobody else', () => {
    expect(isCoach('admin')).toBe(true);
    expect(isCoach('coach')).toBe(true);
    expect(isCoach('athlete')).toBe(false);
    expect(isCoach('private_client')).toBe(false);
    expect(isCoach('parent')).toBe(false);
    expect(isCoach(undefined)).toBe(false);
  });

  it('separates the head coach from assistants', () => {
    // Assistants run practices and write training; only the head coach hands
    // out the codes that let a family in.
    expect(isHeadCoach('admin')).toBe(true);
    expect(isHeadCoach('coach')).toBe(false);
    expect(isHeadCoach(undefined)).toBe(false);
  });

  it('counts one-on-one clients as athletes, since they train too', () => {
    expect(isAthlete('athlete')).toBe(true);
    expect(isAthlete('private_client')).toBe(true);
    expect(isAthlete('parent')).toBe(false);
    expect(isAthlete('coach')).toBe(false);
  });

  it('identifies parents', () => {
    expect(isParent('parent')).toBe(true);
    expect(isParent('athlete')).toBe(false);
  });
});

describe('Apple private relay', () => {
  it('spots a relay address so staff know it is not a normal inbox', () => {
    expect(isPrivateRelay('abc123@privaterelay.appleid.com')).toBe(true);
    expect(isPrivateRelay('ABC123@PrivateRelay.AppleID.com')).toBe(true);
  });

  it('leaves a real address alone', () => {
    expect(isPrivateRelay('pat@example.com')).toBe(false);
    expect(isPrivateRelay(null)).toBe(false);
    expect(isPrivateRelay(undefined)).toBe(false);
  });

  it('names the provider a family would recognise', () => {
    expect(providerLabel('apple')).toBe('Apple');
    expect(providerLabel('google')).toBe('Google');
    expect(providerLabel(undefined)).toBe('your account');
  });
});
