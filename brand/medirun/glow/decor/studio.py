"""MEDIRUN Glow city decor studio: concept image (OpenRouter) -> realistic 3D model (Meshy API, direct).

  python studio.py concept <name> "<object description>" [--n 3] [--brand] [--ref photo.jpg]   -> assets/<name>/concept_1..n.png
                  (--brand: the object carries a partner's signage, so logos are allowed in the picture)
  python studio.py pick <name> <n>                                  -> assets/<name>/concept.png (the approved one)
  python studio.py model <name> [--polys 30000]                     -> assets/<name>/model.glb + thumb.png
  python studio.py status <name>                                    -> last Meshy task state
  python studio.py balance                                          -> Meshy credits left

Keys: MESHY_API_KEY from game-studio/.env, OPENROUTER_API_KEY from server/.env (both git-ignored). Never print them.
Objects, not characters: one object, three-quarter view, whole object visible, plain background, no text or logos.
"""
import base64, json, pathlib, sys, time, urllib.request, urllib.error

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]
ASSETS = HERE / 'assets'
IMAGE_MODEL = 'google/gemini-3-pro-image'
MESHY = 'https://api.meshy.ai/openapi/v1'


def env_key(path, name):
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.startswith(name + '='):
            return line.split('=', 1)[1].strip().strip('"')
    sys.exit(f'{name} missing in {path}')


def http(url, body=None, headers=None, raw=False):
    req = urllib.request.Request(url, method='POST' if body is not None else 'GET',
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json', **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return r.read() if raw else json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'HTTP {e.code} {url.split("?")[0]}: {e.read().decode()[:1500]}')


def meshy_auth():
    return {'Authorization': 'Bearer ' + env_key(ROOT / 'game-studio' / '.env', 'MESHY_API_KEY')}


def folder(name):
    d = ASSETS / name
    d.mkdir(parents=True, exist_ok=True)
    return d


def meta(d, **update):
    p = d / 'meta.json'
    m = json.loads(p.read_text(encoding='utf-8')) if p.exists() else {}
    m.update(update)
    p.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding='utf-8')
    return m


def data_url(path):
    return 'data:image/png;base64,' + base64.b64encode(path.read_bytes()).decode()


def concept(name, desc, n, brand=False, ref=None):
    d = folder(name)
    prompt = ('Photorealistic studio product render for 3D modelling reference. A single object, three-quarter front view '
              'from slightly above, the whole object visible with margin around it, soft even studio light, plain light grey '
              'seamless background, no people, no watermark, '
              + ('only the signage described below, no other text. ' if brand else 'no text, no letters, no logos, no brand marks. ') +
              f'Object: {desc}')
    key = env_key(ROOT / 'server' / '.env', 'OPENROUTER_API_KEY')
    for i in range(1, n + 1):
        res = http('https://openrouter.ai/api/v1/chat/completions', {
            'model': IMAGE_MODEL, 'modalities': ['image', 'text'],
            'messages': [{'role': 'user', 'content': ([{'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + base64.b64encode(pathlib.Path(ref).read_bytes()).decode()}}] if ref else [])
                          + [{'type': 'text', 'text': ('The photo shows the real building: reproduce exactly this building, same architecture, '
                              'proportions, materials and signage. ' if ref else '') + prompt + f' (variation {i})'}]}],
            'image_config': {'aspect_ratio': '4:3', 'image_size': '2K'},
        }, {'Authorization': 'Bearer ' + key, 'X-Title': 'MEDIRUN decor studio'})
        imgs = [im for ch in res.get('choices', []) for im in (ch.get('message', {}).get('images') or [])]
        if not imgs:
            print(f'variation {i}: no image: {json.dumps(res)[:400]}')
            continue
        out = d / f'concept_{i}.png'
        out.write_bytes(base64.b64decode(imgs[0]['image_url']['url'].split(',', 1)[1]))
        print('wrote', out.relative_to(HERE), f"(${res.get('usage', {}).get('cost', '?')})", flush=True)
    meta(d, description=desc)


def pick(name, n):
    d = folder(name)
    (d / 'concept.png').write_bytes((d / f'concept_{n}.png').read_bytes())
    meta(d, picked=n)
    print('picked concept', n)


def model(name, polys):
    d = folder(name)
    src = d / 'concept.png'
    if not src.exists():
        sys.exit(f'{src} missing: run concept + pick first')
    auth = meshy_auth()
    body = {'image_url': data_url(src), 'ai_model': 'latest', 'topology': 'triangle', 'target_polycount': polys,
            'should_remesh': True, 'should_texture': True, 'enable_pbr': True, 'symmetry_mode': 'auto'}
    task = http(f'{MESHY}/image-to-3d', body, auth)['result']
    meta(d, task=task, polys=polys)
    print('meshy task', task, flush=True)
    wait(d, task, auth)


def wait(d, task, auth):
    while True:
        st = http(f'{MESHY}/image-to-3d/{task}', headers=auth)
        s = st.get('status')
        if s == 'SUCCEEDED':
            break
        if s in ('FAILED', 'CANCELED', 'EXPIRED'):
            sys.exit(f'meshy {s}: {json.dumps(st.get("task_error"))[:800]}')
        print(' ', s, st.get('progress'), flush=True)
        time.sleep(12)
    (d / 'model.glb').write_bytes(http(st['model_urls']['glb'], raw=True))
    if st.get('thumbnail_url'):
        (d / 'thumb.png').write_bytes(http(st['thumbnail_url'], raw=True))
    meta(d, model=True)
    print('wrote', (d / 'model.glb').relative_to(HERE), f"{(d / 'model.glb').stat().st_size // 1024} KB")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd, rest = sys.argv[1], sys.argv[2:]
    flag = lambda k, dflt: rest[rest.index(k) + 1] if k in rest else dflt
    pos = [a for i, a in enumerate(rest) if not a.startswith('--') and (i == 0 or not rest[i - 1].startswith('--'))]
    if cmd == 'concept':
        concept(pos[0], pos[1], int(flag('--n', 3)), '--brand' in rest, flag('--ref', None))
    elif cmd == 'pick':
        pick(pos[0], int(pos[1]))
    elif cmd == 'model':
        model(pos[0], int(flag('--polys', 30000)))
    elif cmd == 'status':
        d = folder(pos[0]); wait(d, meta(d)['task'], meshy_auth())
    elif cmd == 'balance':
        print(http(f'{MESHY}/balance', headers=meshy_auth()))
    else:
        sys.exit(__doc__)
