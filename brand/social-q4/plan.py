"""MEDICARD social calendar, 5 Oct – 31 Dec 2026 — the single source of truth for the Q4 posters and captions.

  python plan.py            -> plan.json (posters to render) + social.json (admin #/social records, Metricool payloads)
  python render.py          -> out/feed, out/story (full size) + out/web (review size)
  python build_review.py    -> review/index.html (the page the owner reviews)

Daily rhythm (Tbilisi time; brandbook slots, MEDIRUN first):
  Mon 07:45 story (week) · 10:00 MEDIRUN week post
  Tue 10:00 module post · 12:45 MEDIRUN midday story      (+ LinkedIn 09:30 every other Tuesday)
  Wed 10:00 module post · 17:45 MEDIRUN evening story
  Thu 10:00 module post · 19:30 MEDIRUN tip story
  Fri 10:00 module post · 19:30 „tomorrow: gift rain“ story
  Sat 11:00 gift rain post · 15:00 riddle · 15:30 hint
  Sun 11:00 module post · 19:30 „weekly prizes tonight“ story
"""
import json
import pathlib
import sys
from collections import Counter, defaultdict

from copy_common import APP, SITE, FIRST_COMMENT
import copy_run
from copy_modules import POSTS as MODULE_POSTS

HERE = pathlib.Path(__file__).resolve().parent
CAMPAIGN = 'medicard-q4-2026'
SCREENS = HERE / 'screens'

# module post -> date (feed 10:00 weekdays, 11:00 Sunday)
SCHEDULE = {
    '2026-10-07': 'medi-chat', '2026-10-08': 'pill-remind', '2026-10-11': 'cycle-dial',
    '2026-10-13': 'scan-lab', '2026-10-14': 'lab-bars', '2026-10-16': 'food-georgian', '2026-10-18': 'vet-hub',
    '2026-10-20': 'cycle-pink', '2026-10-21': 'medi-confirm', '2026-10-23': 'pill-pharmacy', '2026-10-25': 'home-layouts',
    '2026-10-27': 'scan-imaging', '2026-10-28': 'food-photo', '2026-10-30': 'coach-client',
    '2026-11-01': 'util-water', '2026-11-03': 'home-men', '2026-11-04': 'cycle-private', '2026-11-05': 'quest-store',
    '2026-11-06': 'medi-consilium', '2026-11-08': 'vet-care', '2026-11-10': 'lab-trend', '2026-11-11': 'food-fasting',
    '2026-11-12': 'pill-interact', '2026-11-13': 'diabetes', '2026-11-15': 'lab-passport', '2026-11-17': 'scan-skin',
    '2026-11-19': 'cycle-doctor', '2026-11-20': 'medi-ask', '2026-11-22': 'quest-invite', '2026-11-24': 'symptoms',
    '2026-11-25': 'food-ways', '2026-11-26': 'coach-scopes', '2026-11-27': 'card-free', '2026-11-29': 'vet-chat',
    '2026-12-02': 'pill-parents', '2026-12-03': 'lab-records', '2026-12-04': 'util-weight', '2026-12-06': 'cycle-home',
    '2026-12-08': 'medi-privacy', '2026-12-10': 'food-weight', '2026-12-11': 'scan-one', '2026-12-13': 'quest-missions',
    '2026-12-15': 'card-lang', '2026-12-17': 'cycle-log', '2026-12-18': 'visits', '2026-12-20': 'card-web',
    '2026-12-22': 'pill-holiday', '2026-12-24': 'food-table', '2026-12-27': 'year-recap',
}
RESERVE = ['partners', 'coach-trainer', 'food-barcode', 'pill-stats', 'quest-levels']

LINKEDIN = [
    ('2026-10-13', 'q1005-1000', 3, '\n'.join([
        'We turned Tbilisi into a game. With almost no budget.',
        '',
        'MEDIRUN is the walking game inside MEDICARD. From 5 October to 31 December, gift boxes appear in public parks three times a day, and players find them by feel: the phone beats like a heart as they get closer.',
        '',
        'How we kept it motivating and cheap:',
        '• Many small boxes instead of a few big ones',
        '• A first-finder ladder: the first opener gets 100%, then 60%, 40%, 25%',
        '• Status over cash: weekly leaderboards for boxes and distance',
        '• One grand prize that only shows up for people who have walked 1% of their city (about 50 km of new streets)',
        '• A hard season budget the autopilot respects on its own',
        '• No random draws, ever',
        '',
        'The world does not need another step counter. It needs a reason to go outside.',
        '',
        '#MEDIRUN #Gamification #HealthTech #Tbilisi #Georgia'])),
    ('2026-10-27', 'q1021-1000', 0, '\n'.join([
        'Our AI assistant has one rule above all others: it never saves anything on its own.',
        '',
        'Medi is one chat for everyday health in MEDICARD. Ask in Georgian or English, by voice or text. When a message should become a record (a medication, a doctor visit, a glass of water, a meal), Medi shows a card in the chat: save, edit or cancel. Nothing is written until the person taps.',
        '',
        'The same principle runs through the product:',
        '• Consent before any data reaches an AI provider, with named recipients',
        '• Declining is a calm choice, not an error',
        '• Intimate cycle data never reaches AI at all',
        '',
        'Trust is not a feature. It is the product.',
        '',
        '#AI #ResponsibleAI #HealthTech #Privacy #Georgia'])),
    ('2026-11-10', 'q1029-1000', 0, '\n'.join([
        'A city game that works in any city.',
        '',
        'MEDIRUN started with gift boxes planned for Tbilisi. Then players appeared in Batumi, Kutaisi and even abroad.',
        '',
        'So the game now places boxes wherever a player lives:',
        '• Spots come from OpenStreetMap paths inside public parks',
        '• Safety rules in code: away from roads, water, schools, hospitals, places of worship',
        '• Three waves a day at local time; more players, more boxes',
        '',
        'Small teams can build systems that scale to places they have never been. You just have to write the rules down.',
        '',
        '#MEDIRUN #OpenStreetMap #ProductDesign #HealthTech'])),
    ('2026-11-24', 'reserve-01-partners', 0, '\n'.join([
        'Tbilisi businesses: want people walking to your door?',
        '',
        'During “Light up Tbilisi” (until 31 December), MEDIRUN players walk the city looking for gift boxes. A café, gym, shop or pharmacy can become a gift point: we place a virtual box at your door and players come to you.',
        '',
        'You give a few dozen small gifts (a coffee, a discount, a day pass). We bring visitors, mention you in our posts and tell you exactly how many people opened your box.',
        '',
        'Write to support@medicard.ge',
        '',
        '#MEDIRUN #Tbilisi #LocalBusiness #Partnerships'])),
    ('2026-12-08', 'q1126-1000', 0, '\n'.join([
        'Privacy by default, not by settings page.',
        '',
        'MEDICOACH connects people with verified fitness trainers inside MEDICARD. When a client links a trainer, nothing is shared. The client chooses each scope (workouts, nutrition, weight, photos) and can revoke any of them instantly.',
        '',
        'Clients and trainers can report each other, a client can block a trainer, and a client who ends the link is never re-invited by that trainer.',
        '',
        'Health data is the most personal data there is. Defaults should say so.',
        '',
        '#PrivacyByDesign #HealthTech #Fitness #Georgia'])),
    ('2026-12-22', 'q1227-1100', 0, '\n'.join([
        'One app, one naming system, ten modules.',
        '',
        'In 2026 MEDICARD grew from a medication reminder into a family: Medi (AI assistant), MEDIPILL, MEDIFOOD, MEDICYCLE, MEDILAB, MEDISCAN, MEDIRUN, MEDIQUEST, MEDIVET and MEDICOACH. Each has one colour and one wordmark, so people know where they are at a glance.',
        '',
        'All of it is free, in Georgian and English, on iPhone and on the web.',
        '',
        'Thank you to everyone who walked, logged, asked and told us what to fix. More in 2027.',
        '',
        '#HealthTech #ProductDesign #Branding #Georgia'])),
]
LINKS_EN = f'📲 Free on iPhone: {APP}\n🌐 {SITE}'


def pid(date, time):
    return f'q{date[5:7]}{date[8:]}-{time.replace(":", "")}'


def resolve(slide, pulls):
    s = dict(slide)
    p = s.get('pull')
    if isinstance(p, str) or p is None:
        hit = pulls.get(p) if p else None
        if hit and (SCREENS / f"{hit['shot']}.webp").exists():
            s['pull'] = hit
            s.pop('ticks', None)
        else:
            s.pop('pull', None)
    return s


def build():
    pulls = json.loads((HERE / 'pulls.json').read_text(encoding='utf-8')) if (HERE / 'pulls.json').exists() else {}
    posts = copy_run.all_run_posts()
    posts.append(dict(copy_run.store_feed('2026-12-25', xmas=True)))
    for date, slug in SCHEDULE.items():
        mp = MODULE_POSTS[slug]
        sunday = date in copy_run.SUNDAYS
        posts.append(dict(date=date, time='11:00' if sunday else '10:00', kind='CAROUSEL' if len(mp['slides']) > 1 else 'FEED',
                          m=mp['m'], slides=mp['slides'], caption=mp['caption'], note='', ai=mp['ai'], slug=slug))
    reserve = []
    for slug in RESERVE:
        mp = MODULE_POSTS[slug]
        reserve.append(dict(date='reserve', time='', kind='FEED', m=mp['m'], slides=mp['slides'], caption=mp['caption'], note='სათადარიგო', ai=mp['ai'], slug=slug))

    out = []
    for p in sorted(posts, key=lambda x: (x['date'], x['time'])):
        p['id'] = pid(p['date'], p['time'])
        out.append(p)
    for i, p in enumerate(reserve, 1):
        p['id'] = f'reserve-{i:02d}-{p["slug"]}'
        out.append(p)
    ids = Counter(p['id'] for p in out)
    dup = [k for k, v in ids.items() if v > 1]
    if dup:
        sys.exit(f'duplicate slots: {dup}')
    for p in out:
        p['slides'] = [resolve(s, pulls) for s in p['slides']]
        p['images'] = [f"{p['id']}-{i + 1}.jpg" for i in range(len(p['slides']))]
        p['networks'] = ['facebook', 'instagram']
    # LinkedIn reuses one image of an existing post
    by_id = {p['id']: p for p in out}
    for date, src, idx, text in LINKEDIN:
        img = by_id[src]['images'][idx]
        blocks = text.split('\n\n')
        text = '\n\n'.join(blocks[:-1] + [LINKS_EN, blocks[-1]])
        out.append(dict(id=pid(date, '09:30'), date=date, time='09:30', kind='LINKEDIN', m='card', slides=[], images=[img],
                        reuse=src, caption=text, note='LinkedIn (English)', ai=by_id[src]['ai'], networks=['linkedin']))
    out.sort(key=lambda x: (x['date'], x['time']))
    return out


def records(plan):
    """admin #/social rows (server/scripts/social-log.mjs upsert) + Metricool payloads — used only after the owner approves."""
    rows = []
    for p in plan:
        if p['date'] == 'reserve':
            continue
        when = f"{p['date']}T{p['time']}:00"
        kind = 'STORY' if p['kind'] == 'STORY' else 'CAROUSEL' if p['kind'] == 'CAROUSEL' else 'POST'
        media = [f'https://medicard.ge/press/q4-2026/{n}' for n in p['images']]
        title = (p['caption'].split('\n')[0] if p['caption'] else p['note'])[:140]
        rec = {'campaign': CAMPAIGN, 'slot': p['id'], 'networks': p['networks'], 'kind': kind,
               'pillar': 'MEDIRUN' if p['m'] == 'run' else p['m'].upper(), 'title': title, 'text': p['caption'] or p['note'],
               'textEn': p['caption'] if p['kind'] == 'LINKEDIN' else None, 'mediaUrls': media, 'scheduledAt': f'{when}+04:00',
               'status': 'PLANNED', 'notes': ('AI-ით შექმნილი სურათი · ' if p['ai'] else '') + (p['note'] or '')}
        info = {'autoPublish': True, 'draft': False, 'media': media, 'publicationDate': {'dateTime': when, 'timezone': 'Asia/Tbilisi'},
                'providers': [{'network': n} for n in p['networks']]}
        if p['kind'] == 'LINKEDIN':
            info.update(text=p['caption'], linkedinData={'type': 'post', 'previewIncluded': True, 'publishImagesAsPDF': False})
        elif p['kind'] == 'STORY':
            info.update(facebookData={'type': 'STORY'}, instagramData={'type': 'STORY', 'isAiGenerated': p['ai']})
        else:
            info.update(text=p['caption'], firstCommentText=FIRST_COMMENT, facebookData={'type': 'POST'},
                        instagramData={'type': 'POST', 'isAiGenerated': p['ai']})
        rows.append({'slot': p['id'], 'record': rec, 'info': info})
    return rows


def check(plan):
    days = defaultdict(list)
    for p in plan:
        if p['date'] != 'reserve':
            days[p['date']].append(p)
    problems = []
    for d, ps in sorted(days.items()):
        n = len([p for p in ps if p['kind'] != 'LINKEDIN'])
        if n < 2:
            problems.append(f'{d}: only {n} items')
    for p in plan:
        if p['kind'] in ('FEED', 'CAROUSEL', 'LINKEDIN') and APP not in p['caption']:
            problems.append(f"{p['id']}: caption without App Store link")
        if p['kind'] in ('FEED', 'CAROUSEL') and SITE not in p['caption']:
            problems.append(f"{p['id']}: caption without medicard.ge")
        for s in p['slides']:
            for key in ('shot',):
                if s.get(key) and not (SCREENS / f"{s[key]}.webp").exists():
                    problems.append(f"{p['id']}: missing screen {s[key]}")
            for sh in s.get('shots', []):
                if not (SCREENS / f'{sh}.webp').exists():
                    problems.append(f"{p['id']}: missing screen {sh}")
            for word in ('MEDI QUEST', 'Medi Vet', 'MEDI COACH', 'MEDI RUN', 'Medi Run', 'Nightingale', 'MEDIDOCTOR', 'სნიმარი'):
                blob = json.dumps(s, ensure_ascii=False) + p['caption']
                if word in blob:
                    problems.append(f"{p['id']}: forbidden name {word}")
    return problems, days


if __name__ == '__main__':
    plan = build()
    (HERE / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=1), encoding='utf-8')
    (HERE / 'social.json').write_text(json.dumps(records(plan), ensure_ascii=False, indent=1), encoding='utf-8')
    problems, days = check(plan)
    kinds = Counter(p['kind'] for p in plan if p['date'] != 'reserve')
    images = sum(len(p['slides']) for p in plan)
    print(f"{len(plan)} items ({sum(1 for p in plan if p['date'] == 'reserve')} reserve) over {len(days)} days · {dict(kinds)} · {images} images to render")
    per_day = Counter(len([p for p in ps if p['kind'] != 'LINKEDIN']) for ps in days.values())
    print('items per day:', dict(sorted(per_day.items())))
    for line in problems[:60]:
        print('  !', line)
    if len(problems) > 60:
        print(f'  … {len(problems) - 60} more')
