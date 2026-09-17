# Assets

Every icon here is generated from one file — **`logo-source.png`**, the clinic
badge as supplied. Nothing else in this folder should be edited by hand.

To change the logo, replace `logo-source.png` and run:

```sh
pip install Pillow     # once
npm run icons
```

## What gets generated

| File | Where it shows | Notes |
|---|---|---|
| `icon.png` | App icon on the home screen | Opaque white square — iOS rejects an icon with transparency |
| `logo.png` | Inside the app: sign-in, the code screen, the Home and Coach headers | Transparent, so it works on navy and on white |
| `splash-icon.png` | The navy screen while the app opens | Transparent |
| `android-icon-foreground.png` | Android adaptive icon | Sits inside the circular safe zone |
| `android-icon-background.png` | Behind it | Flat brand navy `#003482` |
| `android-icon-monochrome.png` | Android themed icons | See below |
| `favicon.png` | Browser tab on the web build | 48×48 |

## Two decisions worth knowing about

**The app icon and the in-app mark are separate files.** iOS will not accept an
app icon with an alpha channel, so `icon.png` is flattened onto white. But a
white square inside the sign-in screen's white circle shows its corners poking
out past the curve, so everything inside the app uses the transparent
`logo.png` instead.

**The themed icon is not the badge's outline.** Android tints that icon by its
alpha channel, so using the badge's silhouette would give a solid blob with no
runners in it. Instead it keeps only the dark artwork — the rings, the
wordmark, and the red and navy runners. The white runner drops out, which reads
as the gap between the other two, the way it does in the logo itself.

## After changing the logo

Rebuild. Icons are baked in at build time and will not update over the air:

```sh
npx expo run:ios      # or: npx expo run:android
```
