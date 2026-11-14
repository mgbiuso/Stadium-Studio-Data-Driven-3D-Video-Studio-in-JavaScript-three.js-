#!/usr/bin/env python3
"""
Download real-world data for one venue, once, and save it as
stadium-studio/data/<venue>-data.js for the 3D page to load.

Run it:   python3 data/fetch_venue.py msg            (uses saved downloads if they exist)
Refresh:  python3 data/fetch_venue.py msg --refresh  (downloads everything again)

Each venue's settings live in data/venues.json (center, area, street names, transit, team).
To add a venue, copy an entry there; see data/README.md.

Sources (all free, no keys):
  Everywhere : OpenStreetMap (streets, buildings, building parts, trees, rail, platforms), Wikidata (facts)
  NYC pack   : NYC Open Data building footprints with roof heights, 2015 street tree census,
               PLUTO tax lots (year built, floors, building type), planimetric sidewalks
  Transit    : any GTFS schedule feed listed for the venue
  Sport      : NHL play-by-play shot locations (other leagues: add a module)

Why a .js file and not .json: a page opened by double-clicking (file://) is not
allowed to read a separate .json file, but it can load a <script> file.
"""
import csv, io, json, math, os, sys, time, urllib.parse, urllib.request, zipfile
from datetime import date, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
REFRESH = "--refresh" in sys.argv
CFGS = json.load(open(os.path.join(HERE, "venues.json")))
KEY = next((a for a in sys.argv[1:] if not a.startswith("--")), None)
if KEY not in CFGS:
    sys.exit("Use: python3 data/fetch_venue.py <venue> [--refresh]   Venues: " + ", ".join(CFGS))
CFG = CFGS[KEY]
RAW = os.path.join(HERE, KEY, "raw")                                          # saved downloads
OUT = os.path.join(HERE, "..", "stadium-studio", "data", f"{KEY}-data.js")   # next to the page that uses it
UA = "stadium-studio-data/1.0 (personal visualization project)"

# Everything venue-specific comes from data/venues.json
LAT0, LON0 = CFG["center"]                   # first guess at the venue center
S, W, N, E = CFG["download_bbox"]            # area to download (south, west, north, east)
BOX = tuple(CFG["model_box"])                # area the model shows, in scene meters: x0, x1, z0, z1
SPORT = CFG.get("sport") or {}
TRANSIT = CFG.get("transit") or []
GRID = CFG.get("grid") or {}
NYC = CFG.get("city_pack") == "nyc"
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


def nyc_query(dataset, select, latlon=False):
    """NYC Open Data rows inside the download area."""
    where = (f"latitude between {S} and {N} and longitude between {W} and {E}" if latlon
             else f"within_box(the_geom,{N},{W},{S},{E})")
    q = urllib.parse.urlencode({"$where": where, "$limit": 5000, "$select": select})
    return get(f"https://data.cityofnewyork.us/resource/{dataset}.json?" + q)


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
def fetch_gtfs(url):
    return get(url)


# ---------------------------------------------------------------- 4. NHL
def fetch_schedule():
    return get(f"https://api-web.nhle.com/v1/club-schedule-season/{SPORT['team']}/{SPORT['season']}")


def fetch_pbp(gid):
    return get(f"https://api-web.nhle.com/v1/gamecenter/{gid}/play-by-play")


# ---------------------------------------------------------------- 5. Wikidata
def fetch_wikidata():
    return get(f"https://www.wikidata.org/wiki/Special:EntityData/{CFG['wikidata']}.json")


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


def osm_footprints(osm):
    """Outside NYC: turn OpenStreetMap buildings into the same shape as the city footprint rows."""
    out = []
    for el in osm:
        t = el.get("tags", {})
        if el["type"] != "way" or not t.get("building") or not el.get("geometry"):
            continue
        h = t.get("height", "").replace("m", "").strip()
        try:
            h = float(h)
        except ValueError:
            lv = t.get("building:levels", "")
            h = float(lv) * 3.2 if lv.replace(".", "").isdigit() else 10.0
        out.append({"bin": f"osm{el['id']}", "height_roof": h / FT, "construction_year": t.get("start_date", ""),
                    "the_geom": {"coordinates": [[[[g["lon"], g["lat"]] for g in el["geometry"]]]]}})
    return out


def city_extra(extra, G):
    """City-pack data in scene coordinates: census trees, tax lots, sidewalks."""
    inside = lambda p: BOX[0] < p[0] < BOX[1] and BOX[2] < p[1] < BOX[3]
    out = {}
    if "census_trees" in extra:
        out["trees"] = [G(float(t["latitude"]), float(t["longitude"])) + [int(float(t.get("tree_dbh") or 0)), t.get("spc_common", "")]
                        for t in extra["census_trees"] if t.get("status", "Alive") == "Alive" and t.get("latitude")]
        out["trees"] = [t for t in out["trees"] if inside(t)]
    if "lots" in extra:
        out["lots"] = [G(float(l["latitude"]), float(l["longitude"])) + [int(float(l.get("yearbuilt") or 0)), float(l.get("numfloors") or 0), l.get("bldgclass", ""), l.get("address", "")]
                       for l in extra["lots"] if l.get("latitude")]
        out["lots"] = [l for l in out["lots"] if inside(l)]
    if "sidewalks" in extra:
        sw = []
        for r in extra["sidewalks"]:
            geom = r.get("the_geom") or {}
            for poly in geom.get("coordinates", []):
                pts = clip_poly([G(lat, lon) for lon, lat in poly[0]])
                if len(pts) >= 3:
                    sw.append(pts)
        out["sidewalks"] = sw
    return out


# ================================================================ main
def main():
    os.makedirs(RAW, exist_ok=True)
    print(f"Venue: {CFG['name']}")
    print("1/6 OpenStreetMap")
    osm = json.loads(cached("osm.json", fetch_osm))["elements"]
    print(f"    {len(osm)} map features")
    print("2/6 Building footprints")
    if NYC:
        fp = json.loads(cached("footprints.json", fetch_footprints))
        print(f"    {len(fp)} buildings from NYC Open Data")
    else:
        fp = osm_footprints(osm)
        print(f"    {len(fp)} buildings from OpenStreetMap (no city footprint pack here)")
    print("3/6 City pack")
    extra = {}
    if NYC:
        extra["census_trees"] = json.loads(cached("nyc-street-trees.json", lambda: nyc_query("uvpi-gqnh", "tree_dbh,spc_common,status,latitude,longitude", True)))
        extra["lots"] = json.loads(cached("nyc-pluto.json", lambda: nyc_query("64uk-42ks", "bbl,address,bldgclass,yearbuilt,numfloors,landuse,latitude,longitude", True)))
        extra["sidewalks"] = json.loads(cached("nyc-sidewalks.json", lambda: nyc_query("52n9-sdep", "the_geom,feat_code")))
        print(f"    {len(extra['census_trees'])} census trees, {len(extra['lots'])} tax lots, {len(extra['sidewalks'])} sidewalk shapes")
    else:
        print("    none for this city yet (see data/README.md)")
    print("4/6 Transit")
    feed = TRANSIT[0] if TRANSIT else None
    gtfs = cached(f"gtfs-{feed['name']}.zip", lambda: fetch_gtfs(feed["url"])) if feed else None
    print("5/6 Sport")
    pbps = []
    if SPORT.get("league") == "nhl":
        sched = json.loads(cached(f"{SPORT['team'].lower()}-schedule-{SPORT['season']}.json", fetch_schedule))
        home = [g for g in sched["games"] if g.get("gameType") == 2 and g["homeTeam"]["abbrev"] == SPORT["team"]
                and g.get("gameState") in ("OFF", "FINAL")]
        for g in home:
            pbps.append(json.loads(cached(f"pbp-{g['id']}.json", lambda gid=g["id"]: (time.sleep(.3), fetch_pbp(gid))[1])))
        print(f"    {len(pbps)} {SPORT['team']} home games")
    else:
        print(f"    no shot data module for {SPORT.get('league', 'this venue')} yet")
    print("6/6 Wikidata")
    wd = json.loads(cached(f"wikidata-{CFG['wikidata']}.json", fetch_wikidata)) if CFG.get("wikidata") else None

    # ---- grid angle from the cross streets (31st to 34th run along the grid's east-west)
    def way_pts(el):
        return [to_local(g["lat"], g["lon"]) for g in el.get("geometry", []) if g]
    bearings = []
    for el in osm:
        nm = el.get("tags", {}).get("name", "")
        if el["type"] == "way" and el.get("tags", {}).get("highway") and nm in GRID.get("angle_streets", []):
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
            if min(math.hypot(*p) for p in pts) < 70 and area(pts) > 10000 and (msg_fp is None or area(pts) > area(msg_fp[1])):
                msg_fp = (b, pts)
    if msg_fp is None:
        sys.exit("Could not find the venue's own building near its center. Check 'center' in venues.json.")
    if CFG.get("shape") == "round":
        ring = [p for p in msg_fp[1] if 52 < math.hypot(*p) < 68]
        cx, cy, R, used = robust_circle(ring)
        print(f"    round venue: radius {R:.1f} m from {used} outline points")
    else:   # any other shape: center on the footprint, no circle
        cx = sum(p[0] for p in msg_fp[1]) / len(msg_fp[1]); cy = sum(p[1] for p in msg_fp[1]) / len(msg_fp[1])
        R = max(math.hypot(p[0] - cx, p[1] - cy) for p in msg_fp[1]); used = 0
        print(f"    venue footprint: about {2 * R:.0f} m across")

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
    grid = {"x_lo": mean_coord(GRID.get("x_lo"), 0), "x_hi": mean_coord(GRID.get("x_hi"), 0),
            "z_lo": mean_coord(GRID.get("z_lo"), 1), "z_hi": mean_coord(GRID.get("z_hi"), 1)}
    streets = clipped(streets, 25); paths = clipped(paths, 0)
    rails = clipped(rails, 0); platforms = [dict(p, pts=clip_poly(p["pts"])) for p in platforms]; platforms = [p for p in platforms if len(p["pts"]) >= 3]
    trees = [t for t in trees if BOX[0] < t[0] < BOX[1] and BOX[2] < t[1] < BOX[3]]
    # keep only the parts on the arena's own block (between 8th and 7th Ave, 33rd and 31st St)
    def on_block(pts):
        cx = sum(q[0] for q in pts) / len(pts); cz = sum(q[1] for q in pts) / len(pts)
        return -90 < cx < 184 and -79 < cz < 78
    parts = [p for p in parts if on_block(p["pts"])]
    print(f"    street grid: {grid}")

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
    print(f"    venue roof height: {drum_h:.1f} m;  {len(buildings)} other building pieces")

    # ---- transit: one weekday hour at the venue's station (from venues.json)
    moves, day = [], date.today()
    if gtfs:
      z = zipfile.ZipFile(io.BytesIO(gtfs))
      rd = lambda n: list(csv.DictReader(io.TextIOWrapper(z.open(n), "utf-8-sig")))
      stops = rd("stops.txt")
      penn = {s["stop_id"] for s in stops if feed["stop_match"] in s["stop_name"].lower()}
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
          if feed["hours"][0] <= hh < feed["hours"][1]:
              moves.append({"t": f"{hh:02d}:{mm:02d}", "min": mm, "kind": kind, "line": routes.get(tr["route_id"], ""), "to": other})
    moves.sort(key=lambda m: (m["min"], m["kind"]))
    if feed:
        print(f"    {len(moves)} {feed['label']} trains between {feed['hours'][0]}:00 and {feed['hours'][1]}:00 on {day.isoformat()}")

    # ---- NHL shots, folded so the home team attacks the +x end and opponents the -x end
    team_id = SPORT.get("team_id")
    rangers, opp = [], []
    goals = {"team": 0, "opp": 0}
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
            if shooter == team_id:
                rangers.append([rnd(x * FT), rnd(y * FT), 1 if goal else 0]); goals["team"] += goal
            else:
                opp.append([rnd(-x * FT), rnd(-y * FT), 1 if goal else 0]); goals["opp"] += goal
    if pbps:
        print(f"    {len(rangers)} {SPORT['team']} shots ({goals['team']} goals), {len(opp)} opponent shots ({goals['opp']} goals)")

    # ---- Wikidata facts
    ent = wd["entities"][CFG["wikidata"]]["claims"] if wd else {}
    def claim(pid):
        try:
            return ent[pid][0]["mainsnak"]["datavalue"]["value"]
        except (KeyError, IndexError):
            return None
    opened = claim("P1619") or claim("P571")
    cap = claim("P1083")
    facts = {"opened": opened["time"][1:11] if opened else None,
             "capacity": int(float(cap["amount"])) if cap else None,
             "wikidata": CFG.get("wikidata")}

    data = {
        "meta": {"made": date.today().isoformat(), "area": [S, W, N, E],
                 "grid_deg": rnd(math.degrees(math.atan2(ex[1], ex[0]))),
                 "note": "x = grid east, z = grid south (along the local street grid), meters, venue center at 0,0"},
        "drum": {"R": rnd(R), "h": rnd(drum_h)}, "complex": cplx, "grid": grid, "box": BOX, "parts": parts,
        "streets": streets, "paths": paths, "buildings": buildings,
        "rails": rails, "platforms": platforms, "trees": trees, "pitches": pitches,
        "trains": {"date": day.isoformat(), "label": feed["label"] if feed else None, "hours": feed["hours"] if feed else None, "moves": moves},
        "shots": {"season": SPORT.get("season"), "team": SPORT.get("team"), "games": len(pbps), "team_shots": rangers, "opp": opp, "goals": goals} if pbps else None,
        "city": city_extra(extra, G),
        "facts": facts,
    }
    with open(OUT, "w") as f:
        f.write("/* Made by data/fetch_msg.py. Do not edit by hand: run the script again instead. */\n")
        f.write(f"window.STADIUM_DATA=window.STADIUM_DATA||{{}};\nwindow.STADIUM_DATA.{KEY}=")
        json.dump(data, f, separators=(",", ":"))
        f.write(";\n")
    print(f"Saved {os.path.relpath(OUT)} ({os.path.getsize(OUT)//1024} KB)")


if __name__ == "__main__":
    main()
