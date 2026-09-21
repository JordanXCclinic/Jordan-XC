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

const TAGS = `
    <link rel="apple-touch-icon" href="${href('web-icon-180.png')}" />
    <link rel="manifest" href="${href('manifest.json')}" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Jordan XC" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="theme-color" content="${LIGHT_BACKGROUND}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${DARK_BACKGROUND}" media="(prefers-color-scheme: dark)" />
    <meta name="description" content="${manifest.description}" />
  `;

let html = fs.readFileSync(INDEX, 'utf8');

if (html.includes('apple-touch-icon')) {
  console.log('  index.html already carries the home screen tags');
} else if (!html.includes('</head>')) {
  console.error('index.html has no </head> to insert before.');
  process.exit(1);
} else {
  html = html.replace('</head>', `${TAGS}</head>`);
  fs.writeFileSync(INDEX, html);
}

console.log(`  home screen icons + manifest -> dist/ (base "${BASE || '/'}")`);
