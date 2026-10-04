"""Shared caption pieces for the Q4 calendar (5 Oct – 31 Dec 2026).

Owner rules (brand/brandbook, AGENTS.md): every caption carries the App Store link and medicard.ge,
every image shows „App Store · medicard.ge“, the reader is შენ, only real facts, MEDIRUN first,
module names written as one word (MEDIPILL, MEDIQUEST …), the assistant is Medi.
"""

APP = 'https://apps.apple.com/app/id6812517519'
SITE = 'https://medicard.ge'
RULES = 'https://medicard.ge/medirun'

LINKS = (
    '📲 MEDICARD უფასოა — ჩამოტვირთე iPhone-ზე:',
    APP,
    f'🌐 {SITE}',
    '🤖 Android — სულ მალე',
)
LINKS_RUN = LINKS[:3] + (f'🗺 წესები და განრიგი: {RULES}',) + LINKS[3:]

TAGS = {
    'run': '#გაანათეთბილისი #MEDIRUN #MEDICARD #თბილისი #საქართველო',
    'medi': '#Medi #MEDICARD #ჯანმრთელობა #საქართველო',
    'pill': '#MEDIPILL #MEDICARD #წამლები #ჯანმრთელობა',
    'food': '#MEDIFOOD #MEDICARD #კვება #ჯანმრთელობა',
    'cycle': '#MEDICYCLE #MEDICARD #ქალისჯანმრთელობა #ციკლი',
    'lab': '#MEDILAB #MEDICARD #ანალიზები #ჯანმრთელობა',
    'scan': '#MEDISCAN #MEDICARD #ანალიზები #ჯანმრთელობა',
    'quest': '#MEDIQUEST #MEDICARD #MediCoins',
    'vet': '#MEDIVET #MEDICARD #შინაურიცხოველები',
    'coach': '#MEDICOACH #MEDICARD #ფიტნესი #ტრენერი',
    'card': '#MEDICARD #ჯანმრთელობა #საქართველო',
}

FIRST_COMMENT = f'📲 iPhone: {APP}\n🌐 {SITE}\n💻 ვებ-ვერსია: {SITE}/app\n🤖 Android — სულ მალე'


def cap(m, *lines, links=None):
    """Caption = the post's own lines, one blank line, the download block, the hashtags."""
    block = links or (LINKS_RUN if m == 'run' else LINKS)
    return '\n'.join(lines + ('',) + block + ('', TAGS[m]))


# ── MEDIRUN facts (server/src/data/medirun-campaign.json, economy 2 — keep in sync) ─────────────
WAVES_WD = ('08:00', '13:00', '18:00')
WAVES_WE = ('09:30', '13:30', '17:30')
RHYTHM = (
    '🌅 ორშაბათი–პარასკევი — 08:00, 13:00 და 18:00 საათზე: ყუთები ყველა უბანში, პირველ გამხსნელს 20–80 Medi Coins',
    '☀️ შაბათ-კვირა — 09:30, 13:30 და 17:30 საათზე: მეტი ყუთი, პირველ გამხსნელს 30–120 Medi Coins',
    '🌧 შაბათობით, 16:00 — საჩუქრების წვიმა ერთ პარკში: 80 და 150 Medi Coins',
    '🏆 ორშაბათობით — კვირის პრიზები ლიდერბორდზე: 300 / 200 / 100 Medi Coins',
    '🔴 31 დეკემბერი, 12:00 — წითელი iPhone 18 Pro Max მათთვის, ვისაც თბილისის 1% აქვს განათებული',
)
HOW = (
    '1️⃣ გახსენი MEDICARD, დააჭირე RUN-ს და გაისეირნე. ყოველი ახალი ქუჩა შენს რუკაზე აინთება.',
    '2️⃣ ყუთიდან 250–350 მეტრზე ტელეფონი გულისცემასავით აკანკალდება. რაც უფრო ახლოს ხარ, მით უფრო ჩქარა.',
    '3️⃣ 20–25 მეტრზე დააჭირე ღილაკს „ყუთის გახსნა“ — Medi Coins მაშინვე ჩაგერიცხება.',
)
LADDER = 'ერთ ყუთს რამდენიმე ადამიანი ხსნის: პირველი იღებს სრულ თანხას, მეორე — 60%-ს, მესამე — 40%-ს, ყველა შემდეგი — 25%-ს.'
LEVELS = (
    '✨ 0,1% — ნაპერწკალი',
    '🏮 0,25% — ფარანი: შაბათობით ფარნის ყუთებს დაინახავ',
    '🔥 0,5% — ჩირაღდანი',
    '⭐ 1% — შუქურა: 31 დეკემბერს წითელ iPhone 18 Pro Max-ს დაინახავ',
)
SAFE_LINE = 'ყუთები მხოლოდ საჯარო პარკების ბილიკებზეა, გზებიდან მოშორებით. საღამოს ყუთები — მხოლოდ განათებულ ბილიკებზე.'
APPLE_NOTE = 'Apple ამ კამპანიის სპონსორი არ არის.'
