"""Holiday truck loop on Rustaveli Avenue: Freedom Square → Philharmonic (First Republic Square) → back, round and round.

  python build-route.py   (reads osm-rustaveli.json, writes rustaveli-loop.json)

Northbound and southbound carriageways come from OSM (oneway ways of შოთა რუსთაველის გამზირი; the short two-way
stretch at the north end is used both ways). At each end the truck goes round the square like the real traffic:
the Freedom Square roundabout and the gyratory round First Republic Square, both fitted as circles from their OSM ways
and driven in their OSM direction. The joined loop is smoothed (Chaikin) and moved 1.8 m to the right of the way
centre lines, so a rig keeps to the right-hand lane.
"""
import json, math, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ways = json.loads((HERE / 'osm-rustaveli.json').read_text(encoding='utf-8'))['ways']
LAT0, LNG0 = 41.6990, 44.7960
KX, KY = 111320 * math.cos(math.radians(LAT0)), 110540
xy = lambda p: (round((p['lon'] - LNG0) * KX, 2), round((p['lat'] - LAT0) * KY, 2))
ll = lambda x, y: [round(LNG0 + x / KX, 7), round(LAT0 + y / KY, 7)]

AVENUE = 'შოთა რუსთაველის გამზირი'
FREEDOM = {523248533, 1314387709, 1314387710, 1314387711, 1314387712}
REPUBLIC = {523260568, 1544099695, 1557982633, 542773470}
SOUTH_START, SOUTH_END, NORTH_END = (41.69403, 44.8012), (41.69399, 44.80103), (41.70381, 44.79042)   # the two carriageways end on different nodes

# directed graph of the avenue
edges = {}
for w in ways:
    if w['tags'].get('name') != AVENUE:
        continue
    pts = [xy(p) for p in w['geometry']]
    key = lambda q: (round(q[0]), round(q[1]))
    edges.setdefault(key(pts[0]), []).append((key(pts[-1]), pts))
    if w['tags'].get('oneway') != 'yes':
        edges.setdefault(key(pts[-1]), []).append((key(pts[0]), pts[::-1]))


def near(lat_lng):
    p = xy({'lat': lat_lng[0], 'lon': lat_lng[1]})
    nodes = set(edges) | {m for v in edges.values() for m, _ in v}     # a dead-end node has no outgoing edge
    return min(nodes, key=lambda k: math.hypot(k[0] - p[0], k[1] - p[1]))


def chain(a, b):
    """Shortest simple path a → b by number of ways (DFS; the avenue is a handful of ways), as one polyline."""
    best = None
    def dfs(node, segs, seen):
        nonlocal best
        if node == b:
            if best is None or len(segs) < len(best):
                best = list(segs)
            return
        for nxt, pts in edges.get(node, []):
            if nxt not in seen:
                seen.add(nxt); segs.append(pts); dfs(nxt, segs, seen); segs.pop(); seen.discard(nxt)
    dfs(a, [], {a})
    if not best:
        raise SystemExit(f'no path {a} -> {b}')
    line = list(best[0])
    for pts in best[1:]:
        line += pts[1:]
    return line


north = chain(near(SOUTH_START), near(NORTH_END))
south = chain(near(NORTH_END), near(SOUTH_END))


def ring(ids):
    pts, turn = [], 0.0
    for w in ways:
        if w['id'] in ids:
            g = [xy(p) for p in w['geometry']]
            pts += g
    cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
    r = sum(math.hypot(p[0] - cx, p[1] - cy) for p in pts) / len(pts)
    for w in ways:                                  # direction of travel: sign of the swept angle along each way
        if w['id'] in ids:
            g = [xy(p) for p in w['geometry']]
            for p, q in zip(g, g[1:]):
                a0, a1 = math.atan2(p[1] - cy, p[0] - cx), math.atan2(q[1] - cy, q[0] - cx)
                turn += (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
    return cx, cy, r, 1 if turn > 0 else -1


def arc(c, frm, to, step=2.0):
    cx, cy, r, sense = c
    a0, a1 = math.atan2(frm[1] - cy, frm[0] - cx), math.atan2(to[1] - cy, to[0] - cx)
    sweep = (a1 - a0) % (2 * math.pi) if sense > 0 else -((a0 - a1) % (2 * math.pi))
    if abs(sweep) < math.pi * 0.6:                 # a U-turn always goes most of the way round the square
        sweep += 2 * math.pi * sense
    n = max(4, int(abs(sweep) * r / step))
    return [(cx + math.cos(a0 + sweep * i / n) * r, cy + math.sin(a0 + sweep * i / n) * r) for i in range(1, n)]


fr, rp = ring(FREEDOM), ring(REPUBLIC)
loop = north + arc(rp, north[-1], south[0]) + south + arc(fr, south[-1], north[0])

# resample every 2 m, Chaikin twice, then 1.8 m to the right
def resample(p, step=2.0):
    out = [p[0]]
    for a, b in zip(p, p[1:] + p[:1]):
        d = math.hypot(b[0] - a[0], b[1] - a[1]); n = max(1, int(d / step))
        out += [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(1, n + 1)]
    return out[:-1]
def chaikin(p):
    out = []
    for a, b in zip(p, p[1:] + p[:1]):
        out += [(0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]), (0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1])]
    return out
pts = resample(loop)
for _ in range(3):
    pts = chaikin(pts)
def even(p, step=2.0):
    """Points every `step` metres along the closed line."""
    out, carry = [p[0]], 0.0
    for a, b in zip(p, p[1:] + p[:1]):
        d = math.hypot(b[0] - a[0], b[1] - a[1]); t = step - carry
        while t <= d:
            out.append((a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d)); t += step
        carry = (carry + d) % step
    return out[:-1]
pts = even(pts)
n = len(pts)
lane = []
for i in range(n):
    a, b = pts[(i - 3) % n], pts[(i + 3) % n]
    d = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
    tx, ty = (b[0] - a[0]) / d, (b[1] - a[1]) / d
    lane.append((pts[i][0] + ty * 1.8, pts[i][1] - tx * 1.8))
length = sum(math.hypot(lane[i][0] - lane[i - 1][0], lane[i][1] - lane[i - 1][1]) for i in range(n))
out = {'name': 'Rustaveli Avenue loop: Freedom Square ⇄ Philharmonic', 'source': 'OpenStreetMap contributors (ODbL)',
       'closed': True, 'length_m': round(length), 'coords': [ll(x, y) for x, y in lane]}
(HERE / 'rustaveli-loop.json').write_text(json.dumps(out, ensure_ascii=False), encoding='utf-8')
print('north', len(north), 'south', len(south), 'freedom r', round(fr[2], 1), 'dir', fr[3], 'republic r', round(rp[2], 1), 'dir', rp[3], 'loop', round(length), 'm', n, 'pts')
