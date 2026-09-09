import {
  KA_MONTHS,
  KA_WEEKDAYS_MON_SHORT,
  calendarMonthCells,
  formatKaParts,
  isYmd,
  todayYmd,
  ymdParts,
} from "./calculators-engine.js";

const YEAR_MIN = 1990;
const YEAR_MAX = 2035;

function closeAll(except) {
  document.querySelectorAll(".mc-date.is-open").forEach((wrap) => {
    if (wrap !== except) setOpen(wrap, false);
  });
}

function setOpen(wrap, open) {
  wrap.classList.toggle("is-open", open);
  const cal = wrap.querySelector(".mc-cal");
  const btn = wrap.querySelector(".mc-date-btn");
  if (cal) cal.hidden = !open;
  btn?.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) render(wrap);
}

function syncLabel(wrap) {
  const input = wrap.querySelector("input[type=date]");
  const weekday = wrap.querySelector("[data-weekday]");
  const date = wrap.querySelector("[data-date]");
  if (!input || !weekday || !date) return;
  if (isYmd(input.value)) {
    const parts = formatKaParts(input.value);
    weekday.textContent = parts.weekday;
    date.textContent = parts.date;
    wrap.classList.add("has-value");
    wrap.classList.remove("is-invalid");
  } else {
    weekday.textContent = "თარიღი";
    date.textContent = "აირჩიე კალენდრიდან";
    wrap.classList.remove("has-value");
  }
}

function viewFromValue(wrap) {
  const input = wrap.querySelector("input[type=date]");
  const today = todayYmd();
  const src = isYmd(input.value) ? input.value : today;
  const { y, m } = ymdParts(src);
  wrap._view = { y, m, mode: "days" };
}

function shiftMonth(wrap, delta) {
  const view = wrap._view;
  let m = view.m + delta;
  let y = view.y;
  while (m < 1) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  y = Math.min(YEAR_MAX, Math.max(YEAR_MIN, y));
  wrap._view = { ...view, y, m };
}

function render(wrap) {
  const cal = wrap.querySelector(".mc-cal");
  const input = wrap.querySelector("input[type=date]");
  if (!cal || !wrap._view) return;
  const today = todayYmd();
  const selected = isYmd(input.value) ? input.value : "";
  const { y, m, mode } = wrap._view;
  const title = wrap.querySelector("[data-cal-title]");
  const body = wrap.querySelector("[data-cal-body]");
  if (mode === "months") {
    title.textContent = String(y);
    body.innerHTML = `<div class="mc-cal-months">${KA_MONTHS.map(
      (name, i) =>
        `<button type="button" data-pick-month="${i + 1}" class="${m === i + 1 ? "is-on" : ""}">${name}</button>`,
    ).join("")}</div>`;
    return;
  }
  title.textContent = `${KA_MONTHS[m - 1]} ${y}`;
  const cells = calendarMonthCells(y, m);
  body.innerHTML = `<div class="mc-cal-dows" aria-hidden="true">${KA_WEEKDAYS_MON_SHORT.map(
    (d, i) => `<span class="${i >= 5 ? "is-end" : ""}">${d}</span>`,
  ).join("")}</div>
    <div class="mc-cal-days">${cells
      .map((cell) => {
        const cls = [
          cell.inMonth ? "" : "is-out",
          cell.weekend ? "is-end" : "",
          cell.date === today ? "is-today" : "",
          cell.date === selected ? "is-on" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return `<button type="button" data-pick="${cell.date}" class="${cls}" aria-label="${cell.date}" aria-pressed="${cell.date === selected}">${cell.day}</button>`;
      })
      .join("")}</div>`;
}

function pick(wrap, ymd) {
  const input = wrap.querySelector("input[type=date]");
  input.value = ymd;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  syncLabel(wrap);
  setOpen(wrap, false);
}

export function mountDateCalendars(root) {
  const wraps = [];
  root.querySelectorAll("input[type=date]").forEach((input) => {
    if (input.closest(".mc-date")) return;
    const wrap = document.createElement("div");
    wrap.className = "mc-date";
    input.classList.add("mc-date-native");
    input.setAttribute("autocomplete", "off");
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.insertAdjacentHTML(
      "beforeend",
      `<button type="button" class="mc-date-btn" aria-haspopup="dialog" aria-expanded="false">
        <span>
          <small data-weekday>თარიღი</small>
          <b data-date>აირჩიე კალენდრიდან</b>
        </span>
        <span class="ic ic-calendar" aria-hidden="true"></span>
      </button>
      <div class="mc-cal" hidden role="dialog" aria-label="კალენდარი">
        <div class="mc-cal-head">
          <button type="button" class="mc-cal-nav" data-nav="-1" aria-label="წინა">‹</button>
          <button type="button" class="mc-cal-title" data-cal-title></button>
          <button type="button" class="mc-cal-nav" data-nav="1" aria-label="შემდეგი">›</button>
        </div>
        <div data-cal-body></div>
        <div class="mc-cal-foot">
          <button type="button" data-today>დღეს</button>
          <button type="button" data-close>დახურვა</button>
        </div>
      </div>`,
    );
    viewFromValue(wrap);
    syncLabel(wrap);
    wraps.push(wrap);

    wrap.querySelector(".mc-date-btn").addEventListener("click", () => {
      const open = !wrap.classList.contains("is-open");
      closeAll(wrap);
      if (open) viewFromValue(wrap);
      setOpen(wrap, open);
    });

    wrap.querySelector("[data-nav='-1']").addEventListener("click", () => {
      if (wrap._view.mode === "months") wrap._view.y = Math.max(YEAR_MIN, wrap._view.y - 1);
      else shiftMonth(wrap, -1);
      render(wrap);
    });
    wrap.querySelector("[data-nav='1']").addEventListener("click", () => {
      if (wrap._view.mode === "months") wrap._view.y = Math.min(YEAR_MAX, wrap._view.y + 1);
      else shiftMonth(wrap, 1);
      render(wrap);
    });
    wrap.querySelector("[data-cal-title]").addEventListener("click", () => {
      wrap._view.mode = wrap._view.mode === "days" ? "months" : "days";
      render(wrap);
    });
    wrap.querySelector("[data-today]").addEventListener("click", () => {
      pick(wrap, todayYmd());
    });
    wrap.querySelector("[data-close]").addEventListener("click", () => setOpen(wrap, false));
    wrap.querySelector("[data-cal-body]").addEventListener("click", (event) => {
      const monthBtn = event.target.closest("[data-pick-month]");
      if (monthBtn) {
        wrap._view.m = Number(monthBtn.dataset.pickMonth);
        wrap._view.mode = "days";
        render(wrap);
        return;
      }
      const dayBtn = event.target.closest("[data-pick]");
      if (dayBtn) pick(wrap, dayBtn.dataset.pick);
    });
  });

  if (!document.documentElement.dataset.mcCalBound) {
    document.documentElement.dataset.mcCalBound = "1";
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".mc-date")) closeAll();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeAll();
    });
  }

  return {
    syncAll() {
      wraps.forEach((wrap) => {
        viewFromValue(wrap);
        syncLabel(wrap);
        setOpen(wrap, false);
      });
    },
  };
}
