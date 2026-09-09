import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const OUT = path.join(root, "server/public/calculators");
const CSS = "/landing.css?v=39";
const CALC_CSS = "/calculators.css?v=2";
const JS = "/calculators.js?v=2";

const TOOLS = [
  {
    slug: "ovulation",
    tone: "cycle",
    icon: "cycle",
    group: "cycle",
    title: "ოვულაციის კალკულატორი",
    short: "სავარაუდო ოვულაცია და ნაყოფიერი ფანჯარა ბოლო პერიოდისა და ციკლის სიგრძით.",
    description:
      "გამოთვალე სავარაუდო ოვულაცია და ნაყოფიერი ფანჯარა ბოლო მენსტრუაციის პირველი დღით. Medicard.GE — მხოლოდ ბრაუზერში, ექიმს არ ცვლის.",
    lead: "შეიყვანე ბოლო პერიოდის პირველი დღე და საშუალო ციკლი. კალკულატორი აჩვენებს სავარაუდო ოვულაციას და ექვსდღიან ნაყოფიერ ფანჯარას.",
    chips: ["ლუთეალური ფაზა ~14 დღე", "არ არის კონტრაცეფცია", "ბრაუზერში რჩება"],
    related: ["cycle", "period", "pregnancy-test"],
  },
  {
    slug: "period",
    tone: "cycle",
    icon: "calendar",
    group: "cycle",
    title: "მენსტრუაციის კალკულატორი",
    short: "შემდეგი პერიოდის თარიღი და მომავალი ციკლების ორიენტირი.",
    description:
      "გამოთვალე შემდეგი მენსტრუაცია ბოლო პერიოდის თარიღით და ციკლის სიგრძით. Medicard.GE კალკულატორი — ქართულად, ბრაუზერში.",
    lead: "ბოლო პერიოდის დასაწყისი, ციკლის სიგრძე და სისხლდენის ხანგრძლივობა — და ნახე მომავალი რამდენიმე ციკლის ორიენტირი.",
    chips: ["რეგულარული ციკლი", "6 ციკლის პროგნოზი", "ბრაუზერში რჩება"],
    related: ["cycle", "ovulation", "pregnancy-test"],
  },
  {
    slug: "cycle",
    tone: "cycle",
    icon: "cycle",
    group: "cycle",
    title: "ციკლის კალკულატორი",
    short: "დღევანდელი ფაზა, ოვულაცია, ნაყოფიერი ფანჯარა და შემდეგი პერიოდი.",
    description:
      "გაიგე, ციკლის რომელ ფაზაში ხარ: მენსტრუაცია, ფოლიკულური, ოვულაცია თუ ლუთეალური. Medicard.GE.",
    lead: "ერთი ციკლის სურათი: რომელი დღეა დღეს, როდის არის ნაყოფიერი ფანჯარა და როდის სავარაუდო შემდეგი პერიოდი.",
    chips: ["ფაზები", "ნაყოფიერი ფანჯარა", "აპში უფრო ზუსტია"],
    related: ["ovulation", "period", "implantation"],
  },
  {
    slug: "pregnancy-test",
    tone: "cycle",
    icon: "flask",
    group: "cycle",
    title: "ორსულობის ტესტის კალკულატორი",
    short: "როდის აქვს შარდის ტესტს საუკეთესო შანსი — გაცდენილ პერიოდამდე და შემდეგ.",
    description:
      "გაიგე, როდის ღირს ორსულობის ტესტის გაკეთება ოვულაციის ან ბოლო პერიოდის მიხედვით. Medicard.GE.",
    lead: "hCG იმპლანტაციის შემდეგ იმატებს. ტესტი უფრო სანდოა გაცდენილი პერიოდის დღეს ან მის შემდეგ — არა ოვულაციის მეორე დღეს.",
    chips: ["2-კვირიანი ლოდინი", "hCG", "ბრაუზერში რჩება"],
    related: ["implantation", "ovulation", "hcg"],
  },
  {
    slug: "implantation",
    tone: "cycle",
    icon: "health",
    group: "cycle",
    title: "იმპლანტაციის კალკულატორი",
    short: "სავარაუდო 6–10 დღიანი ფანჯარა ოვულაციის შემდეგ.",
    description:
      "გამოთვალე, როდის შეიძლება მოხდეს იმპლანტაცია ოვულაციიდან 6–10 დღეში. Medicard.GE.",
    lead: "განაყოფიერებული კვერცხუჯრედი საშვილოსნოს გარსს ჩვეულებრივ ოვულაციიდან 6–10 დღეში ემაგრება. აქედან იწყება hCG-ის მატება.",
    chips: ["6–10 დღე", "არ ადასტურებს ორსულობას", "ბრაუზერში რჩება"],
    related: ["pregnancy-test", "ovulation", "hcg"],
  },
  {
    slug: "weeks-to-months",
    tone: "pregnancy",
    icon: "calendar",
    group: "pregnancy",
    title: "კვირები თვეებში",
    short: "რომელ თვესა და ტრიმესტრში ხარ 40-კვირიანი ორსულობის მიხედვით.",
    description:
      "გადაიყვანე ორსულობის კვირები თვეებსა და ტრიმესტრში. Medicard.GE — 40-კვირიანი კალენდარი.",
    lead: "ექიმები კვირებით საუბრობენ. ახლობლები თვეებს ეკითხებიან. ეს ცხრილი ორივეს აკავშირებს — მიახლოებით, 40-კვირიან კალენდარზე.",
    chips: ["40 კვირა", "3 ტრიმესტრი", "9 თვე"],
    related: ["due-date", "ultrasound", "ivf"],
  },
  {
    slug: "due-date",
    tone: "pregnancy",
    icon: "calendar",
    group: "pregnancy",
    title: "მშობიარობის თარიღი",
    short: "Naegele-ს წესი: ბოლო პერიოდი + 280 დღე, ციკლის სიგრძის კორექციით.",
    description:
      "გამოთვალე სავარაუდო მშობიარობის თარიღი ბოლო მენსტრუაციის პირველი დღით. Medicard.GE.",
    lead: "ვადა ითვლება ბოლო პერიოდის პირველი დღიდან 280 დღე. თუ ციკლი 28 დღეზე გრძელია ან მოკლე, ოვულაცია იცვლება — და ვადაც.",
    chips: ["LMP + 280 დღე", "ციკლის კორექცია", "ულტრაბგერა უფრო ზუსტია"],
    related: ["ultrasound", "weeks-to-months", "ivf"],
  },
  {
    slug: "ivf",
    tone: "pregnancy",
    icon: "flask",
    group: "pregnancy",
    title: "IVF და FET თარიღი",
    short: "ვადა ემბრიონის ასაკით: აღება, 3-დღიანი ან 5/6-დღიანი ტრანსფერი.",
    description:
      "გამოთვალე IVF ან FET ორსულობის სავარაუდო ვადა ტრანსფერის თარიღით და ემბრიონის ასაკით. Medicard.GE.",
    lead: "IVF-ზე განაყოფიერების დღე ცნობილია. ვადა = ტრანსფერი + (266 − ემბრიონის ასაკი დღეებში). 5-დღიანი ბლასტოცისტი = ტრანსფერი + 261 დღე.",
    chips: ["Day 3 / Day 5 / Day 6", "კვერცხუჯრედის აღება", "FET"],
    related: ["due-date", "ultrasound", "weeks-to-months"],
  },
  {
    slug: "ultrasound",
    tone: "pregnancy",
    icon: "health",
    group: "pregnancy",
    title: "ულტრაბგერითი თარიღი",
    short: "EDD სკანის თარიღით და იმ დღის გესტაციური ასაკით.",
    description:
      "გამოთვალე მშობიარობის თარიღი ულტრაბგერის თარიღით და სკანზე მითითებული კვირებით. Medicard.GE.",
    lead: "სკანის დღეს ნაყოფის ასაკი უკვე დათვლილია. ვადა = სკანის თარიღი + (280 − იმ დღის დღეები). პირველი ტრიმესტრის CRL ყველაზე საიმედოა.",
    chips: ["ACOG 280 დღე", "პირველი ტრიმესტრი", "ბრაუზერში რჩება"],
    related: ["due-date", "weeks-to-months", "ivf"],
  },
  {
    slug: "hcg",
    tone: "pregnancy",
    icon: "flask",
    group: "pregnancy",
    title: "hCG კალკულატორი",
    short: "ორი ბეტა-hCG მნიშვნელობით გაორმაგების დრო და ადრეული ორიენტირი.",
    description:
      "გამოთვალე ბეტა-hCG-ის გაორმაგების დრო ორ ანალიზს შორის. Medicard.GE — არ ცვლის ექიმის ინტერპრეტაციას.",
    lead: "ადრეულ ორსულობაში hCG ხშირად 48–72 საათში ორმაგდება. შეიყვანე ორი შედეგი და თარიღი — ნახე ფარდობა და სავარაუდო შემდეგი დიაპაზონი.",
    chips: ["ბეტა-hCG", "48–72 საათი", "არ არის დიაგნოზი"],
    related: ["pregnancy-test", "implantation", "due-date"],
  },
];

const BY_SLUG = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function nav(current) {
  const item = (href, label, icon, key) =>
    `<a href="${href}"${current === key ? ' aria-current="page"' : ""}><span class="ic ic-${icon}" aria-hidden="true"></span>${label}</a>`;
  return `<nav class="nav-links" aria-label="მენიუ">
        ${item("/", "მთავარი გვერდი", "house", "home")}
        ${item("/#how", "Medi", "chat")}
        ${item("/#features", "ფუნქციები", "health")}
        ${item("/calculators", "კალკულატორები", "calc", "calculators")}
        ${item("/#plans", "გეგმები", "wallet")}
        <a class="nav-download" href="/#download"><span class="ic ic-download" aria-hidden="true"></span>ჩამოტვირთვა</a>
      </nav>`;
}

function chrome(page, body) {
  return `<!DOCTYPE html>
<html lang="ka" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)} — მედიქარდი</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <link rel="canonical" href="https://medicard.ge${page.path}" />
  <meta name="theme-color" content="#f3f5f6" />
  <script>
    (function () {
      try {
        var t = localStorage.getItem("medicard.landing.theme");
        if (t !== "light" && t !== "dark") {
          t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        document.documentElement.dataset.theme = t;
        document.documentElement.style.colorScheme = t;
      } catch (e) {}
    })();
  </script>
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="ka_GE" />
  <meta property="og:url" content="https://medicard.ge${page.path}" />
  <meta property="og:title" content="${escapeHtml(page.title)} — მედიქარდი" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:image" content="https://medicard.ge/screens/home.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/icon.png" />
  <link rel="preload" href="/fonts/firago/FiraGO-Regular.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/davit-guramishvili/DM-Davit-Guramishvili.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="${CSS}" />
  <link rel="stylesheet" href="${CALC_CSS}" />
</head>
<body>
  <header class="nav">
    <div class="wrap nav-inner">
      <a class="brand" href="/">
        <img src="/icon.png" width="36" height="36" alt="" />
        მედიქარდი
      </a>
      ${nav(page.current)}
      <div class="nav-actions">
        <button class="theme-btn" id="theme-toggle" type="button" aria-pressed="false" aria-label="გადართე მუქ თემაზე">
          <span class="ic ic-moon icon-moon" aria-hidden="true"></span>
          <span class="ic ic-sun icon-sun" aria-hidden="true"></span>
        </button>
        <button class="menu-btn" id="menu-toggle" type="button" aria-label="მენიუ" aria-expanded="false">
          <span class="ic ic-menu" aria-hidden="true"></span>
        </button>
        <a class="btn btn-cta" href="/#download"><span class="ic ic-download" aria-hidden="true"></span>ჩამოტვირთვა</a>
      </div>
    </div>
  </header>
  <main>
${body}
  </main>
  <footer class="band-paper">
    <div class="wrap">
      <div class="disclaimer" id="disclaimer"><strong>ეს არ არის საბოლოო დიაგნოზი.</strong>
          კალკულატორები, Medi და აპის ანალიზები ეხმარება გაგებაში, მაგრამ არ ცვლის ექიმის კონსულტაციას,
          დანიშნულებას ან სასწრაფო დახმარებას. ციკლის პროგნოზი არ არის კონტრაცეფცია. თუ მდგომარეობა მძიმეა — მიმართე სპეციალისტს ან 112-ს.</div>
      <div class="foot-top">
        <div>
          <a class="brand" href="/">
            <img src="/icon.png" width="36" height="36" alt="" />
            მედიქარდი
          </a>
          <p class="foot-note">Medicard.GE · მხოლოდ iOS და Android</p>
        </div>
        <a class="foot-mail" href="mailto:support@medicard.ge">support@medicard.ge</a>
        <p class="foot-note">ანგარიში, ჩატი და ციკლი მხოლოდ ტელეფონზეა.</p>
      </div>
      <div class="foot-legal">
        <p>© <span id="y"></span> Medicard.GE</p>
        <p>
          <a href="/calculators">კალკულატორები</a>
          · <a href="/privacy">კონფიდენციალურობა</a>
          · <a href="/terms">წესები</a>
          · <a href="#disclaimer">პასუხისმგებლობა</a>
        </p>
      </div>
    </div>
  </footer>
  <script src="/landing.js?v=16"></script>
  ${page.module ? `<script type="module" src="${JS}"></script>` : ""}
</body>
</html>
`;
}

function dateField(name, label) {
  return `<div class="calc-field">
          <label for="${name}">${label}</label>
          <input id="${name}" name="${name}" type="date" required />
        </div>`;
}

function stepper(name, label, min, max, value, suffix, required = true) {
  return `<div class="calc-field">
          <span class="lbl">${label}${suffix ? ` (${suffix})` : ""}</span>
          <div class="calc-stepper">
            <button type="button" data-step="-1" aria-label="შემცირება">−</button>
            <input id="${name}" name="${name}" type="number" min="${min}" max="${max}" value="${value}"${required ? " required" : ""} />
            <button type="button" data-step="1" aria-label="გაზრდა">+</button>
          </div>
        </div>`;
}

function seg(name, options) {
  return `<div class="calc-field">
          <span class="lbl">რითი ვითვლით</span>
          <div class="calc-seg">
            ${options
              .map(
                ([value, label], i) =>
                  `<label><input type="radio" name="${name}" value="${value}"${i === 0 ? " checked" : ""} />${label}</label>`,
              )
              .join("")}
          </div>
        </div>`;
}

function actions() {
  return `<div class="calc-actions">
          <button class="btn btn-cta" type="submit">გამოთვლა</button>
          <button class="btn btn-ghost" type="button" data-reset>თავიდან</button>
        </div>
        <p class="calc-note">შედეგი არის ორიენტირი. არ ცვლის ექიმს, ულტრაბგერას ან ლაბორატორიას.</p>`;
}

const FORMS = {
  ovulation: () =>
    `${dateField("lmp", "ბოლო პერიოდის პირველი დღე")}
        ${stepper("cycleLength", "საშუალო ციკლი", 21, 45, 28, "დღე")}
        ${actions()}`,
  period: () =>
    `${dateField("lmp", "ბოლო პერიოდის პირველი დღე")}
        ${stepper("cycleLength", "საშუალო ციკლი", 21, 45, 28, "დღე")}
        ${stepper("periodLength", "სისხლდენის ხანგრძლივობა", 2, 10, 5, "დღე")}
        ${actions()}`,
  cycle: () => FORMS.period(),
  "pregnancy-test": () =>
    `${seg("mode", [
      ["lmp", "ბოლო პერიოდი"],
      ["ovulation", "ოვულაცია"],
    ])}
        ${dateField("date", "თარიღი")}
        <div data-if="lmp">${stepper("cycleLength", "საშუალო ციკლი", 21, 45, 28, "დღე")}</div>
        ${actions()}`,
  implantation: () => FORMS["pregnancy-test"](),
  "weeks-to-months": () =>
    `${stepper("weeks", "კვირა", 1, 42, 12)}
        ${stepper("days", "დღე", 0, 6, 0)}
        ${actions()}`,
  "due-date": () =>
    `${dateField("lmp", "ბოლო პერიოდის პირველი დღე")}
        ${stepper("cycleLength", "საშუალო ციკლი", 21, 45, 28, "დღე")}
        ${actions()}`,
  ivf: () =>
    `${dateField("transfer", "ტრანსფერის ან აღების თარიღი")}
        <div class="calc-field">
          <span class="lbl">ემბრიონის ასაკი</span>
          <div class="calc-seg" data-cols="4">
            <label><input type="radio" name="type" value="retrieval" />კვერცხუჯრედის აღება</label>
            <label><input type="radio" name="type" value="day3" />3-დღიანი</label>
            <label><input type="radio" name="type" value="day5" checked />5-დღიანი</label>
            <label><input type="radio" name="type" value="day6" />6-დღიანი</label>
          </div>
        </div>
        ${actions()}`,
  ultrasound: () =>
    `${dateField("scan", "სკანის თარიღი")}
        ${stepper("weeks", "კვირა სკანზე", 4, 42, 8)}
        ${stepper("days", "დღე სკანზე", 0, 6, 0)}
        ${actions()}`,
  hcg: () =>
    `${dateField("date1", "პირველი ანალიზის თარიღი")}
        <div class="calc-field">
          <label for="value1">პირველი hCG (mIU/ml)</label>
          <input id="value1" name="value1" type="number" min="1" step="0.1" required />
        </div>
        ${dateField("date2", "მეორე ანალიზის თარიღი")}
        <div class="calc-field">
          <label for="value2">მეორე hCG (mIU/ml)</label>
          <input id="value2" name="value2" type="number" min="1" step="0.1" required />
        </div>
        ${stepper("week", "გესტაციური კვირა (არასავალდებულო)", 3, 20, 5, "", false)}
        ${actions()}`,
};

const ARTICLES = {
  ovulation: `
        <h2>როგორ ითვლება ოვულაცია</h2>
        <p>ოვულაცია ჩვეულებრივ ხდება შემდეგ პერიოდამდე დაახლოებით 14 დღით ადრე — ეს არის საშუალო ლუთეალური ფაზა. 28-დღიან ციკლში ეს დაახლოებით ციკლის შუაა. 32-დღიანში — უფრო გვიან.</p>
        <p>ნაყოფიერი ფანჯარა მოიცავს ოვულაციამდე 5 დღეს და ოვულაციის მეორე დღესაც: სპერმა შეიძლება 5 დღემდე იცოცხლოს, კვერცხუჯრედი კი დაახლოებით ერთი დღე.</p>
        <h3>რა ცვლის თარიღს</h3>
        <ul>
          <li>ციკლის ცვალებადობა ციკლიდან ციკლამდე;</li>
          <li>სტრესი, ავადმყოფობა, მოგზაურობა, წონის ცვლა;</li>
          <li>OPK, BBT და საშვილოსნოს ყელის ლორწო უფრო ზუსტია, ვიდრე კალენდარი.</li>
        </ul>
        <p>Medicard აპში ციკლის ძრავი რამდენიმე ციკლის საშუალოს იყენებს. ეს გვერდი — ერთ ჩანაწერს.</p>`,
  period: `
        <h2>შემდეგი პერიოდის პროგნოზი</h2>
        <p>შემდეგი პერიოდი = ბოლო პერიოდის პირველი დღე + ციკლის სიგრძე. 21–35 დღე ხშირად ნორმად ითვლება, მაგრამ „ნორმა“ შენი ისტორიაა, არა აუცილებლად 28.</p>
        <p>თუ ციკლი ძალიან არარეგულარულია, კალენდარი მხოლოდ ფანჯარას აჩვენებს. აპში აღრიცხვა უფრო სასარგებლოა, ვიდრე ერთი საშუალო.</p>
        <h3>როდის მიმართო ექიმს</h3>
        <ul>
          <li>პერიოდი მოულოდნელად გაქრა და ორსულობის ტესტი უარყოფითია;</li>
          <li>სისხლდენა ძალიან ძლიერია ან 7–10 დღეზე მეტხანს გრძელდება;</li>
          <li>ციკლები მუდმივად 21 დღეზე მოკლეა ან 35-ზე გრძელი.</li>
        </ul>`,
  cycle: `
        <h2>ციკლის ფაზები</h2>
        <p>ციკლი იწყება პერიოდის პირველი დღით. ფოლიკულურ ფაზაში იზრდება ფოლიკული. ოვულაციისას გამოდის კვერცხუჯრედი. ლუთეალურ ფაზაში პროგესტერონი ამზადებს საშვილოსნოს — თუ ორსულობა არ დადგა, ჰორმონები ეცემა და იწყება ახალი პერიოდი.</p>
        <p>ფაზების სიგრძე ყველას ერთნაირი არაა. განსაკუთრებით ფოლიკულური ფაზა იცვლება. ამიტომ აპის პროგნოზი შენს აღრიცხვას ეყრდნობა, არა მხოლოდ 28-დღიან მითს.</p>`,
  "pregnancy-test": `
        <h2>როდის გააკეთო ტესტი</h2>
        <p>შარდის ტესტი ეძებს hCG-ს. ჰორმონი იმპლანტაციის შემდეგ ჩნდება, პიკს კი დაახლოებით 8–10 კვირაზე აღწევს. ამიტომ ოვულაციის მეორე დღეს ტესტი თითქმის ყოველთვის ადრეა.</p>
        <p>ყველაზე სანდო დროა გაცდენილი პერიოდის დღე. კიდევ ერთი კვირა სიზუსტეს ზრდის. სისხლის ანალიზი უფრო ადრე იჭერს hCG-ს, მაგრამ მას ექიმი კითხულობს.</p>
        <h3>ცრუ შედეგი</h3>
        <ul>
          <li>ცრუ-უარყოფითი — ტესტი ადრეა, შარდი განზავებულია, ან ოვულაცია გვიან იყო;</li>
          <li>ცრუ-დადებითი იშვიათია; ზოგი მედიკამენტი და ბოლო ორსულობა შეიძლება ჩაერიოს.</li>
        </ul>`,
  implantation: `
        <h2>რა არის იმპლანტაცია</h2>
        <p>ოვულაციის შემდეგ კვერცხუჯრედი ფალოპის მილში შეიძლება განაყოფიერდეს. შემდეგ ის საშვილოსნოსკენ მიემართება და გარსს ემაგრება. ეს ჩვეულებრივ 6–10 დღეა ოვულაციიდან.</p>
        <p>ზოგს აქვს მცირე სისხლდენა ან ჩხვლეტა — ბევრს არა. არც ერთი სიმპტომი არ ადასტურებს იმპლანტაციას. ამას აჩვენებს ტესტი და ექიმი.</p>`,
  "weeks-to-months": `
        <h2>რატომ კვირები და არა თვეები</h2>
        <p>გესტაციური ასაკი ითვლება ბოლო პერიოდის პირველი დღიდან. პირველი ორი კვირა ტექნიკურად ჯერ ორსულობა არ არის — ამ დროს ხდება ოვულაცია და ჩასახვა.</p>
        <p>თვე საშუალოდ 4 კვირაზე მეტია. ამიტომ „მეხუთე თვე“ ხშირად 18–22 კვირაა, არა ზუსტად 20. ტრიმესტრები: 1–13, 14–27, 28–40+.</p>
        <ul>
          <li>ნაადრევი — 37 კვირამდე;</li>
          <li>სრული ვადა — დაახლოებით 39–40 კვირა 6 დღე;</li>
          <li>გადაცილებული — 42 კვირიდან.</li>
        </ul>`,
  "due-date": `
        <h2>Naegele-ს წესი</h2>
        <p>კლასიკური ვადა: ბოლო პერიოდის პირველი დღე + 280 დღე (40 კვირა). ეს ითვალისწინებს 28-დღიან ციკლს და ოვულაციას მე-14 დღეს.</p>
        <p>თუ ციკლი 32 დღეა, ოვულაცია დაახლოებით 4 დღით გვიანაა — ვადასაც 4 დღეს ვუმატებთ. არარეგულარული ციკლისას ულტრაბგერა სჯობს კალენდარს.</p>
        <p>მხოლოდ დაახლოებით 1 ბავშვი 20-დან იბადება ზუსტად ვადაზე. უმეტესობა — ორ კვირიან ფანჯარაში.</p>`,
  ivf: `
        <h2>IVF და FET როგორ ითვლება</h2>
        <p>ბუნებრივ ორსულობაში ჩასახვის დღე ზუსტად არ იცის. IVF-ზე იცი, როდის მოხდა განაყოფიერება.</p>
        <ul>
          <li>კვერცხუჯრედის აღება: ვადა = აღება + 266 დღე;</li>
          <li>3-დღიანი ემბრიონი: ტრანსფერი + 263 დღე;</li>
          <li>5-დღიანი ბლასტოცისტი: ტრანსფერი + 261 დღე;</li>
          <li>6-დღიანი: ტრანსფერი + 260 დღე.</li>
        </ul>
        <p>FET იგივე ასაკის წესს იყენებს. კლინიკის თარიღი რჩება მთავარ წყაროდ.</p>`,
  ultrasound: `
        <h2>რატომ ცვლის სკანი თარიღს</h2>
        <p>პირველ ტრიმესტრში ნაყოფის სიგრძე (CRL) ყველაზე ზუსტად აჩვენებს ასაკს. თუ სკანის ასაკი LMP-ისგან მეტად განსხვავდება, ექიმი ხშირად სკანს ანიჭებს უპირატესობას.</p>
        <p>ამ კალკულატორში შეიყვან სკანის თარიღს და იმ დღის კვირებს/დღეებს. ვადა = 40 კვირა ამ წერტილიდან.</p>
        <p>22 კვირის შემდეგ დათარიღება ნაკლებად ზუსტია. ერთხელ დადგენილი EDD ჩვეულებრივ აღარ იცვლება ყოველ სკანზე.</p>`,
  hcg: `
        <h2>რას ნიშნავს გაორმაგება</h2>
        <p>იმპლანტაციის შემდეგ hCG იმატებს. ადრეულ კვირებში ხშირად ორმაგდება 48–72 საათში. მოგვიანებით მატება ნელდება და პიკს დაახლოებით 8–10 კვირაზე აღწევს.</p>
        <p>ერთი რიცხვი თითქმის არაფერს ამბობს — დიაპაზონი კვირის მიხედვით ძალიან ფართოა. ორი ანალიზი ერთსა და იმავე ლაბში უფრო სასარგებლოა.</p>
        <ul>
          <li>კლება ან ძალიან ნელი მატება — ექიმთან;</li>
          <li>სწრაფი მატება შეიძლება ნორმა იყოს, მათ შორის მრავალნაყოფიან ორსულობაში;</li>
          <li>ულტრაბგერა ადასტურებს საშვილოსნოსშიდა ორსულობას, არა მხოლოდ hCG.</li>
        </ul>`,
};

function relatedBlock(slugs) {
  return `<div class="calc-related">${slugs
    .map((slug) => {
      const t = BY_SLUG[slug];
      return `<a href="/calculators/${t.slug}"><small>კალკულატორი</small><b>${escapeHtml(t.title)}</b></a>`;
    })
    .join("")}</div>`;
}

function toolPage(tool) {
  const crumbs = `<p class="calc-crumb"><a href="/">მთავარი</a> / <a href="/calculators">კალკულატორები</a> / ${escapeHtml(tool.title)}</p>`;
  const chips = tool.chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join("");
  const body = `    <section class="calc-hero band-dark">
      <div class="wrap">
        ${crumbs}
        <p class="kicker">${tool.group === "cycle" ? "ციკლი" : "ორსულობა"}</p>
        <h1>${escapeHtml(tool.title)}</h1>
        <p class="lead">${escapeHtml(tool.lead)}</p>
        <div class="chips">${chips}</div>
      </div>
    </section>
    <section class="calc-stage band-paper">
      <div class="wrap calc-layout">
        <form class="calc-card" data-calc="${tool.slug}" novalidate autocomplete="off">
          <h2>გამოთვლა</h2>
          ${FORMS[tool.slug]()}
        </form>
        <div class="calc-result" data-result></div>
      </div>
    </section>
    <section class="calc-article band-paper">
      <div class="wrap">
        ${ARTICLES[tool.slug]}
        <h2>სხვა კალკულატორები</h2>
        ${relatedBlock(tool.related)}
      </div>
    </section>`;
  return chrome(
    {
      title: tool.title,
      description: tool.description,
      path: `/calculators/${tool.slug}`,
      current: "calculators",
      module: true,
    },
    body,
  );
}

function hubPage() {
  const group = (id, title, note) => {
    const tiles = TOOLS.filter((t) => t.group === id)
      .map(
        (t) => `<a class="calc-tile" data-tone="${t.tone}" href="/calculators/${t.slug}">
            <div class="icon"><span class="ic ic-lg ic-${t.icon}" aria-hidden="true"></span></div>
            <h3>${escapeHtml(t.title)}</h3>
            <p>${escapeHtml(t.short)}</p>
            <span class="calc-tile-go">გამოთვლა →</span>
          </a>`,
      )
      .join("");
    return `<div class="calc-group">
          <div class="calc-group-head">
            <h2>${title}</h2>
            <p>${note}</p>
          </div>
          <div class="calc-grid">${tiles}</div>
        </div>`;
  };

  const body = `    <section class="calc-hero band-dark">
      <div class="wrap">
        <p class="calc-crumb"><a href="/">მთავარი</a> / კალკულატორები</p>
        <p class="kicker">10 უფასო ინსტრუმენტი</p>
        <h1>ციკლისა და ორსულობის კალკულატორები</h1>
        <p class="lead">ოვულაცია, პერიოდი, ტესტი, იმპლანტაცია, ვადა, IVF, ულტრაბგერა და hCG — ქართულად, Medicard-ის ესთეტიკით. ყველა გამოთვლა რჩება შენს ბრაუზერში.</p>
        <div class="chips">
          <span class="chip">არ იგზავნება სერვერზე</span>
          <span class="chip">არ ცვლის ექიმს</span>
          <span class="chip">არ არის კონტრაცეფცია</span>
        </div>
      </div>
    </section>
    <section class="calc-hub band-paper">
      <div class="wrap">
        ${group("cycle", "ციკლი", "5 კალკულატორი")}
        ${group("pregnancy", "ორსულობა", "5 კალკულატორი")}
      </div>
    </section>
    <section class="calc-article band-paper">
      <div class="wrap">
        <h2>როგორ ვითვლით</h2>
        <p>ოვულაცია ≈ შემდეგი პერიოდი − 14 დღე. ნაყოფიერი ფანჯარა ≈ ოვულაცია − 5 დღე … +1. ორსულობის ვადა = LMP + 280 დღე, ან სკანის/IVF წესები. hCG გაორმაგება ითვლება ორ მნიშვნელობას შორის ლოგარითმით.</p>
        <p>ეს იგივე სამედიცინო ორიენტირებია, რასაც კლინიკური კალკულატორები იყენებენ. შედეგი არის შეფასება. ორსულობის დასადასტურებლად და დასათარიღებლად საჭიროა ექიმი და ულტრაბგერა.</p>
        <p>სრული ციკლის აღრიცხვა, სიმპტომები და Medi — მხოლოდ აპში.</p>
      </div>
    </section>`;
  return chrome(
    {
      title: "კალკულატორები",
      description:
        "Medicard.GE ციკლისა და ორსულობის კალკულატორები: ოვულაცია, პერიოდი, ტესტი, იმპლანტაცია, ვადა, IVF, ულტრაბგერა და hCG.",
      path: "/calculators",
      current: "calculators",
      module: false,
    },
    body,
  );
}

await mkdir(OUT, { recursive: true });
await writeFile(path.join(OUT, "index.html"), hubPage());
for (const tool of TOOLS) {
  await writeFile(path.join(OUT, `${tool.slug}.html`), toolPage(tool));
}
console.log(`wrote ${TOOLS.length + 1} calculator pages → ${OUT}`);
