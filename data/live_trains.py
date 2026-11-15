#!/usr/bin/env python3
"""
Live trains for Stadium Studio, straight from the MTA (free, no key).

Start it before recording:   python3 data/live_trains.py
Stop it:                     press Ctrl + C in the same window

While it runs, Stadium Studio (opened on this Mac) shows real trains arriving at each venue's
station, at real speed. Without it, the page falls back to the real timetable, sped up.

How it works: every 30 seconds it downloads the MTA's live "trip update" feeds, picks out the
trains due at each venue's station in the next half hour, and serves them at
http://127.0.0.1:8790/live.json for the page to read. Nothing leaves your Mac except the
downloads from the MTA.
"""
import csv, io, json, os, threading, time, urllib.request, zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "stadium-studio-live/1.0 (personal visualization project)"
FEED = "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/"
PORT = 8790

# which live feed carries which line, and each venue's station (matched by name in the timetable files)
LIVE = {
    "yankee": {"station": "161 St-Yankee Stadium", "static": "subway", "match": "161 st-yankee stadium",
               "feeds": {"nyct%2Fgtfs": ["4"], "nyct%2Fgtfs-bdfm": ["B", "D"]}},
    "msg":    {"station": "34 St-Penn Station", "static": "subway", "match": "34 st-penn station",
               "feeds": {"nyct%2Fgtfs": ["1", "2", "3"], "nyct%2Fgtfs-ace": ["A", "C", "E"]},
               "lirr": {"static": "lirr", "match": "penn", "feed": "lirr%2Fgtfs-lirr"}},
}


# ---------------------------------------------------------------- a tiny protobuf reader (the feeds are binary)
def varint(b, i):
    r = s = 0
    while True:
        c = b[i]; i += 1; r |= (c & 0x7F) << s; s += 7
        if c < 0x80:
            return r, i


def fields(b):
    i, out = 0, []
    while i < len(b):
        key, i = varint(b, i)
        f, wt = key >> 3, key & 7
        if wt == 0:
            v, i = varint(b, i)
        elif wt == 1:
            v = b[i:i + 8]; i += 8
        elif wt == 2:
            n, i = varint(b, i); v = b[i:i + n]; i += n
        elif wt == 5:
            v = b[i:i + 4]; i += 4
        else:
            raise ValueError("unexpected field type")
        out.append((f, v))
    return out


def trip_updates(raw):
    """Yield (route_id, trip_id, [(stop_id, arrival, departure), ...]) from a GTFS-realtime feed."""
    for f, ent in fields(raw):
        if f != 2:
            continue
        for g, tu in fields(ent):
            if g != 3:
                continue
            route = trip = ""
            stops = []
            for h, v in fields(tu):
                if h == 1:
                    for k, w in fields(v):
                        if k == 1: trip = w.decode()
                        if k == 5: route = w.decode()
                elif h == 2:
                    sid, arr, dep = "", 0, 0
                    for k, w in fields(v):
                        if k == 4: sid = w.decode()
                        if k in (2, 3):
                            t = next((x for n, x in fields(w) if n == 2), 0)
                            if k == 2: arr = t
                            else: dep = t
                    stops.append((sid, arr, dep))
            yield route, trip, stops


# ---------------------------------------------------------------- station ids from the timetable files already downloaded
def stop_ids(static, match):
    for venue in os.listdir(HERE):
        z = os.path.join(HERE, venue, "raw", f"gtfs-{static}.zip")
        if os.path.exists(z):
            with zipfile.ZipFile(z) as zf:
                rows = csv.DictReader(io.TextIOWrapper(zf.open("stops.txt"), "utf-8-sig"))
                return {r["stop_id"] for r in rows if match in r["stop_name"].lower().replace("–", "-")}
    raise SystemExit(f"Run 'python3 data/fetch_venue.py <venue>' first: the {static} timetable is not downloaded yet.")


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


STATE = {"updated": 0, "venues": {}, "error": None}


def refresh():
    now = time.time()
    out = {}
    for key, cfg in LIVE.items():
        ids = cfg.setdefault("_ids", stop_ids(cfg["static"], cfg["match"]))
        arr = []
        for feed, lines in cfg["feeds"].items():
            for route, trip, stops in trip_updates(get(FEED + feed)):
                if route not in lines:
                    continue
                for sid, a, d in stops:
                    t = a or d
                    if sid in ids and now - 120 < t < now + 1800:
                        arr.append({"line": route, "dir": sid[-1] if sid[-1] in "NS" else "", "t": t, "kind": "stop"})
        if "lirr" in cfg:
            L = cfg["lirr"]; lids = L.setdefault("_ids", stop_ids(L["static"], L["match"]))
            for route, trip, stops in trip_updates(get(FEED + L["feed"])):
                at = [s for s in stops if s[0] in lids]
                if not at:
                    continue
                sid, a, d = at[0]
                kind = "dep" if stops[0][0] in lids else "arr" if stops[-1][0] in lids else None
                t = d if kind == "dep" else a
                if kind and now - 300 < t < now + 1800:
                    arr.append({"line": "LIRR", "dir": "", "t": t, "kind": kind})
        out[key] = {"station": cfg["station"], "arrivals": sorted(arr, key=lambda x: x["t"])}
    STATE.update(updated=int(now), venues=out, error=None)
    print(time.strftime("%H:%M:%S"), " ".join(f"{k}: {len(v['arrivals'])} trains" for k, v in out.items()))


def loop():
    while True:
        try:
            refresh()
        except Exception as e:
            STATE["error"] = str(e); print("MTA feed problem, will retry:", e)
        time.sleep(30)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps(STATE).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")       # lets the page on this Mac read it
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    threading.Thread(target=loop, daemon=True).start()
    print(f"Live trains running. Open Stadium Studio on this Mac; it will switch to live trains. (http://127.0.0.1:{PORT}/live.json)")
    print("Press Ctrl + C to stop.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
