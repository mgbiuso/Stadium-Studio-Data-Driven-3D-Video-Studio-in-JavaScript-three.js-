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
  node["highway"~"traffic_signals|street_lamp"]{bb};
  node["railway"~"subway_entrance|station"]{bb};
  way["leisure"]{bb};
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


def schedule(feed, gtfs):
    """One weekday hour of trains at the station. Terminal stations (LIRR at Penn) list arrivals and departures;
    "through" stations (a subway stop) list every train that stops there, with its line and direction."""
    z = zipfile.ZipFile(io.BytesIO(gtfs))
    rd = lambda n: list(csv.DictReader(io.TextIOWrapper(z.open(n), "utf-8-sig")))
    stops = rd("stops.txt")
    here = {s["stop_id"] for s in stops if feed["stop_match"] in s["stop_name"].lower().replace("–", "-")}
    routes = {r["route_id"]: (r.get("route_short_name") if feed.get("through") else None) or r.get("route_long_name") or r.get("route_short_name") for r in rd("routes.txt")}
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
    moves = []
    if feed.get("through"):
        for st in rd("stop_times.txt"):
            if st["stop_id"] in here and st["trip_id"] in trips and trips[st["trip_id"]]["service_id"] in active:
                tm = st["arrival_time"] or st["departure_time"]; hh, mm = int(tm[:2]), int(tm[3:5])
                if feed["hours"][0] <= hh < feed["hours"][1]:
                    tr = trips[st["trip_id"]]
                    moves.append({"t": f"{hh:02d}:{mm:02d}", "min": mm, "kind": "stop", "line": routes.get(tr["route_id"], ""),
                                  "to": tr.get("trip_headsign", ""), "dir": tr.get("direction_id", ""), "stop": st["stop_id"]})
    else:
        by_trip = {}
        for st in rd("stop_times.txt"):
            if st["trip_id"] in trips and trips[st["trip_id"]]["service_id"] in active:
                by_trip.setdefault(st["trip_id"], []).append(st)
        for tid, sts in by_trip.items():
            sts.sort(key=lambda s: int(s["stop_sequence"]))
            first, last = sts[0], sts[-1]
            tr = trips[tid]
            if first["stop_id"] in here:
                tm, kind, other = first["departure_time"], "dep", tr.get("trip_headsign", "")
            elif last["stop_id"] in here:
                tm, kind, other = last["arrival_time"], "arr", next((s["stop_name"] for s in stops if s["stop_id"] == first["stop_id"]), "")
            else:
                continue
            hh, mm = int(tm[:2]), int(tm[3:5])
            if feed["hours"][0] <= hh < feed["hours"][1]:
                moves.append({"t": f"{hh:02d}:{mm:02d}", "min": mm, "kind": kind, "line": routes.get(tr["route_id"], ""), "to": other})
    moves.sort(key=lambda m: (m["min"], m["kind"]))
    return moves, day


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



# ---------------------------------------------------------------- extras pack: what's under and around, and the history
def fetch_entrances():
    """Every subway stair, elevator and passage to the street (MTA, New York State open data)."""
    where = f"within_box(entrance_georeference,{N},{W},{S},{E})"
    q = urllib.parse.urlencode({"$where": where, "$limit": 2000})
    return get("https://data.ny.gov/resource/i9wp-a4ja.json?" + q)


def fetch_day_weather(day, station):
    """One day's weather from NOAA's daily records (Central Park goes back to 1869)."""
    q = urllib.parse.urlencode({"dataset": "daily-summaries", "stations": station, "startDate": day, "endDate": day,
                                "dataTypes": "TMAX,TMIN,PRCP,SNOW", "units": "standard", "format": "json"})
    return get("https://www.ncei.noaa.gov/access/services/data/v1?" + q)


def fetch_landmarks():
    """NYC Landmarks Preservation Commission totals: individual landmarks and historic districts."""
    sites = json.loads(get("https://data.cityofnewyork.us/resource/buis-pvji.json?" + urllib.parse.urlencode(
        {"$select": "lpc_lpnumb,desdate,lpc_sitest", "$limit": 10000})))
    first = {}
    for r in sites:
        if r.get("lpc_sitest") == "Designated" and r.get("desdate"):
            m, d, y = r["desdate"][:10].split("/") if "/" in r["desdate"] else (r["desdate"][5:7], r["desdate"][8:10], r["desdate"][:4])
            iso = f"{y[:4]}-{int(m):02d}-{int(d):02d}"
            first[r["lpc_lpnumb"]] = min(first.get(r["lpc_lpnumb"], iso), iso)
    days = sorted(first.values())
    districts = json.loads(get("https://data.cityofnewyork.us/resource/skyk-mpzq.json?$select=count(*)"))[0]["count"]
    return json.dumps({"individual_landmarks": len(first), "first_designation": days[0], "latest_designation": days[-1],
                       "historic_district_records": int(districts), "checked": date.today().isoformat(),
                       "sources": ["data.cityofnewyork.us buis-pvji (Individual Landmark Sites)", "data.cityofnewyork.us skyk-mpzq (Historic Districts)"]}).encode()



# ---------------------------------------------------------------- NYC 3D Building Model (2014, CityGML), read straight from the zip
def sp_to_ll(X, Y):
    """New York State Plane, Long Island zone (EPSG:2263, US survey feet) -> latitude, longitude.
    Checked against NYC PLUTO lot coordinates: 0.0 m difference."""
    ftUS = 1200 / 3937; a = 6378137.0; f = 1 / 298.257222101; e = math.sqrt(2 * f - f * f); r = math.radians
    p1, p2, p0, l0 = r(41 + 2 / 60), r(40 + 40 / 60), r(40 + 10 / 60), r(-74)
    x = X * ftUS - 300000.0; y = Y * ftUS
    m = lambda p: math.cos(p) / math.sqrt(1 - e * e * math.sin(p) ** 2)
    t = lambda p: math.tan(math.pi / 4 - p / 2) / ((1 - e * math.sin(p)) / (1 + e * math.sin(p))) ** (e / 2)
    n = (math.log(m(p1)) - math.log(m(p2))) / (math.log(t(p1)) - math.log(t(p2))); F = m(p1) / (n * t(p1) ** n); r0 = a * F * t(p0) ** n
    rr = math.copysign(math.hypot(x, r0 - y), n); tt = (rr / (a * F)) ** (1 / n); th = math.atan2(x, r0 - y)
    lat = math.pi / 2 - 2 * math.atan(tt)
    for _ in range(8):
        lat = math.pi / 2 - 2 * math.atan(tt * ((1 - e * math.sin(lat)) / (1 + e * math.sin(lat))) ** (e / 2))
    return math.degrees(lat), math.degrees(th / n + l0)


def read_nyc3d(cfg):
    """Buildings from the city's 2014 3D model inside the download area: BIN, then roof and wall polygons
    as [x_ft, y_ft, z_ft] state plane points. The 13.8 GB of files are streamed from the zip, never unzipped."""
    import zipfile, xml.etree.ElementTree as ET
    zpath = os.path.join(HERE, cfg["zip"])
    lo = [min(c) for c in zip(*[sp_xy(S, W), sp_xy(N, E), sp_xy(S, E), sp_xy(N, W)])]
    hi = [max(c) for c in zip(*[sp_xy(S, W), sp_xy(N, E), sp_xy(S, E), sp_xy(N, W)])]
    G_ = "{http://www.opengis.net/gml}"; B_ = "{http://www.opengis.net/citygml/building/1.0}"; GEN = "{http://www.opengis.net/citygml/generics/1.0}"
    out = []
    with zipfile.ZipFile(zpath) as z:
        for member in cfg["members"]:
            name = next(n for n in z.namelist() if n.endswith(f"/{member}_3D_Buildings_Merged.gml"))
            print(f"    reading {name} ({z.getinfo(name).file_size // 1_000_000} MB) ...")
            with z.open(name) as f:
                for ev, el in ET.iterparse(f, events=("end",)):
                    if el.tag != B_ + "Building":
                        continue
                    first = el.find(f".//{G_}posList")
                    if first is not None:
                        v = first.text.split()
                        x, y = float(v[0]), float(v[1])
                        if lo[0] - 300 < x < hi[0] + 300 and lo[1] - 300 < y < hi[1] + 300:
                            bin_ = None
                            for a in el.findall(f"{GEN}stringAttribute"):
                                if a.get("name") == "BIN":
                                    bin_ = a.findtext(f"{GEN}value")
                            surf = []
                            for kind, tag in (("R", "RoofSurface"), ("W", "WallSurface"), ("G", "GroundSurface")):
                                for s_ in el.iter(B_ + tag):
                                    for pl in s_.iter(G_ + "posList"):
                                        n_ = list(map(float, pl.text.split()))
                                        surf.append([kind, [n_[i:i + 3] for i in range(0, len(n_), 3)]])
                            out.append({"bin": bin_, "s": surf})
                    el.clear()
    return json.dumps(out).encode()


def sp_xy(lat, lon):
    """latitude, longitude -> New York State Plane feet (the inverse of sp_to_ll)."""
    ftUS = 1200 / 3937; a = 6378137.0; f = 1 / 298.257222101; e = math.sqrt(2 * f - f * f); r = math.radians
    p1, p2, p0, l0 = r(41 + 2 / 60), r(40 + 40 / 60), r(40 + 10 / 60), r(-74)
    m = lambda p: math.cos(p) / math.sqrt(1 - e * e * math.sin(p) ** 2)
    t = lambda p: math.tan(math.pi / 4 - p / 2) / ((1 - e * math.sin(p)) / (1 + e * math.sin(p))) ** (e / 2)
    n = (math.log(m(p1)) - math.log(m(p2))) / (math.log(t(p1)) - math.log(t(p2))); F = m(p1) / (n * t(p1) ** n); r0 = a * F * t(p0) ** n
    rr = a * F * t(r(lat)) ** n; th = n * (r(lon) - l0)
    return (rr * math.sin(th) + 300000) / ftUS, (r0 - rr * math.cos(th)) / ftUS


def city3d(blds, G):
    """3D model buildings in scene meters: each wall and roof polygon as flat [x, y, z, ...], y measured up from the
    building's own ground (the model's street is flat at 0). Only buildings inside the model box are kept."""
    if not blds:
        return None
    inside = lambda p: BOX[0] - 5 < p[0] < BOX[1] + 5 and BOX[2] - 5 < p[1] < BOX[3] + 5
    cache, out = {}, {}
    def P(x, y):
        k = (round(x, 1), round(y, 1))
        if k not in cache:
            cache[k] = G(*sp_to_ll(x, y))
        return cache[k]
    for b in blds:
        if not b.get("bin"):
            continue
        zs = [p[2] for kind, ring in b["s"] for p in ring]
        g = [p for kind, ring in b["s"] if kind == "G" for p in ring]
        base = min(p[2] for p in g) if g else min(zs)
        cx = sum(p[0] for p in (g or [q for _, r in b["s"] for q in r])) / max(1, len(g or [q for _, r in b["s"] for q in r]))
        cy = sum(p[1] for p in (g or [q for _, r in b["s"] for q in r])) / max(1, len(g or [q for _, r in b["s"] for q in r]))
        if not inside(P(cx, cy)):
            continue
        polys = []
        for kind, ring in b["s"]:
            if kind == "G" or len(ring) < 4:
                continue
            flat = []
            for x, y, z in ring[:-1]:
                sx, sz = P(x, y); flat += [sx, rnd((z - base) * FT), sz]
            polys.append([kind] + flat)
        if polys:
            out[b["bin"]] = {"h": rnd((max(zs) - base) * FT), "p": polys}
    return out



# ---------------------------------------------------------------- geology pack: bedrock from USGS boreholes, basements from the city
def utm18_ll(E_, N_):
    """UTM zone 18N meters (NAD83) -> latitude, longitude."""
    a = 6378137.0; f = 1 / 298.257222101; e2 = 2 * f - f * f; k0 = .9996; ep2 = e2 / (1 - e2)
    x = E_ - 500000; m = N_ / k0; mu = m / (a * (1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 ** 3 / 256)); e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    p = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu) + (151 * e1 ** 3 / 96) * math.sin(6 * mu)
    C = ep2 * math.cos(p) ** 2; T = math.tan(p) ** 2; Nn = a / math.sqrt(1 - e2 * math.sin(p) ** 2); R = a * (1 - e2) / (1 - e2 * math.sin(p) ** 2) ** 1.5; D_ = x / (Nn * k0)
    lat = p - (Nn * math.tan(p) / R) * (D_ * D_ / 2 - (5 + 3 * T + 10 * C - 4 * C * C - 9 * ep2) * D_ ** 4 / 24 + (61 + 90 * T + 298 * C + 45 * T * T - 252 * ep2 - 3 * C * C) * D_ ** 6 / 720)
    lon = (D_ - (1 + 2 * T + C) * D_ ** 3 / 6 + (5 - 2 * C + 28 * T - 3 * C * C + 8 * ep2 + 24 * T * T) * D_ ** 5 / 120) / math.cos(p)
    return math.degrees(lat), math.degrees(lon) - 75


def read_bedrock_points(zpath):
    """USGS bedrock points (DeMott and others, 2023, doi:10.5066/P911CSI3): latitude, longitude, rock-surface elevation (ft NAVD88), depth (ft), source."""
    import zipfile, struct
    z = zipfile.ZipFile(zpath); shp = z.read("bedrock_pts.shp"); dbf = z.read("bedrock_pts.dbf")
    nrec = struct.unpack("<I", dbf[4:8])[0]; hl = struct.unpack("<H", dbf[8:10])[0]; rl = struct.unpack("<H", dbf[10:12])[0]
    fields, i = [], 32
    while dbf[i] != 0x0D:
        fields.append((dbf[i:i + 11].split(b"\0")[0].decode(), dbf[i + 16])); i += 32
    rows = []
    for k in range(nrec):
        r = dbf[hl + k * rl:hl + (k + 1) * rl]; pos = 1; row = {}
        for nm, ln in fields:
            row[nm] = r[pos:pos + ln].decode(errors="ignore").strip(); pos += ln
        rows.append(row)
    out, off, k = [], 100, 0
    while off < len(shp):
        num, cl = struct.unpack(">II", shp[off:off + 8]); st = struct.unpack("<i", shp[off + 8:off + 12])[0]
        if st == 1 and rows[k].get("Elev_ft"):
            la, lo = utm18_ll(*struct.unpack("<2d", shp[off + 12:off + 28]))
            if S - .004 < la < N + .004 and W - .004 < lo < E + .004:
                out.append([la, lo, float(rows[k]["Elev_ft"]), float(rows[k]["Depth_ft"] or 0), rows[k]["Source"], rows[k]["Data_type"]])
        off += 8 + cl * 2; k += 1
    return json.dumps(out).encode()


def fetch_basements():
    """Which buildings have space below grade (NYC Building Elevation and Subgrade, 2022). Yes or no only, no depth."""
    where = f"latitude between {S} and {N} and longitude between {W} and {E}"
    q = urllib.parse.urlencode({"$where": where, "$limit": 5000, "$select": "bin,subgrade,z_grade,z_floor"})
    return get("https://data.cityofnewyork.us/resource/bsin-59hv.json?" + q)


def ground_pack(pts, G, street_ft):
    """Bedrock surface as a grid (inverse-distance weighting of the boreholes), in scene meters below the street."""
    if not pts:
        return None
    P = [(G(la, lo), el, dp, src) for la, lo, el, dp, src, _ in pts]
    cell = 10.0; x0, x1, z0, z1 = BOX; nx = int((x1 - x0) / cell) + 1; nz = int((z1 - z0) / cell) + 1
    grid = []
    for j in range(nz):
        for i in range(nx):
            x = x0 + i * cell; z = z0 + j * cell; ws = vs = 0.0
            for (px, pz), el, dp, src in P:
                d2 = (px - x) ** 2 + (pz - z) ** 2 + 25.0; w = 1 / d2
                ws += w; vs += w * el
            grid.append(rnd((vs / ws - street_ft) * FT))
    return {"cell": cell, "x0": x0, "z0": z0, "nx": nx, "nz": nz, "rock": grid, "street_ft": street_ft,
            "points": [[p[0], p[1], rnd((el - street_ft) * FT), rnd(dp * FT), src] for p, el, dp, src in P if BOX[0] < p[0] < BOX[1] and BOX[2] < p[1] < BOX[3]],
            "source": "USGS: DeMott, Stumm, Como and Finkelstein, 2023, Geospatial data for bedrock elevation and overburden thickness maps of the Five Boroughs, New York City, New York, doi:10.5066/P911CSI3"}


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
    hist = CFG.get("history") or {}
    if NYC:
        extra["entrances"] = json.loads(cached("mta-entrances.json", fetch_entrances))
        extra["landmarks"] = json.loads(cached("lpc-landmarks.json", fetch_landmarks))
        print(f"    {len(extra['entrances'])} subway entrances, {extra['landmarks']['individual_landmarks']} city landmarks")
    if CFG.get("nyc3d") and os.path.exists(os.path.join(HERE, CFG["nyc3d"]["zip"])):
        extra["nyc3d"] = json.loads(cached("nyc3d.json", lambda: read_nyc3d(CFG["nyc3d"])))
        print(f"    {len(extra['nyc3d'])} buildings from the NYC 3D Building Model (2014)")
    if CFG.get("bedrock") and os.path.exists(os.path.join(HERE, CFG["bedrock"]["zip"])):
        extra["bedrock"] = json.loads(cached("bedrock-points.json", lambda: read_bedrock_points(os.path.join(HERE, CFG["bedrock"]["zip"]))))
        print(f"    {len(extra['bedrock'])} USGS bedrock points near the venue")
    if NYC:
        extra["basements"] = json.loads(cached("nyc-basements.json", fetch_basements))
    extra["days"] = []
    for d in hist.get("days", []):
        w = json.loads(cached(f"weather-{d['date']}.json", lambda d=d: fetch_day_weather(d["date"], hist.get("weather_station", "USW00094728"))))
        extra["days"].append(dict(d, weather=(w[0] if w else None), weather_source=f"NOAA daily summaries, station {hist.get('weather_station', 'USW00094728')}"))
    if extra["days"]:
        print(f"    weather for {len(extra['days'])} history dates")
    print("4/6 Transit")
    feeds = [(f, cached(f"gtfs-{f['name']}.zip", lambda f=f: fetch_gtfs(f["url"]))) for f in TRANSIT]
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
            near = (min(math.hypot(*p) for p in pts) < 70) if CFG.get("shape") == "round" else \
                   (math.hypot(sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) < 150)   # big venues: the shape's middle is near the center
            if near and area(pts) > 10000 and (msg_fp is None or area(pts) > area(msg_fp[1])):
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
    els, furniture = [], []
    for el in osm:
        t = el.get("tags", {})
        if el["type"] == "node" and t.get("natural") == "tree":
            trees.append(G(el["lat"], el["lon"]))
            continue
        if el["type"] == "node":
            kind = t.get("highway") or t.get("railway")
            if kind in ("traffic_signals", "street_lamp", "subway_entrance", "station"):
                furniture.append({"kind": kind, "name": t.get("name", ""), "p": G(el["lat"], el["lon"])})
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
        if t.get("railway") in ("rail", "subway") and not under and t.get("service") not in ("yard", "siding"):
            els.append({"ref": t.get("ref", ""), "name": t.get("name", ""), "bridge": t.get("bridge", ""), "layer": layer, "pts": pts,
                        "subway": t.get("railway") == "subway"})          # above-ground track, like the 4 train over River Avenue
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
    rails = clipped(rails, 0); els = clipped(els, 0)
    furniture = [f for f in furniture if BOX[0] < f["p"][0] < BOX[1] and BOX[2] < f["p"][1] < BOX[3]]
    platforms = [dict(p, pts=clip_poly(p["pts"])) for p in platforms]; platforms = [p for p in platforms if len(p["pts"]) >= 3]
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
    transit = []
    for feed, gtfs in feeds:
        moves, day = schedule(feed, gtfs)
        transit.append({"label": feed["label"], "through": bool(feed.get("through")), "hours": feed["hours"], "date": day.isoformat(), "moves": moves})
        print(f"    {len(moves)} {feed['label']} trains between {feed['hours'][0]}:00 and {feed['hours'][1]}:00 on {day.isoformat()}")
    first = transit[0] if transit else None

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
        "rails": rails, "els": els, "furniture": furniture, "platforms": platforms, "trees": trees, "pitches": pitches,
        "trains": first, "transit": transit,
        "shots": {"season": SPORT.get("season"), "team": SPORT.get("team"), "games": len(pbps), "team_shots": rangers, "opp": opp, "goals": goals} if pbps else None,
        "city": city_extra(extra, G),
        "facts": facts,
        "under": {"entrances": [{"p": G(float(e["entrance_latitude"]), float(e["entrance_longitude"])), "routes": e.get("daytime_routes", ""),
                                 "station": e.get("stop_name", ""), "type": e.get("entrance_type", ""), "line": e.get("line", "")}
                                for e in extra.get("entrances", []) if e.get("entrance_latitude")],
                  "ground_ft": (sorted(float(b["ground_elevation"]) for b in fp if b.get("ground_elevation"))[len(fp) // 2] if NYC and fp else None)},
        "history": {"days": extra.get("days", []), "landmarks": extra.get("landmarks")},
        "city3d": city3d(extra.get("nyc3d"), G),
        "ground": ground_pack(extra.get("bedrock"), G, (sorted(float(b["ground_elevation"]) for b in fp if b.get("ground_elevation"))[len(fp) // 2] if NYC and fp else 0)),
        "basements": sorted({str(int(float(b["bin"]))) for b in extra.get("basements", []) if b.get("subgrade") == "Y" and b.get("bin")}),
    }
    with open(OUT, "w") as f:
        f.write("/* Made by data/fetch_msg.py. Do not edit by hand: run the script again instead. */\n")
        f.write(f"window.STADIUM_DATA=window.STADIUM_DATA||{{}};\nwindow.STADIUM_DATA.{KEY}=")
        json.dump(data, f, separators=(",", ":"))
        f.write(";\n")
    print(f"Saved {os.path.relpath(OUT)} ({os.path.getsize(OUT)//1024} KB)")


if __name__ == "__main__":
    main()
