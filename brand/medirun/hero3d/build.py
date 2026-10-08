"""Build the /medirun hero city from the Meshy model (work/model.glb):

  python build.py [--debug] [--glb]   -> server/public/medirun/hero3d/path.json (+ work/path-debug.png, + city.glb with --glb)

Source: work/model-raw.glb (Meshy without remesh: sharper than the 150k remesh), decimated to ~16 % on export.

The runner's street is found from the model's own texture: the mint light path painted in the key art. Vertices whose
texel is mint, low on the block, form one long cluster; its longest chain (tree diameter) is the run, smoothed and
resampled. path.json carries the normalising matrix (block 10 units wide, street level y = 0) and the run in that space.
"""
import json, pathlib, struct, subprocess, sys, io
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = HERE / 'work'
OUT = ROOT / 'server' / 'public' / 'medirun' / 'hero3d'
SRC = 'model-raw.glb'
OPTIMIZE = ['optimize', '--compress', 'meshopt', '--texture-compress', 'webp', '--texture-size', '2048', '--simplify-ratio', '0.16', '--simplify-error', '0.0004']


def read_glb(p):
    b = p.read_bytes()
    jl = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20 + jl])
    bl = struct.unpack_from('<I', b, 20 + jl)[0]
    binb = b[28 + jl:28 + jl + bl]

    def acc(i):
        a = j['accessors'][i]
        bv = j['bufferViews'][a['bufferView']]
        n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
        dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        arr = np.frombuffer(binb, dtype=dt, count=a['count'] * n, offset=off)
        return arr.reshape(-1, n) if n > 1 else arr

    prim = j['meshes'][0]['primitives'][0]
    img_bv = j['bufferViews'][j['images'][0]['bufferView']]
    img = Image.open(io.BytesIO(binb[img_bv.get('byteOffset', 0):img_bv.get('byteOffset', 0) + img_bv['byteLength']])).convert('RGB')
    return acc(prim['attributes']['POSITION']), acc(prim['attributes']['TEXCOORD_0']), np.asarray(img), acc(prim['indices']).reshape(-1, 3)


def chain(points, link):
    """Longest path through the nearest-neighbour graph of points (two BFS on its minimum spanning tree)."""
    from scipy.sparse.csgraph import minimum_spanning_tree, breadth_first_order, shortest_path
    from scipy.spatial import cKDTree
    from scipy.sparse import coo_matrix
    t = cKDTree(points)
    pairs = np.array(sorted(t.query_pairs(link)))
    d = np.linalg.norm(points[pairs[:, 0]] - points[pairs[:, 1]], axis=1)
    g = coo_matrix((d, (pairs[:, 0], pairs[:, 1])), shape=(len(points),) * 2)
    mst = minimum_spanning_tree(g)
    mst = mst + mst.T
    dist = shortest_path(mst, indices=0, unweighted=False)
    comp = np.isfinite(dist)
    a = int(np.argmax(np.where(comp, dist, -1)))
    da, pred = shortest_path(mst, indices=a, return_predecessors=True)
    b = int(np.argmax(np.where(np.isfinite(da), da, -1)))
    out = [b]
    while out[-1] != a:
        out.append(int(pred[out[-1]]))
    return np.array(out[::-1])


def main(debug):
    pos, uv, tex, tri = read_glb(WORK / SRC)
    h, w, _ = tex.shape
    # Sample every triangle at a few barycentric points (vertices alone are too sparse for a painted street).
    rng = np.random.default_rng(1)
    S = 3 if len(tri) > 1_000_000 else 12
    bc = rng.dirichlet([1, 1, 1], size=S)
    sp = np.einsum('sk,tkd->tsd', bc, pos[tri]).reshape(-1, 3)
    su = np.einsum('sk,tkd->tsd', bc, uv[tri]).reshape(-1, 2)
    px = np.clip((su[:, 0] * (w - 1)).astype(int), 0, w - 1)
    py = np.clip((su[:, 1] * (h - 1)).astype(int), 0, h - 1)   # glTF uv origin is top-left
    col = tex[py, px].astype(int)
    r, g, b = col[:, 0], col[:, 1], col[:, 2]
    mint = (g - r > 45) & (b - r > 25) & (g > 120)

    lo, hi = pos.min(0), pos.max(0)
    scale = 10.0 / max(hi[0] - lo[0], hi[2] - lo[2])
    cx, cz = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2

    mp = sp[mint]
    # one sample per 4 mm cell keeps the clustering small on a 2M-triangle model
    _, keep1 = np.unique(np.round(mp / 0.004).astype(int), axis=0, return_index=True)
    mp = mp[keep1]
    print('mint vertices', len(mp))
    # The street is low on the block; the glowing bridge canopy sits high above the water.
    ground = np.percentile(pos[:, 1], 35)
    keep = mp[:, 1] < ground + (hi[1] - lo[1]) * 0.18
    mp = mp[keep]
    xz = mp[:, [0, 2]]
    # Largest connected cluster.
    from scipy.spatial import cKDTree
    from scipy.sparse.csgraph import connected_components
    from scipy.sparse import coo_matrix
    link = 0.03
    pairs = np.array(sorted(cKDTree(xz).query_pairs(link)))
    n, lab = connected_components(coo_matrix((np.ones(len(pairs)), (pairs[:, 0], pairs[:, 1])), shape=(len(xz),) * 2), directed=False)
    sizes = np.bincount(lab)
    print('clusters', sorted(sizes)[-6:])
    big = lab == np.argmax(sizes)
    street = mp[big]
    # Thin the cloud to a grid, then take its longest chain.
    cell = 0.012
    key = np.round(street[:, [0, 2]] / cell).astype(int)
    _, first = np.unique(key, axis=0, return_index=True)
    s = street[first]
    order = chain(s[:, [0, 2]], 0.05)
    line = s[order]
    # Smooth (moving average) and resample evenly.
    k = 9
    pad = np.concatenate([np.repeat(line[:1], k, 0), line, np.repeat(line[-1:], k, 0)])
    sm = np.array([pad[i:i + 2 * k + 1].mean(0) for i in range(len(line))])
    seg = np.r_[0, np.cumsum(np.linalg.norm(np.diff(sm[:, [0, 2]], axis=0), axis=1))]
    N = 96
    ts = np.linspace(0, seg[-1], N)
    res = np.stack([np.interp(ts, seg, sm[:, i]) for i in range(3)], 1)
    # Street height: median of the street vertices near each sample (smooth, never inside the asphalt).
    tree = cKDTree(street[:, [0, 2]])
    for i, p in enumerate(res):
        idx = tree.query_ball_point(p[[0, 2]], 0.03)
        if idx:
            res[i, 1] = np.percentile(street[idx, 1], 70)
    yk = 6
    ypad = np.r_[np.repeat(res[:1, 1], yk), res[:, 1], np.repeat(res[-1:, 1], yk)]
    res[:, 1] = [ypad[i:i + 2 * yk + 1].mean() for i in range(N)]
    street_y = float(np.median(res[:, 1]))

    scale, cx, cz = float(scale), float(cx), float(cz)

    def nrm(p):
        return [(p[0] - cx) * scale, (p[1] - street_y) * scale, (p[2] - cz) * scale]

    pts = [nrm(p) for p in res]
    # The run starts at the end nearer the viewer's front corner (+x +z in the default camera) and climbs away.
    if pts[0][0] + pts[0][2] < pts[-1][0] + pts[-1][2]:
        pts = pts[::-1]
    scale, cx, cz, street_y = float(scale), float(cx), float(cz), float(street_y)
    m = [scale, 0, 0, 0, 0, scale, 0, 0, 0, 0, scale, 0, -cx * scale, -street_y * scale, -cz * scale, 1]
    bottom = (lo[1] - street_y) * scale
    top = (hi[1] - street_y) * scale
    data = {
        'matrix': m, 'points': [[round(float(v), 4) for v in p] for p in pts],
        'center': [0, round((bottom + top) * 0.35, 3), 0], 'radius': round(float(np.hypot(5, 5) * 0.86), 3),
        'bottom': round(float(bottom), 3), 'top': round(float(top), 3), 'span': 10, 'reach': 1.15, 'runner': 0.42, 'width': 0.3,
        'azimuth': 0.785, 'elevation': 0.6,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    prev = OUT / 'path.json'
    if prev.exists():   # hand-tuned look values survive a rebuild
        old = json.loads(prev.read_text(encoding='utf-8'))
        for k2 in ('center', 'radius', 'reach', 'runner', 'width', 'azimuth', 'elevation'):
            data[k2] = old.get(k2, data[k2])
    prev.write_text(json.dumps(data, separators=(',', ':'), default=float), encoding='utf-8')
    print('path', len(pts), 'pts, length', round(float(seg[-1] * scale), 2), 'units; street y', round(street_y, 4), '-> path.json')

    if debug:
        S = 900
        im = Image.new('RGB', (S, S), (12, 14, 22))
        px_ = im.load()
        allp = (pos[::7, [0, 2]] - [lo[0], lo[2]]) / (hi[[0, 2]] - lo[[0, 2]]).max() * (S - 1)
        for x, z in allp.astype(int):
            px_[x, z] = (60, 64, 80)
        for x, z in ((mp[:, [0, 2]] - [lo[0], lo[2]]) / (hi[[0, 2]] - lo[[0, 2]]).max() * (S - 1)).astype(int):
            px_[x, z] = (40, 160, 140)
        from PIL import ImageDraw
        dr = ImageDraw.Draw(im)
        lp = [tuple(((np.array([p[0], p[2]]) / scale + [cx - lo[0], cz - lo[2]]) / (hi[[0, 2]] - lo[[0, 2]]).max() * (S - 1)).tolist()) for p in pts]
        dr.line(lp, fill=(255, 200, 80), width=3)
        dr.ellipse([lp[0][0] - 8, lp[0][1] - 8, lp[0][0] + 8, lp[0][1] + 8], outline=(255, 80, 80), width=3)
        im.save(WORK / 'path-debug.png')
    return data


if __name__ == '__main__':
    main('--debug' in sys.argv)
    if '--glb' in sys.argv:
        gt = pathlib.Path.home() / 'AppData/Local/Temp/claude/gltf/node_modules/.bin/gltf-transform.cmd'
        subprocess.run([str(gt), OPTIMIZE[0], str(WORK / SRC), str(OUT / 'city.glb'), *OPTIMIZE[1:]], check=True, shell=False)
        print('city.glb', (OUT / 'city.glb').stat().st_size // 1024, 'KB')
