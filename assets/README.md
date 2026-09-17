# Assets

**These are still the stock Expo placeholders.** The app is wired to the
filenames below, so replacing a file is all it takes — no code change.

| File | What it is | Size |
|---|---|---|
| `icon.png` | The clinic logo. Used for the app icon **and** shown on the sign-in screen. | 1024×1024, square |
| `splash-icon.png` | The mark on the navy splash screen. | 1024×1024, transparent background |
| `android-icon-foreground.png` | The logo for the Android adaptive icon. | 1024×1024, transparent |
| `android-icon-background.png` | Solid navy behind it. | 1024×1024 |
| `android-icon-monochrome.png` | Single-colour silhouette for themed icons. | 1024×1024, transparent |
| `favicon.png` | Browser tab icon for the web build. | 48×48 |

Notes on the two that are easy to get wrong:

- **`icon.png` must be square with no transparency.** iOS rejects an icon with
  an alpha channel. The logo is a rounded badge, so put it on a solid
  background — white reads best against the navy sign-in screen, where it sits
  inside a white circle.
- **Android's adaptive icon gets masked into a circle.** Keep the logo inside
  the middle ~66% of `android-icon-foreground.png` or the edges get cut off.
  The background is already navy (`#003482`) via `app.json`.

After replacing them, rebuild — icons are baked in at build time and will not
change over the air:

```sh
npx expo run:ios      # or: npx expo run:android
```
