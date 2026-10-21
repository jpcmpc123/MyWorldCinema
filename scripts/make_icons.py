"""Gera os icones PNG do PWA (globo MyWorld) a partir do desenho do favicon."""
import math
from PIL import Image, ImageDraw

BG = (20, 24, 28, 255)  # #14181c
GREEN = (0, 224, 84)
BLUE = (64, 188, 244)
DEEP = (44, 127, 184)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def globe_color(u, v):
    # gradiente diagonal: verde -> azul -> azul profundo
    t = (u + v) / 2
    return lerp(GREEN, BLUE, t / 0.55) if t < 0.55 else lerp(BLUE, DEEP, (t - 0.55) / 0.45)


def make_icon(size, maskable, path):
    scale = 4  # supersampling p/ antialiasing
    S = size * scale
    img = Image.new("RGBA", (S, S), BG if maskable else (0, 0, 0, 0))
    if not maskable:
        # fundo arredondado
        d = ImageDraw.Draw(img)
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.18), fill=BG)
    R = S * (0.66 if maskable else 0.81) / 2  # maskable: safe zone maior
    cx = cy = S / 2
    px = img.load()
    for y in range(S):
        for x in range(S):
            dx, dy = (x - cx) / R, (y - cy) / R
            r2 = dx * dx + dy * dy
            if r2 > 1:
                continue
            u, v = dx * 0.5 + 0.5, dy * 0.5 + 0.5
            col = globe_color(u, v)
            # linhas do globo (meridiano central + equador + paralelos)
            line = False
            if abs(dx) < 0.06 or abs(dy) < 0.045 or abs(abs(dy) - 0.55) < 0.045:
                line = True
            # elipse horizontal do meridiano: largura varia com y
            w = 0.46 * math.sqrt(max(0.0, 1 - dy * dy))
            if w > 0 and abs(abs(dx) - w) < 0.05:
                line = True
            if line:
                col = lerp(col, BG[:3], 0.35)
            # brilho
            sx, sy = (x - cx + R * 0.35) / (R * 0.32), (y - cy + R * 0.42) / (R * 0.2)
            e = math.exp(-(sx * sx + sy * sy))
            col = lerp(col, (255, 255, 255), min(0.25, e * 0.25))
            px[x, y] = (*col, 255)
    img = img.resize((size, size), Image.LANCZOS)
    img.save(path)
    print("ok", path)


make_icon(192, False, "public/icons/icon-192.png")
make_icon(512, False, "public/icons/icon-512.png")
make_icon(512, True, "public/icons/icon-512-maskable.png")
