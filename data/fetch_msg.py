#!/usr/bin/env python3
"""
Download real-world data for the Madison Square Garden model, once, and save it
as data/msg/msg-data.js for stadium-studio/index.html to load.

Run it:   python3 data/fetch_msg.py            (uses saved downloads if they exist)
Refresh:  python3 data/fetch_msg.py --refresh  (downloads everything again)

Sources (all free, no keys):
  1. NYC Open Data building footprints  -> building outlines and roof heights
  2. OpenStreetMap (Overpass API)       -> streets, sidewalks, trees, Penn Station tracks and platforms
  3. MTA LIRR GTFS schedule             -> real Long Island Rail Road trains at Penn Station
  4. NHL web API (unofficial)           -> Rangers home-game shot locations
  5. Wikidata                           -> facts for labels (opening date, capacity, architect)

Why a .js file and not .json: a page opened by double-clicking (file://) is not
allowed to read a separate .json file, but it can load a <script> file.
"""
import csv, io, json, math, os, sys, time, urllib.parse, urllib.request, zipfile
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "msg", "raw")
OUT = os.path.join(HERE, "..", "stadium-studio", "data", "msg-data.js")   # next to the page that uses it
REFRESH = "--refresh" in sys.argv
UA = "stadium-studio-data/1.0 (personal visualization project)"

# Area: MSG plus the buildings across each surrounding street
LAT0, LON0 = 40.75051, -73.99343           # first guess at the arena center
S, N, W, E = 40.7476, 40.7534, -73.9975, -73.9893
SEASON = "20252026"                          # last complete NHL season
RANGERS_ID = 3
FT = 0.3048


# ---------------------------------------------------------------- downloading
def get(url, data=None, tries=5):
    """Download with polite retries. Busy servers get a growing pause."""
    wait = 4
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:
            if k == tries - 1:
                raise
            print(f"    busy or failed ({e}); retrying in {wait}s")
            time.sleep(wait)
            wait *= 2


def cached(name, fetch):
    """Save each download in data/msg/raw so reruns are instant and offline."""
    path = os.path.join(RAW, name)
    if os.path.exists(path) and not REFRESH:
        with open(path, "rb") as f:
            return f.read()
    print(f"  downloading {name} ...")
    body = fetch()
    with open(path, "wb") as f:
        f.write(body)
    return body


def overpass(query):
    mirrors = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter",
               "https://overpass-api.de/api/interpreter",
               "https://overpass.private.coffee/api/interpreter",
               "https://overpass.kumi.systems/api/interpreter"]
    last = None
    for m in mirrors:
        try:
            body = get(m, urllib.parse.urlencode({"data": query}).encode(), tries=3)
            if body.strip().startswith(b"{"):
                return body
            last = body[:200]
        except Exception as e:
            last = e
    raise RuntimeError(f"OpenStreetMap servers are all busy right now: {last}")


# ---------------------------------------------------------------- 1. footprints
def fetch_footprints():
    where = f"within_box(the_geom,{N},{W},{S},{E})"
    q = urllib.parse.urlencode({"$where": where, "$limit": 3000,
                                "$select": "the_geom,bin,height_roof,ground_elevation,construction_year,feature_code"})
    return get("https://data.cityofnewyork.us/resource/5zhs-2jue.json?" + q)


# ---------------------------------------------------------------- 2. OpenStreetMap
def fetch_osm():
    bb = f"({S},{W},{N},{E})"
    q = f"""[out:json][timeout:90];
(
  way["highway"]{bb};
  way["building"]{bb};
  relation["building"]{bb};
  way["building:part"]{bb};
  way["railway"]{bb};
  way["public_transport"="platform"]{bb};
  node["natural"="tree"]{bb};
  way["leisure"]{bb};
  way["name"="Madison Square Garden"];
);
out geom tags;"""
    return overpass(q)


# ---------------------------------------------------------------- 3. LIRR GTFS
def fetch_gtfs():
    return get("https://rrgtfsfeeds.s3.amazonaws.com/gtfslirr.zip")


# ---------------------------------------------------------------- 4. NHL
def fetch_schedule():
    return get(f"https://api-web.nhle.com/v1/club-schedule-season/NYR/{SEASON}")


def fetch_pbp(gid):
    return get(f"https://api-web.nhle.com/v1/gamecenter/{gid}/play-by-play")


# ---------------------------------------------------------------- 5. Wikidata
def fetch_wikidata():
    return get("https://www.wikidata.org/wiki/Special:EntityData/Q186125.json")


# ================================================================ geometry
def to_local(lat, lon):
    """Degrees -> meters east and north of the first-guess center."""
    return ((lon - LON0) * math.cos(math.radians(LAT0)) * 111320.0, (lat - LAT0) * 110540.0)


def to_ll(p):
    """Local meters -> (lat, lon)."""
    return (LAT0 + p[1] / 110540.0, LON0 + p[0] / (math.cos(math.radians(LAT0)) * 111320.0))


def fit_circle(pts):
    """Least-squares circle through points (Kasa method). Returns cx, cy, r."""
    n = len(pts)
    sx = sum(p[0] for p in pts); sy = sum(p[1] for p in pts)
    sxx = sum(p[0] * p[0] for p in pts); syy = sum(p[1] * p[1] for p in pts); sxy = sum(p[0] * p[1] for p in pts)
    sz = [p[0] * p[0] + p[1] * p[1] for p in pts]
    szx = sum(z * p[0] for z, p in zip(sz, pts)); szy = sum(z * p[1] for z, p in zip(sz, pts)); szz = sum(sz)
    # solve [sxx sxy sx; sxy syy sy; sx sy n] [a b c] = [szx szy szz]
    M = [[sxx, sxy, sx, szx], [sxy, syy, sy, szy], [sx, sy, n, szz]]
    for i in range(3):
        piv = max(range(i, 3), key=lambda r: abs(M[r][i])); M[i], M[piv] = M[piv], M[i]
        for r in range(3):
            if r != i:
                f = M[r][i] / M[i][i]
                M[r] = [a - f * b for a, b in zip(M[r], M[i])]
    a, b, c = (M[i][3] / M[i][i] for i in range(3))
    cx, cy = a / 2, b / 2
    return cx, cy, math.sqrt(c + cx * cx + cy * cy)


def robust_circle(pts):
    """Fit, drop the points that are not on the circle (podiums, entrances), fit again."""
    cur = pts
    for _ in range(6):
        cx, cy, r = fit_circle(cur)
        keep = [p for p in cur if abs(math.hypot(p[0] - cx, p[1] - cy) - r) < 2.5]
        if len(keep) < 12 or len(keep) == len(cur):
            break
        cur = keep
    return cx, cy, r, len(cur)


def area(poly):
    return abs(sum(poly[i][0] * poly[i - 1][1] - poly[i - 1][0] * poly[i][1] for i in range(len(poly)))) / 2


def rnd(v):
    return round(v, 2)


# The model shows the arena block plus the buildings across each street
BOX = (-170.0, 265.0, -160.0, 160.0)      # x0, x1, z0, z1 in scene meters (the arena sits near 8th Ave)


def clip_poly(pts, box=BOX):
    """Cut a building outline to the model's edge (Sutherland-Hodgman)."""
    x0, x1, z0, z1 = box
    edges = [(lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
             (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
             (lambda p: p[1] >= z0, lambda a, b: (a[0] + (b[0] - a[0]) * (z0 - a[1]) / (b[1] - a[1]), z0)),
             (lambda p: p[1] <= z1, lambda a, b: (a[0] + (b[0] - a[0]) * (z1 - a[1]) / (b[1] - a[1]), z1))]
    out = pts
    for inside, cut in edges:
        if not out:
            break
        src, out = out, []
        for i, cur in enumerate(src):
            prev = src[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cut(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cut(prev, cur))
    return [[rnd(p[0]), rnd(p[1])] for p in out]


def clip_line(pts, box=BOX, pad=0):
    """Keep only the parts of a line inside the model's edge. Returns a list of lines."""
    x0, x1, z0, z1 = box[0] - pad, box[1] + pad, box[2] - pad, box[3] + pad
    lines, cur = [], []
    for a, b in zip(pts, pts[1:]):
        t0, t1, dx, dz = 0.0, 1.0, b[0] - a[0], b[1] - a[1]
        ok = True
        for p, q in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dz, a[1] - z0), (dz, z1 - a[1])):
            if p == 0:
                if q < 0: ok = False; break
            else:
                r = q / p
                if p < 0: t0 = max(t0, r)
                else: t1 = min(t1, r)
        if not ok or t0 > t1:
            if len(cur) > 1: lines.append(cur)
            cur = []
            continue
        A = [rnd(a[0] + dx * t0), rnd(a[1] + dz * t0)]; B = [rnd(a[0] + dx * t1), rnd(a[1] + dz * t1)]
        if not cur or cur[-1] != A:
            if len(cur) > 1: lines.append(cur)
            cur = [A]
        cur.append(B)
    if len(cur) > 1: lines.append(cur)
    return lines


# ================================================================ main
def main():
    os.makedirs(RAW, exist_ok=True)
    print("1/5 NYC building footprints")
    fp = json.loads(cached("footprints.json", fetch_footprints))
    print(f"    {len(fp)} buildings")
    print("2/5 OpenStreetMap")
    osm = json.loads(cached("osm.json", fetch_osm))["elements"]
    print(f"    {len(osm)} map features")
    print("3/5 LIRR schedule")
    gtfs = cached("gtfslirr.zip", fetch_gtfs)
    print("4/5 NHL shots")
    sched = json.loads(cached(f"nyr-schedule-{SEASON}.json", fetch_schedule))
    home = [g for g in sched["games"] if g.get("gameType") == 2 and g["homeTeam"]["abbrev"] == "NYR"
            and g.get("gameState") in ("OFF", "FINAL")]
    pbps = []
    for g in home:
        pbps.append(json.loads(cached(f"pbp-{g['id']}.json", lambda gid=g["id"]: (time.sleep(.3), fetch_pbp(gid))[1])))
    print(f"    {len(pbps)} Rangers home games")
    print("5/5 Wikidata")
    wd = json.loads(cached("wikidata-Q186125.json", fetch_wikidata))

    # ---- grid angle from the cross streets (31st to 34th run along the grid's east-west)
    def way_pts(el):
        return [to_local(g["lat"], g["lon"]) for g in el.get("geometry", []) if g]
    bearings = []
    for el in osm:
        nm = el.get("tags", {}).get("name", "")
        if el["type"] == "way" and el.get("tags", {}).get("highway") and nm in ("West 31st Street", "West 33rd Street", "West 34th Street", "West 30th Street"):
            p = way_pts(el)
            for a, b in zip(p, p[1:]):
                L = math.hypot(b[0] - a[0], b[1] - a[1])
                if L > 15:
                    ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])) % 180
                    bearings.append((ang, L))
    theta = sum(a * w for a, w in bearings) / sum(w for _, w in bearings) if bearings else 180 - 29.0
    # theta is the street direction measured from east, counterclockwise (about 151 degrees here)
    ex = (math.cos(math.radians(theta)), math.sin(math.radians(theta)))
    if ex[0] < 0:                       # point "grid east" toward 7th Avenue
        ex = (-ex[0], -ex[1])
    nx = (-ex[1], ex[0])                # grid north, 90 degrees counterclockwise
    print(f"    Manhattan grid is turned {math.degrees(math.atan2(ex[1], ex[0])):.1f} degrees from true east")

    # ---- the drum: fit a circle to the OSM outline of the arena
    # The city draws MSG and its low side buildings as one outline. Its points that sit
    # 52 to 68 m from our first guess are on the round drum; the circle fit finds the true center.
    msg_fp = None
    for b in fp:
        for poly in b["the_geom"]["coordinates"]:
            pts = [to_local(lat, lon) for lon, lat in poly[0]]
            if min(math.hypot(*p) for p in pts) < 70 and area(pts) > 10000:
                msg_fp = (b, pts)
    ring = [p for p in msg_fp[1] if 52 < math.hypot(*p) < 68]
    cx, cy, R, used = robust_circle(ring)
    print(f"    drum circle: radius {R:.1f} m from {used} outline points")

    def G(lat, lon):
        """Degrees -> scene coordinates: x = grid east (toward 7th Ave), z = grid south."""
        e, n = to_local(lat, lon)
        e -= cx; n -= cy
        return [rnd(e * ex[0] + n * ex[1]), rnd(-(e * nx[0] + n * nx[1]))]

    # ---- streets, sidewalks, trees, rails, platforms
    streets, paths, rails, platforms, trees, pitches, parts = [], [], [], [], [], [], []
    for el in osm:
        t = el.get("tags", {})
        if el["type"] == "node" and t.get("natural") == "tree":
            trees.append(G(el["lat"], el["lon"]))
            continue
        if el["type"] != "way" or not el.get("geometry"):
            continue
        pts = [G(g["lat"], g["lon"]) for g in el["geometry"]]
        layer = t.get("layer", "0")
        under = t.get("tunnel") or (layer.lstrip("-").isdigit() and int(layer) < 0) or t.get("location") == "underground"
        hw = t.get("highway")
        if t.get("building:part") and not under:
            parts.append({"name": t.get("name", ""), "part": t.get("building:part"), "h": t.get("height"), "minh": t.get("min_height"),
                          "levels": t.get("building:levels"), "pts": pts})
        if hw in ("primary", "secondary", "tertiary", "residential", "unclassified", "trunk") and not under:
            lanes = int(t.get("lanes", "0").split(";")[0] or 0) if t.get("lanes", "0").split(";")[0].isdigit() else 0
            width = float(t["width"]) if t.get("width", "").replace(".", "").isdigit() else (max(lanes, 2) * 3.4 + 2 if lanes else (17 if "Avenue" in t.get("name", "") else 10.5))
            streets.append({"name": t.get("name", ""), "w": rnd(width), "pts": pts, "oneway": t.get("oneway", "no")})
        elif hw in ("footway", "pedestrian") and t.get("footway") != "crossing" and not under:
            paths.append({"kind": "sidewalk" if t.get("footway") == "sidewalk" else hw, "pts": pts})
        elif hw == "footway" and t.get("footway") == "crossing":
            paths.append({"kind": "crossing", "pts": pts})
        if t.get("railway") in ("rail", "subway") and under:
            rails.append({"ref": t.get("railway:track_ref") or t.get("ref", ""), "service": t.get("service", ""), "layer": layer, "pts": pts,
                          "subway": t.get("railway") == "subway"})
        if (t.get("railway") == "platform" or t.get("public_transport") == "platform") and under:
            platforms.append({"ref": t.get("ref", ""), "layer": layer, "closed": pts[0] == pts[-1], "pts": pts,
                              "subway": "subway" in (t.get("network", "") + t.get("name", "") + t.get("subway", "")).lower() or t.get("subway") == "yes"})
        if t.get("leisure") in ("pitch", "ice_rink", "sports_centre") and math.hypot(*pts[0]) < R:
            pitches.append({"kind": t.get("leisure"), "sport": t.get("sport", ""), "pts": pts})

    # ---- trim everything to the model's edge
    def clipped(items, pad):
        out = []
        for it in items:
            for seg in clip_line(it["pts"], pad=pad):
                out.append(dict(it, pts=seg))
        return out
    lines = {}
    for st in streets:
        lines.setdefault(st["name"], []).append(st["pts"])
    def mean_coord(name, axis):
        v = [p[axis] for l in lines.get(name, []) for p in l if BOX[2] - 60 < p[1] < BOX[3] + 60 and BOX[0] - 60 < p[0] < BOX[1] + 60]
        return rnd(sum(v) / len(v)) if v else None
    grid = {"ave7": mean_coord("7th Avenue", 0), "ave8": mean_coord("8th Avenue", 0),
            "st31": mean_coord("West 31st Street", 1), "st33": mean_coord("West 33rd Street", 1)}
    streets = clipped(streets, 25); paths = clipped(paths, 0)
    rails = clipped(rails, 0); platforms = [dict(p, pts=clip_poly(p["pts"])) for p in platforms]; platforms = [p for p in platforms if len(p["pts"]) >= 3]
    trees = [t for t in trees if BOX[0] < t[0] < BOX[1] and BOX[2] < t[1] < BOX[3]]
    # keep only the parts on the arena's own block (between 8th and 7th Ave, 33rd and 31st St)
    def on_block(pts):
        cx = sum(q[0] for q in pts) / len(pts); cz = sum(q[1] for q in pts) / len(pts)
        return -90 < cx < 184 and -79 < cz < 78
    parts = [p for p in parts if on_block(p["pts"])]
    print(f"    street grid: 8th Ave x={grid['ave8']}, 7th Ave x={grid['ave7']}, 33rd St z={grid['st33']}, 31st St z={grid['st31']}")

    # ---- buildings from the city (heights in feet above ground -> meters)
    buildings = []
    drum_h = float(msg_fp[0]["height_roof"]) * FT
    cplx = [G(*to_ll(p)) for p in msg_fp[1]]
    if cplx[0] == cplx[-1]:
        cplx = cplx[:-1]
    for b in fp:
        if b is msg_fp[0]:
            continue
        h = float(b.get("height_roof") or 0) * FT
        if h < 3:
            continue
        for poly in b["the_geom"]["coordinates"]:
            pts = [G(lat, lon) for lon, lat in poly[0]]
            if pts[0] == pts[-1]:
                pts = pts[:-1]
            if len(pts) < 3 or area(pts) < 25:
                continue
            cxz = (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
            if not (BOX[0] - 30 < cxz[0] < BOX[1] + 30 and BOX[2] - 30 < cxz[1] < BOX[3] + 30):
                continue
            pts = clip_poly(pts)
            if len(pts) < 3 or area(pts) < 25:
                continue
            buildings.append({"bin": b.get("bin"), "h": rnd(h), "yr": b.get("construction_year"), "pts": pts})
    print(f"    drum roof height: {drum_h:.1f} m;  {len(buildings)} other building pieces")

    # ---- LIRR: one weekday evening rush hour at Penn Station
    z = zipfile.ZipFile(io.BytesIO(gtfs))
    rd = lambda n: list(csv.DictReader(io.TextIOWrapper(z.open(n), "utf-8-sig")))
    stops = rd("stops.txt")
    penn = {s["stop_id"] for s in stops if "penn" in s["stop_name"].lower()}
    routes = {r["route_id"]: r.get("route_long_name") or r.get("route_short_name") for r in rd("routes.txt")}
    trips = {t["trip_id"]: t for t in rd("trips.txt")}
    names = z.namelist()
    day = date.today()
    while day.weekday() != 2:            # next Wednesday: a normal weekday
        day += timedelta(days=1)
    ds = day.strftime("%Y%m%d")
    active = set()
    if "calendar.txt" in names:
        wk = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][day.weekday()]
        for c in rd("calendar.txt"):
            if c["start_date"] <= ds <= c["end_date"] and c[wk] == "1":
                active.add(c["service_id"])
    if "calendar_dates.txt" in names:
        for c in rd("calendar_dates.txt"):
            if c["date"] == ds:
                (active.add if c["exception_type"] == "1" else active.discard)(c["service_id"])
    by_trip = {}
    for st in rd("stop_times.txt"):
        if st["trip_id"] in trips and trips[st["trip_id"]]["service_id"] in active:
            by_trip.setdefault(st["trip_id"], []).append(st)
    moves = []
    for tid, sts in by_trip.items():
        sts.sort(key=lambda s: int(s["stop_sequence"]))
        first, last = sts[0], sts[-1]
        tr = trips[tid]
        if first["stop_id"] in penn:
            tm, kind, other = first["departure_time"], "dep", tr.get("trip_headsign", "")
        elif last["stop_id"] in penn:
            tm, kind, other = last["arrival_time"], "arr", next((s["stop_name"] for s in stops if s["stop_id"] == first["stop_id"]), "")
        else:
            continue
        hh, mm = int(tm[:2]), int(tm[3:5])
        if 17 <= hh < 18:
            moves.append({"t": f"{hh:02d}:{mm:02d}", "min": mm, "kind": kind, "line": routes.get(tr["route_id"], ""), "to": other})
    moves.sort(key=lambda m: (m["min"], m["kind"]))
    print(f"    {len(moves)} LIRR trains at Penn between 5 and 6 pm on {day.isoformat()}")

    # ---- NHL shots, folded so Rangers attack the +x end and opponents the -x end
    rangers, opp = [], []
    goals = {"nyr": 0, "opp": 0}
    for pbp in pbps:
        home_id = pbp["homeTeam"]["id"]
        for p in pbp.get("plays", []):
            if p.get("typeDescKey") not in ("shot-on-goal", "goal"):
                continue
            d = p.get("details", {})
            if d.get("xCoord") is None:
                continue
            side = p.get("homeTeamDefendingSide")
            shooter = d.get("eventOwnerTeamId")
            shooter_home = shooter == home_id
            defend = side if shooter_home else ("right" if side == "left" else "left")
            sgn = 1 if defend == "left" else -1          # attack the far end from your own net
            x, y = d["xCoord"] * sgn, d["yCoord"] * sgn
            goal = p["typeDescKey"] == "goal"
            if shooter == RANGERS_ID:
                rangers.append([rnd(x * FT), rnd(y * FT), 1 if goal else 0]); goals["nyr"] += goal
            else:
                opp.append([rnd(-x * FT), rnd(-y * FT), 1 if goal else 0]); goals["opp"] += goal
    print(f"    {len(rangers)} Rangers shots ({goals['nyr']} goals), {len(opp)} opponent shots ({goals['opp']} goals)")

    # ---- Wikidata facts
    ent = wd["entities"]["Q186125"]["claims"]
    def claim(pid):
        try:
            return ent[pid][0]["mainsnak"]["datavalue"]["value"]
        except (KeyError, IndexError):
            return None
    opened = claim("P1619") or claim("P571")
    cap = claim("P1083")
    facts = {"opened": opened["time"][1:11] if opened else None,
             "capacity": int(float(cap["amount"])) if cap else None,
             "wikidata": "Q186125"}

    data = {
        "meta": {"made": date.today().isoformat(), "area": [S, W, N, E],
                 "grid_deg": rnd(math.degrees(math.atan2(ex[1], ex[0]))),
                 "note": "x = grid east toward 7th Avenue, z = grid south toward 31st Street, meters, arena center at 0,0"},
        "drum": {"R": rnd(R), "h": rnd(drum_h)}, "complex": cplx, "grid": grid, "box": BOX, "parts": parts,
        "streets": streets, "paths": paths, "buildings": buildings,
        "rails": rails, "platforms": platforms, "trees": trees, "pitches": pitches,
        "trains": {"date": day.isoformat(), "window": "17:00-18:00", "moves": moves},
        "shots": {"season": SEASON, "games": len(pbps), "nyr": rangers, "opp": opp, "goals": goals},
        "facts": facts,
    }
    with open(OUT, "w") as f:
        f.write("/* Made by data/fetch_msg.py. Do not edit by hand: run the script again instead. */\n")
        f.write("window.STADIUM_DATA=window.STADIUM_DATA||{};\nwindow.STADIUM_DATA.msg=")
        json.dump(data, f, separators=(",", ":"))
        f.write(";\n")
    print(f"Saved {os.path.relpath(OUT)} ({os.path.getsize(OUT)//1024} KB)")


if __name__ == "__main__":
    main()
