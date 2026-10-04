"""Admin #/social records for the merged Q4 calendar (server/scripts/social-log.mjs input files).

  python admin_records.py <scratch dir>
    reads  <scratch>/old_posts.json, <scratch>/mc/socialpost_rows.json, <scratch>/mc/results-*.json[l]
    writes <scratch>/mc/upsert-new.json   new Q4 posts (SCHEDULED, Metricool id)
           <scratch>/mc/status-old.json   replaced / superseded old posts → CANCELED
           <scratch>/mc/upsert-fix.json   kept old posts whose caption was fixed (new Metricool id, new text)
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
CAMPAIGN = 'medicard-q4-2026'
MEDIA = 'https://medicard.ge/press/q4-2026/'


def results(mc):
    out = {}
    for f in sorted(mc.glob('results-*.json*')):
        if f.suffix == '.jsonl':
            rows = [json.loads(l) for l in f.read_text(encoding='utf-8').splitlines() if l.strip()]
        else:
            rows = json.loads(f.read_text(encoding='utf-8'))
        for r in rows:
            out[r['key']] = r
    return out


def main(scratch):
    sp = pathlib.Path(scratch)
    mc = sp / 'mc'
    plan = {p['id']: p for p in json.loads((HERE / 'plan.json').read_text(encoding='utf-8'))}
    merged = json.loads((HERE / 'merged.json').read_text(encoding='utf-8'))
    old = json.loads((sp / 'old_posts.json').read_text(encoding='utf-8'))
    rows = json.loads((mc / 'socialpost_rows.json').read_text(encoding='utf-8'))
    res = results(mc)

    by_mid = {str(r['metricoolId']): r for r in rows if r.get('metricoolId')}
    by_when = {}
    for r in rows:
        by_when.setdefault((r['scheduledAt'][:16], r['kind']), []).append(r)

    upsert, missing = [], []
    for n in merged['new']:
        if n['verdict'] != 'add':
            continue
        p = plan[n['id']]
        key = f"q{n['date'][5:7]}{n['date'][8:]}-{n['time'].replace(':', '')}"
        r = res.get(key)
        if not r or not r.get('ok', True) or not r.get('id'):
            missing.append(key)
            continue
        kind = 'STORY' if p['kind'] == 'STORY' else 'CAROUSEL' if p['kind'] == 'CAROUSEL' else 'POST'
        title = (p['caption'].split('\n')[0] if p['caption'] else p['note'])[:140]
        notes = ('AI-ით შექმნილი სურათი (Instagram-ზე მონიშნული) · ' if p['ai'] else '') + (p['note'] or '')
        if n.get('why'):
            notes = (notes + ' · ' if notes else '') + n['why']
        upsert.append({'campaign': CAMPAIGN, 'slot': key, 'networks': p['networks'], 'kind': kind,
                       'pillar': 'MEDIRUN' if p['m'] == 'run' else {'medi': 'Medi', 'card': 'MEDICARD'}.get(p['m'], 'MEDI' + p['m'].upper()),
                       'title': title, 'text': p['caption'] or p['note'], 'textEn': p['caption'] if p['kind'] == 'LINKEDIN' else None,
                       'mediaUrls': [MEDIA + img for img in p['images']], 'scheduledAt': f"{n['date']}T{n['time']}:00+04:00",
                       'status': 'SCHEDULED', 'metricoolId': str(r['id']), 'notes': notes[:2000]})

    status, fixes, unmatched = [], [], []
    for o in merged['old']:
        raw = old[o['idx']]
        rec = by_mid.get(str(raw['id']))
        if not rec:
            utc = raw['dt']  # Tbilisi local → match on the UTC minute
            from datetime import datetime, timedelta
            t = (datetime.fromisoformat(utc) - timedelta(hours=4)).strftime('%Y-%m-%dT%H:%M')
            kind = 'STORY' if raw['kind'] == 'STORY' else 'CAROUSEL' if raw['kind'].startswith('POSTx') else 'POST'
            cands = by_when.get((t, kind), [])
            rec = cands[0] if len(cands) == 1 else None
        if o['verdict'] in ('replace', 'draft'):
            if rec:
                status.append({'slot': rec['slot'], 'status': 'CANCELED',
                               'notes': f"ჩანაცვლდა Q4 კალენდრით (medicard-q4-2026): {o['why']}. Metricool-ში დრაფტადაა."})
            else:
                unmatched.append(o['idx'])
        elif o.get('fix') and rec:
            new_id = res.get(f"fix-{o['idx']}", {}).get('id')
            a, b = o['fix']
            fixes.append({'slot': rec['slot'], 'text': raw['text'].replace(a, b), **({'metricoolId': str(new_id)} if new_id else {})})
    (mc / 'upsert-new.json').write_text(json.dumps(upsert, ensure_ascii=False, indent=1), encoding='utf-8')
    (mc / 'status-old.json').write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding='utf-8')
    (mc / 'upsert-fix.json').write_text(json.dumps(fixes, ensure_ascii=False, indent=1), encoding='utf-8')
    print('new', len(upsert), 'missing results', missing)
    print('canceled', len(status), 'unmatched old', unmatched, 'fixes', len(fixes))


if __name__ == '__main__':
    main(sys.argv[1])
