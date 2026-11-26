"""Build the TMC++ logo files from one set of construction rules.

Run:  python design/logo/build.py      (writes SVGs into design/logo/kit/svg)

Construction (units are the mark's own; the tile scales them to fit):
  - x-height 104..168, so the wave's midline is y = 136 and its amplitude is 32.
  - The m is y = 136 + 32*cos(2*pi*x/64): two full periods starting at the y-axis,
    so it begins and ends on the baseline. The red point sits on its last trough.
  - The grid pitch is 32 (half a period): every peak and trough lands on a grid line,
    and the thick axes cross at the wave's start, with the x-axis on its midline.
  - T: stroke 26, bar 64 wide. m and c: stroke 20. The c's corners are 45-degree cuts.
"""
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "kit", "svg")

NAVY = "#1d3557"
GRID = "#28497a"
AXIS = "#4f74a8"
WHITE = "#ffffff"
RED = "#e63946"
ORANGE = "#f4a259"

CT, XH, BASE = 64, 104, 168
MID, AMP, P = 136, 32, 64
X0 = 86  # y-axis: where the wave starts


def plus(cx, cy, a, w, col):
    return (f'<path d="M{cx - a:g} {cy:g}H{cx + a:g}M{cx:g} {cy - a:g}V{cy + a:g}" stroke="{col}" '
            f'stroke-width="{w:g}" stroke-linecap="square" fill="none"/>')


def letters(ink, red, orange, plus_pos="below", s=20, st=26):
    """Return (svg fragment, bbox dict). plus_pos: 'below', 'inline' or None."""
    t = f"M22 {CT + st / 2:g}H86M54 {CT}V{BASE + s / 2:g}"
    # Two periods of the cosine as 8 cubic Beziers, one per quarter period, with exact
    # end slopes (Hermite form). Max error is well under 1% of the amplitude.
    def y(x):
        return MID + AMP * math.cos(2 * math.pi * (x - X0) / P)

    def dy(x):
        return -AMP * 2 * math.pi / P * math.sin(2 * math.pi * (x - X0) / P)

    h = P / 4
    wave = f"M{X0} {y(X0):g}"
    for k in range(8):
        a, b = X0 + k * h, X0 + (k + 1) * h
        wave += (f"C{a + h / 3:.2f} {y(a) + h / 3 * dy(a):.2f} {b - h / 3:.2f} {y(b) - h / 3 * dy(b):.2f} "
                 f"{b:g} {y(b):.2f}")
    ex, ey = X0 + 2 * P, BASE
    cl = ex + 13 + 12 + s / 2
    cw, ch = 46, 16
    cr = cl + cw
    c = f"M{cr:g} {XH}H{cl + ch:g}L{cl:g} {XH + ch}V{BASE - ch}L{cl + ch:g} {BASE}H{cr:g}"
    g = (f'<path d="{t}" fill="none" stroke="{ink}" stroke-width="{st}" stroke-linecap="butt"/>'
         f'<path d="{c}" fill="none" stroke="{ink}" stroke-width="{s}" stroke-linecap="butt" stroke-linejoin="miter"/>'
         f'<path d="{wave}" fill="none" stroke="{ink}" stroke-width="{s}" stroke-linecap="butt"/>'
         f'<circle cx="{ex}" cy="{ey}" r="13" fill="{red}"/>')
    left, right, top, bottom = 22, cr + s / 2, CT, BASE + s / 2
    cx = (left + right) / 2
    a, w, gap = 17, 14, 56  # ++: arm length, stroke, centre-to-centre distance
    if plus_pos == "below":
        py = BASE + s / 2 + 22 + a
        g += plus(cx - gap / 2, py, a, w, orange) + plus(cx + gap / 2, py, a, w, orange)
        bottom = py + a + w / 2
    elif plus_pos == "inline":
        px = right + 22 + a + w / 2
        g += plus(px, MID, a, w, orange) + plus(px + gap, MID, a, w, orange)
        right = px + gap + a + w / 2
    return g, dict(left=left, right=right, top=top, bottom=bottom)


def grid():
    lines = "".join(f"M{X0 + k * P / 2:g} -400V700" for k in range(-12, 14) if k)
    lines += "".join(f"M-400 {MID + k * P / 2:g}H700" for k in range(-10, 10) if k)
    return (f'<path d="{lines}" stroke="{GRID}" stroke-width="2.5" fill="none"/>'
            f'<path d="M{X0} -400V700M-400 {MID}H700" stroke="{AXIS}" stroke-width="5" fill="none"/>')


def head(w, h, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
            f'role="img" aria-label="{title}"><title>{title}</title>\n')


def icon(small=False, title="TMC++"):
    """App icon: navy tile. small=True drops the grid and thickens strokes for 16-32 px."""
    if small:
        g, b = letters(WHITE, RED, ORANGE, plus_pos="below", s=24, st=30)
        fit, cy_t = 216, 128
    else:
        g, b = letters(WHITE, RED, ORANGE, plus_pos="below")
        fit, cy_t = 196, 124
    sc = fit / (b["right"] - b["left"])
    tr = (f'translate(128 {cy_t}) scale({sc:.4f}) '
          f'translate({-(b["left"] + b["right"]) / 2:.2f} {-(b["top"] + b["bottom"]) / 2:.2f})')
    bg = "" if small else f'<g transform="{tr}">{grid()}</g>'
    return (head(256, 256, title) +
            '<clipPath id="tile"><rect width="256" height="256" rx="56"/></clipPath>\n'
            f'<g clip-path="url(#tile)"><rect width="256" height="256" fill="{NAVY}"/>{bg}</g>\n'
            f'<g transform="{tr}">{g}</g>\n</svg>\n')


def wordmark(ink, red, orange, plus_pos, title="TMC++"):
    """Tile-less mark, cropped tight with a small margin. Height normalised to 256."""
    g, b = letters(ink, red, orange, plus_pos=plus_pos)
    pad = 12
    w, h = b["right"] - b["left"] + 2 * pad, b["bottom"] - b["top"] + 2 * pad
    sc = 256 / h
    return (head(round(w * sc), 256, title) +
            f'<g transform="scale({sc:.4f}) translate({pad - b["left"]:g} {pad - b["top"]:g})">{g}</g>\n</svg>\n')


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {
        "tmcpp-icon.svg": icon(),
        "tmcpp-icon-small.svg": icon(small=True),
        # wordmarks: on light backgrounds (navy), on dark backgrounds (white), and one-colour
        "tmcpp-wordmark.svg": wordmark(NAVY, RED, ORANGE, "inline"),
        "tmcpp-wordmark-reversed.svg": wordmark(WHITE, RED, ORANGE, "inline"),
        "tmcpp-wordmark-black.svg": wordmark("#000000", "#000000", "#000000", "inline"),
        "tmcpp-wordmark-white.svg": wordmark(WHITE, WHITE, WHITE, "inline"),
        "tmcpp-stacked.svg": wordmark(NAVY, RED, ORANGE, "below"),
        "tmcpp-stacked-reversed.svg": wordmark(WHITE, RED, ORANGE, "below"),
        "tmcpp-stacked-black.svg": wordmark("#000000", "#000000", "#000000", "below"),
        "tmcpp-stacked-white.svg": wordmark(WHITE, WHITE, WHITE, "below"),
    }
    for name, text in files.items():
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
            f.write(text)
        print("wrote", os.path.relpath(os.path.join(OUT, name)))


if __name__ == "__main__":
    main()
