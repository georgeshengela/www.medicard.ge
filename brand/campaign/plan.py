"""MEDICARD launch campaign, 1–28 October 2026 — the single source of truth.

python plan.py  -> plan.json (read by poster.html / render.py / schedule step)

Rules: no invented numbers, reviews or testimonials; medical tips stay general and hedged;
Georgian addresses the reader as შენ; product names MEDICARD, Medi, Medi Vet, Medi Quest,
Medi Coins, MEDIRUN, MEDI COACH. Links go in the first comment (reach), captions say „ლინკი ბიოში“.
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
APP = 'https://apps.apple.com/app/id6812517519'
TAGS = '#MEDICARD #Medi #ჯანმრთელობა #საქართველო'
FIRST_COMMENT = f'📲 iPhone: {APP}\n💻 ვებ-ვერსია: https://medicard.ge/app\n🤖 Android — სულ მალე'
FEED_TIME = '10:00'
WEEKEND_FEED_TIME = '11:00'
STORY_TIME = '19:30'
LI_TIME = '09:30'


def cap(*lines, tags=TAGS):
    return '\n'.join(lines + ('', '📲 ლინკი ბიოში · უფასოდ App Store-ში', '', tags))


DAYS = [
    # ── Week 1 · launch & awareness ─────────────────────────────────────────────
    dict(pillar='launch',
         feed=dict(template='existing', image='launch-feed.jpg', ai=True, caption=cap(
             '✨ MEDICARD AI უკვე App Store-შია! ✨',
             '',
             'წლების განმავლობაში ჯანმრთელობა გაფანტული გვქონდა: ანალიზის ფურცელი უჯრაში, წამლის შეხსენება ერთ აპში, კვება მეორეში, ციკლი მესამეში… და თითქმის ყველა ინგლისურად.',
             '',
             'დღეს ეს მთავრდება 🇬🇪',
             '',
             '🤖 Medi — ჰკითხე ტექსტით ან ხმით',
             '💊 წამლის შეხსენებები',
             '🔬 ანალიზები გასაგებ ენაზე',
             '🥗 კვება ფოტოთი და ბარკოდით',
             '🌸 ციკლის დღიური',
             '🏃 MEDIRUN — გადი გარეთ და აღმოაჩინე შენი ქალაქი',
             '',
             '🔒 შენს ჯანმრთელობის მონაცემებს არასდროს ვყიდით.',
             '🆓 ყველა ფუნქცია უფასოა.',
             '',
             'Medi არ ცვლის ექიმს — საჭიროებისას მიმართე სპეციალისტს.')),
         story=dict(template='existing', image='launch-story.jpg', ai=True),
         linkedin=dict(image='launch-wide.jpg', ai=True, text='\n'.join([
             "Today we're launching MEDICARD AI on the App Store.",
             '',
             "Health apps are built for big languages. Georgia has 3.7 million people and, until today, no health app that speaks its language.",
             '',
             'MEDICARD brings everyday care into one place, in Georgian and English:',
             '• Medi, an AI assistant you can talk or type to',
             '• Medication reminders and plain-language lab explanations',
             '• Nutrition logging from a photo, barcode or voice',
             '• Cycle tracking, pet care (Medi Vet) and training with a coach (MEDI COACH)',
             '• MEDIRUN, a game that gets you outside to explore your city on foot',
             '',
             "Free, and private by design: we never sell health data.",
             '',
             'Link in the first comment.',
             '',
             '#HealthTech #AI #DigitalHealth #Georgia #Startup']))),

    dict(pillar='feature',
         feed=dict(template='screen', screen='v3/medi.webp', kicker='Medi', headline='ჰკითხე. ხმითაც.',
                   sub='Medi იცნობს შენს პროფილს, წამლებს და ბოლო ორი კვირის მაჩვენებლებს — თუ შენ ნებას დართავ.',
                   bullets=['ჩაწერს წამალს ან ვიზიტს', 'აგიხსნის ანალიზს', 'დაგეგმავს კვებას'],
                   caption=cap(
                       'გაიცანი Medi 💚',
                       '',
                       'Medi შენი ჯიბის სამედიცინო ასისტენტია. მას შეგიძლია ჰკითხო ტექსტით ან უბრალოდ ხმით:',
                       '',
                       '🗣 „ხვალ 9-ზე ომეგა-3 ჩამიწერე“',
                       '🗣 „ჩემი ჰემოგლობინი ნორმაშია?“',
                       '🗣 „რა ვჭამო ვახშმად, რომ კალორიებში დავრჩე?“',
                       '',
                       'Medi ხედავს მხოლოდ იმას, რასაც შენ დართავ ნებას, და არასდროს ცვლის ექიმს.',
                       '',
                       'რას ჰკითხავდი პირველად? დაგვიწერე კომენტარში 👇')),
         story=dict(template='story-screen', screen='v3/medi.webp', headline='რას ჰკითხავდი Medi-ს?',
                    sub='მოგვწერე — საუკეთესო კითხვებს პასუხს აქ გავცემთ 💬')),

    dict(pillar='feature',
         feed=dict(template='existing', image='launch-square.jpg', ai=True, caption=cap(
             'ერთი აპი ხუთის ნაცვლად 📱',
             '',
             'წამლები, ანალიზები, კვება, ციკლი, ნაბიჯები და წყალი — ყველაფერი ერთ ადგილას, ქართულად.',
             '',
             'შენახე ეს პოსტი და გაუზიარე მას, ვისაც ხუთი სხვადასხვა აპი უდევს ტელეფონში 😉')),
         story=dict(template='story-photo', photo='../launch/photos/story.png', ai=True, kicker='MEDIRUN',
                    headline='გადი გარეთ.', sub='ქალაქი ყოველ ნაბიჯზე ახალ საჩუქარს მალავს 🎁')),

    dict(pillar='tip',
         feed=dict(template='tip', icon='💧', kicker='რჩევა', headline='წყალი: რამდენი გჭირდება?',
                   bullets=['საჭიროება ინდივიდუალურია — წონაზე, სიცხეზე და აქტივობაზე დამოკიდებული',
                            'წყურვილი და ღია ფერის შარდი კარგი ორიენტირია',
                            'ვარჯიშისა და სიცხის დროს დალიე მეტი'],
                   footnote='ზოგადი ინფორმაციაა და არ ცვლის ექიმის რჩევას.',
                   caption=cap(
                       'რამდენი წყალი უნდა დავლიოთ დღეში? 💧',
                       '',
                       '„8 ჭიქა“ მხოლოდ მითია: საჭიროება ყველასთვის განსხვავებულია და დამოკიდებულია წონაზე, ამინდსა და აქტივობაზე.',
                       '',
                       'MEDICARD-ში წყლის მიზანს შენზე მორგებულად დაისახავ და ერთი შეხებით ჩაწერ ყოველ ჭიქას.',
                       '',
                       'ზოგადი ინფორმაციაა და არ ცვლის ექიმის რჩევას.')),
         story=dict(template='story-screen', screen='v2/hydration.webp', headline='დღეს რამდენი ჭიქა დალიე? 💧',
                    sub='ჩაწერე ერთი შეხებით — MEDICARD დაგითვლის')),

    dict(pillar='feature', photo='meds',
         feed=dict(template='photo', photo='meds', ai=True, kicker='მედიკამენტები',
                   headline='არცერთი დოზა აღარ გამოგრჩება', sub='შეხსენება ზუსტ დროს — და ერთი შეხებით „დავლიე“.',
                   caption=cap(
                       'დაგავიწყდა დღეს წამლის დალევა? 💊',
                       '',
                       'MEDICARD-ში წამალს ერთხელ ჩაწერ, შემდეგ კი აპი ზუსტ დროს შეგახსენებს. „დავლიე“ ერთი შეხებით აღინიშნება და ისტორიაც ინახება.',
                       '',
                       '💊 დოზები და განრიგი',
                       '⏰ შეხსენებები',
                       '📈 როგორ იცავ განრიგს',
                       '',
                       'მშობლებისთვისაც იდეალურია 💚')),
         story=dict(template='story-screen', screen='v3/meds.webp', headline='წამალი დროზე 💊',
                    sub='დააყენე შეხსენება 30 წამში')),

    dict(pillar='feature', photo='lab',
         feed=dict(template='photo', photo='lab', ai=True, kicker='ანალიზები', headline='ანალიზი — გასაგებ ენაზე',
                   sub='ატვირთე ფურცელი. MEDICARD აგიხსნის, რას ნიშნავს თითოეული მაჩვენებელი.',
                   caption=cap(
                       'ანალიზის ფურცელი ისევ უჯრაში გიდევს? 🔬',
                       '',
                       'გადაუღე ფოტო ან ატვირთე PDF, MEDICARD კი:',
                       '✅ მაჩვენებლებს ამოიკითხავს',
                       '✅ გასაგებ ენაზე აგიხსნის',
                       '✅ დროში ცვლილებას გრაფიკზე გაჩვენებს',
                       '',
                       'ეს დიაგნოზი არ არის — ექიმთან საუბარს უკეთ მოამზადებს.')),
         story=dict(template='story-screen', screen='v3/lab.webp', headline='რა არის ALT? 🤔',
                    sub='ატვირთე ანალიზი და MEDICARD აგიხსნის'),
         linkedin=dict(template='li-text', headline='Why we built a health app for a small language',
                       text='\n'.join([
                           'Most health apps treat language as a translation task.',
                           '',
                           'For a Georgian speaker, that means a lab report you can\'t read, reminders in English and advice that ignores local food, pharmacies and doctors.',
                           '',
                           'So we started from the other end:',
                           '• Georgian first, English second',
                           '• Lab results explained in plain language',
                           '• Local pharmacy prices and Georgian foods in the nutrition catalog',
                           '• One app instead of five',
                           '',
                           'Small-language markets are not small problems. They are underserved ones.',
                           '',
                           'What would you build first for your language?',
                           '',
                           '#HealthTech #LocalizationMatters #DigitalHealth #Georgia']))),

    dict(pillar='move', photo='walk',
         feed=dict(template='photo', photo='walk', ai=True, kicker='MEDIRUN', headline='მსოფლიოს სხვა ტრეკერი არ სჭირდება',
                   sub='მას სჭირდება მიზეზი, რომ გარეთ გავიდეს.',
                   caption=cap(
                       'ფეხით სიარული ყველაზე მარტივი „წამალია“ 🏃',
                       '',
                       'MEDIRUN-ში შენი ქალაქი თამაშად იქცევა: დადიხარ, აღმოაჩენ ახალ ადგილებს და პოულობ საჩუქრებს.',
                       '',
                       'სცადე დღეს: 20 წუთიანი გასეირნება და პირველი საჩუქარი 🎁',
                       tags=TAGS + ' #MEDIRUN')),
         story=dict(template='story-photo', photo='walk', ai=True, kicker='MEDIRUN', headline='20 წუთი გარეთ',
                    sub='დღევანდელი მისია — იპოვე პირველი საჩუქარი 🎁')),

    # ── Week 2 · education deep dive ───────────────────────────────────────────
    dict(pillar='tip',
         feed=dict(template='tip', icon='🔬', kicker='რჩევა', headline='ანალიზის ფურცელი: 3 რამ, რაც უნდა იცოდე',
                   bullets=['ნორმის ზღვარი ლაბორატორიების მიხედვით განსხვავდება',
                            'ერთი მაჩვენებლის მცირე გადახრა ხშირად არაფერს ნიშნავს',
                            'მთავარია დინამიკა — შეადარე წინა ანალიზებს'],
                   footnote='შედეგი ყოველთვის ექიმთან განიხილე.',
                   caption=cap(
                       'ანალიზის ფურცელზე წითელი ციფრი დაინახე? 😰 ჯერ ნუ ღელავ.',
                       '',
                       '1️⃣ ნორმის ზღვარი ლაბორატორიების მიხედვით განსხვავდება.',
                       '2️⃣ ერთი მაჩვენებლის მცირე გადახრა ხშირად დროებითია.',
                       '3️⃣ ყველაზე მნიშვნელოვანი დინამიკაა — როგორ იცვლება დროში.',
                       '',
                       'MEDICARD ყველა ანალიზს ერთ ისტორიაში ინახავს და გრაფიკზე გაჩვენებს.',
                       '',
                       'შედეგი ყოველთვის ექიმთან განიხილე.')),
         story=dict(template='story-screen', screen='v3/lab-dark.webp', headline='ნორმა ყველგან ერთნაირია?',
                    sub='არა — ზღვარი ლაბორატორიების მიხედვით განსხვავდება'),
         linkedin=dict(template='li-text', headline='AI in health: helpful only if it is honest', text='\n'.join([
             'Our AI assistant, Medi, is designed around three rules:',
             '',
             '1. It only sees what the person allows. Consent comes before any data leaves the phone.',
             '2. It never diagnoses. It explains, organises and helps prepare for a doctor.',
             '3. It never sells data. Health data is not a business model.',
             '',
             'We think trust is the product. Everything else is features.',
             '',
             '#AI #HealthTech #Privacy #ResponsibleAI']))),

    dict(pillar='feature',
         feed=dict(template='screen', screen='v3/nutrition.webp', kicker='კვება', headline='გადაუღე თეფშს — კალორიები წამებში',
                   sub='ფოტო, ბარკოდი, ხმა ან ძებნა — კვების ჩაწერის 8 გზა.',
                   bullets=['ქართული კერძების კატალოგი', 'ცილა, ნახშირწყლები, ცხიმი', 'შენზე მორგებული დღიური ბიუჯეტი'],
                   caption=cap(
                       'კალორიების დათვლა აღარ არის მოსაწყენი 🥗',
                       '',
                       '📸 გადაუღე თეფშს',
                       '🏷 დაასკანერე ბარკოდი',
                       '🗣 უბრალოდ თქვი, რა ჭამე',
                       '',
                       'MEDICARD შეაფასებს კალორიებსა და მაკროებს — შენახვამდე კი ყოველთვის შეგიძლია შეასწორო.',
                       '',
                       'ლობიო თუ ხაჭაპური? 😄 ქართული კერძებიც იცის.')),
         story=dict(template='story-screen', screen='v3/nutrition.webp', headline='ლობიო თუ ხაჭაპური? 😄',
                    sub='MEDICARD ქართულ კერძებსაც იცნობს')),

    dict(pillar='feature',
         feed=dict(template='screen', screen='v3/cycle.webp', kicker='ციკლი', headline='შენი ციკლი — ქართულად',
                   sub='პროგნოზი, ნაყოფიერი დღეები, სიმპტომები და დღიური — ერთ ადგილას.',
                   bullets=['მარტივი ჩაწერა', 'დღის რჩევები', 'შეხსენებები'],
                   caption=cap(
                       'სწორედ ის, რასაც აქამდე ინგლისურენოვან აპებში ეძებდი 🌸',
                       '',
                       'MEDICARD-ის ციკლის დღიური:',
                       '🌸 პროგნოზი და ნაყოფიერი დღეები',
                       '📝 სიმპტომები, განწყობა, დღიური',
                       '🔔 შეხსენებები',
                       '🔒 მონაცემები მხოლოდ შენ გეკუთვნის',
                       '',
                       'პროგნოზი სავარაუდოა და არ არის კონტრაცეფციის მეთოდი.')),
         story=dict(template='story-screen', screen='v3/cycle-dark.webp', headline='ციკლი, რომელიც გესმის 🌸',
                    sub='პროგნოზი, დღიური, შეხსენებები')),

    dict(pillar='tip',
         feed=dict(template='tip', icon='😴', kicker='რჩევა', headline='ძილი: მარტივი ჩვევები უკეთესი ღამისთვის',
                   bullets=['დაიძინე და გაიღვიძე ყოველდღე ერთსა და იმავე დროს',
                            'ძილამდე ერთი საათით ადრე გვერდზე გადადე ეკრანი',
                            'საღამოს მოერიდე ყავას და მძიმე ვახშამს'],
                   footnote='ზრდასრულს ღამით, როგორც წესი, 7–9 საათი ძილი სჭირდება.',
                   caption=cap(
                       'კარგი დღე წინა ღამით იწყება 😴',
                       '',
                       '🕙 ერთი და იგივე დრო დაძინებისა და გაღვიძებისთვის',
                       '📵 ეკრანი — ძილამდე ერთი საათით ადრე გვერდზე',
                       '☕ საღამოს — ყავის გარეშე',
                       '',
                       'ზრდასრულს ღამით, როგორც წესი, 7–9 საათი ძილი სჭირდება.',
                       '',
                       'შენ რამდენს იძინებ? 👇')),
         story=dict(template='story-tip', icon='😴', headline='რამდენს იძინებ ღამით?', sub='მოგვწერე 👇 · ზრდასრულს ჩვეულებრივ 7–9 სთ სჭირდება')),

    dict(pillar='feature', photo='dog',
         feed=dict(template='photo', photo='dog', ai=True, kicker='Medi Vet', headline='ოთხფეხა მეგობარიც ოჯახის წევრია',
                   sub='ვაქცინები, წონა, შეხსენებები და Medi Vet — ერთ ადგილას.',
                   caption=cap(
                       'შენი ძაღლის ან კატის ჯანმრთელობაც მნიშვნელოვანია 🐾',
                       '',
                       '💉 ვაქცინებისა და პარაზიტების დამუშავების შეხსენებები',
                       '⚖️ წონის ისტორია',
                       '🩺 Medi Vet — კითხვებზე პასუხი 24/7',
                       '',
                       'Medi Vet არ ცვლის ვეტერინარს — გადაუდებელ შემთხვევაში დაუკავშირდი კლინიკას.')),
         story=dict(template='story-screen', screen='v3/pets.webp', headline='შენი ოთხფეხა მეგობარი 🐾',
                    sub='ვაქცინები და შეხსენებები MEDICARD-ში')),

    dict(pillar='trust',
         feed=dict(template='statement', kicker='კონფიდენციალურობა', headline='შენს მონაცემებს არ ვყიდით. არასდროს.',
                   sub='AI-ს არაფერი მიეწოდება შენი ნებართვის გარეშე. თანხმობას ნებისმიერ დროს გააუქმებ.',
                   caption=cap(
                       'ჯანმრთელობის მონაცემები ყველაზე პირადია 🔒',
                       '',
                       'ამიტომ MEDICARD-ში:',
                       '✅ მონაცემებს არ ვყიდით და რეკლამისთვის არ ვიყენებთ',
                       '✅ AI-ს არაფერი მიეწოდება შენი თანხმობის გარეშე',
                       '✅ თანხმობას ნებისმიერ დროს გააუქმებ',
                       '✅ ანგარიშს და მონაცემებს ერთი ღილაკით წაშლი',
                       '',
                       'სრული პოლიტიკა: medicard.ge/privacy')),
         story=dict(template='story-statement', headline='არ ვყიდით. არასდროს. 🔒', sub='შენი ჯანმრთელობის მონაცემები მხოლოდ შენია'),
         linkedin=dict(template='li-text', headline='Privacy by design', text='\n'.join([
             "A health app can't ask for trust. It has to earn it.",
             '',
             'At MEDICARD:',
             '• We never sell or advertise with health data',
             '• AI features only run after an explicit, revocable consent that names every recipient',
             '• People can delete their account and data in one tap',
             '• Accounts are 18+ only',
             '',
             'It costs us some shortcuts. It is worth it.',
             '',
             '#Privacy #HealthTech #GDPR #Trust']))),

    dict(pillar='feature',
         feed=dict(template='screen', screen='v3/quest.webp', kicker='Medi Quest', headline='ჯანსაღი ჩვევა — თამაშით',
                   sub='ყოველდღიური მისიები, სერიები და Medi Coins.',
                   bullets=['დალიე წყალი', 'გაიარე ნაბიჯები', 'დალიე წამალი დროზე'],
                   caption=cap(
                       'ჩვევის შექმნა ძნელია. თამაშით — უფრო ადვილი 🏆',
                       '',
                       'Medi Quest-ში ყოველდღიური მისიები გელოდება: წყალი, ნაბიჯები, წამალი დროზე. ყოველ შესრულებულზე — Medi Coins და ახალი დონე.',
                       '',
                       'რამდენ დღიან სერიას მიაღწევ? 🔥')),
         story=dict(template='story-screen', screen='v3/quest.webp', headline='დღევანდელი მისია 🏆',
                    sub='შეასრულე და მიიღე Medi Coins')),

    # ── Week 3 · community & engagement ────────────────────────────────────────
    dict(pillar='engage',
         feed=dict(template='question', kicker='შენი აზრი', headline='რა გიჭირს ყველაზე მეტად?',
                   bullets=['A — წამლის დროზე დალევა', 'B — ანალიზების გაგება', 'C — ჯანსაღი კვება', 'D — მოძრაობა'],
                   caption=cap(
                       'გულწრფელად: რა გიჭირს ყველაზე მეტად? 🤔',
                       '',
                       'A — წამლის დროზე დალევა 💊',
                       'B — ანალიზების გაგება 🔬',
                       'C — ჯანსაღი კვება 🥗',
                       'D — მოძრაობა 🏃',
                       '',
                       'დაწერე ასო კომენტარში — შენს პასუხებზე დაყრდნობით ვაუმჯობესებთ MEDICARD-ს 💚')),
         story=dict(template='story-question', headline='რა გიჭირს ყველაზე მეტად?',
                    bullets=['💊 წამლები', '🔬 ანალიზები', '🥗 კვება', '🏃 მოძრაობა'], sub='მოგვწერე პასუხი 💬'),
         linkedin=dict(template='li-text', headline="The world doesn't need another tracker", text='\n'.join([
             "The world doesn't need another tracker. It needs a reason to go outside.",
             '',
             'That is the idea behind MEDIRUN, the part of MEDICARD we are most excited about.',
             '',
             'Instead of counting steps, you explore your city: every walk reveals new places and small rewards along the way.',
             '',
             'No language barrier. No gym membership. Just a reason to move.',
             '',
             'What gets you out of the house?',
             '',
             '#MEDIRUN #HealthTech #Gamification #ActiveLiving']))),

    dict(pillar='feature', photo='coach',
         feed=dict(template='photo', photo='coach', ai=True, kicker='MEDI COACH', headline='შენი ტრენერი — შენს ტელეფონში',
                   sub='ვარჯიშის განრიგი, კვების გეგმა და პროგრესი. გაუზიარე მხოლოდ იმას, რასაც შენ აირჩევ.',
                   caption=cap(
                       'ტრენერთან მუშაობ? 🏋️',
                       '',
                       'MEDI COACH-ით ტრენერი ხედავს შენს ვარჯიშებს, კვებასა და პროგრესს, მაგრამ მხოლოდ იმას, რასაც შენ დაუშვებ. წვდომას ნებისმიერ დროს შეწყვეტ.',
                       '',
                       'ტრენერი ხარ? შემოგვიერთდი MEDICARD-ში 💪')),
         story=dict(template='story-photo', photo='coach', ai=True, kicker='MEDI COACH', headline='ტრენერი ხარ? 💪',
                    sub='მართე კლიენტები MEDICARD-ში')),

    dict(pillar='move',
         feed=dict(template='screen', screen='v2/run.webp', kicker='MEDIRUN · შაბათ-კვირა', headline='ამ შაბათ-კვირას — 5 000 ნაბიჯი ახალ ქუჩებზე',
                   sub='გაიარე ქუჩა, სადაც აქამდე არასდროს ყოფილხარ.',
                   bullets=['აირჩიე ახალი მარშრუტი', 'იპოვე საჩუქრები', 'გააზიარე შენი რუკა'],
                   caption=cap(
                       'შაბათ-კვირის გამოწვევა 🏃',
                       '',
                       '5 000 ნაბიჯი ისეთ ქუჩებზე, სადაც აქამდე არ ყოფილხარ. MEDIRUN ყოველ ახალ მონაკვეთს რუკაზე ფერად აღნიშნავს.',
                       '',
                       'შედეგი გვაჩვენე სთორიში და მოგვნიშნე 📍',
                       tags=TAGS + ' #MEDIRUN')),
         story=dict(template='story-screen', screen='v2/run.webp', headline='შაბათ-კვირის გამოწვევა 🏃',
                    sub='5 000 ნაბიჯი ახალ ქუჩებზე')),

    dict(pillar='tip',
         feed=dict(template='tip', icon='👟', kicker='რჩევა', headline='რამდენი ნაბიჯი გჭირდება დღეში?',
                   bullets=['კვლევებით, დღეში დაახლოებით 7 000 ნაბიჯიც კი დიდ სარგებელს იძლევა',
                            'ყოველი დამატებითი 1 000 ნაბიჯი ითვლება',
                            'მიზანი ნელ-ნელა გაზარდე'],
                   footnote='ზოგადი ინფორმაციაა — ჯანმრთელობის პრობლემების შემთხვევაში ექიმს გაესაუბრე.',
                   caption=cap(
                       '10 000 ნაბიჯი აუცილებელია? 👟',
                       '',
                       'კვლევები აჩვენებს, რომ დღეში დაახლოებით 7 000 ნაბიჯიც კი ჯანმრთელობისთვის დიდ სარგებელს იძლევა, და ყოველი დამატებითი ათასი ითვლება.',
                       '',
                       'MEDICARD ნაბიჯებს Apple Health-იდან ავტომატურად დაითვლის და მიზანს ნელ-ნელა გაზრდის.',
                       '',
                       'დღეს რამდენი გაიარე? 👇')),
         story=dict(template='story-tip', icon='👟', headline='დღეს რამდენი ნაბიჯი?', sub='~7 000 ნაბიჯიც დიდ სარგებელს იძლევა')),

    dict(pillar='feature',
         feed=dict(template='statement', kicker='ჯანმრთელობის პასპორტი', headline='ყველაფერი ერთ PDF-ში — ექიმისთვის',
                   sub='სისხლის ჯგუფი, ალერგიები, დაავადებები, წამლები. ქართულად ან ინგლისურად.',
                   caption=cap(
                       'ექიმთან ვიზიტისას ყველაფერი გახსოვს? 📋',
                       '',
                       'MEDICARD ჯანმრთელობის პასპორტს ერთი შეხებით შექმნის: სისხლის ჯგუფი, ალერგიები, დაავადებები და წამლები ერთ PDF-ში.',
                       '',
                       '🇬🇪 ქართულად ან 🇬🇧 ინგლისურად — საზღვარგარეთ მოგზაურობისასაც გამოგადგება.')),
         story=dict(template='story-statement', headline='ჯანმრთელობის პასპორტი 📋', sub='ერთი PDF — ქართულად ან ინგლისურად')),

    dict(pillar='feature',
         feed=dict(template='statement', kicker='აფთიაქები', headline='იპოვე წამალი უკეთეს ფასად',
                   sub='შეადარე ფასები სხვადასხვა ქართულ აფთიაქში — პირდაპირ აპიდან.',
                   caption=cap(
                       'ერთი და იგივე წამალი, სხვადასხვა ფასი 💸',
                       '',
                       'MEDICARD ფასებს რამდენიმე ქართულ აფთიაქში ერთად გაჩვენებს, ფასის ვარდნისას კი შეგატყობინებს.',
                       '',
                       'ფასები აფთიაქის საიტებიდან მოდის და შეიძლება შეიცვალოს — ყიდვამდე გადაამოწმე აფთიაქში.')),
         story=dict(template='story-statement', headline='იგივე წამალი — სხვა ფასი 💸', sub='შეადარე ფასები MEDICARD-ში'),
         linkedin=dict(template='li-text', headline='One app instead of five', text='\n'.join([
             'Unpopular opinion: people do not need more health apps. They need fewer.',
             '',
             'A typical person managing their health juggles a reminder app, a food tracker, a cycle app, a step counter and a folder of lab results.',
             '',
             'Each one is fine. Together they are exhausting, and none of them talk to each other.',
             '',
             'MEDICARD puts them in one place, with one assistant that can see the whole picture (with consent).',
             '',
             'Agree or disagree?',
             '',
             '#HealthTech #ProductDesign #DigitalHealth']))),

    dict(pillar='feature', photo='laptop',
         feed=dict(template='photo', photo='laptop', ai=True, kicker='ვებ-ვერსია', headline='MEDICARD — კომპიუტერიდანაც',
                   sub='medicard.ge/app — იგივე ანგარიში, დიდი ეკრანი, გრაფიკები.',
                   caption=cap(
                       'დიდ ეკრანზე უფრო მოსახერხებელია? 💻',
                       '',
                       'MEDICARD-ის ვებ-ვერსიაში იგივე ანგარიშით შედიხარ: წამლები, ანალიზები, კვება, ციკლი და Medi — კომპიუტერიდან, დიდ გრაფიკებთან ერთად.',
                       '',
                       '👉 medicard.ge/app')),
         story=dict(template='story-photo', photo='laptop', ai=True, kicker='ვებ-ვერსია', headline='კომპიუტერიდანაც 💻',
                    sub='medicard.ge/app')),

    # ── Week 4 · story & behind the scenes ─────────────────────────────────────
    dict(pillar='story',
         feed=dict(template='statement', kicker='რატომ MEDICARD', headline='ჯანმრთელობა, რომელიც ქართულად გესმის',
                   sub='ანალიზის ფურცელი უჯრაში, შეხსენება ერთ აპში, ციკლი მეორეში, კვება მესამეში… ამიტომ შევქმენით MEDICARD.',
                   caption=cap(
                       'რატომ შევქმენით MEDICARD? 💚',
                       '',
                       'ანალიზის ფურცელი უჯრაში ინახებოდა, წამლის შეხსენება ერთ აპში იყო, ციკლი — მეორეში, კვების დღიური — მესამეში. თითქმის ყველა ინგლისურად.',
                       '',
                       'გვინდოდა ერთი ადგილი, სადაც ყოველდღიური ზრუნვა მარტივია, გასაგებია და ქართულია.',
                       '',
                       'ეს მხოლოდ დასაწყისია. რა გინდა, რომ დავამატოთ? 👇')),
         story=dict(template='story-statement', headline='რატომ MEDICARD? 💚', sub='რომ ჯანმრთელობა ქართულად გესმოდეს'),
         linkedin=dict(template='li-text', headline='Built for Georgia', text='\n'.join([
             'People deserve to understand their health in their own language.',
             '',
             'Not a translated menu. Georgian food in the nutrition catalog, Georgian pharmacies in price comparison, and an assistant that answers in Georgian.',
             '',
             'We are building MEDICARD for small-language markets first. Georgia is where we start.',
             '',
             '#HealthTech #Georgia #Startup #Localization']))),

    dict(pillar='feature', photo='family',
         feed=dict(template='photo', photo='family', ai=True, kicker='ოჯახი', headline='იზრუნე მათზე, ვინც შენზე ზრუნავდა',
                   sub='დაეხმარე მშობლებს: წამლები, ვიზიტები და შეხსენებები ერთ აპში.',
                   caption=cap(
                       'მშობლებს წამლების დათვლა უჭირთ? 💚',
                       '',
                       'დაუყენე MEDICARD, ერთად ჩაწერეთ წამლები და ვიზიტები, შეხსენებები კი დანარჩენს თვითონ იზამს.',
                       '',
                       'მონიშნე ის, ვისაც ეს გამოადგება 👇')),
         story=dict(template='story-photo', photo='family', ai=True, kicker='ოჯახი', headline='დაეხმარე მშობლებს 💚',
                    sub='წამლები და შეხსენებები — ერთ აპში')),

    dict(pillar='move',
         feed=dict(template='photo', photo='../launch/photos/story.png', ai=True, kicker='MEDIRUN', headline='შაბათის დილა — საუკეთესო დრო გასასეირნებლად', sub='ყოველი ახალი ქუჩა რუკაზე ფერს იძენს.', caption=cap(
             'შაბათის დილა — საუკეთესო დრო გასასეირნებლად ☀️',
             '',
             'MEDIRUN-ში ყოველი ახალი ქუჩა რუკაზე ფერს იძენს. ამ შაბათ-კვირას შენი ქალაქის ახალ კუთხეს აღმოაჩენ?',
             tags=TAGS + ' #MEDIRUN')),
         story=dict(template='story-photo', photo='../launch/photos/story.png', ai=True, kicker='MEDIRUN',
                    headline='შაბათის დილა ☀️', sub='გადი გარეთ და აღმოაჩინე შენი ქალაქი')),

    dict(pillar='tip',
         feed=dict(template='tip', icon='🌿', kicker='რჩევა', headline='სტრესი: 3 წუთიანი პაუზა',
                   bullets=['ჩაისუნთქე ნელა, 4 წამი', 'ამოისუნთქე კიდევ უფრო ნელა, 6 წამი', 'გაიმეორე 3 წუთის განმავლობაში'],
                   footnote='თუ სტრესი ან შფოთვა ხშირია, სპეციალისტს მიმართე.',
                   caption=cap(
                       'დაძაბული დღე გაქვს? 🌿',
                       '',
                       'სცადე 3 წუთიანი სუნთქვა:',
                       '1️⃣ ნელა ჩაისუნთქე — 4 წამი',
                       '2️⃣ კიდევ უფრო ნელა ამოისუნთქე — 6 წამი',
                       '3️⃣ გაიმეორე 3 წუთის განმავლობაში',
                       '',
                       'ხანგრძლივი ამოსუნთქვა სხეულს დამშვიდებაში ეხმარება.',
                       '',
                       'თუ სტრესი ან შფოთვა ხშირია, სპეციალისტს მიმართე 💚')),
         story=dict(template='story-tip', icon='🌿', headline='3 წუთი შენთვის', sub='4 წამი ჩასუნთქვა · 6 წამი ამოსუნთქვა')),

    dict(pillar='feature',
         feed=dict(template='screen', screen='v3/lab-dark.webp', kicker='ანალიზები', headline='შენი ანალიზების ისტორია — ერთ გრაფიკზე',
                   sub='ყოველი მაჩვენებლის დინამიკა დროში, განმარტებით.',
                   bullets=['ფოტოდან ან PDF-იდან', 'გრაფიკი დროში', 'Medi-სთან განხილვა'],
                   caption=cap(
                       'შენი ჰემოგლობინი როგორ შეიცვალა ბოლო ერთ წელიწადში? 📈',
                       '',
                       'MEDICARD ყველა ანალიზს ერთ ისტორიაში ინახავს: ყოველ მაჩვენებელს დროში, გრაფიკზე ნახავ და Medi-სთან განიხილავ.',
                       '',
                       'შედეგი ყოველთვის ექიმთან განიხილე.')),
         story=dict(template='story-screen', screen='v3/lab-dark.webp', headline='ანალიზები — გრაფიკზე 📈',
                    sub='დინამიკა დროში, ერთ ადგილას')),

    dict(pillar='feature',
         feed=dict(template='statement', kicker='ახალი', headline='MEDICARD ახლა ინგლისურადაც',
                   sub='ქართული ან ინგლისური — აირჩიე ენა დაწყებისას ან პროფილში.',
                   caption=cap(
                       'MEDICARD ახლა ორ ენაზეა 🇬🇪 🇬🇧',
                       '',
                       'ენას აირჩევ პირველივე ეკრანზე ან პროფილში, ნებისმიერ დროს. Medi-ც შენს არჩეულ ენაზე გიპასუხებს.',
                       '',
                       'გაუზიარე უცხოელ მეგობარს, რომელიც საქართველოში ცხოვრობს 💚')),
         story=dict(template='story-statement', headline='ქართულად · English', sub='აირჩიე ენა დაწყებისას'),
         linkedin=dict(template='li-text', headline='Now in English', text='\n'.join([
             'MEDICARD now works in Georgian and English, including the AI assistant, reminders and emails.',
             '',
             'For the many foreigners who live and work in Georgia, that means one app for everyday health, with local pharmacies and local food.',
             '',
             'Know someone who should try it? Link in the first comment.',
             '',
             '#HealthTech #Georgia #Expats #DigitalHealth']))),

    dict(pillar='launch',
         feed=dict(template='statement', kicker='4 კვირა MEDICARD-თან', headline='დიდი მადლობა, რომ ჩვენთან ხარ 💚',
                   sub='ეს მხოლოდ დასაწყისია. Android — სულ მალე.',
                   caption=cap(
                       '4 კვირა გავიდა MEDICARD-ის გაშვებიდან 💚',
                       '',
                       'მადლობა ყველას, ვინც სცადა, მოგვწერა, გაგვიზიარა და შეცდომებზე მიგვითითა. ყოველ თქვენს შეტყობინებას ვკითხულობთ.',
                       '',
                       'შემდეგი ნაბიჯი? Android და კიდევ ბევრი სიახლე. გამოგვყევი! 🚀')),
         story=dict(template='story-statement', headline='მადლობა 💚', sub='ეს მხოლოდ დასაწყისია 🚀')),
]

import datetime as _dt

START = _dt.date(2026, 10, 1)


def build():
    items = []
    for i, day in enumerate(DAYS):
        date = START + _dt.timedelta(days=i)
        weekend = date.weekday() >= 5
        n = i + 1
        feed = dict(day['feed'])
        feed.update(slot=f'd{n:02d}-feed', kind='POST', networks=['facebook', 'instagram'], date=str(date),
                    time=WEEKEND_FEED_TIME if weekend else FEED_TIME, pillar=day['pillar'], firstComment=FIRST_COMMENT)
        feed.setdefault('image', f'd{n:02d}-feed.jpg')
        items.append(feed)
        story = dict(day['story'])
        story.update(slot=f'd{n:02d}-story', kind='STORY', networks=['facebook', 'instagram'], date=str(date),
                     time=STORY_TIME, pillar=day['pillar'])
        story.setdefault('image', f'd{n:02d}-story.jpg')
        items.append(story)
        if 'linkedin' in day:
            li = dict(day['linkedin'])
            li.update(slot=f'd{n:02d}-linkedin', kind='POST', networks=['linkedin'], date=str(date), time=LI_TIME,
                      pillar=day['pillar'], firstComment=f'📲 iPhone: {APP}\n💻 Web: https://medicard.ge/app')
            li.setdefault('image', f'd{n:02d}-linkedin.jpg')
            items.append(li)
    (HERE / 'plan.json').write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(items), 'items')


if __name__ == '__main__':
    build()
