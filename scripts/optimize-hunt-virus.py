#!/usr/bin/env python3
"""Local mesh reduction for Medi Hunt. Does not modify the Desktop original."""

from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

from PIL import Image

SRC = Path(r"C:\Users\User\Desktop\virus_1.glb")
DST = Path(__file__).resolve().parents[1] / "mobile" / "assets" / "hunt" / "virus_1.glb"
TARGET_TRIS = 40_000
TEX_SIZE = 1024


def read_glb(path: Path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise SystemExit("not a GLB")
    off = 12
    json_chunk = b""
    bin_chunk = b""
    while off + 8 <= len(data):
        clen, ctype = struct.unpack_from("<I4s", data, off)
        chunk = data[off + 8 : off + 8 + clen]
        off += 8 + clen
        if off % 4:
            off += 4 - (off % 4)
        if ctype.startswith(b"JSON"):
            json_chunk = chunk.rstrip(b" \x00")
        elif ctype.startswith(b"BIN"):
            bin_chunk = chunk
    return json.loads(json_chunk.decode("utf-8")), bytearray(bin_chunk)


def acc_bytes(gltf, blob, index):
    acc = gltf["accessors"][index]
    view = gltf["bufferViews"][acc["bufferView"]]
    start = (view.get("byteOffset") or 0) + (acc.get("byteOffset") or 0)
    ctype = acc["componentType"]
    typ = acc["type"]
    ncomp = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[typ]
    width = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}[ctype]
    count = acc["count"]
    return memoryview(blob)[start : start + count * ncomp * width], acc


def pack_f32(values):
    return struct.pack("<" + "f" * len(values), *values)


def pack_u32(values):
    return struct.pack("<" + "I" * len(values), *values)


def pack_u8(values):
    return bytes(values)


def cluster(positions, cell):
    """Map vertex index -> cluster id; return cluster representatives."""
    clusters = {}
    remap = [0] * (len(positions) // 3)
    reps = []
    for i in range(len(positions) // 3):
        x, y, z = positions[i * 3 : i * 3 + 3]
        key = (int(x / cell), int(y / cell), int(z / cell))
        cid = clusters.get(key)
        if cid is None:
            cid = len(reps)
            clusters[key] = cid
            reps.append(i)
        remap[i] = cid
    return remap, reps


def main():
    if not SRC.exists():
        raise SystemExit(f"missing source {SRC}")
    gltf, blob = read_glb(SRC)
    prim = gltf["meshes"][0]["primitives"][0]
    pos_mv, pos_acc = acc_bytes(gltf, blob, prim["attributes"]["POSITION"])
    nrm_mv, _ = acc_bytes(gltf, blob, prim["attributes"]["NORMAL"])
    uv_mv, _ = acc_bytes(gltf, blob, prim["attributes"]["TEXCOORD_0"])
    jnt_mv, _ = acc_bytes(gltf, blob, prim["attributes"]["JOINTS_0"])
    wgt_mv, _ = acc_bytes(gltf, blob, prim["attributes"]["WEIGHTS_0"])
    idx_mv, idx_acc = acc_bytes(gltf, blob, prim["indices"])

    pos = list(struct.unpack_from("<" + "f" * pos_acc["count"] * 3, pos_mv, 0))
    nrm = list(struct.unpack_from("<" + "f" * pos_acc["count"] * 3, nrm_mv, 0))
    uv = list(struct.unpack_from("<" + "f" * pos_acc["count"] * 2, uv_mv, 0))
    joints = list(jnt_mv)
    weights = list(struct.unpack_from("<" + "f" * pos_acc["count"] * 4, wgt_mv, 0))
    indices = list(struct.unpack_from("<" + "I" * idx_acc["count"], idx_mv, 0))

    mins = pos_acc["min"]
    maxs = pos_acc["max"]
    diag = max(maxs[i] - mins[i] for i in range(3)) or 1.0

    cell = diag / 90.0
    chosen = None
    for _ in range(18):
        remap, reps = cluster(pos, cell)
        tris = []
        seen = set()
        for t in range(0, len(indices), 3):
            a, b, c = remap[indices[t]], remap[indices[t + 1]], remap[indices[t + 2]]
            if a == b or b == c or a == c:
                continue
            key = tuple(sorted((a, b, c)))
            if key in seen:
                continue
            seen.add(key)
            tris.append((a, b, c))
        print(f"cell={cell:.5f} verts={len(reps)} tris={len(tris)}")
        chosen = (remap, reps, tris, cell)
        if 28_000 <= len(tris) <= 52_000:
            break
        if len(tris) > TARGET_TRIS:
            cell *= 1.18
        else:
            cell *= 0.86

    remap, reps, tris, cell = chosen
    print(f"selected cell={cell:.5f} verts={len(reps)} tris={len(tris)}")

    out_pos = []
    out_nrm = []
    out_uv = []
    out_jnt = []
    out_wgt = []
    for src in reps:
        out_pos.extend(pos[src * 3 : src * 3 + 3])
        out_nrm.extend(nrm[src * 3 : src * 3 + 3])
        out_uv.extend(uv[src * 2 : src * 2 + 2])
        out_jnt.extend(joints[src * 4 : src * 4 + 4])
        out_wgt.extend(weights[src * 4 : src * 4 + 4])
    out_idx = [v for tri in tris for v in tri]

    img_view = gltf["bufferViews"][gltf["images"][0]["bufferView"]]
    img_start = img_view.get("byteOffset") or 0
    img_bytes = bytes(blob[img_start : img_start + img_view["byteLength"]])
    from io import BytesIO

    im = Image.open(BytesIO(img_bytes)).convert("RGB")
    im = im.resize((TEX_SIZE, TEX_SIZE), Image.Resampling.LANCZOS)
    tex_buf = BytesIO()
    im.save(tex_buf, format="JPEG", quality=82, optimize=True)
    tex_bytes = tex_buf.getvalue()

    pos_b = pack_f32(out_pos)
    nrm_b = pack_f32(out_nrm)
    uv_b = pack_f32(out_uv)
    idx_b = pack_u32(out_idx)
    # Clustering breaks a reliable bind pose. Ship a static posed mesh;
    # encounter uses whole-object procedural motion.

    def pad4(b: bytes) -> bytes:
        extra = (4 - (len(b) % 4)) % 4
        return b + (b"\x00" * extra)

    chunks = [pos_b, nrm_b, uv_b, idx_b, tex_bytes]
    padded = [pad4(c) for c in chunks]
    offsets = []
    cur = 0
    for p in padded:
        offsets.append(cur)
        cur += len(p)
    new_bin = b"".join(padded)

    nverts = len(reps)
    nidx = len(out_idx)
    pos_min = [min(out_pos[i::3]) for i in range(3)]
    pos_max = [max(out_pos[i::3]) for i in range(3)]

    gltf["accessors"] = [
        {"componentType": 5126, "count": nverts, "type": "VEC3", "max": pos_max, "min": pos_min, "bufferView": 0},
        {"componentType": 5126, "count": nverts, "type": "VEC3", "bufferView": 1},
        {"componentType": 5126, "count": nverts, "type": "VEC2", "bufferView": 2},
        {"componentType": 5125, "count": nidx, "type": "SCALAR", "bufferView": 3},
    ]
    gltf["bufferViews"] = [
        {"buffer": 0, "byteOffset": offsets[0], "byteLength": len(pos_b), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[1], "byteLength": len(nrm_b), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[2], "byteLength": len(uv_b), "target": 34962},
        {"buffer": 0, "byteOffset": offsets[3], "byteLength": len(idx_b), "target": 34963},
        {"buffer": 0, "byteOffset": offsets[4], "byteLength": len(tex_bytes)},
    ]
    gltf["buffers"] = [{"byteLength": len(new_bin)}]
    gltf["images"][0]["bufferView"] = 4
    gltf["images"][0]["mimeType"] = "image/jpeg"
    prim["attributes"] = {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}
    prim["indices"] = 3
    prim.pop("targets", None)
    gltf["nodes"] = [
        {
            "name": "virus_1",
            "mesh": 0,
            "translation": [0, 0, 0],
        }
    ]
    gltf["scenes"] = [{"nodes": [0]}]
    gltf["scene"] = 0
    gltf.pop("skins", None)
    gltf.pop("animations", None)
    gltf["asset"]["generator"] = "Medicard Hunt local reducer (Tripo source)"
    gltf.pop("extensionsUsed", None)
    gltf.pop("extensionsRequired", None)

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_pad = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b" " * json_pad
    bin_pad = (4 - (len(new_bin) % 4)) % 4
    new_bin += b"\x00" * bin_pad
    total = 12 + 8 + len(json_bytes) + 8 + len(new_bin)
    out = bytearray()
    out += struct.pack("<4sII", b"glTF", 2, total)
    out += struct.pack("<I4s", len(json_bytes), b"JSON")
    out += json_bytes
    out += struct.pack("<I4s", len(new_bin), b"BIN\x00")
    out += new_bin
    DST.parent.mkdir(parents=True, exist_ok=True)
    DST.write_bytes(out)
    print(f"wrote {DST} bytes={DST.stat().st_size} tris={len(tris)} verts={nverts} tex={len(tex_bytes)}")
    print(f"source_bytes={SRC.stat().st_size} dest_bytes={DST.stat().st_size}")


if __name__ == "__main__":
    main()
