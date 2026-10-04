"""Merge the Q4 calendar with the posts already scheduled in Metricool (owner 2026-10-04 evening:
„keep the good old posts — replace only those with an old app screen or old information“).

Inputs: plan.json (new calendar) and old_posts.json (Metricool getScheduledPosts dump, one row per post: id, uuid, dt,
kind, draft, text, media …). Output: merged.json — every old post with a verdict (keep / replace / draft) and every new
post with a verdict (add / skip + reason); day counts stay at 2–3 (LinkedIn not counted).

  python merge.py <old_posts.json>
"""
import json
import pathlib
import sys
from collections import defaultdict

HERE = pathlib.Path(__file__).resolve().parent

# Old posts to replace, by the index in old_posts.json (reviewed one by one on the images and captions):
# old app screens (pre-module-branding v2/v3 screens), the camera step, 08:30/10:30 schedule, old coin amounts
# (Saturday 50/100 or 250/500, lantern 300 / 1 500, 10–50), old module names (Medi Vet, MEDI COACH, Medi Quest).
REPLACE = {
    4: 'კამერა (როგორ ვიპოვო)', 5: 'ძველი ეკრანი (წამლები)', 6: '08:30 · 18:00', 10: 'ძველი ეკრანი (ანალიზი)',
    19: 'ძველი ეკრანი (ანალიზი)', 20: 'ძველი ეკრანი (კვება)', 21: 'შაბათის ქოინები 50/100', 22: 'ძველი ეკრანი (კვება)',
    24: '10:30 · 17:30', 25: 'ძველი ეკრანი (ციკლი)', 28: 'ძველი ეკრანი (ციკლი)', 32: '08:30 · 18:00',
    33: 'ძველი სახელი Medi Vet', 35: 'ძველი ეკრანი (ცხოველები)', 40: 'ძველი ეკრანი + Medi Quest', 41: 'ფარანი 300',
    42: 'ძველი ეკრანი (Medi Quest)', 48: 'ძველი სახელი MEDI COACH', 49: 'შაბათის ქოინები 50/100', 50: 'ძველი სახელი MEDI COACH',
    52: '10:30 · 17:30', 53: 'ძველი ეკრანი (MEDIRUN)', 56: 'ძველი ეკრანი (MEDIRUN)', 60: '08:30 · 18:00',
    75: 'შაბათის ქოინები 50/100', 78: '10:30 · 17:30', 85: '08:30 · 18:00', 86: 'ძველი ეკრანი (ანალიზი)',
    88: 'ძველი ეკრანი (ანალიზი)', 93: 'კამერა (როგორ ვიპოვო)', 96: 'შაბათის ქოინები 50/100', 98: '10:30 · 17:30',
    101: '08:30 · 18:00', 104: 'შაბათის ქოინები + ფარანი 300', 106: '10:30 · 17:30', 109: '08:30 · 18:00',
    111: '08:30 / 10:30, 10–50', 112: 'შაბათის ქოინები + ფარანი 300', 114: '10:30 · 17:30', 117: '08:30 · 18:00',
    118: 'ფარანი 300', 120: 'შაბათის ქოინები + ფარანი 300', 122: '10:30 · 17:30', 125: '08:30 · 18:00',
    126: 'კამერა (როგორ ვიპოვო)', 127: 'შაბათის ქოინები + ფარანი 300', 129: '10:30 · 17:30', 132: '08:30 · 18:00',
    136: 'შაბათის ქოინები + ფარანი 300', 138: '10:30 · 17:30', 141: '08:30 · 18:00', 143: 'შაბათის ქოინები + ფარანი 300',
    145: '10:30 · 17:30', 148: '08:30 · 18:00', 149: 'ფარანი 300', 151: 'შაბათის ქოინები + ფარანი 300',
    153: '10:30 · 17:30', 156: '08:30 · 18:00', 158: 'შაბათის ქოინები + ფარანი 300', 160: '10:30 · 17:30',
    163: '08:30 · 18:00',
    82: 'იმავე დღის დილის ფოტო-პოსტის დუბლი; შაბათს წვიმა და გამოცანებიც არის',
}
# Kept old posts whose caption needs one fact fixed (the image is right).
FIX_TEXT = {
    102: ('🏮 და კიდევ ერთი სიახლე: შაბათობით ფარნის ყუთები — თითოში 300 Medi Coins.',
          '🏮 და კიდევ ერთი სიახლე: შაბათობით ფარნის ყუთები — პირველ გამხსნელს 500 Medi Coins.'),
}

# New posts that repeat a kept old post's role (old one stays): by new post id → reason.
SKIP_NEW = {
    'q1012-1000': 'ძველი „კვირა 2“ (13:00) რჩება', 'q1019-1000': 'ძველი „კვირა 3“ (13:00) რჩება',
    'q1026-1000': 'ძველი „კვირა 4“ (13:00) რჩება', 'q1102-1000': 'ძველი „ნოემბერი — უბნების თვე“ რჩება (ტექსტი გასწორდა)',
    'q1130-1000': 'ძველი „დეკემბერი — შუქურების თვე“ (1 დეკ.) რჩება', 'q1201-1000': 'ძველი „დეკემბერი — შუქურების თვე“ იმავე დღეს',
    'q1209-1000': 'ძველი „22 დღე დარჩა“ რჩება', 'q1223-1000': 'ძველი „8 დღე დარჩა“ რჩება',
    'q1230-1000': 'ძველი „ხვალ, 12:00“ რჩება', 'q1230-2100': 'ძველი სთორი „ხვალ, 12:00“ რჩება',
    'q1231-0900': 'ძველი სთორი „დღეს, 12:00“ რჩება', 'q1231-1130': 'ძველი სთორი „30 წუთში“ რჩება',
    'q1005-0730': 'ძველი დილის სთორი „საჩუქრები უკვე ქალაქშია“ (08:30) რჩება',
    'q1005-1745': 'გაშვების დღე უკვე 4 პოსტია',
    'q1023-1000': 'ძველი პოსტი და სთორი აფთიაქის ფასებზე (20 ოქტ.) რჩება',
}
SKIP_NEW = {k: v for k, v in SKIP_NEW.items() if v}

# New posts placed at a fixed slot despite a full day (launch, how-to without the camera, Saturday rain, New Year).
FORCE = {'q1005-1000': ('2026-10-05', '12:00'), 'q1006-1000': ('2026-10-06', '13:00'),
         'q1024-1100': ('2026-10-24', '12:00'), 'q1231-2000': ('2026-12-31', '20:00')}
# New feed posts that did not fit their day: moved to the nearest day with room (id → (from, to) date window).
RESLOT = {'q1015-1000': ('2026-10-12', '2026-10-14'), 'q1013-1000': ('2026-10-09', '2026-10-31'),
          'q1007-1000': ('2026-10-09', '2026-10-31'), 'q1020-1000': ('2026-10-20', '2026-10-31'),
          'q1022-1000': ('2026-10-22', '2026-10-31'), 'q1008-1000': ('2026-10-09', '2026-10-31'),
          'q1028-1000': ('2026-10-28', '2026-11-30'), 'q1011-1100': ('2026-10-11', '2026-11-30'),
          'q1018-1100': ('2026-10-18', '2026-11-30'), 'q1021-1000': ('2026-10-21', '2026-11-30'),
          'q1025-1100': ('2026-11-30', '2026-11-30'), 'q1027-1000': ('2026-10-27', '2026-11-30')}

# LinkedIn: old ones stay; new ones only where no old LinkedIn post covers the topic.
LI_MOVE = {'q1013-0930': '2026-10-29'}            # MEDIRUN economy → a Thursday without an old LinkedIn post
LI_SKIP = {'q1027-0930': 'ძველი LinkedIn (8 ოქტ.) იმავე თემაზეა', 'q1124-0930': 'ძველი LinkedIn პარტნიორებზე (14 ოქტ.) რჩება'}

# Priority when a day is full: lower = keep first.
def priority(p):
    s = p['slides'][0] if p['slides'] else {}
    if p['date'] in ('2026-10-05', '2026-12-28', '2026-12-29', '2026-12-31'):
        return 0
    if p['m'] == 'run' and p['kind'] != 'STORY':
        return 1                       # MEDIRUN feed (Saturday rain, Monday weeks, levels, ladder …)
    if p['time'] in ('07:45',):
        return 2                       # Monday wave story
    if p['m'] == 'run':
        return 3                       # other MEDIRUN stories
    return 4                           # module feed posts


def main(old_path):
    plan = json.loads((HERE / 'plan.json').read_text(encoding='utf-8'))
    old = json.loads(pathlib.Path(old_path).read_text(encoding='utf-8'))
    day = defaultdict(list)
    out_old = []
    for i, p in enumerate(old):
        d = p['dt'][:10]
        if p['draft']:
            verdict, why = 'draft', 'უკვე დრაფტია'
        elif i in REPLACE:
            verdict, why = 'replace', REPLACE[i]
        else:
            verdict, why = 'keep', FIX_TEXT.get(i) and 'რჩება, ტექსტში ერთი ფაქტი სწორდება' or 'რჩება'
            if p['kind'] != 'LI':
                day[d].append(('old', i))
        out_old.append(dict(idx=i, id=p['id'], uuid=p['uuid'], dt=p['dt'], kind=p['kind'], verdict=verdict, why=why,
                            fix=FIX_TEXT.get(i)))
    old_riddle_days = {p['dt'][:10] for i, p in enumerate(old) if p['kind'] == 'STORY' and p['dt'][11:16] in ('15:00', '15:30') and out_old[i]['verdict'] == 'keep'}
    old_friday_story = {p['dt'][:10] for i, p in enumerate(old) if p['kind'] == 'STORY' and p['dt'][11:16] == '21:00' and out_old[i]['verdict'] == 'keep'}
    out_new = []
    cands = []
    for p in plan:
        if p['date'] == 'reserve':
            continue
        v = dict(id=p['id'], date=p['date'], time=p['time'], kind=p['kind'], m=p['m'], verdict='add', why='')
        if p['kind'] == 'LINKEDIN':
            if p['id'] in LI_SKIP:
                v.update(verdict='skip', why=LI_SKIP[p['id']])
            elif p['id'] in LI_MOVE:
                v.update(date=LI_MOVE[p['id']], why=f"გადატანილია {LI_MOVE[p['id']]}-ზე")
            out_new.append(v)
            continue
        if p['id'] in SKIP_NEW:
            v.update(verdict='skip', why=SKIP_NEW[p['id']])
        elif p['kind'] == 'STORY' and p['time'] in ('15:00', '15:30') and p['date'] in old_riddle_days:
            v.update(verdict='skip', why='ძველი გამოცანა იმავე დროს რჩება')
        elif p['kind'] == 'STORY' and p['time'] == '19:30' and p['date'] in old_friday_story and p['slides'][0].get('t') == 'sgift':
            v.update(verdict='skip', why='ძველი „ხვალ, 16:00“ (21:00) რჩება')
        out_new.append(v)
        if v['verdict'] == 'add':
            cands.append((priority(p), p['time'], v))
    # capacity: at most 3 items per day (old kept first, then new by priority)
    feeds = defaultdict(int)
    for d, items in day.items():
        feeds[d] = sum(1 for k, i in items if k == 'old' and old[i]['kind'].startswith('POST'))
    times = defaultdict(set)
    for d, items in day.items():
        for k, i in items:
            times[d].add(old[i]['dt'][11:16])
    for pr, _, v in sorted(cands, key=lambda x: (x[0], x[1])):
        if v['id'] in FORCE:
            v['date'], v['time'] = FORCE[v['id']]
            v['why'] = 'დაემატა (მნიშვნელოვანი MEDIRUN პოსტი)' if v['id'] != 'q1231-2000' else 'დაემატა (საახალწლო მილოცვა)'
            day[v['date']].append(('new', v['id'])); times[v['date']].add(v['time'])
            feeds[v['date']] += v['kind'] != 'STORY'
            continue
        d = v['date']
        same_time = any(old[i]['dt'][11:16] == v['time'] for _, i in day[d] if _ == 'old')
        if len(day[d]) >= 3:
            v.update(verdict='skip', why='დღე სავსეა ძველი კარგი პოსტებით')
        elif same_time:
            v.update(verdict='skip', why='ამ დროს ძველი პოსტი რჩება')
        else:
            day[d].append(('new', v['id'])); times[d].add(v['time']); feeds[d] += v['kind'] != 'STORY'
    # move the module / MEDIRUN feed posts that did not fit to the nearest day with room
    from datetime import date as _d, timedelta as _td
    by_id = {v['id']: v for v in out_new}
    for rid in RESLOT:
        v = by_id[rid]
        if v['verdict'] != 'skip':
            continue
        lo, hi = (_d.fromisoformat(x) for x in RESLOT[v['id']])
        cur = lo
        while cur <= hi:
            d = cur.isoformat()
            if len(day[d]) < 3 and feeds[d] < 2:
                weekend = cur.weekday() >= 5
                for t in (('11:00', '13:00', '15:00') if weekend else ('10:00', '13:00', '15:00')):
                    if t not in times[d]:
                        v.update(verdict='add', date=d, time=t, why=f"გადატანილია {d} {t}-ზე (თავის დღეს ძველი კარგი პოსტები დარჩა)")
                        day[d].append(('new', v['id'])); times[d].add(t); feeds[d] += 1
                        break
                if v['verdict'] == 'add':
                    break
            cur += _td(days=1)
    (HERE / 'merged.json').write_text(json.dumps(dict(old=out_old, new=out_new), ensure_ascii=False, indent=1), encoding='utf-8')
    from collections import Counter
    print('old:', Counter(o['verdict'] for o in out_old))
    print('new:', Counter(n['verdict'] for n in out_new))
    print('per day:', Counter(len(v) for v in day.values()))
    days = sorted(day)
    empty = [d for d in (sorted({p['date'] for p in plan if p['date'] != 'reserve'})) if len(day.get(d, [])) < 2]
    print('days with < 2:', empty)
    return day


if __name__ == '__main__':
    main(sys.argv[1])
