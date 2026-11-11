"""List smooth vector contour lines inside a map region, to choose lines for labels.

Usage, from topo/: python3 tools/find_lines.py x0 y0 x1 y1 preview.png
"""
import json
import re
import sys

import numpy as np
from PIL import Image, ImageDraw


def load_lines(path="../www/contours-data.js", kinds=("coast", "index")):
    """Decode contour lines of the given kinds; returns arrays of points with .level and .kind set via LINE_INFO."""
    groups = json.loads(re.search(r"const CONTOURS = (.*);", open(path).read()).group(1))
    lines = []
    LINE_INFO.clear()
    for group in groups:
        if group["kind"] not in kinds:
            continue
        for enc in group["lines"]:
            v = np.array(list(map(int, enc.split(","))), dtype=float).reshape(-1, 2)
            LINE_INFO.append((group["level"], group["kind"]))
            lines.append(np.cumsum(v, axis=0) / 10)
    return lines


LINE_INFO = []


def gentlest_span(p, span):
    seg = np.linalg.norm(np.diff(p, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    d = np.diff(p, axis=0)
    turn = np.abs(np.diff(np.unwrap(np.arctan2(d[:, 1], d[:, 0]))))
    best = (np.inf, 0.5)
    for c in np.linspace(span / 2, cum[-1] - span / 2, 40):
        mask = (cum[1:-1] > c - span / 2) & (cum[1:-1] < c + span / 2)
        best = min(best, (turn[mask].sum(), c / cum[-1]))
    return best, cum[-1]


if __name__ == "__main__":
    x0, y0, x1, y1 = map(float, sys.argv[1:5])
    lines = load_lines()
    found = []
    for i, p in enumerate(lines):
        inside = (p[:, 0] >= x0) & (p[:, 0] <= x1) & (p[:, 1] >= y0) & (p[:, 1] <= y1)
        if inside.mean() < 0.8:
            continue
        (turn, at), length = gentlest_span(p, 60) if len(p) > 3 else ((0, 0.5), 0)
        if length < 70:
            continue
        found.append((turn, i, length, at))
    found.sort()
    scale = 4
    img = Image.new("RGB", (int((x1 - x0) * scale), int((y1 - y0) * scale)), "white")
    d = ImageDraw.Draw(img)
    chosen = {i for _, i, _, _ in found[:20]}
    for i, p in enumerate(lines):
        pts = [((x - x0) * scale, (y - y0) * scale) for x, y in p]
        d.line(pts, fill=(220, 40, 40) if i in chosen else (40, 40, 40), width=3 if i in chosen else 1)
    for turn, i, length, at in found[:20]:
        p = lines[i]
        mid = p[len(p) // 2]
        d.text(((mid[0] - x0) * scale + 4, (mid[1] - y0) * scale - 14), str(i), fill=(30, 80, 230))
        print(f"line {i:5d}  length {length:6.1f}  turning {turn:5.2f}  from {p[0].round()} to {p[-1].round()}")
    img.save(sys.argv[5])
