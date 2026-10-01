"""Publish the campaign media in one place: server/public/press/medirun-glow/ (index.html + every image and PDF).

  python build_gallery.py   (after render.py and social.py)

The page is the whole calendar in order — date, time, networks, the image and the exact caption with a copy
button — followed by the print PDFs. It is a plain static page (noindex) so it opens on any phone or computer.
"""
import html, json, pathlib, shutil
from datetime import date

HERE = pathlib.Path(__file__).resolve().parent
DEST = HERE.parents[2] / 'server' / 'public' / 'press' / 'medirun-glow'
DEST.mkdir(parents=True, exist_ok=True)
for sub in ('feed', 'story'):
    for f in (HERE / 'out' / sub).glob('*.jpg'):
        shutil.copy2(f, DEST / f.name)
for f in (HERE / 'out' / 'print').glob('*.pdf'):
    shutil.copy2(f, DEST / f.name)
for f in (HERE / 'out' / 'print').glob('*.png'):
    shutil.copy2(f, DEST / (f.stem + '-preview.png'))

items = json.loads((HERE / 'social.json').read_text(encoding='utf-8'))
MONTHS = ['', 'იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი']
DOW = ['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი', 'კვირა']
NET = {'facebook': 'Facebook', 'instagram': 'Instagram', 'linkedin': 'LinkedIn'}
KIND = {'POST': 'პოსტი', 'CAROUSEL': 'კარუსელი', 'STORY': 'სთორი'}
e = html.escape

days, current = [], None
for it in items:
    r = it['record']; d = r['scheduledAt'][:10]
    if d != current:
        current = d; y, m, dd = map(int, d.split('-'))
        days.append([f'{dd} {MONTHS[m]}, {DOW[date(y, m, dd).weekday()]}', []])
    days[-1][1].append(it)

def card(it):
    r = it['record']; t = r['scheduledAt'][11:16]; manual = it['info'] is None
    imgs = ''.join(f'<a href="{e(u.rsplit("/", 1)[-1])}" target="_blank" rel="noopener"><img loading="lazy" src="{e(u.rsplit("/", 1)[-1])}" alt=""></a>' for u in r['mediaUrls'])
    nets = ' · '.join(NET[n] for n in r['networks'])
    cap = f'<pre>{e(r["text"])}</pre><button type="button" class="copy">ტექსტის დაკოპირება</button>' if r['text'] and not manual else ''
    note = f'<p class="note">{e(r["notes"])}</p>' if manual else ''
    tag = '<span class="tag live">ცოცხლად, ხელით</span>' if manual else f'<span class="tag">{e(KIND.get(r["kind"], r["kind"]))}</span>'
    return f'''<article class="item{' manual' if manual else ''}">
  <header><b>{t}</b>{tag}<span class="nets">{e(nets)}</span></header>
  {f'<div class="media{" many" if len(r["mediaUrls"]) > 1 else ""}">{imgs}</div>' if imgs else ''}
  <h3>{e(r["title"])}</h3>{note}{cap}
</article>'''

calendar = '\n'.join(f'<section class="day"><h2>{e(label)}</h2><div class="grid">{"".join(card(i) for i in its)}</div></section>' for label, its in days)
prints = [('pa3-key', 'A3 პოსტერი QR-ით', '303×426 მმ, 3 მმ ზედნადებით'), ('pa3-teaser', 'A3 თიზერი QR-ით', '303×426 მმ, 3 მმ ზედნადებით'),
          ('pa5-tent', 'A5 მაგიდის ბარათი', '154×216 მმ, 3 მმ ზედნადებით'), ('pst-sticker', 'ვიტრინის სტიკერი Ø150 მმ', '156×156 მმ, მრგვალი ამოჭრა'),
          ('pa4-partner', 'A4 ფურცელი პარტნიორებისთვის', '210×297 მმ, ოფისის პრინტერისთვის')]
print_html = ''.join(f'<article class="item"><a href="{p}.pdf" target="_blank" rel="noopener"><img loading="lazy" src="{p}-preview.png" alt=""></a><h3>{e(n)}</h3><p class="note">{e(s)}</p><a class="btn" href="{p}.pdf" download>PDF-ის ჩამოტვირთვა</a></article>' for p, n, s in prints)
count = {k: sum(1 for i in items if i['info'] is not None and i['record']['kind'] == k and i['record']['networks'] != ['linkedin']) for k in ('POST', 'CAROUSEL', 'STORY')}
li = sum(1 for i in items if i['record']['networks'] == ['linkedin'])
manual = sum(1 for i in items if i['info'] is None)

page = f'''<!DOCTYPE html>
<html lang="ka">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>MEDIRUN · გაანათე თბილისი — პოსტერები და კალენდარი</title>
<link rel="icon" href="/favicon.png">
<style>
@font-face{{font-family:FiraGO;src:url(/fonts/firago/FiraGO-Regular.woff2) format("woff2");font-weight:400}}
@font-face{{font-family:FiraGO;src:url(/fonts/firago/FiraGO-Bold.woff2) format("woff2");font-weight:700}}
:root{{--bg:#050B16;--card:#0C1828;--line:#1C3044;--fg:#E7EEF5;--mute:#8EA2B6;--mint:#2DD4BF;--gold:#F5B83D;--red:#FB7185}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 FiraGO,"Noto Sans Georgian",system-ui,sans-serif}}
.wrap{{max-width:1240px;margin:0 auto;padding:28px 18px 80px}}
h1{{font-size:clamp(30px,5vw,48px);margin:0 0 8px;letter-spacing:-.02em}} h1 i{{color:var(--mint)}}
.lead{{color:var(--mute);max-width:70ch;margin:0}} .stats{{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 6px}}
.stats span{{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:6px 14px;font-size:13px}}
nav.jump{{position:sticky;top:0;z-index:5;background:rgba(5,11,22,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);margin:18px -18px 0;padding:10px 18px;display:flex;gap:8px;overflow-x:auto}}
nav.jump a{{color:var(--fg);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:5px 12px;font-size:13px;white-space:nowrap}}
.day h2{{font-size:20px;margin:34px 0 12px;color:var(--mint)}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}}
.item{{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}}
.item.manual{{border-style:dashed}}
.item header{{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px}} .item header b{{font-size:17px}}
.tag{{background:rgba(45,212,191,.14);color:#99F6E4;border-radius:999px;padding:2px 10px;font-weight:700}} .tag.live{{background:rgba(245,184,61,.15);color:var(--gold)}}
.nets{{color:var(--mute)}}
.media{{display:grid;gap:6px}} .media.many{{grid-template-columns:repeat(3,1fr)}}
.media img,.item>a>img{{width:100%;border-radius:10px;display:block;border:1px solid var(--line)}}
h3{{font-size:15px;margin:0}} .note{{color:var(--mute);font-size:13px;margin:0}}
pre{{white-space:pre-wrap;word-break:break-word;font:13.5px/1.5 FiraGO,system-ui,sans-serif;background:#0A1322;border-radius:10px;padding:10px 12px;margin:0;max-height:260px;overflow:auto}}
button.copy,.btn{{align-self:flex-start;font:700 13px FiraGO,system-ui,sans-serif;color:#022C29;background:var(--mint);border:0;border-radius:999px;padding:8px 14px;cursor:pointer;text-decoration:none}}
.files h2{{color:var(--gold)}}
</style>
</head>
<body><div class="wrap">
<h1>MEDIRUN · <i>გაანათე თბილისი</i></h1>
<p class="lead">3 ოქტომბერი – 31 დეკემბერი 2026. ყველა პოსტი და სთორი თარიღის მიხედვით, ზუსტად იმ ტექსტით, რომელიც გამოქვეყნდება, და ბეჭდვის ფაილები. დააჭირე სურათს — სრული ზომით გაიხსნება.</p>
<div class="stats"><span>{count['POST'] + count['CAROUSEL']} ფიდის პოსტი</span><span>{count['STORY']} სთორი</span><span>{li} LinkedIn</span><span>{manual} ცოცხალი მომენტი</span><span>Facebook · Instagram · LinkedIn</span></div>
<nav class="jump"><a href="#oct">ოქტომბერი</a><a href="#nov">ნოემბერი</a><a href="#dec">დეკემბერი</a><a href="#files">ბეჭდვა</a></nav>
{calendar.replace('<h2>2 ოქტომბერი', '<h2 id="oct">2 ოქტომბერი', 1).replace('<h2>2 ნოემბერი', '<h2 id="nov">2 ნოემბერი', 1).replace('<h2>1 დეკემბერი', '<h2 id="dec">1 დეკემბერი', 1)}
<section class="files day" id="files"><h2>ბეჭდვის ფაილები</h2><div class="grid">{print_html}</div></section>
</div>
<script>
document.addEventListener('click',e=>{{const b=e.target.closest('button.copy');if(!b)return;const t=b.previousElementSibling.textContent;const ok=()=>{{b.textContent='დაკოპირდა ✓';setTimeout(()=>b.textContent='ტექსტის დაკოპირება',1500);}};(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(ok,()=>{{const r=document.createRange();r.selectNodeContents(b.previousElementSibling);const s=getSelection();s.removeAllRanges();s.addRange(r);}});}});
</script>
</body></html>
'''
(DEST / 'index.html').write_text(page, encoding='utf-8')
print('gallery:', DEST / 'index.html', '·', len(list(DEST.iterdir())), 'files')
