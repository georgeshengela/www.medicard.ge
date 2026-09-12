/**
 * Sequential Android visual capture for Phase 3 localization QA.
 * Relies on existing Expo Go + Metro on 8081. Does not sign the user out.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const serial = process.env.ADB_SERIAL || 'emulator-5554';
const root = __dirname;
const shots = path.join(root, 'shots');
const logPath = path.join(root, 'visual-log.json');

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8' });
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function run(action, ...args) {
  const extra = args.map((a) => JSON.stringify(a)).join(' ');
  return execSync(`node "${path.join(root, 'qa-run.js')}" ${action} ${extra}`, {
    encoding: 'utf8',
    cwd: path.resolve(root, '..', '..'),
  });
}

function dumpNodes() {
  try {
    sh(`adb -s ${serial} shell uiautomator dump /sdcard/ui-l10n.xml`);
  } catch {
    /* ignore */
  }
  sh(`adb -s ${serial} pull /sdcard/ui-l10n.xml "${path.join(root, '_live.xml')}"`);
  const xml = fs.readFileSync(path.join(root, '_live.xml'), 'utf8');
  const nodes = [...xml.matchAll(/text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)].map(
    (m) => ({
      t: m[1],
      x: Math.round((Number(m[2]) + Number(m[4])) / 2),
      y: Math.round((Number(m[3]) + Number(m[5])) / 2),
    }),
  );
  return { xml, nodes: nodes.filter((n) => n.t) };
}

function tapText(re) {
  const { nodes } = dumpNodes();
  const hit = nodes.find((n) => re.test(n.t));
  if (!hit) return null;
  sh(`adb -s ${serial} shell input tap ${hit.x} ${hit.y}`);
  return hit;
}

function shot(name) {
  fs.mkdirSync(shots, { recursive: true });
  const dest = path.join(shots, `${name}.png`);
  sh(`adb -s ${serial} shell screencap -p /sdcard/l10n-qa.png`);
  sh(`adb -s ${serial} pull /sdcard/l10n-qa.png "${dest}"`);
  return dest;
}

function openRoute(route) {
  const url = `exp://10.0.2.2:8081/--${route.startsWith('/') ? route : '/' + route}`;
  sh(`adb -s ${serial} shell am start -a android.intent.action.VIEW -d "${url}"`);
  sleep(3500);
}

const VIEWPORT = '1080x2400 @ 420dpi (Pixel_8 / standard phone)';
const screens = [
  { id: '01-home', route: '/home', keys: ['home.*', 'hydration hub title'], wait: /გამარჯობა|შემდეგი მიღება/ },
  { id: '02-sign-in', route: '/sign-in?preview=1', keys: ['auth.signInHero', 'auth.email'], wait: /შედით|ელ-ფოსტა|პაროლი/ },
  { id: '03-sign-up', route: '/sign-up?preview=1', keys: ['auth.signUpHero', 'auth.signUpTitle'], wait: /შექმენით ანგარიში|რეგისტრაცია/ },
  { id: '04-phone-otp', route: '/phone?preview=1', keys: ['auth.phoneHero', 'auth.sendCode'], wait: /ტელეფონ|კოდ/ },
  { id: '05-forgot', route: '/forgot-password?preview=1', keys: ['auth.forgotPasswordChoose'], wait: /პაროლის აღდგენა|აირჩიეთ/ },
  { id: '06-forgot-email', route: '/forgot-password/email?preview=1', keys: ['auth.forgotPasswordEmailHint'], wait: /ელ-ფოსტა|კოდის გაგზავნა/ },
  { id: '07-assess-name', route: '/assessment?step=02-name&preview=1', keys: ['assessment.steps.nameTitle'], wait: /მოგმართოთ|სახელი/ },
  { id: '08-assess-smoking', route: '/assessment?step=14-smoking&preview=1', keys: ['assessment.steps.smokingTitle'], wait: /მოწევ|ეწევ/ },
  { id: '09-assess-meds', route: '/assessment?step=17-meds-gate&preview=1', keys: ['assessment.steps.medsGateTitle'], wait: /მედიკამენტ/ },
  { id: '10-assess-conditions', route: '/assessment?step=21-conditions-list&preview=1', keys: ['assessment.conditions.pcos'], wait: /მდგომარეობ|სინდრომ|პოლიკისტ/ },
  { id: '11-cycle', route: '/cycle', keys: ['cycle dashboard'], wait: /ციკლ|მენსტრუ|დღიური|აღრიცხვ/ },
  { id: '12-cycle-log', route: '/cycle/log', keys: ['cycle logging'], wait: /აღრიცხვ|გამონადენ|სიმპტომ/ },
  { id: '13-cycle-journal', route: '/cycle/journal', keys: ['cycle.journalEmptyTitle'], wait: /დღიურ|ისტორი|ციკლ/ },
  { id: '14-pregnancy', route: '/cycle/pregnancy', keys: ['pregnancy home'], wait: /ორსულ|კვირა|მოვლ/ },
  { id: '15-care-plan', route: '/cycle/pregnancy/care-plan', keys: ['cycle.carePlan.title', 'care_first_booking_title'], wait: /მოვლის გეგმა|ვიზიტ|ორსულ/ },
  { id: '16-timeline', route: '/cycle/pregnancy/timeline', keys: ['cycle.timeline.journey'], wait: /ორსულობის გზა|ტრიმესტრ/ },
  { id: '17-meds-hub', route: '/medications', keys: ['meds.hubTitle'], wait: /მედიკამენტ/ },
  { id: '18-meds-add', route: '/medications/add/search', keys: ['meds.addIntroTitle'], wait: /დამატება|ძებნ|მოძებნ/ },
  { id: '19-hydration-level', route: '/health-metrics/hydration/level', keys: ['hydration.levels.1.title', 'hydration.levels.2.title'], wait: /ჰიდრატაცი|წყლის მიღება|დონე/ },
  { id: '20-chat', route: '/chat/ask', keys: ['chat empty / disclaimer'], wait: /Medi|შეკითხვ|დისკლეიმერ|არ ცვლის/ },
  { id: '21-quest', route: '/medi-quest', keys: ['quest dashboard'], wait: /მისია|ქვესტ|დღევანდელი/ },
  { id: '22-profile', route: '/profile', keys: ['profile'], wait: /პროფილ|პარამეტრ|გასვლა/ },
  { id: '23-privacy', route: '/profile/privacy', keys: ['privacy'], wait: /კონფიდენციალურობა|პირობ/ },
  { id: '24-ai', route: '/profile/ai', keys: ['ai model'], wait: /Medi|მოდელ|AI/ },
  { id: '25-notifications', route: '/profile/notifications', keys: ['notification settings'], wait: /შეტყობინებ|შეხსენებ|ნებართვ/ },
];

const results = [];
fs.mkdirSync(shots, { recursive: true });

for (const screen of screens) {
  const entry = {
    id: screen.id,
    route: screen.route,
    viewport: VIEWPORT,
    keys: screen.keys,
    pass: false,
    blocker: null,
    visibleText: [],
    shot: null,
    notes: '',
  };
  try {
    openRoute(screen.route);
    const t0 = Date.now();
    let matched = false;
    let lastXml = '';
    while (Date.now() - t0 < 18000) {
      const { xml, nodes } = dumpNodes();
      lastXml = xml;
      entry.visibleText = nodes.map((n) => n.t).slice(0, 40);
      if (screen.wait.test(xml)) {
        matched = true;
        break;
      }
      sleep(1200);
    }
    entry.shot = shot(screen.id);
    if (!matched) {
      entry.blocker = 'wait regex not found after open';
      entry.notes = entry.visibleText.slice(0, 12).join(' | ');
    } else {
      entry.pass = true;
    }
  } catch (e) {
    entry.blocker = String(e && e.message ? e.message : e);
  }
  results.push(entry);
  console.log(entry.id, entry.pass ? 'PASS' : 'BLOCKED', entry.blocker || '');
}

fs.writeFileSync(logPath, JSON.stringify({ viewport: VIEWPORT, results }, null, 2), 'utf8');
console.log('WROTE', logPath);
