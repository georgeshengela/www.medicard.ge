(() => {
  const root = document.documentElement;
  const THEME_KEY = "medicard.landing.theme";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const year = document.getElementById("y");
  if (year) year.textContent = String(new Date().getFullYear());

  /* theme */
  function readTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      /* private mode */
    }
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function applyTheme(theme, persist) {
    const next = theme === "light" ? "light" : "dark";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? "#f6f8f9" : "#030712");
    document.querySelectorAll(".theme-btn").forEach((btn) => {
      const isDark = next === "dark";
      btn.setAttribute("aria-pressed", isDark ? "true" : "false");
      btn.setAttribute("aria-label", isDark ? "გადართე ღია თემაზე" : "გადართე მუქ თემაზე");
    });
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* private mode */
      }
    }
  }
  applyTheme(readTheme(), false);
  requestAnimationFrame(() => root.classList.add("theme-ready"));
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true));
  });
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY && (e.newValue === "light" || e.newValue === "dark")) applyTheme(e.newValue, false);
  });

  /* mobile menu */
  const links = document.getElementById("nav-links");
  const menuBtn = document.getElementById("menu-toggle");
  menuBtn?.addEventListener("click", () => {
    const open = links?.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links?.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("is-open");
      menuBtn?.setAttribute("aria-expanded", "false");
    }),
  );

  /* hero phone: slow screen rotation while visible */
  const phone = document.getElementById("hero-phone");
  if (phone && !reduced) {
    const imgs = [...phone.querySelectorAll(".phone-screen img")];
    let i = 0;
    let timer = null;
    const next = () => {
      i = (i + 1) % imgs.length;
      imgs.forEach((img, n) => img.classList.toggle("is-on", n === i));
    };
    const start = () => {
      if (!timer) timer = setInterval(next, 5000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    new IntersectionObserver((entries) => (entries[0]?.isIntersecting ? start() : stop()), { threshold: 0.4 }).observe(phone);
  }

  /* faq: one open at a time */
  const faq = document.querySelector(".faq-list");
  faq?.querySelectorAll("details").forEach((d) => {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      faq.querySelectorAll("details[open]").forEach((o) => {
        if (o !== d) o.open = false;
      });
    });
  });
})();
