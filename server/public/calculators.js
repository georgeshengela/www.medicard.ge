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
import { mountDateCalendars } from "./calculators-calendar.js?v=2";

const I18N = window.MedicardI18n || { lang: "ka", t: (k) => k, locale: "ka-GE" };
const T = I18N.t;
const EN = I18N.lang === "en";
const LOCALE = I18N.locale || "ka-GE";

const EN_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Result dates in the active language ("Thursday 12 March 2027" in English). */
function fmtDate(ymd) {
  if (!EN) return formatKa(ymd);
  const [y, m, d] = ymd.split("-").map(Number);
  return EN_DATE.format(new Date(Date.UTC(y, m - 1, d)));
}

function nDays(n) {
  return EN ? `${n} ${Number(n) === 1 ? "day" : "days"}` : `${n} დღე`;
}

function nWeeksDays(w, d) {
  return EN
    ? `${w} ${w === 1 ? "week" : "weeks"}, ${nDays(d)}`
    : `${w} კვირა, ${d} დღე`;
}

const TRI = EN
  ? ["", "First trimester", "Second trimester", "Third trimester"]
  : ["", "პირველი ტრიმესტრი", "მეორე ტრიმესტრი", "მესამე ტრიმესტრი"];
const BAND = {
  typical: T("ტიპიური გაორმაგება ადრეულ ორსულობაში", "Typical doubling for early pregnancy"),
  fast: T("უფრო სწრაფი, ვიდრე ჩვეულებრივი 48–72 სთ", "Faster than the usual 48–72 h"),
  slow: T("ნელა იმატებს — აჩვენე ექიმს", "Rising slowly — show your doctor"),
  "very-slow": T("ძალიან ნელი მატება — აუცილებლად ექიმთან", "Very slow rise — be sure to see a doctor"),
  falling: T("მაჩვენებელი იკლებს — დაუყოვნებლივ ექიმთან", "The level is falling — see a doctor right away"),
};
const PHASE_EN = {
  period: "Period",
  follicular: "Follicular phase",
  ovulation: "Ovulation",
  fertile: "Fertile window",
  luteal: "Luteal phase",
};
const IVF_EN = {
  retrieval: "Egg retrieval",
  day3: "Day-3 embryo",
  day5: "Day-5 blastocyst",
  day6: "Day-6 blastocyst",
};

function $(sel, root = document) {
  return root.querySelector(sel);
}

function el(html) {
  return html.trim();
}

function legend() {
  return `<div class="calc-legend">
    <span><i class="period"></i>${T("მენსტრუაცია", "Period")}</span>
    <span><i class="fertile"></i>${T("ნაყოფიერი", "Fertile")}</span>
    <span><i class="ovulation"></i>${T("ოვულაცია", "Ovulation")}</span>
    <span><i></i>${T("დანარჩენი", "Other days")}</span>
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
        `<li><i></i><div><small>${label}</small><b>${fmtDate(date)}</b></div></li>`,
    )
    .join("")}</ul>`;
}

function warn(text) {
  return `<p class="calc-warn">${text}</p>`;
}

function privacy() {
  return `<p class="calc-privacy">${T(
    "გამოთვლა მხოლოდ შენს ბრაუზერშია. Medicard არ იღებს და არ ინახავს აქ შეყვანილ თარიღებს.",
    "The calculation happens only in your browser. Medicard doesn't receive or store the dates you enter here.",
  )}</p>`;
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
        `<span class="${m.active ? "is-on" : ""}"><b>${m.month}</b>${T("კვ.", "wk")} ${m.from}–${m.to}</span>`,
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
      <b>${T("შედეგი აქ გამოჩნდება", "Your result will appear here")}</b>
      ${T(
        "შეიყვანე მონაცემები და დააჭირე გამოთვლას. ეს არის ორიენტირი, არა დიაგნოზი.",
        "Enter your details and tap Calculate. This is an estimate, not a diagnosis.",
      )}
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
        <p class="calc-kicker">${T("სავარაუდო ოვულაცია", "Estimated ovulation")}</p>
        <p class="calc-big">${fmtDate(ov.ovulation)}</p>
      </div>
    </div>
    ${metrics([
      [T("ნაყოფიერი ფანჯარა", "Fertile window"), `${fmtDate(ov.fertileStart)} → ${fmtDate(ov.fertileEnd)}`],
      [T("შემდეგი პერიოდი", "Next period"), fmtDate(ov.nextPeriod)],
      [T("ციკლის სიგრძე", "Cycle length"), nDays(ov.cycleLength)],
    ])}
    ${stripHtml(strip, today)}
    ${timeline([
      [T("ოვულაცია", "Ovulation"), ov.ovulation],
      [T("ნაყოფიერი ფანჯრის დასაწყისი", "Fertile window starts"), ov.fertileStart],
      [T("შემდეგი პერიოდი", "Next period"), ov.nextPeriod],
    ])}
    ${warn(T(
      "ოვულაციის კალკულატორი არის შეფასება ლუთეალური ფაზის ~14 დღის წესით. ის არ არის კონტრაცეფცია და არ ადასტურებს ოვულაციას.",
      "The ovulation calculator gives an estimate based on a ~14-day luteal phase. It is not contraception and does not confirm ovulation.",
    ))}
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
        <p class="calc-kicker">${T("შემდეგი პერიოდი", "Next period")}</p>
        <p class="calc-big">${fmtDate(next.start)}</p>
      </div>
    </div>
    ${metrics([
      [T("ხანგრძლივობა", "Dates"), `${fmtDate(next.start)} — ${fmtDate(next.end)}`],
      [T("ციკლი", "Cycle"), nDays(forecast.cycleLength)],
      [T("სისხლდენა", "Bleeding"), nDays(forecast.periodLength)],
    ])}
    ${timeline(forecast.cycles.slice(1).map((c) => [`${T("ციკლი", "Cycle")} ${c.cycle}`, c.start]))}
    ${warn(T(
      "პროგნოზი მუშაობს რეგულარულ ციკლზე. სტრესი, ავადმყოფობა და ჰორმონები თარიღს ცვლიან.",
      "The forecast works for a regular cycle. Stress, illness and hormones can shift the date.",
    ))}
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
  const dayLabel = cycle.inCycle
    ? `${cycle.cycleDay} / ${cycle.cycleLength}`
    : T("ციკლის გარეთ", "Outside this cycle");
  const big = EN
    ? cycle.inCycle
      ? `Cycle day ${cycle.cycleDay}`
      : "New cycle"
    : `ციკლის ${cycle.inCycle ? `${cycle.cycleDay}-ე დღე` : "ახალი ციკლი"}`;
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">${EN ? PHASE_EN[cycle.phase] || cycle.phaseKa : cycle.phaseKa}</p>
        <p class="calc-big">${big}</p>
      </div>
    </div>
    ${metrics([
      [T("დღე", "Day"), dayLabel],
      [T("ოვულაცია", "Ovulation"), fmtDate(cycle.ovulation)],
      [T("შემდეგი პერიოდი", "Next period"), fmtDate(cycle.nextPeriod)],
    ])}
    ${stripHtml(strip, today)}
    ${timeline([
      [T("პერიოდის დასასრული", "Period ends"), cycle.periodEnd],
      [T("ნაყოფიერი ფანჯარა", "Fertile window"), cycle.fertileStart],
      [T("ოვულაცია", "Ovulation"), cycle.ovulation],
      [T("შემდეგი პერიოდი", "Next period"), cycle.nextPeriod],
    ])}
    ${warn(T(
      "ფაზები შეფასებულია საშუალო ციკლით. Medicard აპში პროგნოზი შენს აღრიცხვას ეყრდნობა — აქ მხოლოდ ერთი ციკლის მათემატიკაა.",
      "Phases are estimated from an average cycle. In the Medicard app, the forecast is based on your own tracking — this page only does the math for one cycle.",
    ))}
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
        <p class="calc-kicker">${T("რეკომენდებული ტესტი", "Recommended test day")}</p>
        <p class="calc-big">${fmtDate(win.recommended)}</p>
      </div>
    </div>
    ${metrics([
      [T("ყველაზე ადრე", "Earliest"), fmtDate(win.earliest)],
      [T("2-კვირიანი ლოდინი", "Two-week wait ends"), fmtDate(win.twoWeekWait)],
      [T("უფრო ზუსტი", "More accurate"), fmtDate(win.mostAccurate)],
    ])}
    ${timeline([
      [T("ოვულაცია", "Ovulation"), win.ovulation],
      [T("ადრეული ტესტი", "Early test"), win.earliest],
      [T("გაცდენილი პერიოდი", "Missed period"), win.recommended],
      [T("კვირის შემდეგ", "One week later"), win.mostAccurate],
    ])}
    ${warn(T(
      "უარყოფითი ტესტი გაცდენილ პერიოდამდე ხშირად ცრუ-უარყოფითია. სისხლში hCG უფრო ადრე ჩანს, ვიდრე შარდში.",
      "A negative test before a missed period is often a false negative. hCG shows up in blood earlier than in urine.",
    ))}
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
        <p class="calc-kicker">${T("იმპლანტაციის ფანჯარა", "Implantation window")}</p>
        <p class="calc-big">${fmtDate(win.start)} — ${fmtDate(win.end)}</p>
      </div>
    </div>
    ${metrics([
      [T("ოვულაცია", "Ovulation"), fmtDate(win.ovulation)],
      [T("დაწყება", "Starts"), `+${nDays(6)}`],
      [T("დასასრული", "Ends"), `+${nDays(10)}`],
    ])}
    ${timeline([
      [T("ოვულაცია", "Ovulation"), win.ovulation],
      [T("ფანჯრის დასაწყისი", "Window starts"), win.start],
      [T("ფანჯრის დასასრული", "Window ends"), win.end],
      [T("ტესტისთვის უკეთესი", "Better day to test"), win.testFrom],
    ])}
    ${warn(T(
      "იმპლანტაცია ყველას ერთ დღეს არ ხდება. ეს არის 6–10 დღის სავარაუდო ინტერვალი ოვულაციის შემდეგ.",
      "Implantation doesn't happen on the same day for everyone. This is an estimated window of 6–10 days after ovulation.",
    ))}
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
        <p class="calc-big">${EN ? `Month ${result.month}` : `${result.month}-ე თვე`}</p>
      </div>
    </div>
    ${ring(pct, `${result.weeks}${T("კვ", "w")}`, nDays(result.days))}
    ${metrics([
      [T("გესტაციური ასაკი", "Gestational age"), nWeeksDays(result.weeks, result.days)],
      [T("დარჩენილი", "Remaining"), EN ? `~${result.remainingWeeks} weeks` : `~${result.remainingWeeks} კვირა`],
      [T("ტრიმესტრი", "Trimester"), `${result.trimester}`],
    ])}
    ${monthBar(result.chart)}
    ${weeksBar(result.weeks)}
    ${warn(T(
      "ექიმები ორსულობას კვირებში ზომავენ, არა თვეებში. თვე საშუალოდ 4 კვირაზე მეტია, ამიტომ კონვერტაცია მიახლოებითია.",
      "Doctors measure pregnancy in weeks, not months. A month is a little over 4 weeks on average, so the conversion is approximate.",
    ))}
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
        <p class="calc-kicker">${T("სავარაუდო მშობიარობა", "Estimated due date")}</p>
        <p class="calc-big">${fmtDate(result.edd)}</p>
      </div>
    </div>
    ${ring(pct, `${ga.weeks}${T("კვ", "w")}`, nDays(ga.days))}
    ${metrics([
      [T("ახლა", "Now"), nWeeksDays(ga.weeks, ga.days)],
      [T("ტრიმესტრი", "Trimester"), TRI[result.trimester]],
      [T("თვე", "Month"), `${result.month}`],
    ])}
    ${weeksBar(Math.max(1, ga.weeks))}
    ${timeline([
      [T("ბოლო პერიოდი", "Last period (LMP)"), result.lmp],
      [T("სავარაუდო ჩასახვა", "Estimated conception"), result.conceptionEstimate],
      [T("ვადა", "Due date"), result.edd],
    ])}
    ${warn(T(
      "Naegele-ს წესი: LMP + 280 დღე, ციკლის სიგრძის კორექციით. მხოლოდ ~5% იბადება ზუსტად ამ დღეს. თარიღს ადასტურებს ულტრაბგერა.",
      "Naegele's rule: LMP + 280 days, adjusted for cycle length. Only ~5% of babies are born on exactly this day. An ultrasound confirms the date.",
    ))}
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
        <p class="calc-kicker">${T("IVF / FET ვადა", "IVF / FET due date")}</p>
        <p class="calc-big">${fmtDate(result.edd)}</p>
      </div>
    </div>
    ${metrics([
      [T("მეთოდი", "Method"), EN ? IVF_EN[result.type] || spec.label : spec.label],
      [T("ახლა", "Now"), nWeeksDays(ga.weeks, ga.days)],
      [T("ტრიმესტრი", "Trimester"), TRI[result.trimester]],
    ])}
    ${weeksBar(Math.max(1, ga.weeks))}
    ${timeline([
      [T("ტრანსფერი / აღება", "Transfer / retrieval"), result.transferDate],
      [T("LMP-ეკვივალენტი", "LMP equivalent"), result.lmpEquivalent],
      [T("ვადა", "Due date"), result.edd],
    ])}
    ${warn(T(
      "IVF თარიღი უფრო ზუსტია, რადგან განაყოფიერების დღე ცნობილია. მაინც დაადასტურე კლინიკასთან.",
      "An IVF date is more accurate because the day of fertilization is known. Still, confirm it with your clinic.",
    ))}
    ${privacy()}
  </div>`;
}

function renderUltrasound(form) {
  const result = dueDateFromUltrasound(form.scan.value, form.weeks.value, form.days.value);
  const ga = result.gestationalAge;
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">${T("ულტრაბგერითი ვადა", "Ultrasound due date")}</p>
        <p class="calc-big">${fmtDate(result.edd)}</p>
      </div>
    </div>
    ${metrics([
      [
        T("სკანზე", "At the scan"),
        EN ? `${result.weeksAtScan}w ${result.daysAtScan}d` : `${result.weeksAtScan} კვ. ${result.daysAtScan} დღე`,
      ],
      [T("ახლა", "Now"), nWeeksDays(ga.weeks, ga.days)],
      [T("ტრიმესტრი", "Trimester"), TRI[result.trimester]],
    ])}
    ${weeksBar(Math.max(1, ga.weeks))}
    ${timeline([
      [T("სკანის თარიღი", "Scan date"), result.scanDate],
      [T("LMP-ეკვივალენტი", "LMP equivalent"), result.lmpEquivalent],
      [T("ვადა", "Due date"), result.edd],
    ])}
    ${warn(T(
      "პირველი ტრიმესტრის CRL ყველაზე საიმედოა. მოგვიანებით სკანი ნაკლებად ცვლის უკვე დადგენილ EDD-ს.",
      "A first-trimester crown–rump length (CRL) is the most reliable. Later scans rarely change a due date (EDD) that has already been set.",
    ))}
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
    return `<div class="calc-result is-empty"><div><b>${T("შეამოწმე მონაცემები", "Check your entries")}</b>${T(
      "საჭიროა ორი დადებითი მნიშვნელობა და მეორე თარიღი პირველის შემდეგ.",
      "You need two positive values, and the second date must be after the first.",
    )}</div></div>`;
  }
  const week = Number(form.week.value || 0);
  const range = week ? hcgRangeForWeek(week) : null;
  const hours = Math.round(result.doublingHours);
  const maxBar = 120;
  const width = Math.max(8, Math.min(100, (hours / maxBar) * 100));
  return `<div>
    <div class="calc-result-head">
      <div>
        <p class="calc-kicker">${T("გაორმაგების დრო", "Doubling time")}</p>
        <p class="calc-big">${EN ? `${hours} ${hours === 1 ? "hour" : "hours"}` : `${hours} საათი`}</p>
      </div>
    </div>
    ${metrics([
      [T("ფარდობა", "Ratio"), `${result.ratio.toFixed(2)}×`],
      [T("დღეებში", "In days"), EN ? `${result.doublingDays.toFixed(1)} days` : `${result.doublingDays.toFixed(1)} დღე`],
      [T("შეფასება", "Assessment"), BAND[result.band]],
    ])}
    <div class="calc-hcg">
      <div><b>${T("48სთ", "48h")}</b><span><i style="width:${Math.min(100, (48 / maxBar) * 100)}%"></i></span><b>${T("ტიპიური", "Typical")}</b></div>
      <div><b>${T("შენი", "Yours")}</b><span><i style="width:${width}%"></i></span><b>${hours}${T("სთ", "h")}</b></div>
    </div>
    ${metrics([
      [T("~48სთ-ში", "In ~48h"), Math.round(result.next48).toLocaleString(LOCALE)],
      [T("~72სთ-ში", "In ~72h"), Math.round(result.next72).toLocaleString(LOCALE)],
      [T("ინტერვალი", "Interval"), nDays(result.days)],
    ])}
    ${range ? `<p class="calc-note">${T(
      `${week} კვირაზე ლაბორატორიული ორიენტირი ხშირად ${range.min.toLocaleString("ka-GE")}–${range.max.toLocaleString("ka-GE")} mIU/ml-ია. დიაპაზონი ძალიან განსხვავდება.`,
      `At week ${week}, a common lab reference range is ${range.min.toLocaleString(LOCALE)}–${range.max.toLocaleString(LOCALE)} mIU/ml. Ranges vary a lot.`,
    )}</p>` : ""}
    ${warn(T(
      "hCG მარტო ორსულობის მიმდინარეობას არ ადასტურებს. სისხლის ანალიზი და ულტრაბგერა ექიმთან ერთად იკითხება.",
      "hCG alone doesn't confirm how a pregnancy is progressing. Blood tests and ultrasound are read together with a doctor.",
    ))}
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
