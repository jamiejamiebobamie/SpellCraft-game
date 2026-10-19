# recolor-clock-body.py
# Brightens the clock body's base color and adjusts its highlights separately, from the untouched
# original (art/clock/Clock-body.original.png), writing public/background-scene/Clock/Clock-body.png.
# Needs Pillow. Run from the repo root:
#   python scripts/recolor-clock-body.py                     (the settings below)
#   python scripts/recolor-clock-body.py --preview out.png   (also a before/after preview, as in the game)
#
# The highlights are found by brightness: pixels brighter than most of the body. Each pixel is part
# base, part highlight (blending smoothly between HIGHLIGHT_FROM and HIGHLIGHT_TO), so edges stay soft.
import argparse
import colorsys
from PIL import Image

SOURCE = 'art/clock/Clock-body.original.png'
OUTPUT = 'public/background-scene/Clock/Clock-body.png'

SETTINGS = {
    # The base (everything that isn't a highlight)
    'base_brightness': 1.6,  # 1 = as is
    'base_saturation': 0.85,  # 1 = as is (the original is very saturated)
    # Which parts count as highlights: brightness percentiles of the body (0-100); in between, partly
    'highlight_from': 80,
    'highlight_to': 97,
    # The highlights
    'highlight_brightness': 1.6,
    'highlight_saturation': 1.0,
    'highlight_hue': None,  # e.g. 110 for the candles' green; None keeps their own color
    'highlight_hue_amount': 0.0,  # how far toward highlight_hue (0 to 1)
}

# In the game the clock is shown through CSS brightness(0.8) (the scene's 0.4 x 2; ClockFaceComponent)
GAME_BRIGHTNESS = 0.8


def luminance(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def recolor(image, s):
    pixels = image.load()
    opaque = [luminance(*image.getpixel((x, y))[:3]) for y in range(image.height) for x in range(image.width) if image.getpixel((x, y))[3] > 200]
    opaque.sort()
    low = opaque[int(len(opaque) * s['highlight_from'] / 100)]
    high = opaque[min(len(opaque) - 1, int(len(opaque) * s['highlight_to'] / 100))]

    out = image.copy()
    out_pixels = out.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            h, sat, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            t = min(1, max(0, (luminance(r, g, b) - low) / ((high - low) or 1)))
            t = t * t * (3 - 2 * t)  # smooth

            base = (h, sat * s['base_saturation'], v * s['base_brightness'])
            hh = h
            if s['highlight_hue'] is not None:
                target = s['highlight_hue'] / 360
                diff = ((target - h + 0.5) % 1) - 0.5  # the short way around the color wheel
                hh = (h + diff * s['highlight_hue_amount']) % 1
            highlight = (hh, sat * s['highlight_saturation'], v * s['highlight_brightness'])

            # Blend the two (hue the short way around)
            hue_diff = ((highlight[0] - base[0] + 0.5) % 1) - 0.5
            blended = ((base[0] + hue_diff * t) % 1, base[1] + (highlight[1] - base[1]) * t, base[2] + (highlight[2] - base[2]) * t)
            rr, gg, bb = colorsys.hsv_to_rgb(blended[0], min(1, blended[1]), min(1, blended[2]))
            out_pixels[x, y] = (round(rr * 255), round(gg * 255), round(bb * 255), a)
    return out


# Ivory / pearl: the wood's shading on an ivory palette, with a faint pearly shimmer
PEARL = {
    'light': (240, 232, 214),  # ivory where the original is brightest
    'dark': (58, 50, 40),  # where it's darkest
    'lift': 0.25,  # brightens the shading overall (0 to 1): the original is very dark
    'sheen': 0.10,  # the pearly tint's strength (0: plain ivory)
    'sheen_scale': 90,  # the shimmer's size, in pixels
}


def pearl(image, p=PEARL):
    """The wood (gold-hued, saturated pixels; not the glass) as ivory, with a pearly sheen."""
    import math
    pixels = image.load()
    wood = [(x, y) for y in range(image.height) for x in range(image.width)
            if pixels[x, y][3] > 0 and is_wood(*pixels[x, y][:3])]
    lums = sorted(luminance(*pixels[x, y][:3]) for x, y in wood)
    low, high = lums[int(len(lums) * 0.02)], lums[int(len(lums) * 0.995)]
    out = image.copy()
    out_pixels = out.load()
    for x, y in wood:
        r, g, b, a = pixels[x, y]
        t = min(1, max(0, (luminance(r, g, b) - low) / ((high - low) or 1)))
        t = t ** (1 - p['lift'] * 0.7)  # lift the shadows
        color = [p['dark'][k] + (p['light'][k] - p['dark'][k]) * t for k in range(3)]
        # The pearly shimmer: pastel hues drifting across the surface, stronger in the lighter areas
        phase = (x + 0.6 * y) / p['sheen_scale'] + t * 1.5
        tint = colorsys.hsv_to_rgb((phase % 1), 0.35, 1)
        strength = p['sheen'] * (0.3 + 0.7 * t)
        color = [c * (1 - strength) + tint[k] * 255 * strength for k, c in enumerate(color)]
        out_pixels[x, y] = tuple(round(min(255, c)) for c in color) + (a,)
    return out


def is_wood(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return 0.04 < h < 0.20 and s > 0.4  # the gold-brown wood (the glass is a low-saturation gray-green)


def as_in_game(image, backdrop=(18, 18, 22)):
    """The image over a dark backdrop, at the game's brightness, enlarged 2x."""
    canvas = Image.new('RGBA', image.size, backdrop + (255,))
    canvas.alpha_composite(image)
    dimmed = canvas.convert('RGB').point(lambda c: round(c * GAME_BRIGHTNESS))
    return dimmed.resize((image.width * 2, image.height * 2), Image.LANCZOS)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--preview', help='also save a before/after preview here')
    args = parser.parse_args()

    original = Image.open(SOURCE).convert('RGBA')
    result = recolor(original, SETTINGS)
    result.save(OUTPUT)
    print('wrote', OUTPUT)
    if args.preview:
        before, after = as_in_game(original), as_in_game(result)
        preview = Image.new('RGB', (before.width * 2 + 20, before.height), (60, 60, 60))
        preview.paste(before, (0, 0))
        preview.paste(after, (before.width + 20, 0))
        preview.save(args.preview)
        print('preview', args.preview)
