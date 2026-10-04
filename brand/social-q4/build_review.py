"""Build review/index.html — the owner's page with the whole Q4 calendar.

  python build_review.py                       new calendar only (plan.json)
  python build_review.py <old_posts.json> <old image dir>
      merged view (merged.json): kept old Metricool posts + new posts on their final day, replaced old posts at the end
"""
import json
import pathlib
import shutil
import sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / 'review'


def web_copy(src, dst):
    im = Image.open(src).convert('RGB')
    w, h = im.size
    im.resize((720, round(720 * h / w)), Image.LANCZOS).save(dst, quality=82, optimize=True, progressive=True)


def main(args):
    plan = {p['id']: p for p in json.loads((HERE / 'plan.json').read_text(encoding='utf-8'))}
    img = OUT / 'img'
    img.mkdir(parents=True, exist_ok=True)
    items = []
    if not args:
        for p in plan.values():
            items.append({k: p.get(k) for k in ('id', 'date', 'time', 'kind', 'm', 'images', 'caption', 'note', 'ai', 'slug', 'reuse')})
    else:
        old_path, old_dir = pathlib.Path(args[0]), pathlib.Path(args[1])
        old = json.loads(old_path.read_text(encoding='utf-8'))
        merged = json.loads((HERE / 'merged.json').read_text(encoding='utf-8'))
        for n in merged['new']:
            p = plan[n['id']]
            it = {k: p.get(k) for k in ('id', 'date', 'time', 'kind', 'm', 'images', 'caption', 'note', 'ai', 'slug', 'reuse')}
            it.update(origin='new', moved=n['why'] if 'გადატანილია' in n['why'] else '')
            if n['verdict'] == 'add':
                it.update(date=n['date'], time=n['time'])
            elif p['kind'] in ('FEED', 'CAROUSEL'):
                it.update(date='reserve', time='', note=f"ახალი, არ დაიგეგმა: {n['why']}")
            else:
                continue
            items.append(it)
        for p in plan.values():
            if p['date'] == 'reserve':
                items.append({**{k: p.get(k) for k in ('id', 'date', 'time', 'kind', 'm', 'images', 'caption', 'note', 'ai', 'slug')}, 'origin': 'new'})
        kinds = {'STORY': 'STORY', 'LI': 'LINKEDIN'}
        for o in merged['old']:
            raw = old[o['idx']]
            names = []
            for i, _ in enumerate(raw['media']):
                src = old_dir / f"{raw['dt'][5:16].replace(':', '').replace('T', '_')}_{raw['kind']}_{i + 1}.jpg"
                name = f"old-{o['idx']}-{i + 1}.jpg"
                if not (img / name).exists():
                    web_copy(src, img / name)
                names.append(name)
            kind = kinds.get(raw['kind'], 'CAROUSEL' if raw['kind'].startswith('POSTx') else 'FEED')
            text = raw['text'] or ''
            if o.get('fix'):
                text = text.replace(*o['fix'])
            it = dict(id=f"old-{o['idx']}", date=raw['dt'][:10], time=raw['dt'][11:16], kind=kind, m='old', images=names,
                      caption=text if kind != 'STORY' else '', note='', ai=bool(raw.get('ai')), origin='old', verdict=o['verdict'], why=o['why'])
            if o['verdict'] != 'keep':
                it.update(date='replaced', note=f"დრაფტად გადავიდა ({raw['dt'][:16].replace('T', ' ')}): {o['why']}")
            elif o.get('fix'):
                it['note'] = 'რჩება — ტექსტში ფარნის ქოინები 500-ით გასწორდა'
            items.append(it)
        items.sort(key=lambda x: (x['date'], x['time'] or ''))
    data = json.dumps(items, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    page = (HERE / 'review_template.html').read_text(encoding='utf-8').replace('/*__DATA__*/[]', data)
    (OUT / 'index.html').write_text(page, encoding='utf-8')
    for p in items:
        for name in p['images']:
            src = HERE / 'out' / 'web' / name
            if src.exists() and not (img / name).exists():
                shutil.copy(src, img / name)
    print('review/index.html', len(page) // 1024, 'KB,', len(items), 'items')


if __name__ == '__main__':
    main(sys.argv[1:])
