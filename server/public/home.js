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

  // Day: the moment nearest the middle of the viewport drives the sticky phone.
  const dayPhone = document.getElementById("day-phone");
  const moments = [...document.querySelectorAll(".moment")];
  if (dayPhone && moments.length) {
    let active = moments[0];
    const pick = () => {
      const mid = window.innerHeight * 0.45;
      let best = moments[0];
      let bestDist = Infinity;
      for (const m of moments) {
        const r = m.getBoundingClientRect();
        const c = r.top + r.height / 2;
        const d = Math.abs(c - mid);
        if (d < bestDist) {
          bestDist = d;
          best = m;
        }
      }
      if (best !== active) {
        active = best;
        moments.forEach((m) => m.classList.toggle("is-on", m === best));
        setScreen(dayPhone, best.dataset.key);
      }
    };
    let ticking = false;
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          pick();
          ticking = false;
        });
      },
      { passive: true },
    );
    pick();
    moments.forEach((m) => {
      m.addEventListener("click", () => {
        moments.forEach((x) => x.classList.toggle("is-on", x === m));
        active = m;
        setScreen(dayPhone, m.dataset.key);
      });
    });
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
