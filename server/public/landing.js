(() => {
  const root = document.documentElement;
  const year = document.getElementById("y");
  if (year) year.textContent = String(new Date().getFullYear());

  const stored = localStorage.getItem("medicard.landing.theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(stored === "light" || stored === "dark" ? stored : systemDark ? "dark" : "light");

  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem("medicard.landing.theme", next);
    applyTheme(next);
  });

  const nav = document.querySelector(".nav");
  const onScroll = () => nav?.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

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
    { threshold: 0.14 },
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  const labels = {
    home: "მთავარი",
    medi: "Medi",
    cycle: "ციკლი",
    symptoms: "სიმპტომები",
    metrics: "მაჩვენებლები",
    meds: "მედები",
    streak: "სტრიკი",
    profile: "პროფილი",
    hydration: "ჰიდრატაცია",
    signin: "შესვლა",
  };
  const order = ["home", "medi", "cycle", "symptoms", "metrics", "meds", "streak", "profile"];
  const phone = document.getElementById("stage-phone");
  const caption = document.getElementById("phone-caption");
  const counter = document.getElementById("phone-count");
  const chapters = [...document.querySelectorAll(".chapter[data-screen]")];
  const dock = document.getElementById("phone-dock");
  const dayBtns = [...document.querySelectorAll("[data-day]")];
  const cards = [...document.querySelectorAll(".card[data-screen]")];
  let current = "home";
  let autoplay = null;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setScreen(key, { scrollChapter = false } = {}) {
    if (!phone || !labels[key]) return;
    current = key;
    phone.querySelectorAll(".phone-screen img").forEach((img) => {
      img.classList.toggle("is-on", img.dataset.key === key);
    });
    if (caption) caption.textContent = labels[key];
    if (counter) {
      const i = order.indexOf(key);
      counter.textContent = i >= 0 ? `${String(i + 1).padStart(2, "0")} / ${String(order.length).padStart(2, "0")}` : "";
    }
    dock?.querySelectorAll("button").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.screen === key);
    });
    chapters.forEach((ch) => ch.classList.toggle("is-on", ch.dataset.screen === key));
    dayBtns.forEach((btn) => btn.classList.toggle("is-on", btn.dataset.day === key));
    cards.forEach((card) => card.classList.toggle("is-on", card.dataset.screen === key));
    if (scrollChapter) {
      const ch = chapters.find((el) => el.dataset.screen === key);
      ch?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    }
  }

  dock?.querySelectorAll("button").forEach((btn) => {
    if (!btn.title) btn.title = btn.textContent.trim();
    btn.addEventListener("click", () => {
      stopAuto();
      setScreen(btn.dataset.screen, { scrollChapter: true });
    });
  });
  dayBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      stopAuto();
      setScreen(btn.dataset.day, { scrollChapter: true });
    });
  });
  function phoneInView() {
    const theater = document.querySelector(".theater");
    if (!theater) return false;
    const r = theater.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 80;
  }
  cards.forEach((card) => {
    card.addEventListener("mouseenter", () => {
      if (phoneInView()) setScreen(card.dataset.screen);
    });
    card.addEventListener("focus", () => {
      if (phoneInView()) setScreen(card.dataset.screen);
    });
    const open = () => {
      stopAuto();
      setScreen(card.dataset.screen, { scrollChapter: true });
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });

  const chapterIo = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const key = visible.target.dataset.screen;
      if (key && key !== current) setScreen(key);
    },
    { rootMargin: "-28% 0px -42% 0px", threshold: [0.25, 0.5, 0.75] },
  );
  chapters.forEach((ch) => chapterIo.observe(ch));

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
      setScreen(order[(i + 1) % order.length]);
    }, 3200);
  }

  const hero = document.querySelector(".hero-copy") || document.getElementById("hero-chapter");
  if (hero && !reduced) {
    const heroIo = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) startAuto();
        else stopAuto();
      },
      { threshold: 0.45 },
    );
    heroIo.observe(hero);
  }

  window.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const i = order.indexOf(current);
    if (i < 0) return;
    stopAuto();
    const next = e.key === "ArrowRight" ? order[(i + 1) % order.length] : order[(i - 1 + order.length) % order.length];
    setScreen(next);
  });

  setScreen("home");

  function applyTheme(theme) {
    root.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "light" ? "#f3f5f6" : "#030712");
  }
})();
