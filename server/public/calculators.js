import {
  IVF_TYPES,
  cycleStrip,
  dueDateFromIvf,
  dueDateFromLmp,
  dueDateFromUltrasound,
  estimateOvulation,
  formatKa,
  hcgDoubling,
  hcgRangeForWeek,
  implantationWindow,
  menstrualCycle,
  periodForecast,
  pregnancyTestWindow,
  todayYmd,
  weeksToMonths,
} from "./calculators-engine.js";
import { mountDateCalendars } from "./calculators-calendar.js";

const TRI = ["", "პირველი ტრიმესტრი", "მეორე ტრიმესტრი", "მესამე ტრიმესტრი"];
const BAND = {
  typical: "ტიპიური გაორმაგება ადრეულ ორსულობაში",
  fast: "უფრო სწრაფი, ვიდრე ჩვეულებრივი 48–72 სთ",
  slow: "ნელა იმატებს — აჩვენე ექიმს",
  "very-slow": "ძალიან ნელი მატება — აუცილებლად ექიმთან",
  falling: "მაჩვენებელი იკლებს — დაუყოვნებლივ ექიმთან",
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function el(html) {
  return html.trim();
}

function legend() {
  return `<div class="calc-legend">
    <span><i class="period"></i>მენსტრუაცია</span>
    <span><i class="fertile"></i>ნაყოფიერი</span>
    <span><i class="ovulation"></i>ოვულაცია</span>
    <span><i></i>დანარჩენი</span>
  </div>`;
}

function stripHtml(days, today) {
  return `<div class="calc-strip" aria-hidden="true">${days
    .map(
      (d) =>
        `<i data-kind="${d.kind}" class="${d.date === today ? "is-today" : ""}" title="${d.day}"></i>`,
    )
    .join("")}</div>${legend()}`;
}

function metrics(items) {
  return `<div class="calc-metrics">${items
    .map(
      ([k, v]) => `<article><small>${k}</small><b>${v}</b></article>`,
    )
    .join("")}</div>`;
}

function timeline(items) {
  return `<ul class="calc-timeline">${items
    .map(
      ([label, date]) =>
        `<li><i></i><div><small>${label}</small><b>${formatKa(date)}</b></div></li>`,
    )
    .join("")}</ul>`;
}

function warn(text) {
  return `<p class="calc-warn">${text}</p>`;
}

function privacy() {
  return `<p class="calc-privacy">გამოთვლა მხოლოდ შენს ბრაუზერშია. Medicard არ იღებს და არ ინახავს აქ შეყვანილ თარიღებს.</p>`;
}

function weeksBar(current) {
  const now = Math.max(1, Math.min(40, current));
  return `<div class="calc-weeks" aria-hidden="true">${Array.from({ length: 40 }, (_, i) => {
    const w = i + 1;
    const on = w <= now;
    return `<i class="${on ? "is-on" : ""} ${w === now ? "is-now" : ""}"></i>`;
  }).join("")}</div>`;
}

function monthBar(chart) {
  return `<div class="calc-months">${chart
    .map(
      (m) =>
        `<span class="${m.active ? "is-on" : ""}"><b>${m.month}</b>კვ. ${m.from}–${m.to}</span>`,
    )
    .join("")}</div>`;
}

function ring(percent, top, sub) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(1, percent)) * c;
  return `<div class="calc-ring-wrap">
    <svg class="calc-ring" viewBox="0 0 140 140" aria-hidden="true">
      <circle class="track" cx="70" cy="70" r="${r}"></circle>
      <circle class="fill" cx="70" cy="70" r="${r}" transform="rotate(-90 70 70)"
        stroke-dasharray="${dash} ${c}"></circle>
      <text x="70" y="68" text-anchor="middle">${top}</text>
      <text class="sub" x="70" y="86" text-anchor="middle">${sub}</text>
    </svg>
  </div>`;
}

function emptyState() {
  return `<div class="calc-result is-empty">
    <div>
      <span class="ic ic-lg ic-calc" aria-hidden="true"></span>
      <b>შედეგი აქ გამოჩნდება</b>
      შეიყვანე მონაცემები და დააჭირე გამოთვლას. ეს არის ორიენტირი, არა დიაგნოზი.
    </div>
  </div>`;
}

function renderOvulation(form) {
  const lmp = form.lmp.value;
  const cycleLength = form.cycleLength.value;
  const today = todayYmd();
  const ov = estimateOvulation(lmp, cycleLength);
  const strip = cycleStrip(lmp, cycleLength, 5);
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">სავარაუდო ოვულაცია</p>
        <p class="calc-big">${formatKa(ov.ovulation)}</p>
      </div>
    </div>
    ${metrics([
      ["ნაყოფიერი ფანჯარა", `${formatKa(ov.fertileStart)} → ${formatKa(ov.fertileEnd)}`],
      ["შემდეგი პერიოდი", formatKa(ov.nextPeriod)],
      ["ციკლის სიგრძე", `${ov.cycleLength} დღე`],
    ])}
    ${stripHtml(strip, today)}
    ${timeline([
      ["ოვულაცია", ov.ovulation],
      ["ნაყოფიერი ფანჯრის დასაწყისი", ov.fertileStart],
      ["შემდეგი პერიოდი", ov.nextPeriod],
    ])}
    ${warn("ოვულაციის კალკულატორი არის შეფასება ლუთეალური ფაზის ~14 დღის წესით. ის არ არის კონტრაცეფცია და არ ადასტურებს ოვულაციას.")}
    ${privacy()}
  </div>`;
}

function renderPeriod(form) {
  const lmp = form.lmp.value;
  const cycleLength = form.cycleLength.value;
  const periodLength = form.periodLength.value;
  const forecast = periodForecast(lmp, cycleLength, periodLength, 6);
  const next = forecast.next;
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">შემდეგი პერიოდი</p>
        <p class="calc-big">${formatKa(next.start)}</p>
      </div>
    </div>
    ${metrics([
      ["ხანგრძლივობა", `${formatKa(next.start)} — ${formatKa(next.end)}`],
      ["ციკლი", `${forecast.cycleLength} დღე`],
      ["სისხლდენა", `${forecast.periodLength} დღე`],
    ])}
    ${timeline(forecast.cycles.slice(1).map((c) => [`ციკლი ${c.cycle}`, c.start]))}
    ${warn("პროგნოზი მუშაობს რეგულარულ ციკლზე. სტრესი, ავადმყოფობა და ჰორმონები თარიღს ცვლიან.")}
    ${privacy()}
  </div>`;
}

function renderCycle(form) {
  const lmp = form.lmp.value;
  const cycleLength = form.cycleLength.value;
  const periodLength = form.periodLength.value;
  const today = todayYmd();
  const cycle = menstrualCycle(lmp, cycleLength, periodLength, today);
  const strip = cycleStrip(lmp, cycleLength, periodLength);
  const dayLabel = cycle.inCycle ? `${cycle.cycleDay} / ${cycle.cycleLength}` : "ციკლის გარეთ";
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">${cycle.phaseKa}</p>
        <p class="calc-big">ციკლის ${cycle.inCycle ? `${cycle.cycleDay}-ე დღე` : "ახალი ციკლი"}</p>
      </div>
    </div>
    ${metrics([
      ["დღე", dayLabel],
      ["ოვულაცია", formatKa(cycle.ovulation)],
      ["შემდეგი პერიოდი", formatKa(cycle.nextPeriod)],
    ])}
    ${stripHtml(strip, today)}
    ${timeline([
      ["პერიოდის დასასრული", cycle.periodEnd],
      ["ნაყოფიერი ფანჯარა", cycle.fertileStart],
      ["ოვულაცია", cycle.ovulation],
      ["შემდეგი პერიოდი", cycle.nextPeriod],
    ])}
    ${warn("ფაზები შეფასებულია საშუალო ციკლით. Medicard აპში პროგნოზი შენს აღრიცხვას ეყრდნობა — აქ მხოლოდ ერთი ციკლის მათემატიკაა.")}
    ${privacy()}
  </div>`;
}

function renderTest(form) {
  const win = pregnancyTestWindow({
    mode: form.mode.value,
    date: form.date.value,
    cycleLength: form.cycleLength?.value || 28,
  });
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">რეკომენდებული ტესტი</p>
        <p class="calc-big">${formatKa(win.recommended)}</p>
      </div>
    </div>
    ${metrics([
      ["ყველაზე ადრე", formatKa(win.earliest)],
      ["2-კვირიანი ლოდინი", formatKa(win.twoWeekWait)],
      ["უფრო ზუსტი", formatKa(win.mostAccurate)],
    ])}
    ${timeline([
      ["ოვულაცია", win.ovulation],
      ["ადრეული ტესტი", win.earliest],
      ["გაცდენილი პერიოდი", win.recommended],
      ["კვირის შემდეგ", win.mostAccurate],
    ])}
    ${warn("უარყოფითი ტესტი გაცდენილ პერიოდამდე ხშირად ცრუ-უარყოფითია. სისხლში hCG უფრო ადრე ჩანს, ვიდრე შარდში.")}
    ${privacy()}
  </div>`;
}

function renderImplant(form) {
  const win = implantationWindow({
    mode: form.mode.value,
    date: form.date.value,
    cycleLength: form.cycleLength?.value || 28,
  });
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">იმპლანტაციის ფანჯარა</p>
        <p class="calc-big">${formatKa(win.start)} — ${formatKa(win.end)}</p>
      </div>
    </div>
    ${metrics([
      ["ოვულაცია", formatKa(win.ovulation)],
      ["დაწყება", "+6 დღე"],
      ["დასასრული", "+10 დღე"],
    ])}
    ${timeline([
      ["ოვულაცია", win.ovulation],
      ["ფანჯრის დასაწყისი", win.start],
      ["ფანჯრის დასასრული", win.end],
      ["ტესტისთვის უკეთესი", win.testFrom],
    ])}
    ${warn("იმპლანტაცია ყველას ერთ დღეს არ ხდება. ეს არის 6–10 დღის სავარაუდო ინტერვალი ოვულაციის შემდეგ.")}
    ${privacy()}
  </div>`;
}

function renderWeeks(form) {
  const result = weeksToMonths(form.weeks.value, form.days.value);
  const pct = (result.weeks * 7 + result.days) / 280;
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">${TRI[result.trimester]}</p>
        <p class="calc-big">${result.month}-ე თვე</p>
      </div>
    </div>
    ${ring(pct, `${result.weeks}კვ`, `${result.days} დღე`)}
    ${metrics([
      ["გესტაციური ასაკი", `${result.weeks} კვირა, ${result.days} დღე`],
      ["დარჩენილი", `~${result.remainingWeeks} კვირა`],
      ["ტრიმესტრი", `${result.trimester}`],
    ])}
    ${monthBar(result.chart)}
    ${weeksBar(result.weeks)}
    ${warn("ექიმები ორსულობას კვირებში ზომავენ, არა თვეებში. თვე საშუალოდ 4 კვირაზე მეტია, ამიტომ კონვერტაცია მიახლოებითია.")}
    ${privacy()}
  </div>`;
}

function renderDue(form) {
  const result = dueDateFromLmp(form.lmp.value, form.cycleLength.value);
  const ga = result.gestationalAge;
  const pct = ga.totalDays / 280;
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">სავარაუდო მშობიარობა</p>
        <p class="calc-big">${formatKa(result.edd)}</p>
      </div>
    </div>
    ${ring(pct, `${ga.weeks}კვ`, `${ga.days} დღე`)}
    ${metrics([
      ["ახლა", `${ga.weeks} კვირა, ${ga.days} დღე`],
      ["ტრიმესტრი", TRI[result.trimester]],
      ["თვე", `${result.month}`],
    ])}
    ${weeksBar(Math.max(1, ga.weeks))}
    ${timeline([
      ["ბოლო პერიოდი", result.lmp],
      ["სავარაუდო ჩასახვა", result.conceptionEstimate],
      ["ვადა", result.edd],
    ])}
    ${warn("Naegele-ს წესი: LMP + 280 დღე, ციკლის სიგრძის კორექციით. მხოლოდ ~5% იბადება ზუსტად ამ დღეს. თარიღს ადასტურებს ულტრაბგერა.")}
    ${privacy()}
  </div>`;
}

function renderIvf(form) {
  const result = dueDateFromIvf(form.transfer.value, form.type.value);
  const ga = result.gestationalAge;
  const spec = IVF_TYPES[result.type];
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">IVF / FET ვადა</p>
        <p class="calc-big">${formatKa(result.edd)}</p>
      </div>
    </div>
    ${metrics([
      ["მეთოდი", spec.label],
      ["ახლა", `${ga.weeks} კვირა, ${ga.days} დღე`],
      ["ტრიმესტრი", TRI[result.trimester]],
    ])}
    ${weeksBar(Math.max(1, ga.weeks))}
    ${timeline([
      ["ტრანსფერი / აღება", result.transferDate],
      ["LMP-ეკვივალენტი", result.lmpEquivalent],
      ["ვადა", result.edd],
    ])}
    ${warn("IVF თარიღი უფრო ზუსტია, რადგან განაყოფიერების დღე ცნობილია. მაინც დაადასტურე კლინიკასთან.")}
    ${privacy()}
  </div>`;
}

function renderUltrasound(form) {
  const result = dueDateFromUltrasound(form.scan.value, form.weeks.value, form.days.value);
  const ga = result.gestationalAge;
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">ულტრაბგერითი ვადა</p>
        <p class="calc-big">${formatKa(result.edd)}</p>
      </div>
    </div>
    ${metrics([
      ["სკანზე", `${result.weeksAtScan} კვ. ${result.daysAtScan} დღე`],
      ["ახლა", `${ga.weeks} კვირა, ${ga.days} დღე`],
      ["ტრიმესტრი", TRI[result.trimester]],
    ])}
    ${weeksBar(Math.max(1, ga.weeks))}
    ${timeline([
      ["სკანის თარიღი", result.scanDate],
      ["LMP-ეკვივალენტი", result.lmpEquivalent],
      ["ვადა", result.edd],
    ])}
    ${warn("პირველი ტრიმესტრის CRL ყველაზე საიმედოა. მოგვიანებით სკანი ნაკლებად ცვლის უკვე დადგენილ EDD-ს.")}
    ${privacy()}
  </div>`;
}

function renderHcg(form) {
  const result = hcgDoubling({
    date1: form.date1.value,
    value1: form.value1.value,
    date2: form.date2.value,
    value2: form.value2.value,
  });
  if (!result.ok) {
    return `<div class="calc-result is-empty"><div><b>შეამოწმე მონაცემები</b>საჭიროა ორი დადებითი მნიშვნელობა და მეორე თარიღი პირველის შემდეგ.</div></div>`;
  }
  const week = Number(form.week.value || 0);
  const range = week ? hcgRangeForWeek(week) : null;
  const hours = Math.round(result.doublingHours);
  const maxBar = 120;
  const width = Math.max(8, Math.min(100, (hours / maxBar) * 100));
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">გაორმაგების დრო</p>
        <p class="calc-big">${hours} საათი</p>
      </div>
    </div>
    ${metrics([
      ["ფარდობა", `${result.ratio.toFixed(2)}×`],
      ["დღეებში", `${result.doublingDays.toFixed(1)} დღე`],
      ["შეფასება", BAND[result.band]],
    ])}
    <div class="calc-hcg">
      <div><b>48სთ</b><span><i style="width:${Math.min(100, (48 / maxBar) * 100)}%"></i></span><b>ტიპიური</b></div>
      <div><b>შენი</b><span><i style="width:${width}%"></i></span><b>${hours}სთ</b></div>
    </div>
    ${metrics([
      ["~48სთ-ში", Math.round(result.next48).toLocaleString("ka-GE")],
      ["~72სთ-ში", Math.round(result.next72).toLocaleString("ka-GE")],
      ["ინტერვალი", `${result.days} დღე`],
    ])}
    ${range ? `<p class="calc-note">${week} კვირაზე ლაბორატორიული ორიენტირი ხშირად ${range.min.toLocaleString("ka-GE")}–${range.max.toLocaleString("ka-GE")} mIU/ml-ია. დიაპაზონი ძალიან განსხვავდება.</p>` : ""}
    ${warn("hCG მარტო ორსულობის მიმდინარეობას არ ადასტურებს. სისხლის ანალიზი და ულტრაბგერა ექიმთან ერთად იკითხება.")}
    ${privacy()}
  </div>`;
}

const RENDERERS = {
  ovulation: renderOvulation,
  period: renderPeriod,
  cycle: renderCycle,
  "pregnancy-test": renderTest,
  implantation: renderImplant,
  "weeks-to-months": renderWeeks,
  "due-date": renderDue,
  ivf: renderIvf,
  ultrasound: renderUltrasound,
  hcg: renderHcg,
};

function toggleMode(form) {
  const mode = form.querySelector("[name=mode]:checked");
  const cycleWrap = form.querySelector("[data-if=lmp]");
  if (!mode || !cycleWrap) return;
  const hide = mode.value !== "lmp";
  cycleWrap.hidden = hide;
  cycleWrap.querySelectorAll("input").forEach((input) => {
    input.disabled = hide;
  });
}

function bindSteppers(form) {
  form.querySelectorAll("[data-step]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = btn.parentElement.querySelector("input");
      const step = Number(btn.dataset.step);
      const min = Number(input.min || 0);
      const max = Number(input.max || 99);
      input.value = String(Math.min(max, Math.max(min, Number(input.value || 0) + step)));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  });
}

function init() {
  const form = document.querySelector("form[data-calc]");
  const out = document.querySelector("[data-result]");
  if (!form || !out) return;

  out.innerHTML = emptyState();
  bindSteppers(form);
  const dates = mountDateCalendars(form);
  toggleMode(form);
  form.querySelectorAll("[name=mode]").forEach((el) => {
    el.addEventListener("change", () => toggleMode(form));
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const emptyDate = [...form.querySelectorAll("input[type=date][required]:not(:disabled)")].find(
      (input) => !input.value,
    );
    if (emptyDate) {
      emptyDate.closest(".mc-date")?.classList.add("is-invalid");
      emptyDate.closest(".mc-date")?.querySelector(".mc-date-btn")?.click();
      return;
    }
    if (!form.reportValidity()) return;
    const kind = form.dataset.calc;
    const render = RENDERERS[kind];
    if (!render) return;
    out.classList.remove("is-empty");
    out.innerHTML = render(form);
    out.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  form.querySelector("[data-reset]")?.addEventListener("click", () => {
    form.reset();
    dates.syncAll();
    toggleMode(form);
    out.innerHTML = emptyState();
  });
}

init();
