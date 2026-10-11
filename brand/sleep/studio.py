"""MEDISLEEP studio (OpenRouter): melodies (Lyria 3 Pro) and cover art (Nano Banana Pro) for the sound library.

    py brand/sleep/studio.py music [ids]   -> sounds/out/<id>.mp3|wav -> .m4a (loudness matched to synth.py)
    py brand/sleep/studio.py art [ids]     -> art/out/<id>.png -> art/out/<id>.jpg (900x1200)

The catalogue (ids, titles, prompts) lives in library.json next to this file; the server's seed reads the same
file. Key: OPENROUTER_API_KEY from the main checkout's server/.env (git-ignored). Never print it.
"""
import base64
import json
import pathlib
import subprocess
import sys
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
API = 'https://openrouter.ai/api/v1'
IMAGE_MODEL = 'google/gemini-3-pro-image'
MUSIC_MODEL = 'google/lyria-3-pro-preview'
ENV_CANDIDATES = [HERE.parents[1] / 'server' / '.env', pathlib.Path(r'C:\Users\User\Desktop\www.medicard\server\.env')]
SOUND_OUT = HERE / 'sounds' / 'out'
ART_OUT = HERE / 'art' / 'out'
TARGET_LUFS = -24.0


def key():
    for env in ENV_CANDIDATES:
        if env.exists():
            for line in env.read_text(encoding='utf-8').splitlines():
                if line.startswith('OPENROUTER_API_KEY='):
                    return line.split('=', 1)[1].strip().strip('"')
    sys.exit('OPENROUTER_API_KEY missing in server/.env')


def library():
    return json.loads((HERE / 'library.json').read_text(encoding='utf-8'))


def post(body, stream=False):
    req = urllib.request.Request(f'{API}/chat/completions', data=json.dumps(body).encode(), method='POST',
                                 headers={'Authorization': f'Bearer {key()}', 'Content-Type': 'application/json',
                                          'X-Title': 'Medicard sleep studio'})
    try:
        return urllib.request.urlopen(req, timeout=900)
    except urllib.error.HTTPError as e:
        sys.exit(f'HTTP {e.code}: {e.read().decode()[:1500]}')


def music(ids):
    SOUND_OUT.mkdir(parents=True, exist_ok=True)
    for item in library()['sounds']:
        if item.get('source') != 'lyria' or (ids and item['id'] not in ids):
            continue
        body = {'model': MUSIC_MODEL, 'modalities': ['text', 'audio'], 'stream': True,
                'messages': [{'role': 'user', 'content': item['prompt']}]}
        chunks, fmt, cost = [], None, None
        with post(body, stream=True) as r:
            for raw in r:
                line = raw.decode().strip()
                if not line.startswith('data:') or line == 'data: [DONE]':
                    continue
                ev = json.loads(line[5:])
                for ch in ev.get('choices', []):
                    a = (ch.get('delta') or {}).get('audio') or {}
                    if a.get('data'):
                        chunks.append(a['data'])
                    fmt = a.get('format') or fmt
                if ev.get('usage'):
                    cost = ev['usage'].get('cost')
        data = b''.join(base64.b64decode(c) for c in chunks)
        if not data:
            print('no audio for', item['id'])
            continue
        ext = fmt or ('mp3' if data[:3] == b'ID3' or data[:2] == b'\xff\xfb' else 'wav' if data[:4] == b'RIFF' else 'bin')
        src = SOUND_OUT / f"{item['id']}.src.{ext}"
        src.write_bytes(data)
        encode(src, SOUND_OUT / f"{item['id']}.m4a")
        print('music', item['id'], f'${cost}', flush=True)


def encode(src, dest):
    """Loudness-match to the procedural sounds (two-pass loudnorm), soft 3 s fade in/out, AAC 128k."""
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(src)],
                           capture_output=True, text=True, check=True)
    dur = float(probe.stdout.strip())
    fades = f'afade=t=in:d=3,afade=t=out:st={max(0.0, dur - 4):.2f}:d=4'
    measure = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(src), '-af',
                              f'{fades},loudnorm=I={TARGET_LUFS}:TP=-3:LRA=11:print_format=json', '-f', 'null', '-'],
                             capture_output=True, text=True, check=True).stderr
    s = json.loads(measure[measure.rindex('{'):measure.rindex('}') + 1])
    af = (f"{fades},loudnorm=I={TARGET_LUFS}:TP=-3:LRA=11:linear=true:measured_I={s['input_i']}:"
          f"measured_TP={s['input_tp']}:measured_LRA={s['input_lra']}:measured_thresh={s['input_thresh']}:"
          f"offset={s['target_offset']}")
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src), '-af', af, '-ar', '44100',
                    '-ac', '2', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(dest)], check=True)
    print(f'  {dest.name} {dur:.0f}s {dest.stat().st_size / 1e6:.2f} MB')


def art(ids):
    ART_OUT.mkdir(parents=True, exist_ok=True)
    lib = library()
    style = lib['artStyle']
    for item in lib['sounds']:
        if ids and item['id'] not in ids:
            continue
        png = ART_OUT / f"{item['id']}.png"
        res = json.load(post({
            'model': IMAGE_MODEL, 'modalities': ['image', 'text'],
            'messages': [{'role': 'user', 'content': f"{item['art']} {style}"}],
            'image_config': {'aspect_ratio': '3:4', 'image_size': '1K'},
        }))
        done = False
        for ch in res.get('choices', []):
            for im in ch.get('message', {}).get('images') or []:
                png.write_bytes(base64.b64decode(im['image_url']['url'].split(',', 1)[1]))
                done = True
                break
        if not done:
            print('no image for', item['id'], json.dumps(res)[:400])
            continue
        jpg = ART_OUT / f"{item['id']}.jpg"
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(png), '-vf',
                        'scale=900:1200:force_original_aspect_ratio=increase,crop=900:1200', '-q:v', '4', str(jpg)],
                       check=True)
        print('art', item['id'], f"${res.get('usage', {}).get('cost', '?')}", f'{jpg.stat().st_size / 1e3:.0f} KB', flush=True)


if __name__ == '__main__':
    cmd, *rest = sys.argv[1:] or ['help']
    {'music': music, 'art': art}.get(cmd, lambda _: print(__doc__))(rest)
