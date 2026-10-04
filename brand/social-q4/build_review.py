"""Build review/index.html — the owner's review page for the Q4 calendar (published as a private Artifact).

  python build_review.py     reads plan.json, writes review/index.html (images: out/web/*.jpg published as img/*.jpg)
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
plan = json.loads((HERE / 'plan.json').read_text(encoding='utf-8'))
items = [{k: p.get(k) for k in ('id', 'date', 'time', 'kind', 'm', 'images', 'caption', 'note', 'ai', 'slug', 'reuse')} for p in plan]
data = json.dumps(items, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')

page = (HERE / 'review_template.html').read_text(encoding='utf-8').replace('/*__DATA__*/[]', data)
out = HERE / 'review'
out.mkdir(exist_ok=True)
(out / 'index.html').write_text(page, encoding='utf-8')
print('review/index.html', len(page) // 1024, 'KB,', len(items), 'items')
