"""Store screenshots in the existing Kickborn style (KICKBORN/Kickborn-Store): logo, a two-line
headline (white / green) and the game screen in a phone or tablet frame on the night-pitch
background. Screens come from the mock career (game dev server ?mock=1&dev=<screen>, captured per
language by capture_screens.mjs).

  python scripts/store-screenshots.py <captures dir> <out dir> [lang…]

Writes <out>/<device>/<lang>/NN.png: iPhone 6.9" 1320x2868 and iPad 13" 2064x2752.
"""
import os
import sys

from fontTools.merge import Merger
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FS = os.path.join(ROOT, 'game', 'node_modules', '@fontsource', 'barlow-condensed', 'files')
ICON = os.path.join(ROOT, 'game', 'public', 'icons', 'icon-512.png')
WHITE, GREEN, INK = (242, 245, 250), (31, 212, 122), (7, 11, 20)
SCREENS = ['liveMatch', 'home', 'contract', 'profile', 'life', 'postMatch', 'seasonEnd', 'world']
CAPTIONS = {
    'en': [('PLAY THE', 'KEY MOMENTS'), ('PLAN YOUR', 'CAREER'), ('WIN THE', 'NEGOTIATION'), ('GROW YOUR', 'TALENT'),
           ('LIFE OFF', 'THE PITCH'), ('EVERY MATCH', 'COUNTS'), ('YOUR SEASON', 'STORY'), ('A WHOLE', 'FOOTBALL WORLD')],
    'es': [('JUEGA LOS', 'MOMENTOS CLAVE'), ('PLANIFICA TU', 'CARRERA'), ('GANA LA', 'NEGOCIACIÓN'), ('DESARROLLA TU', 'TALENTO'),
           ('LA VIDA FUERA', 'DEL CAMPO'), ('CADA PARTIDO', 'CUENTA'), ('LA HISTORIA DE', 'TU TEMPORADA'), ('TODO UN MUNDO', 'DE FÚTBOL')],
    'pt': [('JOGUE OS', 'MOMENTOS DECISIVOS'), ('PLANEJE SUA', 'CARREIRA'), ('VENÇA A', 'NEGOCIAÇÃO'), ('DESENVOLVA SEU', 'TALENTO'),
           ('A VIDA FORA', 'DE CAMPO'), ('CADA PARTIDA', 'CONTA'), ('A HISTÓRIA DA', 'SUA TEMPORADA'), ('UM MUNDO INTEIRO', 'DE FUTEBOL')],
    'de': [('SPIEL DIE', 'SCHLÜSSELMOMENTE'), ('PLANE DEINE', 'KARRIERE'), ('GEWINN DIE', 'VERHANDLUNG'), ('ENTWICKLE DEIN', 'TALENT'),
           ('DAS LEBEN NEBEN', 'DEM PLATZ'), ('JEDES SPIEL', 'ZÄHLT'), ('DIE GESCHICHTE', 'DEINER SAISON'), ('EINE GANZE', 'FUSSBALLWELT')],
    'fr': [('JOUE LES', 'MOMENTS CLÉS'), ('PLANIFIE TA', 'CARRIÈRE'), ('REMPORTE LA', 'NÉGOCIATION'), ('DÉVELOPPE TON', 'TALENT'),
           ('LA VIE EN DEHORS', 'DU TERRAIN'), ('CHAQUE MATCH', 'COMPTE'), ("L'HISTOIRE DE", 'TA SAISON'), ('TOUT UN MONDE', 'DE FOOTBALL')],
    'it': [('GIOCA I', 'MOMENTI CHIAVE'), ('PIANIFICA LA TUA', 'CARRIERA'), ('VINCI LA', 'TRATTATIVA'), ('SVILUPPA IL TUO', 'TALENTO'),
           ('LA VITA FUORI', 'DAL CAMPO'), ('OGNI PARTITA', 'CONTA'), ('LA STORIA DELLA', 'TUA STAGIONE'), ('UN INTERO MONDO', 'DI CALCIO')],
    'id': [('MAINKAN MOMEN', 'PENTINGNYA'), ('RENCANAKAN', 'KARIERMU'), ('MENANGKAN', 'NEGOSIASI'), ('KEMBANGKAN', 'BAKATMU'),
           ('HIDUP DI LUAR', 'LAPANGAN'), ('SETIAP LAGA', 'BERARTI'), ('KISAH', 'MUSIMMU'), ('SATU DUNIA', 'SEPAK BOLA')],
}
# Capture locale folder per language (capture_screens.mjs names folders by browser locale).
CAPTURE = {'en': 'en-US', 'es': 'es-ES', 'pt': 'pt-BR', 'de': 'de-DE', 'fr': 'fr-FR', 'it': 'it-IT', 'id': 'id-ID'}
DEVICES = {
    # canvas, frame box (x, y, w), corner radius, bezel, capture subfolder
    'ios-iphone-69': ((1320, 2868), (105, 640, 1110), 140, 30, 'phone'),
    'ios-ipad-13': ((2064, 2752), (232, 700, 1600), 90, 34, 'tablet'),
}


def font(size, _cache={}):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.barlow800.ttf')
    if not os.path.exists(path):
        parts = []
        for s in ('latin', 'latin-ext'):
            f = TTFont(os.path.join(FS, f'barlow-condensed-{s}-800-normal.woff'))
            f.flavor = None
            p = path + f'.{s}.ttf'
            f.save(p)
            parts.append(p)
        Merger().merge(parts).save(path)
    if size not in _cache:
        _cache[size] = ImageFont.truetype(path, size)
    return _cache[size]


def background(w, h):
    img = Image.new('RGB', (w, h), (12, 22, 34))
    glow = Image.new('L', (w, h), 0)
    ImageDraw.Draw(glow).ellipse((-w * 0.2, h * 0.08, w * 1.2, h * 0.75), fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(w * 0.18))
    img.paste(Image.new('RGB', (w, h), (20, 92, 62)), (0, 0), glow)
    d = ImageDraw.Draw(img)
    line = (34, 70, 62)
    d.rectangle((w * 0.2, -10, w * 0.8, h * 0.17), outline=line, width=3)  # penalty box
    d.line((0, h * 0.53, w, h * 0.53), fill=line, width=3)  # halfway line
    return img


def headline(d, w, top, a, b, max_w):
    size = int(w * 0.125)
    while size > 40 and max(d.textlength(a, font=font(size)), d.textlength(b, font=font(size))) > max_w:
        size -= 4
    f = font(size)
    for i, (t, c) in enumerate(((a, WHITE), (b, GREEN))):
        d.text(((w - d.textlength(t, font=f)) / 2, top + i * size * 0.98), t, font=f, fill=c)


def compose(screen_png, lang, i, device):
    (w, h), (fx, fy, fw), radius, bezel, _ = DEVICES[device]
    img = background(w, h)
    d = ImageDraw.Draw(img)
    # logo row: icon + spaced wordmark
    icon = Image.open(ICON).convert('RGBA').resize((int(w * 0.048),) * 2, Image.LANCZOS)
    mark = 'K I C K B O R N'
    mf = font(int(w * 0.03))
    tw = d.textlength(mark, font=mf)
    x0 = (w - icon.width - 18 - tw) / 2
    img.paste(icon, (int(x0), int(h * 0.05)), icon)
    d.text((x0 + icon.width + 18, h * 0.05 + (icon.height - mf.size) / 2 - 4), mark, font=mf, fill=(200, 210, 222))
    a, b = CAPTIONS[lang][i]
    headline(d, w, h * 0.078, a, b, w * 0.9)
    # device frame running off the bottom edge
    shot = Image.open(screen_png).convert('RGB')
    sw = fw - 2 * bezel
    shot = shot.resize((sw, int(shot.height * sw / shot.width)), Image.LANCZOS)
    fh = h - fy + radius
    frame = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    fd.rounded_rectangle((0, 0, fw - 1, fh - 1), radius, fill=(10, 14, 22), outline=(58, 70, 92), width=4)
    mask = Image.new('L', (sw, min(shot.height, fh - bezel)), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, mask.width - 1, mask.height + radius), radius - bezel, fill=255)
    frame.paste(shot.crop((0, 0, mask.width, mask.height)), (bezel, bezel), mask)
    shadow = Image.new('L', (w, h), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((fx, fy + 30, fx + fw, h + radius), radius, fill=150)
    img.paste(Image.new('RGB', (w, h), (0, 0, 0)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(40)))
    img.paste(frame, (fx, fy), frame)
    return img


def main():
    cap, out, *langs = sys.argv[1:]
    for lang in langs or [l for l in CAPTIONS if l != 'en']:
        for device, spec in DEVICES.items():
            os.makedirs(os.path.join(out, device, lang), exist_ok=True)
            for i, sc in enumerate(SCREENS):
                src = os.path.join(cap, CAPTURE[lang], spec[4], f'{sc}.png')
                compose(src, lang, i, device).save(os.path.join(out, device, lang, f'{i + 1:02d}.png'), optimize=True)
        print('composed', lang)


if __name__ == '__main__':
    main()
