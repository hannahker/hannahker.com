"""Set labels along chosen vector contour lines, write labels.js, and render a preview.

Usage, from topo/: python3 tools/place_labels.py ../www/labels.js preview.png
Pick lines with tools/find_lines.py.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from find_lines import load_lines

LINE_KINDS = ("coast", "index", "mid")

LABELS = [
    dict(line=286, text="Hannah Ker", kind="name", size=10, at=0.9719, smooth=13),
    dict(line=502, text="About", kind="nav", size=7, at=0.1005, smooth=9, route="about"),
    dict(line=387, text="Selected Works", kind="nav", size=7, at=0.7178, smooth=9, route="works"),
]

PREVIEW_BOX = (1080, 20, 1260, 170)
PREVIEW_FONT = "/System/Library/Fonts/Helvetica.ttc"  # matches the page font


def oriented(p):
    return p[::-1] if p[0][0] > p[-1][0] else p


def smoothed(p, window=5):
    if len(p) <= window:
        return p
    kernel = np.ones(window) / window
    padded = np.pad(p, ((window // 2, window // 2), (0, 0)), mode="edge")
    out = np.column_stack([np.convolve(padded[:, i], kernel, mode="valid") for i in range(2)])
    out[0], out[-1] = p[0], p[-1]
    return out


def arc(p):
    return np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))])


def point(p, cum, s):
    return np.array([np.interp(s, cum, p[:, 0]), np.interp(s, cum, p[:, 1])])


def gentlest(p, cum, span):
    d = np.diff(p, axis=0)
    turn = np.abs(np.diff(np.unwrap(np.arctan2(d[:, 1], d[:, 0]))))
    centres = np.linspace(span / 2 + 1, cum[-1] - span / 2 - 1, 60)
    scores = [turn[(cum[1:-1] > c - span / 2) & (cum[1:-1] < c + span / 2)].sum() for c in centres]
    return centres[int(np.argmin(scores))] / cum[-1]


def main(out_js, out_preview):
    lines = load_lines(kinds=LINE_KINDS)
    scale = 4
    x0, y0, x1, y1 = PREVIEW_BOX
    img = Image.new("RGB", (int((x1 - x0) * scale), int((y1 - y0) * scale)), "white")
    draw = ImageDraw.Draw(img)
    for p in lines:
        draw.line([((x - x0) * scale, (y - y0) * scale) for x, y in p], fill=(20, 20, 20), width=2)

    out = []
    for label in LABELS:
        p = smoothed(oriented(lines[label["line"]]), label.get("smooth", 5))
        cum = arc(p)
        font = ImageFont.truetype(PREVIEW_FONT, int(label["size"] * scale))
        width = font.getlength(label["text"]) / scale
        if width > cum[-1]:
            print(f"WARNING: {label['text']!r} ({width:.0f}) is longer than line {label['line']} ({cum[-1]:.0f})")
        if "start_x" in label:
            start = float(np.interp(label["start_x"], p[:, 0], cum))
            at = round((start + width / 2) / cum[-1], 4)
        elif label.get("at") is not None:
            at = label["at"]
        else:
            at = round(float(gentlest(p, cum, width)), 3)
        out.append({k: v for k, v in label.items() if k not in ("line", "start_x", "smooth")} | {
            "at": at, "d": "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in p),
        })

        cursor = cum[-1] * at - width / 2
        for ch in label["text"]:
            adv = font.getlength(ch) / scale
            mid = cursor + adv / 2
            a, b = point(p, cum, mid - adv / 2), point(p, cum, mid + adv / 2)
            angle = np.degrees(np.arctan2(b[1] - a[1], b[0] - a[0]))
            glyph = Image.new("L", (int(adv * scale) + 10, int(label["size"] * scale * 1.5)), 0)
            ImageDraw.Draw(glyph).text((5, 0), ch, font=font, fill=255)
            rotated = glyph.rotate(-angle, expand=True, resample=Image.BICUBIC)
            c = (point(p, cum, mid) - (x0, y0)) * scale
            box = (int(c[0] - rotated.width / 2), int(c[1] - rotated.height / 2))
            halo = rotated.point(lambda v: 255 if v > 10 else 0).resize(rotated.size)
            img.paste((255, 255, 255), box, halo)
            img.paste((10, 10, 10), box, rotated)
            cursor += adv

    open(out_js, "w").write("const LABELS = " + json.dumps(out, indent=2) + ";\n")
    img.save(out_preview)
    print(f"{len(out)} labels written to {out_js}")


if __name__ == "__main__":
    main(*sys.argv[1:3])
