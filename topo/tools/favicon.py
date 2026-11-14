"""Crop a small square of the contour map as the site favicon (SVG, plus PNG fallbacks).

Usage, from topo/: python3 tools/favicon.py ../www
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from find_lines import LINE_INFO, load_lines

CENTRE = (1505, 1040)
SIZE = 30
EVERY = 100
STROKE = 1.6


def chaikin(p, rounds=3):
    """Round off the corners of an open polyline."""
    for _ in range(rounds):
        a, b = p[:-1], p[1:]
        mid = np.empty((2 * len(a), 2))
        mid[0::2], mid[1::2] = 0.75 * a + 0.25 * b, 0.25 * a + 0.75 * b
        p = np.vstack([p[:1], mid, p[-1:]])
    return p


def snapshot():
    """Pieces of every EVERY-metre contour inside the window, in 0-32 favicon units."""
    lines = load_lines(kinds=("index", "mid", "minor"))
    origin = np.array(CENTRE) - SIZE / 2
    pieces = []
    for p, (level, _) in zip(lines, LINE_INFO):
        if level == 0 or level % EVERY:
            continue
        q = (p - origin) * 32 / SIZE
        inside = np.flatnonzero(((q > -3) & (q < 35)).all(axis=1))
        for run in np.split(inside, np.flatnonzero(np.diff(inside) > 1) + 1) if len(inside) else []:
            if len(run) > 1:
                pieces.append(chaikin(q[run]))
    return pieces


def svg(lines):
    paths = "".join(f'<path d="M{" L".join(f"{x:.1f} {y:.1f}" for x, y in q)}"/>' for q in lines)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
        "<style>g{stroke:#141414}@media (prefers-color-scheme:dark){g{stroke:#fff}}</style>"
        f'<g fill="none" stroke-width="{STROKE}" stroke-linejoin="round" stroke-linecap="round">{paths}</g></svg>\n'
    )


def png(lines, size, background=None):
    scale = 8
    img = Image.new("RGBA", (size * scale, size * scale), background or (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    k = size * scale / 32
    for q in lines:
        draw.line([(x * k, y * k) for x, y in q], fill=(20, 20, 20, 255), width=round(STROKE * k), joint="curve")
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    out = Path(sys.argv[1])
    lines = snapshot()
    (out / "favicon.svg").write_text(svg(lines))
    png(lines, 32).save(out / "favicon.png")
    png(lines, 180, (255, 255, 255, 255)).convert("RGB").save(out / "apple-touch-icon.png")
    print(f"{len(lines)} contour pieces at {EVERY} m in a {SIZE}-unit square around {CENTRE}")
