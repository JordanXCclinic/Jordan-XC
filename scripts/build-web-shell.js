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
 *
 * Deliberately NOT full screen. Claiming apple-mobile-web-app-capable did make
 * it open without Safari's bars, but the tab bar then sat wrong at the bottom
 * on a real iPhone — labels sliced off — and four attempts at the safe-area
 * handling behind it did not fix it. None of that was reproducible in any
 * desktop browser, so each attempt cost the person a test on their own phone.
 * With the browser's own bars visible the layout has always been correct, and
 * the icon and name still make it look like an app on the home screen.
 *
 * The phone builds are unaffected by any of this: they are not web pages, and
 * they get the real safe-area handling from the operating system.
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

const ICONS = [
  'web-icon-180.png',
  'web-icon-192.png',
  'web-icon-512.png',
  'web-splash-logo.png',
];

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
  display: 'browser',
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

// The icon and the name, and nothing that changes how the page is laid out.
// apple-mobile-web-app-capable and the status bar and viewport settings that
// went with it are deliberately absent; see the note at the top of this file.
const TAGS = `
    <link rel="apple-touch-icon" href="${href('web-icon-180.png')}" />
    <link rel="manifest" href="${href('manifest.json')}" />
    <meta name="apple-mobile-web-app-title" content="Jordan XC" />
    <meta name="theme-color" content="${LIGHT_BACKGROUND}" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="${DARK_BACKGROUND}" media="(prefers-color-scheme: dark)" />
    <meta name="description" content="${manifest.description}" />
    <style>
      /* The page is blank until the bundle has downloaded and drawn the first
         screen, which on a phone on clinic wifi is a second or two of white.
         This paints the clinic's own opening instead, in the markup, so it is
         there on the first frame with nothing to wait for. It is removed as
         soon as the app has something on screen. */
      #boot {
        position: fixed;
        inset: 0;
        z-index: 2147483646;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${BRAND_NAVY};
        transition: opacity 260ms ease-out;
      }
      #boot img {
        width: 128px;
        height: 128px;
      }
      #boot.done {
        opacity: 0;
        pointer-events: none;
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
    </style>
  `;

// Sits inside <body> rather than <head>, and is taken down by the app itself
// appearing rather than by a timer: a slow connection should hold the badge for
// as long as it needs, and a fast one should not sit on it.
const BOOT = `
    <div id="boot"><img src="${href('web-splash-logo.png')}" alt="" /></div>
    <script>
      (function () {
        var boot = document.getElementById('boot');
        var root = document.getElementById('root');
        if (!boot || !root) return;
        var done = false;
        function clear() {
          if (done) return;
          done = true;
          observer.disconnect();
          boot.className = 'done';
          setTimeout(function () { boot.remove(); }, 400);
        }
        var observer = new MutationObserver(function () {
          if (root.childElementCount > 0) clear();
        });
        observer.observe(root, { childList: true, subtree: true });
        if (root.childElementCount > 0) clear();
        // If the bundle fails outright, do not leave the badge up forever with
        // nothing behind it: the app's own error screen should be reachable.
        setTimeout(clear, 10000);
      })();
    </script>
  `;

let html = fs.readFileSync(INDEX, 'utf8');

if (html.includes('apple-touch-icon')) {
  console.log('  index.html already carries the home screen tags');
  fs.writeFileSync(INDEX, html);
} else if (!html.includes('</head>')) {
  console.error('index.html has no </head> to insert before.');
  process.exit(1);
} else {
  html = html.replace('</head>', `${TAGS}</head>`);
  if (!html.includes('</body>')) {
    console.error('index.html has no </body> to insert the opening screen before.');
    process.exit(1);
  }
  html = html.replace('</body>', `${BOOT}</body>`);
  fs.writeFileSync(INDEX, html);
}

console.log(`  home screen icons + manifest -> dist/ (base "${BASE || '/'}")`);
