"""MEDIRUN Glow landmark studio: a hero 3D model for one real landmark on the night map.

  python landmark.py concept <name> "<description>" [--aspect 9:16]   -> work/<name>/concept.png   (OpenRouter image, a few cents)
  python landmark.py model <name> [--polys N]          -> work/<name>/model.glb     (Meshy image-to-3D, Meshy credits)
  node optimize.mjs <name>                             -> server/public/medirun/glow/detail/models/<name>.glb

Keys: MESHY_API_KEY from game-studio/.env, OPENROUTER_API_KEY from server/.env (both git-ignored). Never print them.
work/ is scratch (git-ignored); only the optimized model and the placement in detail/landmarks.json are published.
"""
import base64, json, pathlib, sys, time, urllib.request, urllib.error

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]
WORK = HERE / 'work'
IMAGE_MODEL = 'google/gemini-3-pro-image'


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
        sys.exit(f'HTTP {e.code} {url}: {e.read().decode()[:1500]}')


def folder(name):
    d = WORK / name
    d.mkdir(parents=True, exist_ok=True)
    return d


def concept(name, desc, aspect='16:9'):
    d = folder(name)
    prompt = ('Reference image for 3D modelling of a real landmark. The whole structure from end to end, isolated: '
              'no water, no ground, no city, no people, no sky — a plain light grey studio background. Elevated three-quarter '
              'view, even soft studio light, no shadows on the background, no text, no watermark. Accurate proportions and '
              f'structure. Landmark: {desc}')
    res = http('https://openrouter.ai/api/v1/chat/completions', {
        'model': IMAGE_MODEL, 'modalities': ['image', 'text'], 'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': prompt}]}],
        'image_config': {'aspect_ratio': aspect, 'image_size': '2K'},
    }, {'Authorization': 'Bearer ' + env_key(ROOT / 'server' / '.env', 'OPENROUTER_API_KEY'), 'X-Title': 'MEDIRUN landmarks'})
    for ch in res.get('choices', []):
        for im in ch.get('message', {}).get('images') or []:
            (d / 'concept.png').write_bytes(base64.b64decode(im['image_url']['url'].split(',', 1)[1]))
            (d / 'meta.json').write_text(json.dumps({'description': desc}, indent=2, ensure_ascii=False), encoding='utf-8')
            print('wrote', (d / 'concept.png').relative_to(HERE), f"(${res.get('usage', {}).get('cost', '?')})")
            return
    sys.exit(f'no image: {json.dumps(res)[:1500]}')


def model(name, polys):
    d = folder(name)
    src = d / 'concept.png'
    if not src.exists():
        sys.exit(f'{src} missing: run concept first or drop your own image there')
    auth = {'Authorization': 'Bearer ' + env_key(ROOT / 'game-studio' / '.env', 'MESHY_API_KEY')}
    job = http('https://api.meshy.ai/openapi/v1/image-to-3d', {
        'image_url': 'data:image/png;base64,' + base64.b64encode(src.read_bytes()).decode(),
        'ai_model': 'latest', 'topology': 'triangle', 'target_polycount': polys, 'should_remesh': True,
        'should_texture': True, 'enable_pbr': False, 'symmetry_mode': 'off',
    }, auth)
    task = job.get('result')
    print('meshy task', task, flush=True)
    while True:
        time.sleep(10)
        st = http(f'https://api.meshy.ai/openapi/v1/image-to-3d/{task}', headers=auth)
        if st.get('status') == 'SUCCEEDED':
            break
        if st.get('status') in ('FAILED', 'CANCELED', 'EXPIRED'):
            sys.exit(f"meshy {st.get('status')}: {json.dumps(st.get('task_error'))[:800]}")
        print(' ', st.get('status'), st.get('progress'), flush=True)
    (d / 'model.glb').write_bytes(http(st['model_urls']['glb'], raw=True))
    if st.get('thumbnail_url'):
        (d / 'model_thumb.png').write_bytes(http(st['thumbnail_url'], raw=True))
    print('wrote', (d / 'model.glb').relative_to(HERE), 'task', task)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, rest = sys.argv[1], sys.argv[2:]
    if cmd == 'concept':
        concept(rest[0], rest[1], rest[rest.index('--aspect') + 1] if '--aspect' in rest else '16:9')
    elif cmd == 'model':
        model(rest[0], int(rest[rest.index('--polys') + 1]) if '--polys' in rest else 40000)
    else:
        sys.exit(__doc__)
