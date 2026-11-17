"""
The wider city around a venue, for the skyline: every building footprint (NYC Open Data 5zhs-2jue)
from river to river, in the same scene coordinates as the venue's main data file.

Use:  python3 data/fetch_skyline.py msg
Writes stadium-studio/data/msg-skyline.js. The close-up buildings stay in msg-data.js; this file only
adds the ones outside the main model box, simplified and rounded to half a meter to keep it small.
Settings come from venues.json -> "<venue>".skyline: {"box": [x0, x1, z0, z1]} in scene meters.
"""
import json, math, os, sys, urllib.parse

KEY = sys.argv[1] if len(sys.argv) > 1 else "msg"
sys.argv = [sys.argv[0], KEY]          # the main recipe reads the venue from the command line
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_venue as F               # reuse its downloads, map math and venue center

SKY = F.CFG.get("skyline") or {}
BOX = SKY.get("box", [-1500, 2000, -900, 800])


def frame():
    """Rebuild the main recipe's scene transform (grid angle from the cross streets, center from the drum)."""
    osm = json.loads(F.cached("osm.json", F.fetch_osm))["elements"]
    fp = json.loads(F.cached("footprints.json", F.fetch_footprints))
    bearings = []
    for el in osm:
        nm = el.get("tags", {}).get("name", "")
        if el["type"] == "way" and el.get("tags", {}).get("highway") and nm in F.GRID.get("angle_streets", []):
            p = [F.to_local(g["lat"], g["lon"]) for g in el.get("geometry", []) if g]
            for a, b in zip(p, p[1:]):
                L = math.hypot(b[0] - a[0], b[1] - a[1])
                if L > 15:
                    bearings.append((math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180, L))
    theta = sum(a * w for a, w in bearings) / sum(w for _, w in bearings)
    ex = (math.cos(math.radians(theta)), math.sin(math.radians(theta)))
    if ex[0] < 0:
        ex = (-ex[0], -ex[1])
    nx = (-ex[1], ex[0])
    best = None
    for b in fp:
        for poly in b["the_geom"]["coordinates"]:
            pts = [F.to_local(lat, lon) for lon, lat in poly[0]]
            if min(math.hypot(*p) for p in pts) < 70 and F.area(pts) > 10000 and (best is None or F.area(pts) > F.area(best)):
                best = pts
    cx, cy, _, _ = F.robust_circle([p for p in best if 52 < math.hypot(*p) < 68])
    G = lambda lat, lon: (lambda e, n: ((e - cx) * ex[0] + (n - cy) * ex[1], -((e - cx) * nx[0] + (n - cy) * nx[1])))(*F.to_local(lat, lon))
    def ll(x, z):   # scene -> (lat, lon), for the download box
        e = cx + x * ex[0] - z * nx[0]; n = cy + x * ex[1] - z * nx[1]
        return F.to_ll((e, n))
    return G, ll


def simplify(pts, tol=0.8):
    """Douglas-Peucker on a closed ring: fewer corners, same shape at skyline distance."""
    if len(pts) < 5:
        return pts
    def rdp(seg):
        a, b = seg[0], seg[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1e-9
        i, dmax = 0, 0
        for k in range(1, len(seg) - 1):
            d = abs(dy * seg[k][0] - dx * seg[k][1] + b[0] * a[1] - b[1] * a[0]) / L
            if d > dmax:
                i, dmax = k, d
        return rdp(seg[:i + 1])[:-1] + rdp(seg[i:]) if dmax > tol else [a, b]
    far = max(range(len(pts)), key=lambda k: (pts[k][0] - pts[0][0]) ** 2 + (pts[k][1] - pts[0][1]) ** 2)
    out = rdp(pts[:far + 1])[:-1] + rdp(pts[far:] + [pts[0]])[:-1]
    return out if len(out) >= 3 else pts


def main():
    G, ll = frame()
    corners = [ll(x, z) for x in (BOX[0], BOX[1]) for z in (BOX[2], BOX[3])]
    S, N = min(c[0] for c in corners), max(c[0] for c in corners)
    W, E = min(c[1] for c in corners), max(c[1] for c in corners)
    print(f"Skyline box {BOX} -> lat {S:.4f}..{N:.4f}, lon {W:.4f}..{E:.4f}")
    rows, off = [], 0
    while True:
        name = f"skyline-footprints-{off}.json"
        q = urllib.parse.urlencode({"$where": f"within_box(the_geom,{N},{W},{S},{E})", "$limit": 20000, "$offset": off,
                                    "$order": "bin", "$select": "the_geom,bin,height_roof,construction_year"})
        page = json.loads(F.cached(name, lambda q=q: F.get("https://data.cityofnewyork.us/resource/5zhs-2jue.json?" + q)))
        rows += page; print(f"    {len(rows)} footprints so far")
        if len(page) < 20000:
            break
        off += 20000
    near = tuple(F.CFG["model_box"])
    # the buildings the main model already draws in detail (by the city's building ID), plus the Garden and its custom tower
    main = open(os.path.join(F.HERE, "..", "stadium-studio", "data", f"{KEY}-data.js")).read()
    mark = f"window.STADIUM_DATA.{KEY}="; body = main[main.index(mark) + len(mark):]; mdata = json.loads(body[:body.rindex("}") + 1])
    drawn = {str(b.get("bin")) for b in mdata.get("buildings", []) if b.get("bin")} | {"1083026"}
    out, land = [], {}
    for b in rows:
        h = float(b.get("height_roof") or 0) * F.FT
        if h < 4:
            continue
        yr = int(b["construction_year"]) if str(b.get("construction_year") or "").isdigit() else 0
        for poly in b["the_geom"]["coordinates"]:
            pts = [G(lat, lon) for lon, lat in poly[0]]
            if pts[0] == pts[-1]:
                pts = pts[:-1]
            if len(pts) < 3 or F.area(pts) < 30:
                continue
            cx = sum(p[0] for p in pts) / len(pts); cz = sum(p[1] for p in pts) / len(pts)
            if not (BOX[0] < cx < BOX[1] and BOX[2] < cz < BOX[3]):
                continue
            # where buildings stand, there is land: remember the west and east edge of each 40 m strip
            k = int((cz - BOX[2]) // 40); lo, hi = land.get(k, (1e9, -1e9)); land[k] = (min(lo, min(p[0] for p in pts)), max(hi, max(p[0] for p in pts)))
            inside = all(near[0] <= p[0] <= near[1] and near[2] <= p[1] <= near[3] for p in pts)
            if (str(b.get("bin")) in drawn and inside) or math.hypot(cx, cz) < 70:
                continue          # already drawn in detail by the main model (buildings cut at its edge are drawn whole here)
            pts = simplify(pts)
            flat = [v for p in pts for v in (round(p[0] * 2), round(p[1] * 2))]   # half meters, as integers
            out.append([round(h * 2), yr] + flat)
    strips = [[k, round(lo), round(hi)] for k, (lo, hi) in sorted(land.items())]
    data = {"made": F.date.today().isoformat(), "box": BOX, "unit": 0.5, "strip": 40,
            "note": "b: [height*2, year, x0*2, z0*2, x1*2, z1*2, ...] in scene meters (half-meter integers). land: [strip index, west x, east x] where buildings stand",
            "source": "NYC Open Data, Building Footprints (5zhs-2jue)", "b": out, "land": strips}
    path = os.path.join(F.HERE, "..", "stadium-studio", "data", f"{KEY}-skyline.js")
    with open(path, "w") as f:
        f.write("// Made by data/fetch_skyline.py. Do not edit by hand.\n")
        f.write(f"window.STADIUM_SKYLINE=window.STADIUM_SKYLINE||{{}};window.STADIUM_SKYLINE[{json.dumps(KEY)}]=")
        json.dump(data, f, separators=(",", ":")); f.write(";\n")
    print(f"Saved {os.path.relpath(path)}: {len(out)} buildings, {os.path.getsize(path)//1024} KB")


if __name__ == "__main__":
    main()
