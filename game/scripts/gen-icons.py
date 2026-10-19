"""Kickborn app icons from the key art (build-resources/icon-art.png, 1024x1024: a player running at a
ball on the penalty spot under night floodlights). Writes every icon the iOS app, Android app, PWA,
Electron build and marketing site use. Run: npm run icons   (Python 3 + Pillow + numpy)

Crops:
  square  the art as it is, full bleed (iOS rounds the corners itself; apple-touch-icon, site marks)
  round   the art at 88% about the subject; the margin is the art's own edges stretched and blurred,
          so player and ball sit well inside an inscribed circle (Android legacy, PWA, Electron)
  small   a tighter crop with more contrast, for 16-48 px (favicons, smallest PWA icon)
Android adaptive: background = the stretched, blurred art; foreground = the sharp art (feathered edge)
sized so the subject sits inside the 72 dp visible area of the 108 dp layer.

python scripts/gen-icons.py [preview_dir]   also writes square/circle previews at 1024/180/64/32.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

GAME = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
REPO = os.path.dirname(GAME)
art = Image.open(os.path.join(GAME, 'build-resources', 'icon-art.png')).convert('RGB').resize((1024, 1024), Image.LANCZOS)
W = 1024
CX, CY = 515, 512  # subject centre: head top ~55, ball bottom ~965, hands ~255..790
ROUND_SCALE, MASKABLE_SCALE = 0.88, 0.84
ADAPTIVE_SCALE = ROUND_SCALE * 72 / 108


def feather(size, border):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rectangle([border, border, size[0] - 1 - border, size[1] - 1 - border], fill=255)
    return m.filter(ImageFilter.GaussianBlur(border / 2))


def layers(scale, canvas):
    """(background RGB, foreground RGBA): the art scaled to `scale` of the canvas about the subject."""
    s = round(canvas * scale)
    small = np.asarray(art.resize((s, s), Image.LANCZOS))
    x = round(canvas / 2 - CX * s / W)
    y = round(canvas / 2 - CY * s / W)
    ext = np.pad(small, ((y, canvas - s - y), (x, canvas - s - x), (0, 0)), mode='edge')
    bg = Image.fromarray(ext).filter(ImageFilter.GaussianBlur(18 * canvas / 1024))
    bg = ImageEnhance.Brightness(bg).enhance(0.92)
    fg = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    fg.paste(Image.fromarray(small).convert('RGBA'), (x, y), feather((s, s), max(1, round(s * 0.05))))
    return bg, fg


def padded(scale, canvas=1024):
    bg, fg = layers(scale, canvas)
    return Image.alpha_composite(bg.convert('RGBA'), fg).convert('RGB')


def small_crop():
    im = art.crop((60, 36, 60 + 930, 36 + 930))
    im = ImageEnhance.Contrast(im).enhance(1.15)
    return ImageEnhance.Color(im).enhance(1.12)


def fit(im, size):
    out = im.resize((size, size), Image.LANCZOS)
    if size <= 64:  # crisp edges at favicon sizes
        out = out.filter(ImageFilter.UnsharpMask(radius=0.8, percent=60, threshold=1))
    return out


def mask(size, shape):
    k = 4
    m = Image.new('L', (size * k, size * k), 0)
    d = ImageDraw.Draw(m)
    if shape == 'circle':
        d.ellipse([0, 0, size * k - 1, size * k - 1], fill=255)
    else:  # rounded square, roughly the iOS / Android legacy shape
        d.rounded_rectangle([0, 0, size * k - 1, size * k - 1], radius=round(size * k * 0.2237), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def masked(im, size, shape):
    out = fit(im, size).convert('RGBA')
    out.putalpha(mask(size, shape))
    return out


def save(im, path, mode=None):
    path = os.path.join(REPO, path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    (im.convert(mode) if mode else im).save(path, optimize=True)
    print('  ', os.path.relpath(path, REPO).replace('\\', '/'), im.size)


def adaptive_visible(canvas=1024):
    """What a launcher shows of the adaptive icon: the middle 72 of 108 dp."""
    full = canvas * 108 // 72
    bg, fg = layers(ADAPTIVE_SCALE, full)
    o = (full - canvas) // 2
    return Image.alpha_composite(bg.convert('RGBA'), fg).convert('RGB').crop((o, o, o + canvas, o + canvas))


square, round_, maskable, small = art, padded(ROUND_SCALE), padded(MASKABLE_SCALE), small_crop()

# iOS: one 1024 universal icon, opaque
save(fit(square, 1024), 'game/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 'RGB')

# Android: legacy square/round mipmaps + adaptive layers (108 dp; 72 dp visible)
RES = 'game/android/app/src/main/res'
for dens, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    save(masked(round_, px, 'square'), f'{RES}/mipmap-{dens}/ic_launcher.png')
    save(masked(round_, px, 'circle'), f'{RES}/mipmap-{dens}/ic_launcher_round.png')
    full = px * 108 // 48
    bg, fg = layers(ADAPTIVE_SCALE, full * 2)
    save(bg.resize((full, full), Image.LANCZOS), f'{RES}/mipmap-{dens}/ic_launcher_background.png', 'RGB')
    save(fg.resize((full, full), Image.LANCZOS), f'{RES}/mipmap-{dens}/ic_launcher_foreground.png')

# Splash screens (Android drawable*/splash.png, iOS Splash.imageset): every file keeps its size; the
# rounded-square icon centred on night navy at 36% of the short side.
NAVY = (11, 18, 32)
splashes = [os.path.join(RES, d, 'splash.png') for d in sorted(os.listdir(os.path.join(REPO, RES))) if d.startswith('drawable')]
splashes += [f'game/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732{x}.png' for x in ['', '-1', '-2']]
for f in splashes:
    if not os.path.exists(os.path.join(REPO, f)):
        continue
    w, h = Image.open(os.path.join(REPO, f)).size
    s = round(min(w, h) * 0.36)
    out = Image.new('RGB', (w, h), NAVY)
    icon = masked(round_, s, 'square')
    out.paste(icon, ((w - s) // 2, (h - s) // 2), icon)
    save(out, f)

# PWA (game/public): "any" icons full bleed and opaque; maskable inside the 80% safe circle
for s in [48, 72, 96, 128, 144, 192, 256, 384, 512]:
    save(fit(small if s <= 48 else round_, s), f'game/public/icons/icon-{s}.png', 'RGB')
for s in [192, 512]:
    save(fit(maskable, s), f'game/public/icons/maskable-{s}.png', 'RGB')
save(fit(square, 180), 'game/public/icons/apple-touch-icon.png', 'RGB')
save(fit(small, 32), 'game/public/favicon.png', 'RGB')
fit(small, 48).save(os.path.join(GAME, 'public', 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
print('   game/public/favicon.ico 16/32/48')

# Electron
save(masked(round_, 1024, 'square'), 'game/build-resources/icon.png')
save(fit(square, 1024), 'game/build-resources/icon-bleed.png', 'RGB')
save(layers(ADAPTIVE_SCALE, 1024)[1], 'game/build-resources/icon-foreground.png')

# Marketing site marks (square, opaque)
save(fit(small, 96), 'site/public/media/brand/mark-96.png', 'RGB')
for s in [180, 192, 512]:
    save(fit(square, s), f'site/public/media/brand/mark-{s}.png', 'RGB')

# Previews: each source at 1024/180/64/32 in a square and a circle mask on grey; 64 and 32 are also
# enlarged x4 (nearest neighbour) so their pixels can be judged. Plus one contact sheet.
if len(sys.argv) > 1:
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    sources = {'square': square, 'round': round_, 'adaptive-visible': adaptive_visible(),
               'maskable': maskable, 'small': small}
    for name, src in sources.items():
        for s in [1024, 180, 64, 32]:
            for shape in ['square', 'circle']:
                im = masked(src, s, shape)
                if s < 180:
                    im = im.resize((s * 4, s * 4), Image.NEAREST)
                sheet = Image.new('RGB', im.size, (128, 128, 128))
                sheet.paste(im, (0, 0), im)
                sheet.save(os.path.join(out, f'{name}-{s}-{shape}.png'))
    rows = ['square', 'round', 'adaptive-visible', 'small']
    sheet = Image.new('RGB', (6 * 200 + 20, len(rows) * 200 + 20), (60, 64, 72))
    for r, name in enumerate(rows):
        c = 0
        for shape in ['square', 'circle']:
            for s in [180, 64, 32]:
                im = masked(sources[name], s, shape)
                sheet.paste(im, (10 + c * 200, 10 + r * 200), im)
                c += 1
    sheet.save(os.path.join(out, 'contact-sheet.png'))
    print('previews in', out)
