"""Generate vector contours for Vancouver and the North Shore from CDED USGS-DEM tiles.

Usage, from topo/: python3 tools/dem_contours.py data/cded ../www/contours-data.js
"""
import glob
import json
import sys
from pathlib import Path

import contourpy
import numpy as np
from scipy import ndimage

BOUNDS = dict(west=-123.32, east=-122.82, south=49.19, north=49.47)
INTERVAL = 25
INDEX_EVERY = 4
METRES_PER_UNIT = 20
SMOOTHING = 1.2
SIMPLIFY = 0.2


def fortran_float(s):
    return float(s.strip().replace("D", "E"))


NODATA = -32767
BLOCK = 1024


def read_dem(path):
    """Read a USGS DEM (CDED) file into (grid south-to-north, west lon, south lat, spacing in degrees)."""
    text = Path(path).read_bytes().decode("ascii")
    header = text[:BLOCK]
    corners = [fortran_float(header[546 + 24 * i: 546 + 24 * (i + 1)]) / 3600 for i in range(8)]
    res_x, res_y, res_z = (float(header[816 + 12 * i: 816 + 12 * (i + 1)]) for i in range(3))
    n_columns = int(header[858:864])
    if not np.isclose(res_x, res_y):
        raise ValueError(f"{path}: unequal spacing {res_x} x {res_y} arc-seconds")

    columns = []
    pos = BLOCK
    for _ in range(n_columns):
        block = text[pos:pos + BLOCK]
        m = int(block[12:18])
        datum = fortran_float(block[72:96])
        raw = [block[144 + 6 * i: 150 + 6 * i] for i in range(min(m, 146))]
        pos += BLOCK
        while len(raw) < m:
            block = text[pos:pos + BLOCK]
            raw += [block[6 * i: 6 * i + 6] for i in range(min(m - len(raw), 170))]
            pos += BLOCK
        values = np.array(raw, dtype=float)
        column = np.where(values == NODATA, np.nan, datum + values * res_z)
        columns.append(column)
    grid = np.column_stack(columns)
    west, south = min(corners[0::2]), min(corners[1::2])
    return grid, west, south, res_x / 3600


def mosaic(folder):
    tiles = [read_dem(f) for f in sorted(glob.glob(f"{folder}/*.dem"))]
    step = tiles[0][3]
    west = min(t[1] for t in tiles)
    south = min(t[2] for t in tiles)
    east = max(t[1] + (t[0].shape[1] - 1) * step for t in tiles)
    north = max(t[2] + (t[0].shape[0] - 1) * step for t in tiles)
    cols = round((east - west) / step) + 1
    rows = round((north - south) / step) + 1
    grid = np.full((rows, cols), np.nan)
    for g, tw, ts, _ in tiles:
        r0, c0 = round((ts - south) / step), round((tw - west) / step)
        target = grid[r0:r0 + g.shape[0], c0:c0 + g.shape[1]]
        target[:] = np.where(np.isnan(g), target, g)
    print(f"mosaic {rows} x {cols} cells at {step * 3600:.2f} arc-seconds, from {len(tiles)} tiles")
    return grid, west, south, step


def crop(grid, west, south, step):
    c0, c1 = round((BOUNDS["west"] - west) / step), round((BOUNDS["east"] - west) / step) + 1
    r0, r1 = round((BOUNDS["south"] - south) / step), round((BOUNDS["north"] - south) / step) + 1
    sub = grid[r0:r1, c0:c1]
    lons = west + np.arange(c0, c1) * step
    lats = south + np.arange(r0, r1) * step
    missing = np.isnan(sub)
    if missing.mean() > 0.01:
        raise ValueError(f"{missing.mean():.1%} of the cropped area has no data")
    if missing.any():
        print(f"filling {missing.sum()} void cells ({missing.mean():.3%}) from their nearest neighbours")
        idx = ndimage.distance_transform_edt(missing, return_distances=False, return_indices=True)
        sub = sub[tuple(idx)]
    return sub[::-1], lons, lats[::-1]


def simplify(points, tolerance):
    if len(points) < 3:
        return points
    keep = np.zeros(len(points), dtype=bool)
    keep[[0, -1]] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        seg = points[b] - points[a]
        rel = points[a + 1:b] - points[a]
        norm = np.hypot(*seg)
        d = np.abs(seg[0] * rel[:, 1] - seg[1] * rel[:, 0]) / norm if norm else np.hypot(rel[:, 0], rel[:, 1])
        i = int(np.argmax(d))
        if d[i] > tolerance:
            keep[a + 1 + i] = True
            stack += [(a, a + 1 + i), (a + 1 + i, b)]
    return points[keep]


def encode(points):
    q = np.round(points * 10).astype(int)
    return ",".join(map(str, np.vstack([q[:1], np.diff(q, axis=0)]).ravel()))


def main(folder, out):
    grid, lons, lats = crop(*mosaic(folder))
    lat_mid = np.radians(lats.mean())
    x = (lons - lons[0]) * 111_320 * np.cos(lat_mid) / METRES_PER_UNIT
    y = (lats[0] - lats) * 110_950 / METRES_PER_UNIT
    z = ndimage.gaussian_filter(np.maximum(grid, 0), SMOOTHING)
    gen = contourpy.contour_generator(x=x, y=y, z=z, line_type="Separate")

    levels = [0.5] + list(range(INTERVAL, int(z.max()) + 1, INTERVAL))
    groups = []
    total_points = 0
    for level in levels:
        kind = ("coast" if level < 1 else "index" if level % (INTERVAL * INDEX_EVERY) == 0
                else "mid" if level % (INTERVAL * 2) == 0 else "minor")
        lines = []
        for line in gen.lines(level):
            line = simplify(line, SIMPLIFY)
            if len(line) >= 2 and np.hypot(*(line.max(0) - line.min(0))) > 1.5:
                lines.append(encode(line))
                total_points += len(line)
        if lines:
            groups.append({"level": round(level), "kind": kind, "lines": lines})

    size = [round(float(x[-1]), 1), round(float(y[-1]), 1)]
    payload = json.dumps(groups, separators=(",", ":"))
    meta = {"bounds": BOUNDS, "interval": INTERVAL, "metresPerUnit": METRES_PER_UNIT, "maxElevation": round(float(grid.max()))}
    Path(out).write_text(
        f"const CONTOUR_SIZE = {json.dumps(size)};\nconst CONTOUR_META = {json.dumps(meta)};\nconst CONTOURS = {payload};\n"
    )
    print(f"map {size[0]} x {size[1]} units ({size[0] * METRES_PER_UNIT / 1000:.1f} x {size[1] * METRES_PER_UNIT / 1000:.1f} km), "
          f"elevation {grid.min():.0f}-{grid.max():.0f} m, {len(groups)} levels, {total_points} points, {len(payload) // 1024} KB")


if __name__ == "__main__":
    main(*sys.argv[1:3])
