"""Build the Metricool payloads for the merged calendar (merged.json):
  drafts.json   — old outdated posts → draft (full original content, draft: true)
  fixes.json    — kept old posts whose caption gets one fact fixed
  creates-*.json — new posts to schedule, split in date chunks for parallel workers

  python metricool_payloads.py <old_posts.json> <media base url> <out dir>
"""
import json
import pathlib
import sys

from copy_common import FIRST_COMMENT

HERE = pathlib.Path(__file__).resolve().parent


def old_info(raw, draft=None, text=None):
    nets = [p['network'] for p in raw['providers']]
    info = {
        'autoPublish': raw.get('autoPublish', True), 'draft': raw['draft'] if draft is None else draft,
        'descendants': [], 'hasNotReadNotes': raw.get('hasNotReadNotes', False), 'shortener': raw.get('shortener', False),
        'smartLinkData': {'ids': []}, 'media': raw['media'], 'mediaAltText': raw.get('mediaAltText') or [],
        'publicationDate': raw['publicationDate'], 'providers': [{'network': n} for n in nets],
        'firstCommentText': raw.get('firstCommentText', ''),
    }
    t = raw.get('text', '') if text is None else text
    if t:
        info['text'] = t
    for key, net in (('facebookData', 'facebook'), ('instagramData', 'instagram'), ('linkedinData', 'linkedin')):
        if net in nets and raw.get(key) is not None:
            info[key] = raw[key]
    return info


def main(old_path, base, out_dir):
    out = pathlib.Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    old = json.loads(pathlib.Path(old_path).read_text(encoding='utf-8'))
    merged = json.loads((HERE / 'merged.json').read_text(encoding='utf-8'))
    plan = {p['id']: p for p in json.loads((HERE / 'plan.json').read_text(encoding='utf-8'))}

    drafts, fixes = [], []
    for o in merged['old']:
        raw = old[o['idx']]['raw']
        if o['verdict'] == 'replace':
            drafts.append(dict(key=f"old-{o['idx']}", dt=o['dt'], why=o['why'], id=str(raw['id']), uuid=raw['uuid'],
                               info=json.dumps(old_info(raw, draft=True), ensure_ascii=False)))
        elif o['verdict'] == 'keep' and o.get('fix'):
            a, b = o['fix']
            assert a in raw['text'], f"fix text not found in old #{o['idx']}"
            fixes.append(dict(key=f"old-{o['idx']}", dt=o['dt'], id=str(raw['id']), uuid=raw['uuid'],
                              info=json.dumps(old_info(raw, text=raw['text'].replace(a, b)), ensure_ascii=False)))

    creates = []
    for n in merged['new']:
        if n['verdict'] != 'add':
            continue
        p = plan[n['id']]
        when = f"{n['date']}T{n['time']}:00"
        slot = f"q{n['date'][5:7]}{n['date'][8:]}-{n['time'].replace(':', '')}"
        media = [base + img for img in p['images']]
        nets = p['networks']
        info = {'autoPublish': True, 'draft': False, 'descendants': [], 'hasNotReadNotes': False, 'shortener': False,
                'smartLinkData': {'ids': []}, 'media': media, 'mediaAltText': [],
                'publicationDate': {'dateTime': when, 'timezone': 'Asia/Tbilisi'}, 'providers': [{'network': x} for x in nets]}
        if p['kind'] == 'LINKEDIN':
            info.update(text=p['caption'], firstCommentText='', linkedinData={'type': 'post', 'previewIncluded': True, 'publishImagesAsPDF': False})
        elif p['kind'] == 'STORY':
            info.update(firstCommentText='', facebookData={'type': 'STORY'}, instagramData={'type': 'STORY', 'isAiGenerated': bool(p['ai'])})
        else:
            info.update(text=p['caption'], firstCommentText=FIRST_COMMENT, facebookData={'type': 'POST'},
                        instagramData={'type': 'POST', 'isAiGenerated': bool(p['ai'])})
        creates.append(dict(key=slot, plan_id=n['id'], date=f"{when}+04:00", kind=p['kind'],
                            info=json.dumps(info, ensure_ascii=False)))
    creates.sort(key=lambda c: c['date'])
    (out / 'drafts.json').write_text(json.dumps(sorted(drafts, key=lambda d: d['dt']), ensure_ascii=False, indent=1), encoding='utf-8')
    (out / 'fixes.json').write_text(json.dumps(fixes, ensure_ascii=False, indent=1), encoding='utf-8')
    cuts = [('A', '2026-10-05', '2026-10-25'), ('B', '2026-10-26', '2026-11-22'), ('C', '2026-11-23', '2026-12-31')]
    for name, lo, hi in cuts:
        part = [c for c in creates if lo <= c['date'][:10] <= hi]
        (out / f'creates-{name}.json').write_text(json.dumps(part, ensure_ascii=False, indent=1), encoding='utf-8')
        print(name, len(part))
    print('drafts', len(drafts), 'fixes', len(fixes), 'creates', len(creates))


if __name__ == '__main__':
    main(*sys.argv[1:4])
