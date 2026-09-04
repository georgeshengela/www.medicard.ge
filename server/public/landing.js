(() => {
  const root = document.documentElement;
  const year = document.getElementById("y");
  if (year) year.textContent = String(new Date().getFullYear());

  const stored = localStorage.getItem("medicard.landing.theme");
  applyTheme(stored === "light" || stored === "dark" ? stored : "light");

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("medicard.landing.theme", next);
    applyTheme(next);
  });

  const nav = document.querySelector(".nav");
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

  function updateNavTone() {
    const y = (nav?.getBoundingClientRect().bottom || 72) + 10;
    const probe = document.elementFromPoint(Math.min(120, window.innerWidth / 2), y);
    const light = Boolean(probe?.closest(".band-paper, .band-soft, .band-cta, footer"));
    nav?.classList.toggle("on-light", light);
  }
  updateNavTone();
  window.addEventListener("scroll", updateNavTone, { passive: true });
  window.addEventListener("resize", updateNavTone);

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

  function applyTheme(theme) {
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f3f5f6" : "#030712");
    updateNavTone();
  }

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
