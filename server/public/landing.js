(() => {
  const root = document.documentElement;
  const THEME_KEY = "medicard.landing.theme";
  const year = document.getElementById("y");
  if (year) year.textContent = String(new Date().getFullYear());

  function readTheme() {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      /* private mode */
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme, persist) {
    const next = theme === "dark" ? "dark" : "light";
    root.dataset.theme = next;
    root.style.colorScheme = next;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", next === "light" ? "#f3f5f6" : "#030712");
    document.querySelectorAll(".theme-btn").forEach((btn) => {
      const toLight = next === "dark";
      btn.setAttribute("aria-pressed", toLight ? "true" : "false");
      btn.setAttribute("aria-label", toLight ? "გადართე ღია თემაზე" : "გადართე მუქ თემაზე");
      btn.title = toLight ? "ღია თემა" : "მუქი თემა";
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
    btn.addEventListener("click", () => {
      applyTheme(root.dataset.theme === "dark" ? "light" : "dark", true);
    });
  });

  window.addEventListener("storage", (event) => {
    if (event.key === THEME_KEY && (event.newValue === "light" || event.newValue === "dark")) {
      applyTheme(event.newValue, false);
    }
  });

  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  const onScheme = () => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") return;
    } catch {
      return;
    }
    applyTheme(scheme.matches ? "dark" : "light", false);
  };
  if (typeof scheme.addEventListener === "function") scheme.addEventListener("change", onScheme);
  else if (typeof scheme.addListener === "function") scheme.addListener(onScheme);

  const links = document.querySelector(".nav-links");
  const menuBtn = document.getElementById("menu-toggle");
  menuBtn?.addEventListener("click", () => {
    const open = links?.classList.toggle("is-open");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  links?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      links.classList.remove("is-open");
      menuBtn?.setAttribute("aria-expanded", "false");
    });
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  const order = ["home", "medi", "cycle", "symptoms", "metrics", "meds", "streak", "profile"];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let current = "home";
  let autoplay = null;

  function setScreen(key, scope) {
    const rootEl = scope || document;
    rootEl.querySelectorAll(".phone-screen img").forEach((img) => {
      img.classList.toggle("is-on", img.dataset.key === key);
    });
    if (!scope || scope.id === "hero-phone") current = key;
    document.querySelectorAll(".fcard[data-screen], .card[data-screen]").forEach((card) => {
      card.classList.toggle("is-on", card.dataset.screen === key);
    });
    document.querySelectorAll("[data-day]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.day === key);
    });
  }

  function stopAuto() {
    if (autoplay) {
      clearInterval(autoplay);
      autoplay = null;
    }
  }
  function startAuto() {
    if (reduced || autoplay) return;
    autoplay = setInterval(() => {
      const i = order.indexOf(current);
      setScreen(order[(i + 1) % order.length], document.getElementById("hero-phone"));
    }, 3200);
  }

  const hero = document.querySelector(".hero-copy");
  if (hero && !reduced) {
    const heroIo = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) startAuto();
        else stopAuto();
      },
      { threshold: 0.35 },
    );
    heroIo.observe(hero);
  }

  function bindScreen(sel, phoneId) {
    document.querySelectorAll(sel).forEach((el) => {
      const show = () => {
        stopAuto();
        setScreen(el.dataset.screen || el.dataset.day, document.getElementById(phoneId));
      };
      el.addEventListener("mouseenter", show);
      el.addEventListener("focus", show);
      el.addEventListener("click", show);
    });
  }
  bindScreen(".card[data-screen]", "hero-phone");
  bindScreen("[data-day]", "hero-phone");

  window.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = order.indexOf(current);
    if (i < 0) return;
    stopAuto();
    const next = e.key === "ArrowRight" ? order[(i + 1) % order.length] : order[(i - 1 + order.length) % order.length];
    setScreen(next, document.getElementById("hero-phone"));
  });

  setScreen("home", document.getElementById("hero-phone"));

  const tocLinks = [...document.querySelectorAll(".legal-toc a[href^='#']")];
  const tocHeads = tocLinks
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  if (tocHeads.length) {
    const markToc = () => {
      const y = 120;
      let current = tocHeads[0];
      for (const el of tocHeads) {
        if (el.getBoundingClientRect().top <= y) current = el;
      }
      tocLinks.forEach((a) => a.classList.toggle("is-on", a.getAttribute("href") === `#${current.id}`));
    };
    markToc();
    window.addEventListener("scroll", markToc, { passive: true });
  }
})();
