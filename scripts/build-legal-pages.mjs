import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const CSS = "/landing.css?v=36";

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
    ctaTitle: "კონფიდენციალობის მოთხოვნა",
    ctaBody: "წვდომა, გასწორება, წაშლა ან ნებისმიერი კითხვა თქვენს მონაცემებზე — მოგვწერეთ.",
    ctaNoteHtml:
      'სრული პოლიტიკა ყოველთვის ხელმისაწვდომია <a href="/privacy">medicard.ge/privacy</a>-ზე. აპშიც: პროფილი → კონფიდენციალურობა.',
    ctaIcon: "lock",
    current: "privacy",
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
  },
];

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
  const meta = { updated: "", effective: "" };
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
    const updated = line.match(/^\*\*ბოლო განახლება:\*\*\s*(.+)$/);
    if (updated) {
      meta.updated = updated[1].trim();
      i += 1;
      continue;
    }
    const effective = line.match(/^\*\*ძალაში შესვლის თარიღი:\*\*\s*(.+)$/);
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
      !/^\*\*ბოლო/.test(lines[i]) &&
      !/^\*\*[^:]{2,40}:\*\*\s+\S/.test(lines[i]) &&
      !/^[^#*\d][^:]{1,40}:\s*\*\*/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    if (para.length) blocks.push({ type: "p", text: para.join(" ") });
  }
  return { meta, blocks };
}

function renderBlocks(blocks) {
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
      const warn =
        /არ წარმოადგენს ექიმს|არ წარმოადგენს სამედიცინო|არ წარმოადგენს დიაგნოზს|არ არის განკუთვნილი გადაუდებელი|არ უნდა გამოიყენოთ როგორც|არ დაიწყოთ, არ შეწყვიტოთ|არ ცვლის ექიმს/.test(
          b.text,
        );
      const noSell = b.text.includes("არ ყიდის თქვენს ჯანმრთელობის მონაცემებს");
      const slogan = b.text.includes("შენი ჯანმრთელობა. შენი ისტორია");
      const principles = b.text.includes("მონაცემთა მინიმიზაცია");
      if (warn && b.text.length < 280) {
        html.push(`<div class="legal-box warn"><h3>${inline(b.text.replace(/^\*\*|\*\*$/g, ""))}</h3></div>`);
        continue;
      }
      if (noSell) {
        html.push(`<div class="legal-box ok"><h3>${inline(b.text)}</h3></div>`);
        continue;
      }
      if (principles && b.text.includes("კონფიდენციალურობა")) {
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
      if (slogan) {
        html.push(`<p class="legal-slogan">${inline(b.text.replaceAll("**", "").replace(/^MEDICARD — /, ""))}</p>`);
        continue;
      }
      html.push(`<p>${inline(b.text)}</p>`);
    }
  }
  return html.join("\n          ");
}

function pageHtml(page, meta, blocks) {
  const article = renderBlocks(blocks);
  const toc = blocks
    .filter((b) => b.type === "h2")
    .map((b, i) => {
      const n = String(i + 1).padStart(2, "0");
      return `          <a href="#${b.id}"><em>${n}</em>${escapeHtml(b.label)}</a>`;
    })
    .join("\n");
  const chips = page.chips.map((c) => `          <span class="chip">${escapeHtml(c)}</span>`).join("\n");
  const privacyCurrent = page.current === "privacy" ? ' aria-current="page"' : "";
  const termsCurrent = page.current === "terms" ? ' aria-current="page"' : "";

  return `<!DOCTYPE html>
<html lang="ka" data-theme="light">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(page.title)} — მედიქარდი</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <link rel="canonical" href="https://medicard.ge${page.path}" />
  <meta name="theme-color" content="#f3f5f6" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="ka_GE" />
  <meta property="og:url" content="https://medicard.ge${page.path}" />
  <meta property="og:title" content="${escapeHtml(page.title)} — მედიქარდი" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:image" content="https://medicard.ge/screens/home.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/icon.png" />
  <link rel="preload" href="/fonts/firago/FiraGO-Regular.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/fonts/davit-guramishvili/DM-Davit-Guramishvili.ttf" as="font" type="font/ttf" crossorigin />
  <link rel="stylesheet" href="${CSS}" />
</head>
<body>
  <header class="nav">
    <div class="wrap nav-inner">
      <a class="brand" href="/">
        <img src="/icon.png" width="36" height="36" alt="" />
        მედიქარდი
      </a>
      <nav class="nav-links" aria-label="მენიუ">
        <a href="/"><span class="ic ic-house" aria-hidden="true"></span>მთავარი გვერდი</a>
        <a href="/#how"><span class="ic ic-chat" aria-hidden="true"></span>Medi</a>
        <a href="/#features"><span class="ic ic-health" aria-hidden="true"></span>ფუნქციები</a>
        <a href="/privacy"${privacyCurrent}><span class="ic ic-lock" aria-hidden="true"></span>კონფიდენციალურობა</a>
        <a href="/terms"${termsCurrent}>წესები</a>
        <a class="nav-download" href="/#download"><span class="ic ic-download" aria-hidden="true"></span>ჩამოტვირთვა</a>
      </nav>
      <div class="nav-actions">
        <button class="theme-btn" id="theme-toggle" type="button" aria-label="თემის შეცვლა">
          <span class="ic ic-moon icon-moon" aria-hidden="true"></span>
          <span class="ic ic-sun icon-sun" aria-hidden="true"></span>
        </button>
        <button class="menu-btn" id="menu-toggle" type="button" aria-label="მენიუ" aria-expanded="false">
          <span class="ic ic-menu" aria-hidden="true"></span>
        </button>
        <a class="btn btn-cta" href="/#download"><span class="ic ic-download" aria-hidden="true"></span>ჩამოტვირთვა</a>
      </div>
    </div>
  </header>

  <main>
    <section class="legal-hero band-dark">
      <div class="wrap">
        <h1 class="kicker">${escapeHtml(page.title)}</h1>
        <p class="lead">${escapeHtml(page.lead)}</p>
        <div class="legal-dates">
          <article>
            <small>ბოლო განახლება</small>
            <b>${escapeHtml(meta.updated)}</b>
          </article>
          <article>
            <small>ძალაში შესვლის თარიღი</small>
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
        <nav class="legal-toc" aria-label="სარჩევი">
          <p class="kicker">სარჩევი</p>
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
            <span><small>ძალაშია</small><b>${escapeHtml(meta.effective)}</b></span>
          </article>
        </div>
      </div>
    </section>
  </main>

  <footer class="band-paper">
    <div class="wrap">
      <div class="disclaimer" id="disclaimer"><strong>ეს არ არის საბოლოო დიაგნოზი.</strong>
          Medi და აპის ანალიზები ეხმარება გაგებაში, მაგრამ არ ცვლის ექიმის კონსულტაციას,
          დანიშნულებას ან სასწრაფო დახმარებას. თუ მდგომარეობა მძიმეა — მიმართე სპეციალისტს ან 112-ს.</div>
      <div class="foot-top">
        <div>
          <a class="brand" href="/">
            <img src="/icon.png" width="36" height="36" alt="" />
            მედიქარდი
          </a>
          <p class="foot-note">Medicard.GE · მხოლოდ iOS და Android</p>
        </div>
        <a class="foot-mail" href="mailto:support@medicard.ge">support@medicard.ge</a>
        <p class="foot-note">ანგარიში, ჩატი და ციკლი მხოლოდ ტელეფონზეა.</p>
      </div>
      <div class="foot-legal">
        <p>© <span id="y"></span> Medicard.GE</p>
        <p>
          <a href="/privacy"${privacyCurrent}>კონფიდენციალურობა</a>
          · <a href="/terms"${termsCurrent}>წესები</a>
          · <a href="/#disclaimer">პასუხისმგებლობა</a>
        </p>
      </div>
    </div>
  </footer>
  <script src="/landing.js?v=15"></script>
</body>
</html>
`;
}

for (const page of pages) {
  const md = await readFile(fileURLToPath(new URL(page.source, root)), "utf8");
  const { meta, blocks } = parseMarkdown(md);
  const html = pageHtml(page, meta, blocks);
  if (html.includes("\uFFFD")) throw new Error(`replacement character in ${page.out}`);
  const out = fileURLToPath(new URL(page.out, root));
  await writeFile(out, html, "utf8");
  console.log("wrote", page.out, "h2", blocks.filter((b) => b.type === "h2").length, meta);
}
