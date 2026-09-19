// Generated from medipulsi/src by build-core.mjs.
import { distance } from './engine.js';
export const CHAPTERS = [{ id: 'green', name: 'მწვანე თბილისი', subtitle: 'ქალაქის მშვიდი მხარე', symbol: '01' }, { id: 'oldtown', name: 'ძველი ქალაქის ამბები', subtitle: 'ერთი ადგილი. ახალი ისტორია.', symbol: '02' }, { id: 'horizon', name: 'წყალი და ჰორიზონტი', subtitle: 'მეტი სივრცე შენი ნაბიჯებისთვის', symbol: '03' }, { id: 'culture', name: 'ქალაქის ხელწერა', subtitle: 'აღმოაჩინე თბილისის ხასიათი', symbol: '04' }];
const locationSource = (lat, lon) => `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
const make = (id, name, chapter, center, radius, meters, title, story, icon, tip = 'იარე საჯარო საფეხმავლო სივრცეში. ზონის ცენტრში ზუსტად მისვლა საჭირო არ არის.', source = locationSource(center[1], center[0])) => ({ id, name, chapter, center, radius, meters, seconds: 60, title, story, icon, tip, source });
export const MISSIONS = [
    make('vake', 'ვაკის პარკი', 'green', [44.7509, 41.7098], 460, 500, 'მწვანე დასაწყისი', 'ნაცნობი პარკი ახალი თვალით. იპოვე შენი მშვიდი ბილიკი.', 'trees'),
    make('mziuri', 'მზიური', 'green', [44.7704, 41.7113], 420, 450, 'პატარა მზიური დღე', 'ხეების ჩრდილში გასეირნება ქალაქის ყოველდღიურობას ცვლის.', 'trees', undefined, 'https://georgia.travel/family-attractions/mziuri-park'),
    make('vera', 'ვერის ბაღი', 'green', [44.78817, 41.70851], 210, 300, 'პაუზა ვერაზე', 'შეაგროვე პატარა გასეირნება დიდი დღის შუაში.', 'trees'),
    make('dedaena', 'დედაენის ბაღი', 'green', [44.80449, 41.70058], 230, 300, 'ქალაქის ხმები', 'მდინარის სიახლოვე და ქალაქის რიტმი ერთ გასეირნებაში.', 'trees'),
    make('april9', '9 აპრილის ბაღი', 'green', [44.7994, 41.6983], 170, 250, 'ბაღი ქალაქის გულში', 'გადაუხვიე ყოველდღიურ გზას და გახსენი კიდევ ერთი შტამპი.', 'flower'),
    make('mushtaidi', 'მუშტაიდის ბაღი', 'green', [44.7864, 41.7219], 240, 350, 'ბაღის პატარა ამბავი', 'ნელა გაიარე და შეამჩნიე ის, რასაც ჩვეულებრივ ჩაუვლიდი.', 'trees', 'შეამოწმე შესვლის ადგილობრივი პირობები. ატრაქციონით მგზავრობა არ ითვლება.'),
    make('kikvidze', 'კიკვიძის პარკი', 'green', [44.7898, 41.7481], 290, 450, 'ჩრდილოეთის მწვანე გზა', 'კიდევ ერთი უბანი, კიდევ ერთი მიზეზი ფეხით გასვლისთვის.', 'trees'),
    make('dighomi', 'დიღმის ტყე-პარკი', 'green', [44.77205, 41.76829], 600, 650, 'ხეების ქალაქი', 'აირჩიე ხელმისაწვდომი ბილიკი და მოაგროვე შენი მწვანე კილომეტრის ნაწილი.', 'trees'),
    make('freedom', 'თავისუფლების მოედანი', 'oldtown', [44.8005, 41.6934], 150, 120, 'თბილისის გულისცემა', 'აქედან შენი ძველი ქალაქის კოლექცია იწყება.', 'landmark', 'მიზანი სრულდება ტროტუარიდანაც. მოძრაობის წრეში ან გზის სავალ ნაწილზე გადასვლა საჭირო არ არის.', 'https://georgia.travel/liberty-square-tbilisi'),
    make('orbeliani', 'ორბელიანის მოედანი', 'oldtown', [44.8018, 41.6987], 140, 160, 'ქალაქური შეხვედრა', 'აღმოაჩინე ქუჩების პატარა გადაკვეთა და შენი შემდეგი ამბავი.', 'landmark'),
    make('gabriadze', 'გაბრიაძის საათის კოშკი', 'oldtown', [44.8053, 41.6959], 120, 120, 'დრო შენს მხარესაა', 'ამჯერად დრო გასეირნებისთვის გამოყავი.', 'landmark'),
    make('peace', 'მშვიდობის ხიდი', 'oldtown', [44.8080, 41.6930], 170, 180, 'ორი ნაპირის ამბავი', 'გააგრძელე აღმოჩენა მდინარის გასწვრივ.', 'bridge', 'შტამპი მიმდებარე საფეხმავლო სივრციდანაც ითვლება; მთელი ხიდის გადაკვეთა სავალდებულო არ არის.'),
    make('rike', 'რიყის პარკი', 'oldtown', [44.8099, 41.6937], 330, 400, 'მტკვრის რიტმი', 'ხიდებსა და პარკს შორის შენი ახალი ბილიკი იპოვე.', 'trees', undefined, 'https://georgia.travel/family-attractions/rike-park'),
    make('metekhi', 'მეტეხის გარე სივრცე', 'oldtown', [44.8112, 41.6900], 140, 120, 'ძველი ქალაქის აივანი', 'აღმოაჩინე ქალაქის ხედი საჯარო გარე სივრციდან.', 'landmark', 'არ არის საჭირო ტაძარში შესვლა. მოერიდე ვიწრო კიდეებს და დარჩი ღია საფეხმავლო სივრცეში.'),
    make('abanotubani', 'აბანოთუბანი', 'oldtown', [44.8110, 41.6880], 220, 250, 'თბილისური დასაწყისი', 'ძველი უბნის ქუჩები შენს პასპორტში ახალ ფურცელს გახსნის.', 'landmark'),
    make('gudiashvili', 'გუდიაშვილის მოედანი', 'oldtown', [44.8031, 41.6910], 130, 150, 'სოლოლაკის დეტალები', 'ერთი პატარა მოედანი და უამრავი შესამჩნევი დეტალი.', 'landmark'),
    make('turtle', 'კუს ტბა', 'horizon', [44.7540, 41.7007], 420, 700, 'ტბის მშვიდი ტემპი', 'იარე ნაპირთან შენი ტემპით. სრული წრის შემოვლა აუცილებელი არ არის.', 'waves', 'ზონის წრე მოიცავს ტბასაც, მაგრამ წყალში შესვლა მიზანი არ არის. გამოიყენე ნაპირის ბილიკები.', 'https://georgia.travel/turtle-lake'),
    make('lisi', 'ლისის ტბა', 'horizon', [44.73454, 41.74385], 850, 1000, 'ლისის ჰორიზონტი', 'შეაგროვე კილომეტრი ტბის გარემოში — სურვილისამებრ რამდენიმე გასეირნებად.', 'waves', 'იარე ნაპირის ხელმისაწვდომ ბილიკებზე. სრული წრე და წყალში შესვლა საჭირო არ არის.', 'https://georgia.travel/lisi-lake'),
    make('mtatsminda', 'მთაწმინდის პარკი', 'horizon', [44.7864, 41.6954], 430, 600, 'ქალაქი შენს ქვემოთ', 'შტამპისთვის პარკში გასეირნებაა საჭირო; მთაზე ფეხით ასვლა სავალდებულო არ არის.', 'mountain', 'მისია ფეხით გასეირნებას ეძღვნება. ფუნიკულიორისა და ატრაქციონების ნაცვლად გამოიყენე საჯარო ბილიკები.', 'https://georgia.travel/mtatsminda'),
    make('mother', 'ქართლის დედა', 'horizon', [44.8047, 41.6881], 190, 200, 'სოლოლაკის ჰორიზონტი', 'გაიხსენი კიდევ ერთი ხედი ქალაქზე.', 'mountain', 'კიბეების და ფერდობის გამო აირჩიე შენთვის მისაწვდომი გზა. კედლებზე ასვლა საჭირო არ არის.'),
    make('chronicle', 'საქართველოს მატიანე', 'horizon', [44.8107, 41.7704], 260, 300, 'ქალაქის დიდი ამბავი', 'ახალი ადგილი შენი თბილისური კოლექციისთვის.', 'landmark', 'მიზანი გარე სივრცეში სრულდება. კიბეები შეიძლება მოძრაობას ართულებდეს.'),
    make('sameba', 'სამების გარე სივრცე', 'culture', [44.8165, 41.6975], 330, 350, 'ქალაქის სილუეტი', 'გარე სივრცეში მშვიდი გასეირნებით აღმოაჩინე ახალი შტამპი.', 'landmark', 'ტაძარში შესვლა საჭირო არ არის. გაითვალისწინე სივრცის ადგილობრივი წესები.'),
    make('botanical', 'ბოტანიკური ბაღის შესასვლელი', 'culture', [44.807067, 41.687967], 150, 150, 'მწვანე ქალაქის კარიბჭე', 'კოლექციის ეს შტამპი ბაღის საჯარო მისასვლელს ეძღვნება.', 'flower', 'მისიისთვის ბილეთის ყიდვა საჭირო არ არის. საჯარო მისასვლელზე დარჩი; ბაღის შიგნით ვიზიტს საკუთარი პირობები აქვს.', 'https://georgia.travel/the-botanical-garden'),
    make('opera', 'ოპერა და რუსთაველი', 'culture', [44.7957, 41.7032], 230, 300, 'რუსთაველის რიტმი', 'არქიტექტურისა და ყოველდღიური თბილისის პატარა გასეირნება.', 'landmark', 'იარე ტროტუარზე. ოპერაში შესვლა ან ღონისძიების ბილეთი საჭირო არ არის.'),
];
export const emptyBook = () => ({ version: 1, selected: null, progress: {} });
export const missionById = (id) => MISSIONS.find(m => m.id === id);
export const missionProgress = (book, m) => book.progress[m.id] || { meters: 0, seconds: 0, completedAt: null };
export function missionPercent(book, m) { const p = missionProgress(book, m); return p.completedAt ? 100 : Math.floor(Math.min(p.meters / m.meters, p.seconds / m.seconds, 1) * 100); }
export function loadBook(raw) { const book = emptyBook(); if (!raw || typeof raw !== 'object')
    return book; const d = raw; if (d.version !== 1)
    return book; book.selected = missionById(d.selected)?.id || null; for (const m of MISSIONS) {
    const p = d.progress?.[m.id];
    if (!p)
        continue;
    const num = (n, max) => Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0;
    const meters = num(p.meters, m.meters), seconds = num(p.seconds, m.seconds);
    book.progress[m.id] = { meters, seconds, completedAt: meters >= m.meters && seconds >= m.seconds && typeof p.completedAt === 'string' && !Number.isNaN(Date.parse(p.completedAt)) ? p.completedAt : null };
} return book; }
/** Count only accepted movement inside the selected mission. Pauses and teleports contribute zero. */
export function advanceMission(book, before, after, now = Date.now(), mission = missionById(book.selected)) {
    const m = mission;
    if (!m || before.source !== after.source || missionProgress(book, m).completedAt)
        return book;
    const meters = after.meters - before.meters, seconds = after.movingSeconds - before.movingSeconds;
    if (meters <= 0 || seconds <= 0 || seconds > 15 || meters / seconds > 7 || after.accuracy > 25 || before.accuracy > 25 || !['tracking', 'off-path'].includes(after.status))
        return book;
    if (after.source === 'gps' && (after.lastFix === null || now - after.lastFix > 15000 || before.lastFix === null))
        return book;
    if (distance(before.position, after.position) > meters + 20)
        return book;
    if (distance(before.position, m.center) + before.accuracy > m.radius || distance(after.position, m.center) + after.accuracy > m.radius)
        return book;
    const p = missionProgress(book, m), next = { meters: Math.min(m.meters, p.meters + meters), seconds: Math.min(m.seconds, p.seconds + seconds), completedAt: null };
    if (next.meters >= m.meters && next.seconds >= m.seconds)
        next.completedAt = new Date(now).toISOString();
    return { ...book, progress: { ...book.progress, [m.id]: next } };
}
export function missionCircle(m) { const coordinates = []; for (let i = 0; i <= 64; i++) {
    const a = i / 64 * Math.PI * 2;
    coordinates.push([m.center[0] + Math.cos(a) * m.radius / (111195 * Math.cos(m.center[1] * Math.PI / 180)), m.center[1] + Math.sin(a) * m.radius / 111195]);
} return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coordinates] } }; }
