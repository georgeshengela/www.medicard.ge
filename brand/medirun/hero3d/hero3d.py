"""MEDIRUN /medirun hero: the key-art city as a floating 3D diorama (OpenRouter concept -> Meshy image-to-3D, direct).

  python hero3d.py concept [--n 3]          -> work/concept_1..n.png   (from work/source.jpg, the owner's key art)
  python hero3d.py pick <n>                 -> work/concept.png
  python hero3d.py model [--polys 120000]   -> work/model.glb + thumb.png   (Meshy credits)
  python hero3d.py status                   -> waits for the last Meshy task and downloads it
  python hero3d.py balance                  -> Meshy credits left
  node build.mjs                            -> server/public/medirun/hero3d/city.glb + path.json

Keys: MESHY_API_KEY from game-studio/.env, OPENROUTER_API_KEY from server/.env (both git-ignored). Never print them.
work/ is scratch (git-ignored); only the optimized model and the path are published.
"""
import base64, json, pathlib, sys, time, urllib.request, urllib.error

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
WORK = HERE / 'work'
IMAGE_MODEL = 'google/gemini-3-pro-image'
MESHY = 'https://api.meshy.ai/openapi/v1'

PROMPT = (
    'Turn this night picture into ONE isolated tilt-shift miniature diorama, like a museum city model: a rounded square block '
    'of exactly this part of old Tbilisi cut out of the city and floating on a thin dark slate base with clean straight cut edges. '
    'Keep everything that is in the picture: the curving river with its stone embankments, the glass Peace Bridge glowing mint, '
    'the Metekhi church on its floodlit rock, the dark blue-grey old town houses with wooden balconies, and the winding street '
    'whose houses glow warm orange with a bright mint light path running along it. '
    'Three-quarter view from above, the whole block visible with a wide margin around it, '
    'plain flat neutral mid-grey seamless studio background, nothing outside the block, no people, no runner figures, '
    'no text, no letters, no logos, no watermark. Crisp detail, physically plausible miniature, soft night lighting.'
)


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


def meta(**update):
    p = WORK / 'meta.json'
    m = json.loads(p.read_text(encoding='utf-8')) if p.exists() else {}
    m.update(update)
    p.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding='utf-8')
    return m


def concept(n):
    src = WORK / 'source.jpg'
    key = env_key(ROOT / 'server' / '.env', 'OPENROUTER_API_KEY')
    for i in range(1, n + 1):
        res = http('https://openrouter.ai/api/v1/chat/completions', {
            'model': IMAGE_MODEL, 'modalities': ['image', 'text'],
            'messages': [{'role': 'user', 'content': [
                {'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + base64.b64encode(src.read_bytes()).decode()}},
                {'type': 'text', 'text': PROMPT + f' (variation {i})'}]}],
            'image_config': {'aspect_ratio': '4:3', 'image_size': '2K'},
        }, {'Authorization': 'Bearer ' + key, 'X-Title': 'MEDIRUN hero 3D'})
        imgs = [im for ch in res.get('choices', []) for im in (ch.get('message', {}).get('images') or [])]
        if not imgs:
            print(f'variation {i}: no image: {json.dumps(res)[:400]}')
            continue
        out = WORK / f'concept_{i}.png'
        out.write_bytes(base64.b64decode(imgs[0]['image_url']['url'].split(',', 1)[1]))
        print('wrote', out.relative_to(HERE), f"(${res.get('usage', {}).get('cost', '?')})", flush=True)


def model(polys):
    src = WORK / 'concept.png'
    if not src.exists():
        sys.exit(f'{src} missing: run concept + pick first')
    auth = meshy_auth()
    # Baked look, no PBR: the night lighting of the key art lives in the base colour, the page adds the light show.
    body = {'image_url': 'data:image/png;base64,' + base64.b64encode(src.read_bytes()).decode(), 'ai_model': 'latest',
            'topology': 'triangle', 'target_polycount': polys, 'should_remesh': True, 'should_texture': True,
            'enable_pbr': False, 'symmetry_mode': 'off'}
    task = http(f'{MESHY}/image-to-3d', body, auth)['result']
    meta(task=task, polys=polys)
    print('meshy task', task, flush=True)
    wait(task, auth)


def wait(task, auth):
    while True:
        st = http(f'{MESHY}/image-to-3d/{task}', headers=auth)
        s = st.get('status')
        if s == 'SUCCEEDED':
            break
        if s in ('FAILED', 'CANCELED', 'EXPIRED'):
            sys.exit(f'meshy {s}: {json.dumps(st.get("task_error"))[:800]}')
        print(' ', s, st.get('progress'), flush=True)
        time.sleep(15)
    (WORK / 'model.glb').write_bytes(http(st['model_urls']['glb'], raw=True))
    if st.get('thumbnail_url'):
        (WORK / 'thumb.png').write_bytes(http(st['thumbnail_url'], raw=True))
    print('wrote work/model.glb', f"{(WORK / 'model.glb').stat().st_size // 1024} KB")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd, rest = sys.argv[1], sys.argv[2:]
    flag = lambda k, dflt: rest[rest.index(k) + 1] if k in rest else dflt
    WORK.mkdir(exist_ok=True)
    if cmd == 'concept':
        concept(int(flag('--n', 3)))
    elif cmd == 'pick':
        (WORK / 'concept.png').write_bytes((WORK / f'concept_{rest[0]}.png').read_bytes())
        meta(picked=int(rest[0]))
    elif cmd == 'model':
        model(int(flag('--polys', 120000)))
    elif cmd == 'status':
        wait(meta()['task'], meshy_auth())
    elif cmd == 'balance':
        print(http(f'{MESHY}/balance', headers=meshy_auth()))
    else:
        sys.exit(__doc__)
