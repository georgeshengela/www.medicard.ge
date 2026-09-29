import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SITE_STYLES, SITE_HEADER, siteFooter, DISCLAIMER_APP } from "./site-chrome.mjs";

const root = new URL("../", import.meta.url);
const CSS = "/landing.css?v=39";

const pages = [
  {
    source: "scripts/privacy-source.md",
    out: "server/public/privacy.html",
    path: "/privacy",
    title: "კონფიდენციალურობის პოლიტიკა",
    description:
      "MEDICARD-ის კონფიდენციალურობის პოლიტიკა. რა პერსონალურ და ჯანმრთელობის მონაცემებს ვაგროვებთ, როგორ ვიცავთ და რა უფლებები გაქვთ.",
    lead: "MEDICARD-ისთვის თქვენი პირადი და ჯანმრთელობის მონაცემების კონფიდენციალურობა უმნიშვნელოვანესია. ეს პოლიტიკა განმარტავს, რა ვაგროვებთ, რატომ ვამუშავებთ, როგორ ვიცავთ და რა უფლებები გაქვთ.",
    chips: ["ჯანმრთელობის მონაცემები არ იყიდება", "Privacy by Design", "Medi არ არის ექიმი"],
    ctaTitle: "კონფიდენციალურობის მოთხოვნა",
    ctaBody: "წვდომა, გასწორება, წაშლა ან ნებისმიერი კითხვა თქვენს მონაცემებზე — მოგვწერეთ.",
    ctaNoteHtml:
      'სრული პოლიტიკა ყოველთვის ხელმისაწვდომია <a href="/privacy">medicard.ge/privacy</a>-ზე. აპშიც: პროფილი → კონფიდენციალურობა.',
    ctaIcon: "lock",
    current: "privacy",
    lang: "ka",
    altPath: "/privacy-en",
  },
  {
    source: "scripts/terms-source.md",
    out: "server/public/terms.html",
    path: "/terms",
    title: "წესები და პირობები",
    description:
      "MEDICARD-ის წესები და პირობები. როგორ გამოიყენება აპი, რა შეზღუდვები აქვს Medi-ს და რა პასუხისმგებლობა გაქვთ.",
    lead: "კეთილი იყოს თქვენი მობრძანება MEDICARD-ში. ეს წესები არეგულირებს აპლიკაციისა და მასთან დაკავშირებული სერვისების გამოყენებას.",
    chips: ["Medi არ არის ექიმი", "არ არის გადაუდებელი დახმარება", "ციკლი არ არის კონტრაცეფცია"],
    ctaTitle: "კითხვა წესებზე",
    ctaBody: "წესები, ანგარიში ან სამართლებრივი საკითხი — მოგვწერეთ.",
    ctaNoteHtml:
      'სრული წესები ხელმისაწვდომია <a href="/terms">medicard.ge/terms</a>-ზე. აპშიც: პროფილი → წესები და პირობები.',
    ctaIcon: "shield",
    current: "terms",
    lang: "ka",
    altPath: "/terms-en",
  },
  // English translations. Same section structure as the Georgian source (checked block by block);
  // the Georgian version prevails. The site language switch (site-i18n.js) moves between each pair.
  {
    source: "scripts/privacy-source.en.md",
    kaSource: "scripts/privacy-source.md",
    out: "server/public/privacy-en.html",
    path: "/privacy-en",
    title: "Privacy Policy",
    description:
      "MEDICARD's privacy policy: what personal and health data we collect, how we protect it and what rights you have.",
    lead: "The privacy of your personal and health data matters greatly to MEDICARD. This policy explains what we collect, why we process it, how we protect it and what rights you have.",
    chips: ["Health data is never sold", "Privacy by Design", "Medi is not a doctor"],
    ctaTitle: "Privacy request",
    ctaBody: "Access, correction, deletion or any question about your data — write to us.",
    ctaNoteHtml:
      'The full policy is always available at <a href="/privacy-en">medicard.ge/privacy-en</a>. In the app: Profile → Privacy.',
    ctaIcon: "lock",
    current: "privacy",
    lang: "en",
    altPath: "/privacy",
  },
  {
    source: "scripts/terms-source.en.md",
    kaSource: "scripts/terms-source.md",
    out: "server/public/terms-en.html",
    path: "/terms-en",
    title: "Terms of Use",
    description:
      "MEDICARD's terms of use: how the app may be used, what Medi's limitations are and what you are responsible for.",
    lead: "Welcome to MEDICARD. These terms govern the use of the application and the services connected with it.",
    chips: ["Medi is not a doctor", "Not an emergency service", "Cycle tracking is not contraception"],
    ctaTitle: "Questions about the terms",
    ctaBody: "The terms, your account or a legal matter — write to us.",
    ctaNoteHtml:
      'The full terms are available at <a href="/terms-en">medicard.ge/terms-en</a>. In the app: Profile → Terms of Use.',
    ctaIcon: "shield",
    current: "terms",
    lang: "en",
    altPath: "/terms",
  },
];

const UI = {
  ka: {
    updated: "ბოლო განახლება",
    effective: "ძალაში შესვლის თარიღი",
    toc: "სარჩევი",
    inForce: "ძალაშია",
    brand: "მედიქარდი",
    locale: "ka_GE",
  },
  en: {
    updated: "Last updated",
    effective: "Effective date",
    toc: "Contents",
    inForce: "In force",
    brand: "MEDICARD",
    locale: "en_US",
  },
};

// The English sources open with this line; it is shown as a notice at the top of the article.
const EN_NOTE = /^This is an English translation\b/;

const EN_FOOT_LINKS = [
  ["/about", "About"],
  ["/contact", "Contact"],
  ["/privacy-en", "Privacy"],
  ["/terms-en", "Terms"],
  ["/delete-account", "Delete account"],
  ["/calculators", "Calculators"],
];

function siteFooterEn({ current = "" } = {}) {
  const links = EN_FOOT_LINKS.map(
    ([href, label]) => `          <a href="${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a>`,
  ).join("\n");
  return `  <footer class="sf-foot">
    <div class="wrap">
      <p class="disclaimer" id="disclaimer"><strong>This is not a diagnosis.</strong> Medi and the app's analyses help you understand, but they do not replace a doctor's consultation, prescription or emergency care. If your condition is serious, see a specialist or call 112.</p>
      <div class="sf-row">
        <a class="sf-brand" href="/"><img src="/icon.png" width="28" height="28" alt="" /><span>MEDICARD</span></a>
        <nav class="sf-links" aria-label="Site links">
${links}
        </nav>
        <p class="sf-copy">© <span id="y">2026</span> Medicard.GE</p>
      </div>
    </div>
  </footer>`;
}

function escapeHtml(s) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(s) {
  let out = escapeHtml(s);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\b(support@medicard\.ge)\b/g, '<a href="mailto:$1">$1</a>');
  out = out.replace(/\b(https:\/\/medicard\.ge(?:\/[^\s<]*)?)\b/g, '<a href="$1">$1</a>');
  return out;
}

function parseMarkdown(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const meta = { updated: "", effective: "", note: "" };
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (i === 0 && line.startsWith("# ") && !/^\d+\./.test(line.slice(2))) {
      i += 1;
      continue;
    }
    const updated = line.match(/^\*\*(?:ბოლო განახლება|Last updated):\*\*\s*(.+)$/);
    if (updated) {
      meta.updated = updated[1].trim();
      i += 1;
      continue;
    }
    const effective = line.match(/^\*\*(?:ძალაში შესვლის თარიღი|Effective date):\*\*\s*(.+)$/);
    if (effective) {
      meta.effective = effective[1].trim();
      i += 1;
      continue;
    }
    const h1 = line.match(/^# (\d+)\.\s*(.+)$/);
    if (h1) {
      blocks.push({ type: "h2", id: `s${h1[1]}`, text: `${h1[1]}. ${h1[2]}`, label: h1[2] });
      i += 1;
      continue;
    }
    if (line.startsWith("## ") || line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.replace(/^#+\s/, "") });
      i += 1;
      continue;
    }
    if (line.startsWith("* ")) {
      const items = [];
      while (i < lines.length && lines[i].startsWith("* ")) {
        items.push(lines[i].slice(2));
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }
    if (/^\*\*[^:]{2,40}:\*\*\s+\S/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\*\*[^:]+:\*\*\s+\S/.test(lines[i])) {
        const m = lines[i].match(/^\*\*([^:]+):\*\*\s*(.+)$/);
        if (m) rows.push([m[1], m[2]]);
        i += 1;
      }
      blocks.push({ type: "id", rows });
      continue;
    }
    if (/^[^#*\d][^:]{1,40}:\s*\*\*/.test(line)) {
      const rows = [];
      while (i < lines.length) {
        const m = lines[i].match(/^([^:]+):\s*\*\*(.+)\*\*\s*$/);
        if (!m) break;
        rows.push([m[1].trim(), m[2].trim()]);
        i += 1;
      }
      if (rows.length) {
        blocks.push({ type: "id", rows });
        continue;
      }
    }
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3} /.test(lines[i]) &&
      !lines[i].startsWith("* ") &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^\*\*(?:ბოლო|Last updated|Effective date)/.test(lines[i]) &&
      !/^\*\*[^:]{2,40}:\*\*\s+\S/.test(lines[i]) &&
      !/^[^#*\d][^:]{1,40}:\s*\*\*/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length) {
      const text = para.join(" ");
      if (!blocks.length && !meta.note && EN_NOTE.test(text)) meta.note = text;
      else blocks.push({ type: "p", text });
    }
  }
  return { meta, blocks };
}

// Paragraph styling is decided on the Georgian text; the English page reuses it block by block.
function classify(b) {
  if (b.type !== "p") return "";
  const warn =
    /არ წარმოადგენს ექიმს|არ წარმოადგენს სამედიცინო|არ წარმოადგენს დიაგნოზს|არ არის განკუთვნილი გადაუდებელი|არ უნდა გამოიყენოთ როგორც|არ დაიწყოთ, არ შეწყვიტოთ|არ ცვლის ექიმს/.test(
      b.text,
    );
  if (warn && b.text.length < 280) return "warn";
  if (b.text.includes("არ ყიდის თქვენს ჯანმრთელობის მონაცემებს")) return "ok";
  if (b.text.includes("მონაცემთა მინიმიზაცია") && b.text.includes("კონფიდენციალურობა")) return "pillars";
  if (b.text.includes("ყველაფერი შენი ჯანმრთელობისთვის")) return "slogan";
  return "";
}

// The translation must keep the Georgian structure: same headings, list lengths and paragraph count.
function checkParity(page, en, ka) {
  const shape = (list) =>
    list.map((b) =>
      b.type === "h2"
        ? `h2:${b.id}`
        : b.type === "ul" || b.type === "ol"
          ? `${b.type}:${b.items.length}`
          : b.type === "id"
            ? `id:${b.rows.length}`
            : b.type,
    );
  const a = shape(en);
  const k = shape(ka);
  const at = a.findIndex((x, i) => x !== k[i]);
  if (a.length !== k.length || at !== -1) {
    const i = at === -1 ? Math.min(a.length, k.length) : at;
    const sample = JSON.stringify(en[i]?.text || en[i]?.items || en[i]?.rows || "").slice(0, 120);
    throw new Error(`${page.source} does not match ${page.kaSource} at block ${i}: ${a[i]} vs ${k[i]} ${sample}`);
  }
}

function renderBlocks(blocks, kinds = blocks.map(classify)) {
  const html = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    if (b.type === "h2") {
      html.push(`<h2 id="${b.id}">${inline(b.text)}</h2>`);
      continue;
    }
    if (b.type === "h3") {
      html.push(`<h3>${inline(b.text)}</h3>`);
      continue;
    }
    if (b.type === "ul" || b.type === "ol") {
      const named = b.type === "ul" && b.items.every((item) => item.includes(" — ")) && b.items.length >= 4;
      if (named) {
        html.push('<div class="legal-providers">');
        for (const item of b.items) {
          const [name, role] = item.split(" — ");
          html.push(`<article><b>${inline(name)}</b><span>${inline(role)}</span></article>`);
        }
        html.push("</div>");
        continue;
      }
      const tag = b.type === "ol" ? "ol" : "ul";
      html.push(`<${tag}>`);
      for (const item of b.items) html.push(`<li>${inline(item)}</li>`);
      html.push(`</${tag}>`);
      continue;
    }
    if (b.type === "id") {
      html.push('<div class="legal-box"><dl class="legal-id">');
      for (const [k, v] of b.rows) {
        html.push(`<div><dt>${inline(k)}</dt><dd>${inline(v)}</dd></div>`);
      }
      html.push("</dl></div>");
      continue;
    }
    if (b.type === "p") {
      const kind = kinds[i];
      if (kind === "warn") {
        html.push(`<div class="legal-box warn"><h3>${inline(b.text.replace(/^\*\*|\*\*$/g, ""))}</h3></div>`);
        continue;
      }
      if (kind === "ok") {
        html.push(`<div class="legal-box ok"><h3>${inline(b.text)}</h3></div>`);
        continue;
      }
      if (kind === "pillars") {
        const parts = b.text
          .replaceAll("**", "")
          .split(/[.\n]/)
          .map((s) => s.trim())
          .filter((s) => s && !s.startsWith("MEDICARD"));
        if (parts.length >= 4) {
          html.push('<div class="legal-pillars">');
          for (const part of parts.slice(0, 5)) html.push(`<span>${inline(part)}</span>`);
          html.push("</div>");
          continue;
        }
      }
      if (kind === "slogan") {
        html.push(`<p class="legal-slogan">${inline(b.text.replaceAll("**", "").replace(/^MEDICARD — /, ""))}</p>`);
        continue;
      }
      html.push(`<p>${inline(b.text)}</p>`);
    }
  }
  return html.join("\n          ");
}

function pageHtml(page, meta, blocks, kinds) {
  const ui = UI[page.lang];
  const en = page.lang === "en";
  const kaPath = en ? page.altPath : page.path;
  const enPath = en ? page.path : page.altPath;
  const note = meta.note ? `<div class="legal-box"><p>${inline(meta.note)}</p></div>\n          ` : "";
  const article = note + renderBlocks(blocks, kinds);
  const toc = blocks
    .filter((b) => b.type === "h2")
    .map((b, i) => {
      const n = String(i + 1).padStart(2, "0");
      return `          <a href="#${b.id}"><em>${n}</em>${escapeHtml(b.label)}</a>`;
    })
    .join("\n");
  const chips = page.chips.map((c) => `          <span class="chip">${escapeHtml(c)}</span>`).join("\n");
  // Opening the English URL is a language choice (like ?lang=en); site-i18n.js would otherwise
  // send a visitor with no stored choice back to the Georgian page.
  const enChoice = en
    ? `  <script>try{if(!/[?&]lang=/.test(location.search))localStorage.setItem("medicard.lang","en")}catch(e){}</script>\n`
    : "";

  return `<!DOCTYPE html>
<html lang="${page.lang}" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)} — ${ui.brand}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <link rel="canonical" href="https://medicard.ge${page.path}" />
  <link rel="alternate" hreflang="ka" href="https://medicard.ge${kaPath}" />
  <link rel="alternate" hreflang="en" href="https://medicard.ge${enPath}" />
  <link rel="alternate" hreflang="x-default" href="https://medicard.ge${kaPath}" />
  <meta name="medicard:${en ? "ka" : "en"}" content="${page.altPath}" />
${enChoice}  <script src="/site-i18n.js?v=1"></script>
  <meta name="theme-color" content="#E8F5F2" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="${ui.locale}" />
  <meta property="og:url" content="https://medicard.ge${page.path}" />
  <meta property="og:title" content="${escapeHtml(page.title)} — ${ui.brand}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:image" content="https://medicard.ge/screens/home.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/icon.png" />
  <link rel="preload" href="/fonts/firago/FiraGO-Regular.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="stylesheet" href="${CSS}" />
${SITE_STYLES}
</head>
<body class="site-refresh">
${SITE_HEADER}

  <main>
    <section class="legal-hero band-dark">
      <div class="wrap">
        <h1 class="kicker">${escapeHtml(page.title)}</h1>
        <p class="lead">${escapeHtml(page.lead)}</p>
        <div class="legal-dates">
          <article>
            <small>${ui.updated}</small>
            <b>${escapeHtml(meta.updated)}</b>
          </article>
          <article>
            <small>${ui.effective}</small>
            <b>${escapeHtml(meta.effective)}</b>
          </article>
        </div>
        <div class="chips">
${chips}
        </div>
      </div>
    </section>

    <section class="legal-body band-paper">
      <div class="wrap legal-shell">
        <nav class="legal-toc" aria-label="${ui.toc}">
          <p class="kicker">${ui.toc}</p>
${toc}
        </nav>
        <article class="legal-article">
          ${article}
        </article>
      </div>
    </section>

    <section class="ask band-cta" id="request">
      <div class="wrap ask-grid">
        <div class="ask-copy">
          <h2>${escapeHtml(page.ctaTitle)}</h2>
          <p>${escapeHtml(page.ctaBody)}</p>
          <a class="ask-mail" href="mailto:support@medicard.ge"><span class="ic ic-chat" aria-hidden="true"></span>support@medicard.ge</a>
        </div>
        <div class="ask-side">
          <article class="ask-card">
            <span class="ic ic-lg ic-${page.ctaIcon}" aria-hidden="true"></span>
            <p>${page.ctaNoteHtml}</p>
          </article>
          <article class="ask-date">
            <span class="ic ic-calendar" aria-hidden="true"></span>
            <span><small>${ui.inForce}</small><b>${escapeHtml(meta.effective)}</b></span>
          </article>
        </div>
      </div>
    </section>
  </main>

${en ? siteFooterEn({ current: page.path }) : siteFooter({ disclaimer: DISCLAIMER_APP, current: page.path })}
  <script src="/landing.js?v=17"></script>
</body>
</html>
`;
}

for (const page of pages) {
  const md = await readFile(fileURLToPath(new URL(page.source, root)), "utf8");
  const { meta, blocks } = parseMarkdown(md);
  let kinds;
  if (page.kaSource) {
    const ka = parseMarkdown(await readFile(fileURLToPath(new URL(page.kaSource, root)), "utf8"));
    checkParity(page, blocks, ka.blocks);
    if (!meta.note) throw new Error(`${page.source}: missing the "This is an English translation" line`);
    if (/[ა-ჿ]/.test(meta.updated + meta.effective)) throw new Error(`${page.source}: dates must be in English`);
    kinds = ka.blocks.map(classify);
  }
  const html = pageHtml(page, meta, blocks, kinds);
  if (html.includes("�")) throw new Error(`replacement character in ${page.out}`);
  const out = fileURLToPath(new URL(page.out, root));
  await writeFile(out, html, "utf8");
  console.log("wrote", page.out, "h2", blocks.filter((b) => b.type === "h2").length, meta.updated, "/", meta.effective);
}
