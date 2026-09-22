#!/usr/bin/env node
/*
 * Makes the web build installable to a phone's home screen.
 *
 * Expo's exported index.html carries a favicon and nothing else, so iOS falls
 * back to a screenshot of the page for the icon and opens the shortcut inside
 * Safari, address bar and all. The tags below are what turn it into something
 * that looks like the app: the clinic badge as the icon, full screen, and a
 * top strip that matches the page instead of fighting it.
 *
 * Runs after `expo export`, because that is what writes dist/index.html.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');

// Pages serves the site from a subpath, so every reference here needs it.
// Matches what expo export was given, and is empty for a root deployment.
const BASE = (process.env.EXPO_WEB_BASE_URL ?? '').replace(/\/+$/, '');
const href = (file) => `${BASE}/${file}`;

// Kept in step with lib/theme.ts. Safari tints the status bar area with these,
// picking by the phone's appearance setting, so the strip above the app is the
// page's own colour in both themes rather than a white bar over a dark screen.
const LIGHT_BACKGROUND = '#FFFFFF';
const DARK_BACKGROUND = '#080D18';
const BRAND_NAVY = '#003482';

const ICONS = ['web-icon-180.png', 'web-icon-192.png', 'web-icon-512.png'];

if (!fs.existsSync(INDEX)) {
  console.error(`No build at ${INDEX}. Run "expo export --platform web" first.`);
  process.exit(1);
}

for (const icon of ICONS) {
  const from = path.join(ROOT, 'assets', icon);
  if (!fs.existsSync(from)) {
    console.error(`Missing ${from}. Run "npm run icons".`);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(DIST, icon));
}

const manifest = {
  name: 'Jordan XC Clinic',
  // What actually fits under a home screen icon.
  short_name: 'Jordan XC',
  description:
    'The schedule, training, and clinic news hub for athletes and families of the Jordan Cross Country Clinic.',
  start_url: `${BASE}/`,
  scope: `${BASE}/`,
  display: 'standalone',
  orientation: 'portrait',
  background_color: BRAND_NAVY,
  theme_color: BRAND_NAVY,
  icons: [
    { src: href('web-icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: href('web-icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};

// Named .json rather than .webmanifest: the file is served by GitHub Pages,
// whose content type for .webmanifest is not something this can check, and a
// manifest served as application/octet-stream is refused by some browsers.
// .json is unambiguous everywhere and browsers do not require the
// application/manifest+json type to accept one.
fs.writeFileSync(
  path.join(DIST, 'manifest.json'),
  JSON.stringify(manifest, null, 2) + '\n'
);

// black-translucent rather than default, and it has to stay that way while
// viewport-fit=cover is set. "default" keeps an opaque status bar and starts
// the web view below it, while viewport-fit=cover tells the page it has the
// whole screen: the app then lays out for a screen taller than it really has
// and the tab bar falls off the bottom by the height of the status bar. The
// two must agree. black-translucent gives the web view the whole screen, which
// is the one the insets describe.
//
// In that mode iOS always draws the status bar text white, so the strip behind
// it is painted brand navy below — white on white would be invisible in light
// mode. The strip is env(safe-area-inset-top) tall, which is zero in an
// ordinary browser tab, so it costs nothing there.
const TAGS = `
    <link rel="apple-touch-icon" href="${href('web-icon-180.png')}" />
    <link rel="manifest" href="${href('manifest.json')}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Jordan XC" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="${LIGHT_BACKGROUND}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${DARK_BACKGROUND}" media="(prefers-color-scheme: dark)" />
    <meta name="description" content="${manifest.description}" />
    <style>
      /* Expo's own reset sizes the page with height: 100%. In an installed iOS
         app with viewport-fit=cover that resolves short of the real screen, so
         the app ended above the home indicator, the page's white showed through
         beneath it, and body's overflow: hidden sliced the tab bar labels that
         fell past that edge. dvh is the viewport actually being displayed.
         Declared after the reset so it wins, and paired with the fallback for
         anything that does not know dvh. */
      html,
      body,
      #root {
        height: 100vh;
        height: 100dvh;
      }
      /* Nothing should show through the app now, but if a rounded corner or a
         rubber-band scroll ever reveals the page beneath, it should be the
         app's own colour rather than a white flash. */
      body {
        background-color: ${LIGHT_BACKGROUND};
      }
      @media (prefers-color-scheme: dark) {
        body {
          background-color: ${DARK_BACKGROUND};
        }
      }
      body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: env(safe-area-inset-top);
        background: ${BRAND_NAVY};
        z-index: 9999;
        pointer-events: none;
      }
    </style>
  `;

let html = fs.readFileSync(INDEX, 'utf8');

// Without viewport-fit=cover, Safari reports every env(safe-area-inset-*) as
// zero. react-native-safe-area-context reads exactly those values, so the tab
// bar was given no room for the home indicator and sat underneath it. It only
// showed once the app went full screen: before that, Safari's own toolbar
// happened to fill the gap. Rewritten rather than appended — a second viewport
// meta is ignored.
const VIEWPORT = /<meta\s+name="viewport"\s+content="([^"]*)"\s*\/?>/i;
const viewport = html.match(VIEWPORT);
if (!viewport) {
  console.error('index.html has no viewport meta to extend.');
  process.exit(1);
}
if (!viewport[1].includes('viewport-fit')) {
  html = html.replace(
    VIEWPORT,
    `<meta name="viewport" content="${viewport[1]}, viewport-fit=cover" />`
  );
}

if (html.includes('apple-touch-icon')) {
  console.log('  index.html already carries the home screen tags');
  fs.writeFileSync(INDEX, html);
} else if (!html.includes('</head>')) {
  console.error('index.html has no </head> to insert before.');
  process.exit(1);
} else {
  html = html.replace('</head>', `${TAGS}</head>`);
  fs.writeFileSync(INDEX, html);
}

console.log(`  home screen icons + manifest -> dist/ (base "${BASE || '/'}")`);
