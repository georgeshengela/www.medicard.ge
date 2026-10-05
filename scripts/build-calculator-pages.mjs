import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SITE_STYLES, SITE_HEADER, siteFooter, DISCLAIMER_CALC, enAttr } from "./site-chrome.mjs";

// Georgian is written in the page; English rides along as data-en* attributes
// (server/public/site-i18n.js swaps them in for ?lang=en / the ქა | EN switch).

const root = fileURLToPath(new URL("..", import.meta.url));
const OUT = path.join(root, "server/public/calculators");
const CSS = "/landing.css?v=39";
const CALC_CSS = "/calculators.css?v=2";
const JS = "/calculators.js?v=3";
const LANDING_JS = "/landing.js?v=17";

/** ` data-en="…"` (or data-en-html when the English carries our own markup); empty without English. */
function E(en) {
  if (!en) return "";
  return ` ${en.includes("<") ? "data-en-html" : "data-en"}="${enAttr(en)}"`;
}

/** Adds data-en to each <h2>/<h3>/<p>/<li> of an article, in document order. */
function bilingual(html, enList, name) {
  let i = 0;
  const out = html.replace(/<(h2|h3|p|li)>/g, (_, tag) => `<${tag}${E(enList[i++])}>`);
  if (i !== enList.length) throw new Error(`${name}: ${i} blocks but ${enList.length} English strings`);
  return out;
}

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

// English for TOOLS (chips: null = the chip is already language-neutral).
const TOOLS_EN = {
  ovulation: {
    title: "Ovulation calculator",
    short: "Estimated ovulation and fertile window from your last period and cycle length.",
    description:
      "Estimate ovulation and your fertile window from the first day of your last period. Medicard.GE — runs only in your browser and doesn't replace a doctor.",
    lead: "Enter the first day of your last period and your average cycle. The calculator shows your estimated ovulation and six-day fertile window.",
    chips: ["Luteal phase ~14 days", "Not contraception", "Stays in your browser"],
  },
  period: {
    title: "Period calculator",
    short: "Your next period date and a guide to the cycles ahead.",
    description:
      "Work out your next period from the date of your last period and your cycle length. A Medicard.GE calculator that runs in your browser.",
    lead: "Enter when your last period started, your cycle length and how long you bleed — and see a guide to your next few cycles.",
    chips: ["Regular cycle", "6-cycle forecast", "Stays in your browser"],
  },
  cycle: {
    title: "Cycle calculator",
    short: "Today's phase, ovulation, fertile window and next period.",
    description: "Find out which phase of your cycle you're in: period, follicular, ovulation or luteal. Medicard.GE.",
    lead: "A picture of one cycle: which cycle day it is today, when your fertile window is and when your next period is likely.",
    chips: ["Phases", "Fertile window", "More accurate in the app"],
  },
  "pregnancy-test": {
    title: "Pregnancy test calculator",
    short: "When a urine test has the best chance — before and after a missed period.",
    description:
      "Find out when it's worth taking a pregnancy test, based on ovulation or your last period. Medicard.GE.",
    lead: "hCG rises after implantation. A test is more reliable on the day of your missed period or later — not the day after ovulation.",
    chips: ["Two-week wait", null, "Stays in your browser"],
  },
  implantation: {
    title: "Implantation calculator",
    short: "The estimated 6–10 day window after ovulation.",
    description: "Estimate when implantation may happen, 6–10 days after ovulation. Medicard.GE.",
    lead: "A fertilized egg usually attaches to the lining of the uterus 6–10 days after ovulation. That's when hCG starts to rise.",
    chips: ["6–10 days", "Doesn't confirm pregnancy", "Stays in your browser"],
  },
  "weeks-to-months": {
    title: "Weeks to months",
    short: "Which month and trimester you're in, based on a 40-week pregnancy.",
    description: "Convert pregnancy weeks into months and trimesters. Medicard.GE — a 40-week calendar.",
    lead: "Doctors talk in weeks. Family and friends ask in months. This chart connects the two — approximately, on a 40-week calendar.",
    chips: ["40 weeks", "3 trimesters", "9 months"],
  },
  "due-date": {
    title: "Due date calculator",
    short: "Naegele's rule: last period + 280 days, adjusted for cycle length.",
    description: "Estimate your due date from the first day of your last period. Medicard.GE.",
    lead: "Your due date is 280 days from the first day of your last period. If your cycle is longer or shorter than 28 days, ovulation shifts — and so does the due date.",
    chips: ["LMP + 280 days", "Cycle adjustment", "Ultrasound is more accurate"],
  },
  ivf: {
    title: "IVF and FET due date",
    short: "Due date by embryo age: egg retrieval, day-3 or day-5/6 transfer.",
    description: "Estimate your IVF or FET due date from the transfer date and embryo age. Medicard.GE.",
    lead: "With IVF, the day of fertilization is known. Due date = transfer + (266 − embryo age in days). Day-5 blastocyst = transfer + 261 days.",
    chips: [null, "Egg retrieval", null],
  },
  ultrasound: {
    title: "Ultrasound due date",
    short: "Due date (EDD) from the scan date and the gestational age on that day.",
    description: "Estimate your due date from the ultrasound date and the weeks given at the scan. Medicard.GE.",
    lead: "On the day of the scan, the baby's age has already been measured. Due date = scan date + (280 − gestational age in days on that day). A first-trimester CRL is the most reliable.",
    chips: ["ACOG 280 days", "First trimester", "Stays in your browser"],
  },
  hcg: {
    title: "hCG calculator",
    short: "Doubling time and an early guide from two beta-hCG values.",
    description:
      "Calculate beta-hCG doubling time between two blood tests. Medicard.GE — doesn't replace your doctor's interpretation.",
    lead: "In early pregnancy, hCG often doubles every 48–72 hours. Enter two results and their dates — see the ratio and the likely next range.",
    chips: ["Beta-hCG", "48–72 hours", "Not a diagnosis"],
  },
};
for (const t of TOOLS) t.en = TOOLS_EN[t.slug];

const BY_SLUG = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chrome(page, body) {
  return `<!DOCTYPE html>
<html lang="ka" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="/site-i18n.js?v=2"></script>
  <title data-en="${enAttr(page.titleEn)} — MEDICARD">${escapeHtml(page.title)} — მედიქარდი</title>
  <meta name="description" content="${escapeHtml(page.description)}" data-en-content="${enAttr(page.descriptionEn)}" />
  <link rel="canonical" href="https://medicard.ge${page.path}" />
  <link rel="alternate" hreflang="ka" href="https://medicard.ge${page.path}" />
  <link rel="alternate" hreflang="en" href="https://medicard.ge${page.path}?lang=en" />
  <link rel="alternate" hreflang="x-default" href="https://medicard.ge${page.path}" />
  <meta name="theme-color" content="#E8F5F2" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="ka_GE" data-en-content="en_US" />
  <meta property="og:url" content="https://medicard.ge${page.path}" />
  <meta property="og:title" content="${escapeHtml(page.title)} — მედიქარდი" data-en-content="${enAttr(page.titleEn)} — MEDICARD" />
  <meta property="og:description" content="${escapeHtml(page.description)}" data-en-content="${enAttr(page.descriptionEn)}" />
  <meta property="og:image" content="https://medicard.ge/screens/home.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/icon.png" />
  <link rel="preload" href="/fonts/firago/FiraGO-Regular.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="${CSS}" />
  <link rel="stylesheet" href="${CALC_CSS}" />
${SITE_STYLES}
</head>
<body class="site-refresh">
${SITE_HEADER}
  <main>
${body}
  </main>
${siteFooter({ disclaimer: DISCLAIMER_CALC, current: page.current === "calculators" ? "/calculators" : "" })}
  <script src="${LANDING_JS}"></script>
  ${page.module ? `<script type="module" src="${JS}"></script>` : ""}
</body>
</html>
`;
}

function dateField(name, label, labelEn) {
  return `<div class="calc-field">
          <label for="${name}"${E(labelEn)}>${label}</label>
          <input id="${name}" name="${name}" type="date" required />
        </div>`;
}

/** labelEn is the full English label, suffix included ("Average cycle (days)"). */
function stepper(name, label, labelEn, min, max, value, suffix, required = true) {
  return `<div class="calc-field">
          <span class="lbl"${E(labelEn)}>${label}${suffix ? ` (${suffix})` : ""}</span>
          <div class="calc-stepper">
            <button type="button" data-step="-1" aria-label="შემცირება" data-en-aria-label="Decrease">−</button>
            <input id="${name}" name="${name}" type="number" min="${min}" max="${max}" value="${value}"${required ? " required" : ""} />
            <button type="button" data-step="1" aria-label="გაზრდა" data-en-aria-label="Increase">+</button>
          </div>
        </div>`;
}

/** Radio text sits in a span so site-i18n.js never rebuilds the input (its listeners stay). */
function radio(name, value, label, labelEn, checked) {
  return `<label><input type="radio" name="${name}" value="${value}"${checked ? " checked" : ""} /><span${E(labelEn)}>${label}</span></label>`;
}

function seg(name, options) {
  return `<div class="calc-field">
          <span class="lbl"${E("Calculate from")}>რითი ვითვლით</span>
          <div class="calc-seg">
            ${options.map(([value, label, labelEn], i) => radio(name, value, label, labelEn, i === 0)).join("")}
          </div>
        </div>`;
}

function actions() {
  return `<div class="calc-actions">
          <button class="btn btn-cta" type="submit"${E("Calculate")}>გამოთვლა</button>
          <button class="btn btn-ghost" type="button" data-reset${E("Start over")}>თავიდან</button>
        </div>
        <p class="calc-note"${E("The result is an estimate. It doesn't replace a doctor, an ultrasound or lab tests.")}>შედეგი არის ორიენტირი. არ ცვლის ექიმს, ულტრაბგერას ან ლაბორატორიას.</p>`;
}

const LMP = ["ბოლო პერიოდის პირველი დღე", "First day of your last period"];
const CYCLE = () => stepper("cycleLength", "საშუალო ციკლი", "Average cycle (days)", 21, 45, 28, "დღე");

const FORMS = {
  ovulation: () =>
    `${dateField("lmp", ...LMP)}
        ${CYCLE()}
        ${actions()}`,
  period: () =>
    `${dateField("lmp", ...LMP)}
        ${CYCLE()}
        ${stepper("periodLength", "სისხლდენის ხანგრძლივობა", "Period length (days)", 2, 10, 5, "დღე")}
        ${actions()}`,
  cycle: () => FORMS.period(),
  "pregnancy-test": () =>
    `${seg("mode", [
      ["lmp", "ბოლო პერიოდი", "Last period"],
      ["ovulation", "ოვულაცია", "Ovulation"],
    ])}
        ${dateField("date", "თარიღი", "Date")}
        <div data-if="lmp">${CYCLE()}</div>
        ${actions()}`,
  implantation: () => FORMS["pregnancy-test"](),
  "weeks-to-months": () =>
    `${stepper("weeks", "კვირა", "Weeks", 1, 42, 12)}
        ${stepper("days", "დღე", "Days", 0, 6, 0)}
        ${actions()}`,
  "due-date": () =>
    `${dateField("lmp", ...LMP)}
        ${CYCLE()}
        ${actions()}`,
  ivf: () =>
    `${dateField("transfer", "ტრანსფერის ან აღების თარიღი", "Embryo transfer or egg retrieval date")}
        <div class="calc-field">
          <span class="lbl"${E("Embryo age")}>ემბრიონის ასაკი</span>
          <div class="calc-seg" data-cols="4">
            ${radio("type", "retrieval", "კვერცხუჯრედის აღება", "Egg retrieval")}
            ${radio("type", "day3", "3-დღიანი", "Day 3")}
            ${radio("type", "day5", "5-დღიანი", "Day 5", true)}
            ${radio("type", "day6", "6-დღიანი", "Day 6")}
          </div>
        </div>
        ${actions()}`,
  ultrasound: () =>
    `${dateField("scan", "სკანის თარიღი", "Scan date")}
        ${stepper("weeks", "კვირა სკანზე", "Weeks at the scan", 4, 42, 8)}
        ${stepper("days", "დღე სკანზე", "Days at the scan", 0, 6, 0)}
        ${actions()}`,
  hcg: () =>
    `${dateField("date1", "პირველი ანალიზის თარიღი", "Date of the first test")}
        <div class="calc-field">
          <label for="value1"${E("First hCG (mIU/ml)")}>პირველი hCG (mIU/ml)</label>
          <input id="value1" name="value1" type="number" min="1" step="0.1" required />
        </div>
        ${dateField("date2", "მეორე ანალიზის თარიღი", "Date of the second test")}
        <div class="calc-field">
          <label for="value2"${E("Second hCG (mIU/ml)")}>მეორე hCG (mIU/ml)</label>
          <input id="value2" name="value2" type="number" min="1" step="0.1" required />
        </div>
        ${stepper("week", "გესტაციური კვირა (არასავალდებულო)", "Gestational week (optional)", 3, 20, 5, "", false)}
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

// English for ARTICLES: one string per <h2>/<h3>/<p>/<li>, in order.
const ARTICLES_EN = {
  ovulation: [
    "How ovulation is calculated",
    "Ovulation usually happens about 14 days before your next period — that's the average luteal phase. In a 28-day cycle, that's roughly mid-cycle. In a 32-day cycle, it's later.",
    "The fertile window covers the 5 days before ovulation and the day after it: sperm can live for up to 5 days, while the egg lives for about one day.",
    "What shifts the date",
    "Variation from one cycle to the next;",
    "Stress, illness, travel, weight change;",
    "Ovulation tests (OPKs), basal body temperature (BBT) and cervical mucus are more accurate than a calendar.",
    "In the Medicard app, the cycle engine uses the average of several cycles. This page uses a single entry.",
  ],
  period: [
    "Next period forecast",
    "Next period = first day of your last period + cycle length. 21–35 days is often considered normal, but your “normal” is your own history, not necessarily 28.",
    "If your cycle is very irregular, a calendar can only show a window. Tracking in the app is more useful than a single average.",
    "When to see a doctor",
    "Your periods suddenly stopped and a pregnancy test is negative;",
    "Bleeding is very heavy or lasts longer than 7–10 days;",
    "Your cycles are consistently shorter than 21 days or longer than 35.",
  ],
  cycle: [
    "Cycle phases",
    "A cycle starts on the first day of your period. In the follicular phase, a follicle grows. At ovulation, an egg is released. In the luteal phase, progesterone prepares the uterus — if pregnancy doesn't happen, hormone levels drop and a new period begins.",
    "Phase lengths aren't the same for everyone — the follicular phase varies the most. That's why the app's forecast relies on your own tracking, not just the 28-day myth.",
  ],
  "pregnancy-test": [
    "When to test",
    "A urine test looks for hCG. The hormone appears after implantation and peaks at around 8–10 weeks. So a test the day after ovulation is almost always too early.",
    "The most reliable time is the day of your missed period. Waiting another week improves accuracy. A blood test picks up hCG earlier, but it should be read by a doctor.",
    "False results",
    "False negative — testing too early, diluted urine, or late ovulation;",
    "False positives are rare; some medicines and a recent pregnancy can interfere.",
  ],
  implantation: [
    "What is implantation?",
    "After ovulation, the egg may be fertilized in the fallopian tube. It then travels to the uterus and attaches to the lining — usually 6–10 days after ovulation.",
    "Some people notice light spotting or cramping — many don't. No symptom confirms implantation. A test and a doctor can show that.",
  ],
  "weeks-to-months": [
    "Why weeks, not months",
    "Gestational age is counted from the first day of your last period. The first two weeks aren't technically pregnancy yet — that's when ovulation and conception happen.",
    "A month is a little more than 4 weeks on average. So “month five” is often weeks 18–22, not exactly week 20. Trimesters: weeks 1–13, 14–27 and 28–40+.",
    "Preterm — before 37 weeks;",
    "Full term — about 39 weeks to 40 weeks 6 days;",
    "Post-term — from 42 weeks.",
  ],
  "due-date": [
    "Naegele's rule",
    "The classic due date: first day of your last period + 280 days (40 weeks). This assumes a 28-day cycle with ovulation on day 14.",
    "If your cycle is 32 days, ovulation is about 4 days later — so we add 4 days to the due date too. With an irregular cycle, an ultrasound is better than the calendar.",
    "Only about 1 baby in 20 is born exactly on the due date. Most arrive within a two-week window.",
  ],
  ivf: [
    "How IVF and FET dates are calculated",
    "In a natural pregnancy, the exact day of conception isn't known. With IVF, you know when fertilization happened.",
    "Egg retrieval: due date = retrieval + 266 days;",
    "Day-3 embryo: transfer + 263 days;",
    "Day-5 blastocyst: transfer + 261 days;",
    "Day 6: transfer + 260 days.",
    "A frozen embryo transfer (FET) uses the same embryo-age rule. Your clinic's date remains the main source.",
  ],
  ultrasound: [
    "Why a scan changes the date",
    "In the first trimester, the baby's crown–rump length (CRL) shows gestational age most accurately. If the scan age differs a lot from the LMP date, doctors often go with the scan.",
    "In this calculator, you enter the scan date and the weeks/days measured on that day. Due date = 40 weeks counted from that point.",
    "Dating after 22 weeks is less accurate. Once set, the due date (EDD) usually isn't changed at every scan.",
  ],
  hcg: [
    "What doubling means",
    "hCG rises after implantation. In the early weeks, it often doubles within 48–72 hours. Later the rise slows, peaking at around 8–10 weeks.",
    "A single number says almost nothing — the range for each week is very wide. Two tests at the same lab are more useful.",
    "A fall or a very slow rise — see a doctor;",
    "A fast rise can be normal, including in a multiple pregnancy;",
    "An ultrasound confirms a pregnancy inside the uterus — hCG alone does not.",
  ],
};

function relatedBlock(slugs) {
  return `<div class="calc-related">${slugs
    .map((slug) => {
      const t = BY_SLUG[slug];
      return `<a href="/calculators/${t.slug}"><small${E("Calculator")}>კალკულატორი</small><b${E(t.en.title)}>${escapeHtml(t.title)}</b></a>`;
    })
    .join("")}</div>`;
}

function toolPage(tool) {
  const en = tool.en;
  const crumbEn = `<a href='/'>Home</a> / <a href='/calculators'>Calculators</a> / ${en.title}`;
  const crumbs = `<p class="calc-crumb"${E(crumbEn)}><a href="/">მთავარი</a> / <a href="/calculators"${E("Calculators")}>კალკულატორები</a> / ${escapeHtml(tool.title)}</p>`;
  const chips = tool.chips.map((c, i) => `<span class="chip"${E(en.chips[i])}>${escapeHtml(c)}</span>`).join("");
  const body = `    <section class="calc-hero band-dark">
      <div class="wrap">
        ${crumbs}
        <p class="kicker"${E(tool.group === "cycle" ? "Cycle" : "Pregnancy")}>${tool.group === "cycle" ? "ციკლი" : "ორსულობა"}</p>
        <h1${E(en.title)}>${escapeHtml(tool.title)}</h1>
        <p class="lead"${E(en.lead)}>${escapeHtml(tool.lead)}</p>
        <div class="chips">${chips}</div>
      </div>
    </section>
    <section class="calc-stage band-paper">
      <div class="wrap calc-layout">
        <form class="calc-card" data-calc="${tool.slug}" novalidate autocomplete="off">
          <h2${E("Calculate")}>გამოთვლა</h2>
          ${FORMS[tool.slug]()}
        </form>
        <div class="calc-result" data-result></div>
      </div>
    </section>
    <section class="calc-article band-paper">
      <div class="wrap">
        ${bilingual(ARTICLES[tool.slug], ARTICLES_EN[tool.slug], tool.slug)}
        <h2${E("More calculators")}>სხვა კალკულატორები</h2>
        ${relatedBlock(tool.related)}
      </div>
    </section>`;
  return chrome(
    {
      title: tool.title,
      titleEn: en.title,
      description: tool.description,
      descriptionEn: en.description,
      path: `/calculators/${tool.slug}`,
      current: "calculators",
      module: true,
    },
    body,
  );
}

function hubPage() {
  const group = (id, title, titleEn, note, noteEn) => {
    const tiles = TOOLS.filter((t) => t.group === id)
      .map(
        (t) => `<a class="calc-tile" data-tone="${t.tone}" href="/calculators/${t.slug}">
            <div class="icon"><span class="ic ic-lg ic-${t.icon}" aria-hidden="true"></span></div>
            <h3${E(t.en.title)}>${escapeHtml(t.title)}</h3>
            <p${E(t.en.short)}>${escapeHtml(t.short)}</p>
            <span class="calc-tile-go"${E("Calculate →")}>გამოთვლა →</span>
          </a>`,
      )
      .join("");
    return `<div class="calc-group">
          <div class="calc-group-head">
            <h2${E(titleEn)}>${title}</h2>
            <p${E(noteEn)}>${note}</p>
          </div>
          <div class="calc-grid">${tiles}</div>
        </div>`;
  };

  const body = `    <section class="calc-hero band-dark">
      <div class="wrap">
        <p class="calc-crumb"${E("<a href='/'>Home</a> / Calculators")}><a href="/">მთავარი</a> / კალკულატორები</p>
        <p class="kicker"${E("10 free tools")}>10 უფასო ინსტრუმენტი</p>
        <h1${E("Cycle and pregnancy calculators")}>ციკლისა და ორსულობის კალკულატორები</h1>
        <p class="lead"${E("Ovulation, period, pregnancy test, implantation, due date, IVF, ultrasound and hCG — in the calm Medicard style. Every calculation stays in your browser.")}>ოვულაცია, პერიოდი, ტესტი, იმპლანტაცია, ვადა, IVF, ულტრაბგერა და hCG — ქართულად, Medicard-ის ესთეტიკით. ყველა გამოთვლა რჩება შენს ბრაუზერში.</p>
        <div class="chips">
          <span class="chip"${E("Nothing is sent to a server")}>არ იგზავნება სერვერზე</span>
          <span class="chip"${E("Doesn't replace a doctor")}>არ ცვლის ექიმს</span>
          <span class="chip"${E("Not contraception")}>არ არის კონტრაცეფცია</span>
        </div>
      </div>
    </section>
    <section class="calc-hub band-paper">
      <div class="wrap">
        ${group("cycle", "ციკლი", "Cycle", "5 კალკულატორი", "5 calculators")}
        ${group("pregnancy", "ორსულობა", "Pregnancy", "5 კალკულატორი", "5 calculators")}
      </div>
    </section>
    <section class="calc-article band-paper">
      <div class="wrap">
        <h2${E("How we calculate")}>როგორ ვითვლით</h2>
        <p${E("Ovulation ≈ next period − 14 days. Fertile window ≈ ovulation − 5 days … +1 day. Due date = LMP + 280 days, or the scan/IVF rules. hCG doubling time is calculated with a logarithm between two values.")}>ოვულაცია ≈ შემდეგი პერიოდი − 14 დღე. ნაყოფიერი ფანჯარა ≈ ოვულაცია − 5 დღე … +1. ორსულობის ვადა = LMP + 280 დღე, ან სკანის/IVF წესები. hCG გაორმაგება ითვლება ორ მნიშვნელობას შორის ლოგარითმით.</p>
        <p${E("These are the same medical rules of thumb that clinical calculators use. The result is an estimate. Confirming and dating a pregnancy takes a doctor and an ultrasound.")}>ეს იგივე სამედიცინო ორიენტირებია, რასაც კლინიკური კალკულატორები იყენებენ. შედეგი არის შეფასება. ორსულობის დასადასტურებლად და დასათარიღებლად საჭიროა ექიმი და ულტრაბგერა.</p>
        <p${E("Full cycle tracking, symptoms and Medi are only in the app.")}>სრული ციკლის აღრიცხვა, სიმპტომები და Medi — მხოლოდ აპში.</p>
      </div>
    </section>`;
  return chrome(
    {
      title: "კალკულატორები",
      titleEn: "Calculators",
      description:
        "Medicard.GE ციკლისა და ორსულობის კალკულატორები: ოვულაცია, პერიოდი, ტესტი, იმპლანტაცია, ვადა, IVF, ულტრაბგერა და hCG.",
      descriptionEn:
        "Medicard.GE cycle and pregnancy calculators: ovulation, period, pregnancy test, implantation, due date, IVF, ultrasound and hCG.",
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
