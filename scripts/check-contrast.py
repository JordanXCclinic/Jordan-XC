#!/usr/bin/env python3
"""Check every text/background pairing in both themes against WCAG AA.

    npm run check:contrast

Reads the palettes straight out of lib/theme.ts, so the check cannot drift from
what the app renders. Body text needs 4.5:1; icons and incidental text need 3:1.
Exits non-zero on a failure.
"""
import re
import pathlib

SRC = pathlib.Path('lib/theme.ts').read_text()


def brand_value(key: str) -> str | None:
    block = SRC.split('export const brand', 1)[1].split('};', 1)[0]
    match = re.search(rf"{key}:\s*'(#[0-9A-Fa-f]{{6}})'", block)
    return match.group(1) if match else None


def palette(name: str) -> dict[str, str]:
    """Hex values for one palette, following `brand.x` references."""
    block = SRC.split(f'export const {name}', 1)[1].split('};', 1)[0]
    out: dict[str, str] = {}
    for key, raw in re.findall(r'(\w+):\s*([^,\n]+)', block):
        value = raw.strip().rstrip(',')
        if value.startswith("'#"):
            out[key] = value.strip("'")
        elif value.startswith('brand.'):
            resolved = brand_value(value.split('.')[1])
            if resolved:
                out[key] = resolved
    return out


def luminance(colour: str) -> float:
    channels = (int(colour[i:i + 2], 16) / 255 for i in (1, 3, 5))
    linear = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast(foreground: str, background: str) -> float:
    a, b = luminance(foreground), luminance(background)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


# Every pairing the app actually puts on screen.
PAIRS = [
    ('body text on page', 'text', 'background', 4.5),
    ('muted text on page', 'textMuted', 'background', 4.5),
    ('muted text on card', 'textMuted', 'surface', 4.5),
    ('faint text on page', 'textFaint', 'background', 3.0),
    ('link/icon on page', 'primary', 'background', 3.0),
    ('white on primary fill', 'textInverse', 'primarySurface', 4.5),
    ('muted on primary fill', 'textOnPrimary', 'primarySurface', 4.5),
    ('white on danger fill', 'textInverse', 'dangerSurface', 4.5),
    ('success text on tint', 'success', 'successTint', 4.5),
    ('warning text on tint', 'warning', 'warningTint', 4.5),
    ('danger text on tint', 'danger', 'dangerTint', 4.5),
    ('primary text on tint', 'primary', 'primaryTint', 4.5),
]

failures = 0
for theme in ('lightColors', 'darkColors'):
    colours = palette(theme)
    print(f'\n--- {theme} ---')
    for label, fg, bg, needed in PAIRS:
        if fg not in colours or bg not in colours:
            print(f'  ??  {label}: {fg} or {bg} missing from the palette')
            failures += 1
            continue
        ratio = contrast(colours[fg], colours[bg])
        ok = ratio >= needed
        failures += 0 if ok else 1
        print(f'  {"OK " if ok else "LOW"} {label:24} {ratio:5.2f}:1  (needs {needed})')

print(f'\n{failures} failing pair(s)')
raise SystemExit(1 if failures else 0)
