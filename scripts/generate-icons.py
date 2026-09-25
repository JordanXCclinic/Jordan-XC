#!/usr/bin/env python3
"""Generate every app icon from one source logo.

    pip install Pillow
    npm run icons

Edit assets/logo-source.png and re-run; everything else in assets/ is derived
and should not be hand-edited.
"""
from PIL import Image, ImageChops

NAVY = (0, 52, 130, 255)
WHITE = (255, 255, 255, 255)

# Android masks an adaptive icon down to the middle ~66% of the canvas, so the
# badge is drawn smaller than that to leave the corners room.
ANDROID_COVERAGE = 0.62
ANDROID_CANVAS = 432

src = Image.open('assets/logo-source.png').convert('RGBA')

# Measure padding from the artwork itself, not from whatever transparent margin
# the export happened to carry.
bbox = src.getbbox()
if bbox:
    src = src.crop(bbox)


def fitted(art: Image.Image, canvas: int, coverage: float) -> Image.Image:
    """`art` centered on a transparent square, scaled to `coverage` of it."""
    target = canvas * coverage
    scale = min(target / art.width, target / art.height)
    width, height = round(art.width * scale), round(art.height * scale)
    resized = art.resize((width, height), Image.LANCZOS)

    out = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    out.paste(resized, ((canvas - width) // 2, (canvas - height) // 2), resized)
    return out


def flatten(img: Image.Image, background: tuple) -> Image.Image:
    plate = Image.new('RGBA', img.size, background)
    plate.alpha_composite(img)
    return plate


def silhouette(art: Image.Image) -> Image.Image:
    """The logo reduced to its dark artwork in one flat colour.

    Android tints the themed icon by its alpha, so taking the shape's outline
    would give a featureless blob. Keeping only what is dark leaves the rings,
    the wordmark, and the runners — the white runner drops out, which reads as
    the gap between the other two, the way it does in the logo itself.
    """
    lum = flatten(art, WHITE).convert('L')
    dark = lum.point(lambda v: 255 if v < 140 else 0).convert('L')
    inside = art.getchannel('A').point(lambda v: 255 if v > 8 else 0).convert('L')
    mask = ImageChops.multiply(dark, inside)

    mark = Image.new('RGBA', art.size, (0, 0, 0, 0))
    mark.paste((0, 0, 0, 255), (0, 0), mask)
    mark.putalpha(mask)
    return mark


def android(art: Image.Image) -> Image.Image:
    return fitted(art, ANDROID_CANVAS, ANDROID_COVERAGE).resize((512, 512), Image.LANCZOS)


# App icon. iOS rejects an alpha channel, so this is flattened onto white and
# saved as RGB. White also lets the same file work as the in-app mark, where it
# sits on a white circle or a white page.
flatten(fitted(src, 1024, 0.90), WHITE).convert('RGB').save('assets/icon.png')

# Splash. Sits directly on navy, so this one keeps its transparency.
fitted(src, 1024, 0.92).save('assets/splash-icon.png')

# The in-app mark. Transparent, so it works on the navy sign-in circle and on a
# white page alike — a white square would show its corners through the circle.
fitted(src, 1024, 1.0).save('assets/logo.png')

android(src).save('assets/android-icon-foreground.png')
Image.new('RGBA', (512, 512), NAVY).save('assets/android-icon-background.png')
android(silhouette(src)).save('assets/android-icon-monochrome.png')

# Favicon. Too small for the wordmark to read either way, so it keeps its
# transparency and lets the browser's tab colour show through.
fitted(src, 48, 0.98).save('assets/favicon.png')

# The mark the web page paints before any JavaScript has run. It sits on navy,
# so unlike the home screen icons this one keeps its transparency.
fitted(src, 256, 0.92).save('assets/web-splash-logo.png')

# Home screen icons for the web build. iOS rounds and masks these itself and,
# like the app icon, will not take an alpha channel — a transparent one comes
# out with a black square behind it — so they are flattened onto white too.
# 180 is what iOS asks for; Android reads the 192 and 512 from the manifest.
for size in (180, 192, 512):
    flatten(fitted(src, size, 0.90), WHITE).convert('RGB').save(
        f'assets/web-icon-{size}.png'
    )

for name in (
    'icon.png',
    'logo.png',
    'splash-icon.png',
    'android-icon-foreground.png',
    'android-icon-background.png',
    'android-icon-monochrome.png',
    'favicon.png',
    'web-splash-logo.png',
    'web-icon-180.png',
    'web-icon-192.png',
    'web-icon-512.png',
):
    image = Image.open(f'assets/{name}')
    print(f'  assets/{name:32} {str(image.size):12} {image.mode}')
