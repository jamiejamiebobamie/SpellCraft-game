# Makes the site's icons from a mask image: trims it to the mask, centers it in a square with a
# small margin, and writes favicon.ico (16/32/48), favicon-32.png, apple-touch-icon.png (180, on
# black, since iOS fills transparency with black anyway), and, if the source is large enough,
# icon-192.png and icon-512.png (needs Pillow). Run from the repo root:
#   python scripts/make-icons.py <the mask exported at 1024 px or more>.png public
import sys
from PIL import Image

source, public = sys.argv[1], sys.argv[2]
mask = Image.open(source).convert('RGBA')
mask = mask.crop(mask.split()[-1].getbbox())
w, h = mask.size

def square(margin):
    side = int(max(w, h) * (1 + margin))
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(mask, ((side - w) // 2, (side - h) // 2), mask)
    return sq

tab = square(0.08)  # tab icons: fill as much as possible
tab.save(f'{public}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
tab.resize((32, 32), Image.LANCZOS).save(f'{public}/favicon-32.png')

home = square(0.35)  # home-screen icons: room for the rounded corners
apple = Image.new('RGBA', (180, 180), (0, 0, 0, 255))
apple.alpha_composite(home.resize((180, 180), Image.LANCZOS))
apple.convert('RGB').save(f'{public}/apple-touch-icon.png')

made = ['favicon.ico', 'favicon-32.png', 'apple-touch-icon.png']
if home.size[0] >= 512:
    for size in (192, 512):
        home.resize((size, size), Image.LANCZOS).save(f'{public}/icon-{size}.png')
        made.append(f'icon-{size}.png')
print(f'mask {w}x{h}; made', ', '.join(made), '' if home.size[0] >= 512 else '(skipped 192/512: source too small)')
