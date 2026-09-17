# Assets

**These are still the stock Expo placeholders.** The app is wired to the
filenames below, so replacing a file is all it takes — no code change.

| File | What it is | Size |
|---|---|---|
| `icon.png` | The clinic logo. Feeds the app icon **and** every mark inside the app — sign-in, the code screen, and the Home and Coach headers. | 1024×1024, square |
| `splash-icon.png` | The mark on the navy splash screen. Needs a **transparent** background, unlike `icon.png`. | 1024×1024, transparent |
| `android-icon-foreground.png` | The logo for the Android adaptive icon. | 1024×1024, transparent |
| `android-icon-background.png` | Solid navy behind it. | 1024×1024 |
| `android-icon-monochrome.png` | Single-colour silhouette for themed icons. | 1024×1024, transparent |
| `favicon.png` | Browser tab icon for the web build. | 48×48 |

Notes on the two that are easy to get wrong:

- **`icon.png` must be square with no transparency.** iOS rejects an icon with
  an alpha channel. The badge has rounded edges, so put it on a solid **white**
  square. White is what makes the same file work in both jobs: as the app icon,
  and in the app, where it sits either inside a white circle (sign-in) or on a
  white page (Home and Coach), so the square edges never show.
- **The splash is the one place that needs transparency**, because the mark sits
  directly on navy. That is why `splash-icon.png` stays a separate file — a
  white square would show as a white block behind the logo.
- **Android's adaptive icon gets masked into a circle.** Keep the logo inside
  the middle ~66% of `android-icon-foreground.png` or the edges get cut off.
  The background is already navy (`#003482`) via `app.json`.

After replacing them, rebuild — icons are baked in at build time and will not
change over the air:

```sh
npx expo run:ios      # or: npx expo run:android
```
