// The static config lives in app.json. This file exists for one reason: the
// web build is served from a subpath on GitHub Pages
// (jordanxcclinic.github.io/Jordan-XC), so every asset and route link has to
// be prefixed with that path.
//
// `experiments.baseUrl` is applied to whatever bundle is being built, not just
// the web one, and expo-router prepends it to routes in any non-development
// build. Baking it into app.json would therefore put "/Jordan-XC" in front of
// the phone app's routes too and break its deep links. So it is read from the
// environment instead: the Pages workflow sets EXPO_WEB_BASE_URL, and the EAS
// builds for iOS and Android, which never set it, keep the default of "".
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_WEB_BASE_URL ?? '',
  },
});
