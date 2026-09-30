import { asMapLink, directionsUrl, looksLikeLink } from '../lib/maps';

const search = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

describe('directionsUrl', () => {
  it('searches the location name when there is no address', () => {
    expect(directionsUrl('Jemison Trail')).toBe(search('Jemison Trail'));
    expect(directionsUrl('Jemison Trail', '  ')).toBe(search('Jemison Trail'));
  });

  it('prefers the address, encoded', () => {
    expect(directionsUrl('Jemison Trail', '3700 Mountain Brook Pkwy, AL #2')).toBe(
      search('3700 Mountain Brook Pkwy, AL #2')
    );
  });

  it('opens a pasted maps link as it is', () => {
    const link = 'https://maps.app.goo.gl/AbC123xyz';
    expect(directionsUrl('Jemison Trail', link)).toBe(link);
  });

  it('falls back to the location name for a link that is not a map', () => {
    expect(directionsUrl('Jemison Trail', 'https://example.com/maps')).toBe(
      search('Jemison Trail')
    );
  });
});

describe('asMapLink', () => {
  it.each([
    'https://maps.app.goo.gl/AbC123xyz',
    'https://www.google.com/maps/place/Jemison+Park',
    'https://google.com/maps?q=33.5,-86.7',
    'https://maps.google.com/?q=Jemison',
    'https://goo.gl/maps/xyz',
    'https://maps.apple.com/?address=3700%20Mountain%20Brook',
  ])('accepts %s', (link) => {
    expect(asMapLink(link)).toBe(link);
  });

  it.each([
    'https://example.com/maps',
    'https://www.google.com/search?q=jemison',
    'https://goo.gl/abc',
    'https://maps.google.com.evil.io/x',
    'http://maps.app.goo.gl/AbC',
    'javascript:alert(1)',
    '3700 Mountain Brook Pkwy',
  ])('refuses %s', (text) => {
    expect(asMapLink(text)).toBeNull();
  });
});

describe('looksLikeLink', () => {
  it('tells a link from an address', () => {
    expect(looksLikeLink('https://maps.app.goo.gl/x')).toBe(true);
    expect(looksLikeLink('3700 Mountain Brook Pkwy')).toBe(false);
  });
});
