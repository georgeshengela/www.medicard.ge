"""MEDIRUN gift-box spots for Tbilisi, harvested from OpenStreetMap (Overpass API).

Run:  python harvest.py
      Downloads 5 bounded Overpass queries once into $MEDIRUN_OSM_CACHE (default ./cache, ~80 MB raw OSM JSON),
      then writes server/src/data/medirun-spots-tbilisi.json. Needs: pip install shapely pyproj numpy

Rules (owner brief, 2026-10-01): spots are nodes of public footways/paths/pedestrian ways inside free,
public parks / gardens / squares / named pedestrian streets inside the Tbilisi city boundary; >= 15 m from
motor roads (20 m from rail); away from cemeteries, places of worship, schools, kindergartens, hospitals,
clinics, military, prisons, construction (20 m), water / rivers / cliffs (25 m), playgrounds, pitches, zoos
and theme parks; never inside private or paid areas; never on bridges, tunnels, indoor, steep or informal
trails; >= 150 m apart; about 1 spot per 3 ha (max 8) per park; deeper nodes preferred (depthM, rewarded up
to 150 m from the park edge, not on the outer 8 m).
Golden points are hand-picked OSM node ids (checked on maps of the surroundings); if OSM renumbers a node
the script stops at the assert and the point has to be picked again.
"""
import json, math, os, re, sys, time, datetime, collections, urllib.request, urllib.parse
import numpy as np
import shapely
from shapely.geometry import Point, Polygon, LineString
from shapely.ops import polygonize, unary_union
from shapely.strtree import STRtree
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
OUT = os.path.join(REPO, "server", "src", "data", "medirun-spots-tbilisi.json")
CACHE = os.environ.get("MEDIRUN_OSM_CACHE") or os.path.join(HERE, "cache")

# ---------------------------------------------------------------- Overpass (few, bounded queries; cached)
ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
             "https://maps.mail.ru/osm/tools/overpass/api/interpreter"]
CITY_AREA = "area(id:3601996871)->.t;"
QUERIES = {
    "bounds_geom": "[out:json][timeout:180];rel(id:1996871,11300436,11300438,11300445,11300446,11300449,"
                   "13438808,13438809,13438810,13438811,13438812);out body geom;",
    "areas": "[out:json][timeout:180];" + CITY_AREA + """(
 way["leisure"~"^(park|garden|playground|water_park|stadium|pitch|dog_park)$"](area.t);
 rel["leisure"~"^(park|garden|playground|water_park)$"](area.t);
 nwr["place"="square"](area.t);
 way["highway"="pedestrian"](area.t); rel["highway"="pedestrian"](area.t); way["area:highway"="pedestrian"](area.t);
 nwr["tourism"~"^(zoo|theme_park)$"](area.t); nwr["leisure"~"^(amusement_arcade|nature_reserve)$"](area.t);
 nwr["landuse"~"^(cemetery|military|construction|reservoir|basin)$"](area.t);
 nwr["amenity"~"^(grave_yard|place_of_worship|school|kindergarten|hospital|clinic|prison)$"](area.t);
 nwr["natural"~"^(water|cliff|wetland)$"](area.t); nwr["waterway"~"^(river|riverbank|canal)$"](area.t); nwr["water"](area.t);
 nwr["military"](area.t); nwr["aerialway"="station"](area.t); way["aerialway"](area.t); nwr["amenity"="fountain"](area.t);
 nwr["barrier"~"^(fence|wall)$"]["access"~"^(private|no)$"](area.t);
);out body geom;""",
    "paths": "[out:json][timeout:180];" + CITY_AREA + 'way["highway"~"^(footway|path|pedestrian)$"](area.t);out body geom;',
    "roads": "[out:json][timeout:180];" + CITY_AREA + """(
 way["highway"~"^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link|residential|unclassified|living_street|service|road)$"](area.t);
 way["railway"~"^(rail|light_rail|tram|narrow_gauge)$"](area.t);
);out tags geom;""",
    "private": "[out:json][timeout:180];" + CITY_AREA + """(
 way["access"~"^(private|no|customers|permit)$"]["highway"!~"."]["barrier"!~"."](area.t);
 rel["access"~"^(private|no|customers|permit)$"](area.t);
 way["fee"="yes"]["highway"!~"."](area.t); rel["fee"="yes"](area.t);
);out body geom;""",
}
def load(name, rounds=4):
    path = os.path.join(CACHE, name + ".json")
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        data = urllib.parse.urlencode({"data": QUERIES[name]}).encode()
        for rnd in range(rounds):
            for ep in ENDPOINTS:
                try:
                    req = urllib.request.Request(ep, data=data, headers={"User-Agent": "medicard-medirun-spots/1.0"})
                    with urllib.request.urlopen(req, timeout=200) as r: raw = r.read()
                    j = json.loads(raw)
                    if "error" in (j.get("remark") or "").lower(): raise RuntimeError(j["remark"])
                    open(path, "wb").write(raw); print(f"{name}: {len(raw) / 1e6:.1f} MB from {ep}", file=sys.stderr)
                    break
                except Exception as e:
                    print(f"{name}: {ep} failed: {e}", file=sys.stderr)
            else:
                time.sleep(20 + 20 * rnd); continue
            break
        else:
            raise SystemExit(f"Overpass unavailable for {name}")
    return json.load(open(path, encoding="utf-8"))["elements"]

# ---------------------------------------------------------------- geometry (metres: UTM 38N)
_fwd = Transformer.from_crs(4326, 32638, always_xy=True)
_inv = Transformer.from_crs(32638, 4326, always_xy=True)
def proj(lng, lat): return _fwd.transform(lng, lat)
def unproj(x, y): return _inv.transform(x, y)
def coords(geom): return [proj(g["lon"], g["lat"]) for g in geom if g]
def way_line(e):
    c = coords(e["geometry"])
    return LineString(c) if len(c) >= 2 else None
def way_poly(e):
    c = coords(e["geometry"])
    if len(c) >= 4 and c[0] == c[-1]:
        p = Polygon(c)
        if not p.is_valid: p = p.buffer(0)
        return p if p.area > 0 else None
    return None
def rel_poly(e):
    outers, inners = [], []
    for m in e.get("members", []):
        if m["type"] != "way" or "geometry" not in m: continue
        c = coords(m["geometry"])
        if len(c) < 2: continue
        (inners if m.get("role") == "inner" else outers).append(LineString(c))
    def rings(lines):
        polys = list(polygonize(unary_union(lines))) if lines else []
        return unary_union(polys) if polys else None
    o = rings(outers)
    if o is None: return None
    i = rings(inners)
    if i is not None: o = o.difference(i)
    if not o.is_valid: o = o.buffer(0)
    return o if o.area > 0 else None
def element_geom(e):
    """Polygon for closed ways / multipolygons, LineString for open ways, Point for nodes."""
    if e["type"] == "node": return Point(proj(e["lon"], e["lat"]))
    if e["type"] == "way":
        p = way_poly(e)
        return p if p is not None else way_line(e)
    if e["type"] == "relation":
        if e.get("tags", {}).get("type") not in ("multipolygon", "boundary"): return None
        return rel_poly(e)

MIN_SPACING = 150.0
ROAD_MIN = 15.0
RAIL_MIN = 20.0
DEPTH_SWEET = 150.0  # deeper than this is not rewarded further (keeps boxes off remote forest trails)
MIN_DEPTH = 8.0      # never on the outer edge of a park / garden / square

DISTRICTS = {
    11300436: ("Samgori", "სამგორი"), 11300438: ("Nadzaladevi", "ნაძალადევი"), 11300445: ("Didube", "დიდუბე"),
    11300446: ("Saburtalo", "საბურთალო"), 11300449: ("Vake", "ვაკე"), 13438808: ("Isani", "ისანი"),
    13438809: ("Krtsanisi", "კრწანისი"), 13438810: ("Chughureti", "ჩუღურეთი"), 13438811: ("Mtatsminda", "მთაწმინდა"),
    13438812: ("Gldani", "გლდანი"),
}
CITY_REL = 1996871
MOTOR = re.compile(r"^(motorway|trunk|primary|secondary|tertiary)(_link)?$|^(residential|unclassified|living_street|service|road)$")

# ---------------------------------------------------------------- Georgian -> Latin (national system)
KA = dict(zip("აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ",
              ["a","b","g","d","e","v","z","t","i","k'","l","m","n","o","p'","zh","r","s","t'","u","p","k","gh","q'","sh","ch","ts","dz","ts'","ch'","kh","j","h"]))
KA_PLAIN = {k: v.replace("'", "") for k, v in KA.items()}
def translit(s, plain=False):
    m = KA_PLAIN if plain else KA
    return "".join(m.get(ch, ch) for ch in s)
def has_ka(s): return bool(s) and any("ა" <= ch <= "ჿ" for ch in s)
def slugify(s):
    s = translit(s, plain=True).lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s[:40].strip("-") or "spot"

# ---------------------------------------------------------------- boundaries
bounds = {e["id"]: e for e in load("bounds_geom")}
city = rel_poly(bounds[CITY_REL])
districts = [(rid, rel_poly(bounds[rid])) for rid in DISTRICTS]
def district_of(pt):
    for rid, poly in districts:
        if poly.covers(pt): return rid
    return min(districts, key=lambda d: d[1].distance(pt))[0]

# ---------------------------------------------------------------- areas: candidates and exclusions
areas = load("areas")
cands = []        # dict(kind, geom, tags, id, name...)
excl = []         # (geom, buffer_m, reason)
water_polys = []; river_lines = []; fountains = []; stations = []
BAD_ACCESS = {"private", "no", "customers", "permit", "military"}

def is_free_public(t):
    if t.get("access") in BAD_ACCESS: return False
    if t.get("fee") in ("yes",) or (t.get("charge") and t.get("fee") != "no"): return False
    if t.get("abandoned") == "yes" or t.get("disused") == "yes": return False
    if t.get("tourism") == "zoo": return False
    nm = (t.get("name", "") + " " + t.get("name:en", "")).lower()
    if "ზოოპარკ" in nm or " zoo" in " " + nm or "ბოტანიკურ" in nm or "botanical" in nm: return False
    return True

for e in areas:
    t = e.get("tags", {})
    g = element_geom(e)
    if g is None: continue
    poly = g.geom_type in ("Polygon", "MultiPolygon")
    lei, am, lu, nat, ww = t.get("leisure"), t.get("amenity"), t.get("landuse"), t.get("natural"), t.get("waterway")
    # --- exclusions
    if lu in ("cemetery",) or am == "grave_yard": excl.append((g, 20, "cemetery"))
    if am == "place_of_worship" and poly: excl.append((g, 20, "worship"))
    if lu == "religious" and poly: excl.append((g, 20, "worship"))
    if am in ("school", "kindergarten", "hospital", "clinic"):
        excl.append((g, 20 if poly else 30, am))
    if lu == "education" and poly: excl.append((g, 20, "education"))
    if lu == "military" or "military" in t: excl.append((g, 20 if poly else 30, "military"))
    if am == "prison": excl.append((g, 20, "prison"))
    if lu == "construction": excl.append((g, 20, "construction"))
    if poly and (nat == "water" or "water" in t or lu in ("reservoir", "basin") or ww == "riverbank"):
        excl.append((g, 25, "water")); water_polys.append(g)
    if ww == "river":
        if poly: excl.append((g, 25, "water")); water_polys.append(g)
        else: excl.append((g, 25, "river")); river_lines.append(g)
    if ww == "canal": excl.append((g, 25 if poly else 15, "canal"))
    if nat == "wetland": excl.append((g, 15, "wetland"))
    if nat == "cliff": excl.append((g, 25, "cliff"))
    if am == "fountain":
        excl.append((g, 5 if poly else 8, "fountain")); fountains.append((e, g))
    if lei == "playground" and poly: excl.append((g, 5, "playground"))
    if lei in ("pitch", "stadium", "dog_park") and poly: excl.append((g, 3, lei))
    if lei == "water_park" or t.get("tourism") == "zoo": excl.append((g, 20, "zoo/waterpark"))
    if t.get("tourism") == "theme_park" and lei != "park" and poly: excl.append((g, 10, "theme_park"))
    if t.get("aerialway") == "station": stations.append((e, g))
    # --- candidates
    kind = None
    if lei in ("park", "garden") and poly: kind = lei
    elif t.get("place") == "square" and poly: kind = "square"
    elif (t.get("highway") == "pedestrian" or t.get("area:highway") == "pedestrian") and t.get("name"):
        kind = "pedestrian"
    if kind and (city.intersects(g)):
        if not is_free_public(t):
            excl.append((g, 0, "fee/private:" + t.get("name", "")))
            continue
        if kind == "garden" and t.get("garden:type") in ("residential", "private"): continue
        name = t.get("name:ka") or t.get("name") or t.get("name:en")
        cands.append(dict(id=f"{e['type'][0]}{e['id']}", kind=kind, geom=g, tags=t, named=bool(name), linear=not poly,
                          area=g.area if poly else 0.0))

# closed private / paid areas (gated yards, paid sports grounds, private parks): a spot is never inside one
for e in load("private"):
    if e["type"] == "node": continue
    t = e.get("tags", {})
    g = element_geom(e)
    if g is None or g.geom_type not in ("Polygon", "MultiPolygon"): continue
    if t.get("access") in BAD_ACCESS or t.get("fee") == "yes":
        excl.append((g, 0, "private/fee"))
print(f"candidates: {len(cands)}  exclusions: {len(excl)}", file=sys.stderr)

# ---------------------------------------------------------------- roads
roads, rails = [], []
for e in load("roads"):
    t = e.get("tags", {})
    ln = way_line(e)
    if ln is None: continue
    if "railway" in t and t["railway"] in ("rail", "light_rail", "tram", "narrow_gauge"):
        if t.get("tunnel") in (None, "no"): rails.append(ln)
        continue
    hw = t.get("highway", "")
    if not MOTOR.match(hw): continue
    if t.get("tunnel") not in (None, "no"): continue  # an underground road is not traffic next to you
    roads.append(ln)
road_tree = STRtree(roads); rail_tree = STRtree(rails)
print(f"roads: {len(roads)} rails: {len(rails)}", file=sys.stderr)

# ---------------------------------------------------------------- path nodes
paths = load("paths")
node_xy = {}; node_ways = collections.defaultdict(list)
way_ok = {}
BAD_SAC = {"mountain_hiking", "demanding_mountain_hiking", "alpine_hiking", "demanding_alpine_hiking", "difficult_alpine_hiking"}
for e in paths:
    t = e["tags"]
    ok = True
    if t.get("footway") in ("sidewalk", "crossing", "traffic_island"): ok = False
    if t.get("access") in BAD_ACCESS or t.get("foot") in ("no", "private"): ok = False
    if t.get("bridge") not in (None, "no") or t.get("tunnel") not in (None, "no"): ok = False
    if t.get("indoor") == "yes" or t.get("covered") == "yes": ok = False
    try:
        if t.get("layer") and float(t["layer"].split(";")[0]) != 0: ok = False
    except ValueError: pass
    if t.get("sac_scale") in BAD_SAC or t.get("informal") == "yes": ok = False
    if t.get("trail_visibility") in ("bad", "very_bad", "horrible", "no"): ok = False
    if t.get("surface") in ("rock",): ok = False
    way_ok[e["id"]] = ok
    for nid, g in zip(e["nodes"], e["geometry"]):
        if g is None: continue
        node_xy[nid] = proj(g["lon"], g["lat"])
        node_ways[nid].append(e)

# a node is usable only if every way through it is usable (a node shared with a bridge or tunnel is out)
nids = [n for n in node_xy if all(way_ok[w["id"]] for w in node_ways[n])]
pts = shapely.points(np.array([node_xy[n] for n in nids]))
print(f"usable path nodes: {len(nids)}", file=sys.stderr)

# road / rail distance for all
road_d = np.full(len(pts), 1e9); ri, rdist = road_tree.query_nearest(pts, return_distance=True, all_matches=False)
road_d[ri[0]] = rdist
rail_d = np.full(len(pts), 1e9)
if rails:
    ri, rdist = rail_tree.query_nearest(pts, return_distance=True, all_matches=False)
    rail_d[ri[0]] = rdist

# exclusions
ex_geoms = [g.buffer(b) if b > 0 else g for g, b, _ in excl]
ex_tree = STRtree(ex_geoms)
hit = ex_tree.query(pts, predicate="intersects")
excluded = np.zeros(len(pts), bool); excluded[hit[0]] = True

# candidate containment
cand_geoms = [c["geom"].buffer(1.0) if c["linear"] else c["geom"] for c in cands]
cand_tree = STRtree(cand_geoms)
inside = cand_tree.query(pts, predicate="intersects")
KIND_RANK = {"park": 0, "garden": 1, "square": 2, "pedestrian": 3}
node_cand = {}
for pi, ci in zip(*inside):
    c = cands[ci]
    if c["linear"]:
        # a named pedestrian way only owns the nodes that are on the way itself
        if not any(w["tags"].get("highway") == "pedestrian" and w["tags"].get("name") and f"w{w['id']}" == c["id"] for w in node_ways[nids[pi]]):
            continue
    prev = node_cand.get(pi)
    key = (KIND_RANK[c["kind"]], -c["area"])
    if prev is None or key < (KIND_RANK[cands[prev]["kind"]], -cands[prev]["area"]):
        node_cand[pi] = ci

stats = collections.Counter()
by_cand = collections.defaultdict(list)
for pi, ci in node_cand.items():
    if excluded[pi]: stats["excluded"] += 1; continue
    if road_d[pi] < ROAD_MIN: stats["road<15"] += 1; continue
    if rail_d[pi] < RAIL_MIN: stats["rail<20"] += 1; continue
    if not city.covers(pts[pi]): stats["outside city"] += 1; continue
    c = cands[ci]
    depth = float(road_d[pi]) if c["linear"] else float(c["geom"].boundary.distance(pts[pi]))
    if not c["linear"] and depth < MIN_DEPTH: stats["edge<8"] += 1; continue
    lits = [w["tags"].get("lit") for w in node_ways[nids[pi]]]
    lit = True if "yes" in lits else (False if "no" in lits else None)
    side = any(w["tags"].get("highway") in ("footway", "path") for w in node_ways[nids[pi]])
    score = min(depth, DEPTH_SWEET) - 0.25 * max(0.0, depth - DEPTH_SWEET)
    score += 0.1 * min(float(road_d[pi]), 100.0) + (5 if lit else 0) + (3 if side else 0)
    by_cand[ci].append(dict(pi=pi, nid=nids[pi], depth=depth, lit=lit, score=score, road=float(road_d[pi])))
    stats["kept"] += 1
print("node filter:", dict(stats), file=sys.stderr)

# ---------------------------------------------------------------- selection
def quota(c):
    if c["kind"] in ("park", "garden"):
        return max(1, min(8, int(c["area"] / 30000 + 0.5)))
    if c["linear"]:
        return max(1, min(3, int(c["geom"].length / 250)))
    return 2 if c["area"] > 10000 else 1

MIN_UNNAMED_AREA = 2500.0
def eligible(c):
    if not c["named"] and not c["linear"] and c["area"] < MIN_UNNAMED_AREA: return False
    if not c["named"] and c["kind"] == "garden" and c["area"] < 10000: return False  # small unnamed gardens are often private yards
    return True

order = sorted([ci for ci in by_cand if eligible(cands[ci])],
               key=lambda ci: (not cands[ci]["named"], -cands[ci]["area"], -cands[ci]["geom"].length))
for ci in by_cand: by_cand[ci].sort(key=lambda s: -s["score"])

picked = []; grid = collections.defaultdict(list); cnt = collections.Counter()
def free(xy):
    gx, gy = int(xy[0] // MIN_SPACING), int(xy[1] // MIN_SPACING)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for q in grid[(gx + dx, gy + dy)]:
                if math.hypot(q[0] - xy[0], q[1] - xy[1]) < MIN_SPACING: return False
    return True
def take(ci, s):
    xy = node_xy[s["nid"]]
    grid[(int(xy[0] // MIN_SPACING), int(xy[1] // MIN_SPACING))].append(xy)
    picked.append((ci, s)); cnt[ci] += 1

def run(selection, rounds=8):
    for r in range(rounds):
        for ci in selection:
            if cnt[ci] >= quota(cands[ci]) or cnt[ci] > r: continue
            for s in by_cand[ci]:
                if s.get("used"): continue
                if free(node_xy[s["nid"]]):
                    s["used"] = True; take(ci, s); break

named = [ci for ci in order if cands[ci]["named"]]
unnamed = [ci for ci in order if not cands[ci]["named"]]
run(named)
# unnamed public green areas (eligible ones: parks >= 0.25 ha, gardens >= 1 ha) come after every named place
run(unnamed)
print("picked", len(picked), file=sys.stderr)

# ---------------------------------------------------------------- output
DEFAULT = {"park": "პარკი", "garden": "ბაღი", "square": "მოედანი", "pedestrian": "ქუჩა"}
spots = []; slugs = collections.Counter()
for ci, s in sorted(picked, key=lambda p: (DISTRICTS[district_of(Point(node_xy[p[1]["nid"]]))][0], not cands[p[0]]["named"], -cands[p[0]]["area"], cands[p[0]]["id"], -p[1]["depth"])):
    c = cands[ci]; t = c["tags"]
    xy = node_xy[s["nid"]]; lng, lat = unproj(*xy)
    rid = district_of(Point(xy)); den, dka = DISTRICTS[rid]
    ka_name = t.get("name:ka") or (t.get("name") if has_ka(t.get("name")) else None)
    place = ka_name or t.get("name") or t.get("name:en") or DEFAULT[c["kind"]]
    place_en = t.get("name:en") or (translit(ka_name, plain=True).title() if ka_name else (t.get("name") or None))
    base = slugify(place_en or ka_name) if (ka_name or place_en) else f"{den.lower()}-local-{c['kind']}"
    slugs[base] += 1
    s["out"] = dict(id=f"{base}-{slugs[base]:02d}", place=place, placeEn=place_en, district=dka, kind=c["kind"],
                    lng=round(lng, 6), lat=round(lat, 6), lit=s["lit"],
                    areaM2=int(round(c["area"])) if not c["linear"] else None,
                    depthM=round(s["depth"], 1))
    spots.append(s["out"])

# ---------------------------------------------------------------- golden points (hand-picked OSM footway nodes)
GOLDEN = {
    "rike": (12206942368, "რიყის პარკი",
             "Open lawn on the concrete footway ~40 m north of the Rike-Narikala lower cable-car station (clear of its doors): ~49 m from the nearest road, ~86 m from the Mtkvari water, ~165 m from the Bridge of Peace."),
    "vake": (6448678189, "ვაკის პარკი",
             "Paved ring of the big round fountain plaza in the lower park, ~145 m inside the main Chavchavadze Ave entrance: the widest open space in the park, ~76 m from the nearest road."),
    "lisi": (9132498227, "ლისის ტბა",
             "Lakeside promenade at the main south-east entrance (cafés, parking): on land ~43 m from the water and ~73 m from the nearest road."),
    "april9": (5428716651, "9 აპრილის ბაღი",
               "Central paved paths beside the pond in the middle of the garden (behind the National Gallery, just off Rustaveli Ave): ~48 m from the nearest street, ~35 m from the pond."),
    "finale": (1470638782, "რიყის პარკი",
               "Paved junction by the open plaza and the big fountain in the middle of Rike Park, ~110 m north of the `rike` point: ~70 m from roads, ~79 m from the water, ~135 m from the Bridge of Peace."),
}
golden = {}
nid_pos = {n: i for i, n in enumerate(nids)}
for key, (nid, place, why) in GOLDEN.items():
    i = nid_pos[nid]
    assert not excluded[i] and road_d[i] >= 30, (key, road_d[i])
    lng, lat = unproj(*node_xy[nid])
    golden[key] = dict(place=place, lng=round(lng, 6), lat=round(lat, 6), why=why)
gr, gf = node_xy[GOLDEN["rike"][0]], node_xy[GOLDEN["finale"][0]]
assert math.hypot(gr[0] - gf[0], gr[1] - gf[1]) >= 100

if __name__ == "__main__":
    # ---------------------------------------------------------------- validation
    xy = np.array([proj(s["lng"], s["lat"]) for s in spots])
    dmin = min(np.hypot(*(xy[j + 1:] - xy[j]).T).min() for j in range(len(xy) - 1))
    assert dmin >= MIN_SPACING - 0.5, dmin
    assert len({s["id"] for s in spots}) == len(spots)
    ids = [s["id"] for s in spots]
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    fetched = datetime.datetime.fromtimestamp(os.path.getmtime(os.path.join(CACHE, "paths.json")), datetime.timezone.utc).date().isoformat()
    doc = {"source": f"© OpenStreetMap contributors (ODbL 1.0), Overpass API, fetched {fetched}",
           "generatedAt": now, "spots": spots, "golden": golden}
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2); f.write("\n")
    by_d = collections.Counter(s["district"] for s in spots)
    print(len(spots), "spots, min spacing", round(float(dmin), 1), "m")
    for k, v in sorted(by_d.items(), key=lambda kv: -kv[1]): print(" ", k, v)
    print("median depthM", float(np.median([s["depthM"] for s in spots])), "kinds", dict(collections.Counter(s["kind"] for s in spots)))
    print("lit", dict(collections.Counter(s["lit"] for s in spots)))
    print("written", OUT)
