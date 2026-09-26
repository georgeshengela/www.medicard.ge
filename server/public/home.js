(() => {
  const root = document.documentElement;
  const THEME_KEY = "medicard.landing.theme";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const year = document.getElementById("y");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- theme ---------- */
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
    if (meta) meta.setAttribute("content", next === "light" ? "#f4f7f8" : "#030712");
    document.querySelectorAll(".theme-btn").forEach((btn) => {
      const isDark = next === "dark";
      btn.setAttribute("aria-pressed", isDark ? "true" : "false");
      btn.setAttribute("aria-label", isDark ? "გადართე ღია თემაზე" : "გადართე მუქ თემაზე");
      btn.title = isDark ? "ღია თემა" : "მუქი თემა";
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

  /* ---------- nav ---------- */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav?.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

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

  /* ---------- reveal ---------- */
  const rv = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          rv.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  document.querySelectorAll(".rv").forEach((el) => rv.observe(el));

  /* ---------- phone screens ---------- */
  function setScreen(phone, key) {
    if (!phone) return;
    phone.querySelectorAll(".phone-screen img").forEach((img) => {
      img.classList.toggle("is-on", img.dataset.key === key);
    });
  }

  // Hero: slow autoplay while visible, mouse parallax on the floating cards.
  const heroPhone = document.getElementById("hero-phone");
  const heroStage = document.getElementById("hero-stage");
  const heroOrder = ["home", "medi", "meds", "metrics", "cycle", "streak"];
  let heroIdx = 0;
  let heroTimer = null;
  const startHero = () => {
    if (reduced || heroTimer) return;
    heroTimer = setInterval(() => {
      heroIdx = (heroIdx + 1) % heroOrder.length;
      setScreen(heroPhone, heroOrder[heroIdx]);
    }, 3600);
  };
  const stopHero = () => {
    if (heroTimer) clearInterval(heroTimer);
    heroTimer = null;
  };
  if (heroStage) {
    new IntersectionObserver(
      (entries) => (entries[0]?.isIntersecting ? startHero() : stopHero()),
      { threshold: 0.3 },
    ).observe(heroStage);

    if (!reduced && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      let raf = 0;
      let mx = 0;
      let my = 0;
      heroStage.addEventListener("pointermove", (e) => {
        const r = heroStage.getBoundingClientRect();
        mx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        my = ((e.clientY - r.top) / r.height - 0.5) * 2;
        if (!raf) {
          raf = requestAnimationFrame(() => {
            heroStage.style.setProperty("--mx", mx.toFixed(3));
            heroStage.style.setProperty("--my", my.toFixed(3));
            raf = 0;
          });
        }
      });
      heroStage.addEventListener("pointerleave", () => {
        heroStage.style.setProperty("--mx", "0");
        heroStage.style.setProperty("--my", "0");
      });
    }
  }

  // Day: a 7-stop timeline. The active stop's progress bar drives auto-advance
  // (animationend), so hovering/focusing the panel pauses it without timers.
  const dayPanel = document.getElementById("day-panel");
  const dayPhone = document.getElementById("day-phone");
  const stops = [...document.querySelectorAll(".stop")];
  const views = [...document.querySelectorAll(".dv")];
  if (dayPanel && dayPhone && stops.length) {
    let idx = 0;
    const show = (i, restart) => {
      idx = (i + stops.length) % stops.length;
      const key = stops[idx].dataset.key;
      stops.forEach((s, n) => {
        const on = n === idx;
        if (on && restart) {
          s.classList.remove("is-on");
          void s.offsetWidth;
        }
        s.classList.toggle("is-on", on);
        s.classList.toggle("is-done", n < idx);
        s.setAttribute("aria-selected", on ? "true" : "false");
        s.tabIndex = on ? 0 : -1;
      });
      views.forEach((v) => v.classList.toggle("is-on", v.dataset.key === key));
      setScreen(dayPhone, key);
    };
    stops.forEach((s, n) => {
      s.addEventListener("click", () => show(n, true));
      s.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); show(idx + 1, true); stops[idx].focus(); }
        if (e.key === "ArrowLeft") { e.preventDefault(); show(idx - 1, true); stops[idx].focus(); }
      });
      s.querySelector("i")?.addEventListener("animationend", () => {
        if (s.classList.contains("is-on")) show(idx + 1, true);
      });
    });
    document.getElementById("day-prev")?.addEventListener("click", () => show(idx - 1, true));
    document.getElementById("day-next")?.addEventListener("click", () => show(idx + 1, true));
    const pause = (on) => dayPanel.classList.toggle("is-paused", on);
    dayPanel.addEventListener("pointerenter", () => pause(true));
    dayPanel.addEventListener("pointerleave", () => pause(false));
    dayPanel.addEventListener("focusin", () => pause(true));
    dayPanel.addEventListener("focusout", () => pause(false));
    // Only run the progress while the panel is on screen.
    new IntersectionObserver(
      (entries) => dayPanel.classList.toggle("is-offscreen", !entries[0]?.isIntersecting),
      { threshold: 0.3 },
    ).observe(dayPanel);
    show(0, true);
  }

  /* ---------- FAQ: one open at a time ---------- */
  const faq = document.querySelector(".faq");
  faq?.querySelectorAll("details").forEach((d) => {
    d.addEventListener("toggle", () => {
      if (!d.open) return;
      faq.querySelectorAll("details[open]").forEach((o) => {
        if (o !== d) o.open = false;
      });
    });
  });
})();
