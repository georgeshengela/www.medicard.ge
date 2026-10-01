"""MEDIRUN „გაანათე თბილისი“ — the whole social calendar, 2 Oct – 31 Dec 2026 (FB + IG + LinkedIn via Metricool).

  python social.py   -> social.json (Metricool payloads + admin #/social records), prints a summary

Slots never collide with the launch campaign (feed 10:00/11:00, story 19:30, LinkedIn 09:30 on its own days) or the
MEDIRUN passport series (15:00). Owner rules: every caption carries the App Store link and medicard.ge (cap()),
every image shows "App Store · medicard.ge"; product name MEDIRUN; reader addressed as შენ; no invented numbers.
Live moments (Saturday winners, 31 Dec winner) are recorded as PLANNED in admin and posted by hand.
"""
import json, pathlib, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'campaign'))
from plan import cap, with_links_en, FIRST_COMMENT  # noqa: E402  (same links block and first comment as the launch campaign)

HERE = pathlib.Path(__file__).resolve().parent
BASE = 'https://medicard.ge/press/medirun-glow/'
CAMPAIGN = 'medirun-glow-2026'
T = '#გაანათეთბილისი #MEDIRUN #MEDICARD #თბილისი #საქართველო'
img = lambda *names: [BASE + f'{n}.jpg' for n in names]

SATURDAYS = [  # (date, Friday before, nominative day, lantern boxes)
    ('2026-10-10', '2026-10-09', '10 ოქტომბერი', False), ('2026-10-17', '2026-10-16', '17 ოქტომბერი', False),
    ('2026-10-24', '2026-10-23', '24 ოქტომბერი', False), ('2026-10-31', '2026-10-30', '31 ოქტომბერი', False),
    ('2026-11-07', '2026-11-06', '7 ნოემბერი', True), ('2026-11-14', '2026-11-13', '14 ნოემბერი', True),
    ('2026-11-21', '2026-11-20', '21 ნოემბერი', True), ('2026-11-28', '2026-11-27', '28 ნოემბერი', True),
    ('2026-12-05', '2026-12-04', '5 დეკემბერი', True), ('2026-12-12', '2026-12-11', '12 დეკემბერი', True),
    ('2026-12-19', '2026-12-18', '19 დეკემბერი', True), ('2026-12-26', '2026-12-25', '26 დეკემბერი', True),
]
MONDAYS = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23',
           '2026-11-30', '2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28']
LEVEL_STORY_DAYS = ['2026-10-14', '2026-10-28', '2026-11-04', '2026-11-18', '2026-12-02', '2026-12-16']

HOW = cap('ახალი ხარ? აი, როგორ იპოვი თბილისში დამალულ საჩუქარს 👇',
          '',
          '1️⃣ გახსენი MEDICARD და ჩართე MEDIRUN — იარე ან ირბინე.',
          '2️⃣ საჩუქართან მიახლოებისას ტელეფონი გულისცემასავით აკანკალდება. რაც უფრო ახლოს ხარ, მით უფრო ჩქარა.',
          '3️⃣ ადგილზე ჩართე კამერა, იპოვე ყუთი და შეეხე — Medi Coins ავტომატურად ჩაირიცხება.',
          '',
          'მონაწილეობა უფასოა.', tags=T)
RHYTHM = ('📅 ორშაბათი–პარასკევი: მცირე ყუთები, 08:30-სა და 18:00-ზე',
          '🎁 შაბათი–კვირა: უფრო დიდი ყუთები, 10:30-სა და 17:30-ზე',
          '🌧 შაბათს, 16:00-ზე: საჩუქრების წვიმა ერთ პარკში',
          '🔴 31 დეკემბერს: წითელი iPhone 18 Pro Max შუქურებისთვის')
LEVELS = ('✨ 0,1% — ნაპერწკალი',
          '🏮 0,25% — ფარანი: ნოემბრიდან შაბათის ფარნის ყუთებს დაინახავ',
          '🔥 0,5% — ჩირაღდანი',
          '⭐ 1% — შუქურა: 31 დეკემბერს წითელ iPhone 18 Pro Max-ს დაინახავ')


def levels_text(lead):
    return cap(lead, '',
               'MEDIRUN-ში ყოველი ახალი ქუჩა შენს რუკაზე ინთება. რაც მეტ ახალ ქუჩას გაივლი, მით უფრო მაღალი იქნება შენი დონე:',
               '', *LEVELS, '',
               '1% დაახლოებით 50 კილომეტრი ახალი ქუჩაა. ერთსა და იმავე გზას მეორედ არ ვითვლით.',
               '', 'შენი პროცენტი MEDIRUN-ში ჩანს. 👣', tags=T)


def week_text(emoji, title, dates_line, places, saturday):
    return cap(f'{emoji} {title}', '', f'{dates_line} მეტი ყუთი {places}.', '',
               'ყუთები საჯარო ბილიკებზეა, ოღონდ პარკების სიღრმეში — ცოტა ძებნა მოგიწევს. 😉', '',
               f'⭐ {saturday}, 16:00-ზე — საჩუქრების წვიმა. რომელ პარკში — იმ დღეს, 15:00-ზე გეტყვით.', tags=T)


def iphone_text(head):
    return cap(head, '',
               'წითელ iPhone 18 Pro Max-ს მხოლოდ ის დაინახავს, ვინც MEDIRUN-ში თბილისის 1%-ს გაანათებს. ეს დაახლოებით 50 კილომეტრი ახალი ქუჩაა.',
               '', 'ვინც ყუთს პირველი გახსნის, iPhone-ს ის წაიღებს.', '', 'შენ რამდენ პროცენტზე ხარ? შენი პროცენტი MEDIRUN-ში ჩანს. 👣', tags=T)


POSTS = []
def feed(slot, date, time, media, text, kind=None):
    POSTS.append(dict(slot=slot, date=date, time=time, kind=kind or ('CAROUSEL' if len(media) > 1 else 'POST'), net='fbig', media=media, text=text))
def story(slot, date, time, name):
    POSTS.append(dict(slot=slot, date=date, time=time, kind='STORY', net='fbig', media=img(name), text=''))
def linkedin(slot, date, media, text):
    POSTS.append(dict(slot=slot, date=date, time='09:30', kind='POST', net='li', media=media, text=text))
def manual(slot, date, time, title, notes):
    POSTS.append(dict(slot=slot, date=date, time=time, kind='STORY', net='fbig', media=[], text=title, manual=True, notes=notes))

# ── teaser + launch ───────────────────────────────────────────────────────────────────────────
feed('g-teaser', '2026-10-02', '17:00', img('f00-teaser'),
     cap('რაღაც აინთება. ✨', '', 'ხვალ, 3 ოქტომბერს, თბილისში ახალი თამაში იწყება.', '',
         'ჩამოტვირთე MEDICARD დღესვე, რომ ხვალ პირველებს შორის იყო. 👇', tags=T))
story('g-teaser-s1', '2026-10-02', '18:30', 's01-teaser')
story('g-teaser-s2', '2026-10-02', '21:30', 's02-teaser')
story('g-launch-s', '2026-10-03', '08:30', 's03-launch')
feed('g-launch', '2026-10-03', '12:00', img('f01-key', 'f02-how', 'f03-week', 'f04-levels', 'f13-safety'),
     cap('დაიწყო. 🌃', '',
         'თბილისში საჩუქრები დაიმალა. ჩართე MEDIRUN, გაისეირნე და იგრძენი, როგორ აჩქარდება ტელეფონის გული, როცა ყუთს მიუახლოვდები.',
         '', *RHYTHM, '',
         'ყუთებში Medi Coins-ია: ავტომატურად ჩაირიცხება და ჯილდოებზე გადაცვლი.', '',
         'გადაფურცლე და ნახე, როგორ ითამაშო 👉', tags=T))
story('g-launch-how', '2026-10-03', '18:00', 's10-how')
feed('g-iphone', '2026-10-04', '13:00', img('f05-iphone'),
     cap('31 დეკემბერი, 12:00. 🔴', '',
         'ახალი წლის წინა დღეს თბილისში ერთი ყუთი დაიმალება — მასში წითელი iPhone 18 Pro Max იქნება.', '',
         'ამ ყუთს ყველა ვერ დაინახავს. ის მხოლოდ მათ გამოუჩნდებათ, ვინც MEDIRUN-ში თბილისის 1%-ს გაანათებს — ეს დაახლოებით 50 კილომეტრი ახალი ქუჩაა.', '',
         'დრო 31 დეკემბრამდე გაქვს. ვინც ყუთს პირველი გახსნის, iPhone-ს ის წაიღებს.', '', 'დღესვე დაიწყე 👟', tags=T))

# ── October weeks ─────────────────────────────────────────────────────────────────────────────
feed('g-week1', '2026-10-06', '13:00', img('f06-week1'), week_text('🏛', 'კვირა 1 — ძველი ქალაქის ამბები', '3–11 ოქტომბერს', 'ძველ თბილისშია: მოედნებთან, ხიდებთან და აბანოებთან', 'შაბათს, 10 ოქტომბერს'))
feed('g-partners', '2026-10-07', '13:00', img('f12-partner'),
     cap('გაქვს კაფე, სპორტდარბაზი, მაღაზია ან აფთიაქი თბილისში? ☕️', '',
         'MEDIRUN-ის მოთამაშეები ქალაქში დამალულ საჩუქრებს ეძებენ. გახდი საჩუქრის წერტილი: შენს კართან ვირტუალურ ყუთს დავდებთ და მოთამაშეები პირდაპირ შენთან მოვლენ.', '',
         'შენგან — რამდენიმე ათეული მცირე საჩუქარი. ჩვენგან — სტუმრები, მოხსენიებები და ზუსტი რიცხვი, რამდენმა გახსნა შენი ყუთი. ფულს არ ვითხოვთ.', '',
         'მოგვწერე: support@medicard.ge', tags=T))
feed('g-week2', '2026-10-12', '13:00', img('f07-week2'), week_text('🌳', 'კვირა 2 — მწვანე თბილისი', '12–18 ოქტომბერს', 'ბაღებსა და პარკებშია: ვაკიდან დიღმის ტყე-პარკამდე', 'შაბათს, 17 ოქტომბერს'))
feed('g-levels-1', '2026-10-14', '13:00', img('f04-levels'), levels_text('რამდენი პროცენტით ანათებს შენი თბილისი? 💡'))
feed('g-week3', '2026-10-19', '13:00', img('f08-week3'), week_text('🌊', 'კვირა 3 — წყალი და ჰორიზონტი', '19–25 ოქტომბერს', 'ტბებთან და ქალაქის გადასახედებთანაა: კუს ტბა, ლისი, მთაწმინდა, საქართველოს მატიანე', 'შაბათს, 24 ოქტომბერს'))
feed('g-safety', '2026-10-21', '13:00', img('f13-safety'),
     cap('ქალაქში ფრთხილად ითამაშე. 🙏', '',
         '• ყუთები მხოლოდ საჯარო ბილიკებზეა — არასოდეს გზაზე, ეზოში ან დახურულ ტერიტორიაზე.',
         '• ქუჩის გადაკვეთისას ეკრანს ნუ უყურებ — პულსს ხელში იგრძნობ.',
         '• საღამოს ყუთები მხოლოდ განათებულ ადგილებშია.',
         '• სხვებს ნუ უბიძგებ: შაბათის წვიმაში ყუთები ბევრს ეყოფა.',
         '• დიდ საჩუქარს აპში ნაჩვენები კოდითა და პირადობის მოწმობით გადმოგცემთ.', tags=T))
feed('g-week4', '2026-10-26', '13:00', img('f09-week4'), week_text('🎭', 'კვირა 4 — ქალაქის ხელწერა', '26 ოქტომბრიდან 1 ნოემბრამდე', 'სამებასთან, ბოტანიკურ ბაღთან და რუსთაველზეა', 'შაბათს, 31 ოქტომბერს'))
feed('g-how-1', '2026-10-28', '13:00', img('f02-how'), HOW)

# ── November ──────────────────────────────────────────────────────────────────────────────────
feed('g-november', '2026-11-02', '13:00', img('f10-november'),
     cap('🗺 ნოემბერი — უბნების თვე', '', 'ყოველ კვირას მეტი ყუთი სხვა უბნებში:', '',
         '2–8 · გლდანი, ნაძალადევი', '9–15 · დიდუბე, ჩუღურეთი, საბურთალო', '16–22 · ისანი, სამგორი', '23–29 · ვაკე, მთაწმინდა, კრწანისი', '',
         '🏮 და კიდევ ერთი სიახლე: შაბათობით ფარნის ყუთები — თითოში 300 Medi Coins. მათ მხოლოდ ის დაინახავს, ვისაც თბილისის 0,25% აქვს განათებული.', '',
         'შენი უბანი რომელია? 👇', tags=T))
feed('g-iphone-52', '2026-11-09', '13:00', img('f05-iphone-52'), iphone_text('🔴 31 დეკემბრამდე 52 დღე დარჩა.'))
feed('g-rhythm', '2026-11-11', '13:00', img('f03-week'), cap('კვირის რიტმი ⏰', '', *RHYTHM, '', 'ყუთები პარკების სიღრმეშია — ცოტა ძებნა მოგიწევს.', tags=T))
feed('g-levels-2', '2026-11-18', '13:00', img('f04-levels'), levels_text('შენი თბილისი რომელ დონეზეა? 🏮'))
feed('g-how-2', '2026-11-25', '13:00', img('f02-how'), HOW)

# ── December ──────────────────────────────────────────────────────────────────────────────────
feed('g-december', '2026-12-01', '13:00', img('f11-december'),
     cap('🔴 დეკემბერი — შუქურების თვე', '',
         '31 დეკემბერს, 12:00-ზე თბილისში წითელი iPhone 18 Pro Max დაიმალება. მას მხოლოდ შუქურები დაინახავენ — ისინი, ვისაც თბილისის 1% აქვს განათებული.', '',
         '30 დღე დარჩა. შენი პროცენტი MEDIRUN-ში ჩანს. ✨', tags=T))
feed('g-iphone-22', '2026-12-09', '13:00', img('f05-iphone-22'), iphone_text('🔴 31 დეკემბრამდე 22 დღე დარჩა.'))
feed('g-levels-3', '2026-12-16', '13:00', img('f04-levels'), levels_text('15 დღე დარჩა. შენი თბილისი რამდენი პროცენტით ანათებს? ⭐'))
feed('g-iphone-8', '2026-12-23', '13:00', img('f05-iphone-8'), iphone_text('🔴 31 დეკემბრამდე 8 დღე დარჩა.'))
feed('g-iphone-1', '2026-12-30', '13:00', img('f05-iphone-1'),
     cap('🔴 ხვალ, 12:00-ზე.', '',
         'ხვალ თბილისში წითელი iPhone 18 Pro Max დაიმალება. ჩართე MEDIRUN 12:00-ზე — თუ თბილისის 1% გაქვს განათებული, ყუთის პულსს იგრძნობ.', '',
         'ვინც ყუთს პირველი გახსნის, iPhone-ს ის წაიღებს. წარმატება, შუქურებო! ✨', tags=T))
story('g-iphone-s1', '2026-12-30', '21:00', 's09-iphone-tomorrow')
story('g-iphone-s2', '2026-12-31', '09:00', 's09-iphone-today')
story('g-iphone-s3', '2026-12-31', '11:30', 's09-iphone-soon')
manual('g-iphone-winner', '2026-12-31', '15:00', 'დიდი საჩუქრის გამარჯვებული (ცოცხლად)', 'ხელით: გამარჯვებულის სახელი და ფოტო მხოლოდ წერილობითი თანხმობით. iPhone გადაეცემა აპში ნაჩვენები კოდითა და პირადობის მოწმობით.')

# ── weekly rhythm: Monday story, Friday announcement, Saturday riddles ───────────────────────
for d in MONDAYS:
    story(f'g-weekday-{d[5:]}', d, '08:15', 's04-weekday')
for d in LEVEL_STORY_DAYS:
    story(f'g-levels-s-{d[5:]}', d, '20:30', 's08-levels')
for i, (sat, fri, day, lantern) in enumerate(SATURDAYS, 1):
    n = f'{i:02d}'
    feed(f'g-sat-{n}', fri, '13:00', img(f'f14-saturday-{n}'),
         cap(f'🌧 შაბათის წვიმა — {day}, 16:00', '',
             'ხვალ ერთ თბილისურ პარკში საჩუქრების წვიმა მოვა: ყუთებში 50 და 100 Medi Coins იქნება.', '',
             'რომელ პარკში? 15:00-ზე სთორიში გამოცანას გამოვაქვეყნებთ, 15:30-ზე — მეორე მინიშნებას.',
             *(('', '🏮 შაბათობით ფარნის ყუთებიც ჩნდება — თითოში 300 Medi Coins. მათ მხოლოდ ის დაინახავს, ვისაც თბილისის 0,25% აქვს განათებული.') if lantern else ()),
             '', 'ჩართე შეტყობინებები, რომ მინიშნება არ გამოგრჩეს. 🔔', tags=T))
    story(f'g-sat-{n}-tomorrow', fri, '21:00', f's07-tomorrow-{n}')
    story(f'g-sat-{n}-weekend', sat, '09:30', 's05-weekend')
    story(f'g-sat-{n}-hint1', sat, '15:00', f's06-hint-{n}-1')
    story(f'g-sat-{n}-hint2', sat, '15:30', f's06-hint-{n}-2')
    manual(f'g-sat-{n}-winners', sat, '18:30', f'შაბათის წვიმის მპოვნელები — {day} (ცოცხლად)', 'ხელით: მხოლოდ რეალური რიცხვები ადმინიდან (MEDIRUN → ჯილდოები); სახელი/ფოტო მხოლოდ თანხმობით.')

# ── LinkedIn (English, links in the post) ─────────────────────────────────────────────────────
linkedin('g-li-launch', '2026-10-07', img('f01-key'), with_links_en(
    'We turned Tbilisi into a game.\n\n'
    'MEDIRUN is the walking game inside MEDICARD. Streets light up on your map as you walk, and when you get close to a hidden gift, your phone starts beating like a heart.\n\n'
    'From 3 October to 31 December the city is the playing field:\n'
    '• Monday to Friday, a few small boxes hidden deep inside parks\n'
    '• Weekends, bigger ones\n'
    '• Saturdays at 16:00, a gift rain in one park, revealed an hour earlier with a riddle\n'
    '• 31 December, one red iPhone 18 Pro Max, visible only to players who have lit 1% of Tbilisi (about 50 km of new streets)\n\n'
    "The world doesn't need another tracker. It needs a reason to go outside.\n\n"
    '#MEDIRUN #MEDICARD #Tbilisi #Georgia #HealthTech'))
linkedin('g-li-partners', '2026-10-14', img('f12-partner'), with_links_en(
    'Tbilisi businesses: want walkers at your door?\n\n'
    'During “Light up Tbilisi” (3 October – 31 December), MEDIRUN players walk the city looking for hidden gift boxes. '
    'A café, gym, shop or pharmacy can become a gift point: we place a virtual box at your door and players come to you.\n\n'
    'You give a few dozen small gifts (a coffee, a discount, a day pass). We bring visitors, mention you in our posts and tell you exactly how many people opened your box. No fees.\n\n'
    'Write to support@medicard.ge\n\n'
    '#MEDIRUN #Tbilisi #LocalBusiness #Georgia'))
linkedin('g-li-december', '2026-12-02', img('f11-december'), with_links_en(
    'The 1% challenge: 29 days left.\n\n'
    'On 31 December at 12:00 one red iPhone 18 Pro Max will be hidden somewhere in Tbilisi. Only MEDIRUN players who have lit 1% of the city can see it: about 50 km of streets they had never walked before.\n\n'
    'A prize that only shows up for people who have walked their own city. That is the whole idea of MEDIRUN.\n\n'
    '#MEDIRUN #MEDICARD #Tbilisi #Gamification'))

# ── build payloads ────────────────────────────────────────────────────────────────────────────
out = []
for p in sorted(POSTS, key=lambda x: (x['date'], x['time'])):
    when = f"{p['date']}T{p['time']}:00"
    networks = ['linkedin'] if p['net'] == 'li' else ['facebook', 'instagram']
    title = (p['text'].split('\n')[0] if p['text'] else '')[:140]
    if p['kind'] == 'STORY' and not p.get('manual'):
        title = 'სთორი · ' + p['media'][0].rsplit('/', 1)[-1][:-4]
    record = {'campaign': CAMPAIGN, 'slot': p['slot'], 'networks': networks, 'kind': p['kind'], 'pillar': 'MEDIRUN',
              'title': title or p['slot'], 'text': p['text'], 'textEn': None, 'mediaUrls': p['media'],
              'scheduledAt': f'{when}+04:00', 'status': 'PLANNED' if p.get('manual') else 'SCHEDULED',
              'notes': p.get('notes') or 'MEDIRUN · გაანათე თბილისი · Metricool: ავტომატური გამოქვეყნება · სურათები AI-ით შექმნილი (Instagram-ზე მონიშნული)'}
    info = None
    if not p.get('manual'):
        info = {'autoPublish': True, 'draft': False, 'descendants': [], 'hasNotReadNotes': False, 'shortener': False,
                'smartLinkData': {'ids': []}, 'media': p['media'], 'mediaAltText': [],
                'publicationDate': {'dateTime': when, 'timezone': 'Asia/Tbilisi'}, 'providers': [{'network': n} for n in networks]}
        if p['net'] == 'li':
            info.update(text=p['text'], linkedinData={'type': 'post', 'previewIncluded': True, 'publishImagesAsPDF': False})
        elif p['kind'] == 'STORY':
            info.update(facebookData={'type': 'STORY'}, instagramData={'type': 'STORY', 'isAiGenerated': True})
        else:
            info.update(text=p['text'], firstCommentText=FIRST_COMMENT, facebookData={'type': 'POST'},
                        instagramData={'type': 'POST', 'isAiGenerated': True})
    out.append({'slot': p['slot'], 'date': f'{when}+04:00', 'info': info, 'record': record})

(HERE / 'social.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
by = {}
for o in out:
    k = 'manual' if o['info'] is None else o['record']['kind'] + ('/li' if o['record']['networks'] == ['linkedin'] else '')
    by[k] = by.get(k, 0) + 1
missing = sorted({u.rsplit('/', 1)[-1] for o in out for u in o['record']['mediaUrls'] if not (HERE / 'out' / ('story' if '/s' in u.rsplit('/', 1)[-1][:2] or u.rsplit('/', 1)[-1].startswith('s') else 'feed') / u.rsplit('/', 1)[-1]).exists()})
print(len(out), 'items', by, 'missing media:', missing or 'none')
