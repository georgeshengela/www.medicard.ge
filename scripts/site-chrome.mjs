// Shared header/footer for the generated public pages (calculators, privacy, terms).
// The navigation itself is rendered by server/public/site-nav.js so every page gets the same menu.
// English copy rides along as data-en / data-en-html (server/public/site-i18n.js swaps it in).

export const SITE_STYLES = `  <link rel="stylesheet" href="/site-nav.css?v=9" />
  <link rel="stylesheet" href="/site-refresh.css?v=2" />`;

export const SITE_HEADER = `  <header class="tb" id="topbar"></header>
  <script src="/site-nav.js?v=8"></script>`;

/** Attribute value escaping for data-en* (keeps our own markup in data-en-html). */
export function enAttr(s) {
  return String(s).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

const FOOT_LINKS = [
  ["/about", "ჩვენ შესახებ", "About"],
  ["/contact", "კონტაქტი", "Contact"],
  ["/privacy", "კონფიდენციალურობა", "Privacy"],
  ["/terms", "წესები", "Terms"],
  ["/delete-account", "ანგარიშის წაშლა", "Delete account"],
  ["/calculators", "კალკულატორები", "Calculators"],
];

export const DISCLAIMER_APP =
  "Medi და აპის ანალიზები ეხმარება გაგებაში, მაგრამ არ ცვლის ექიმის კონსულტაციას, დანიშნულებას ან სასწრაფო დახმარებას. თუ მდგომარეობა მძიმეა — მიმართე სპეციალისტს ან დარეკე 112-ზე.";

export const DISCLAIMER_CALC =
  "კალკულატორები, Medi და აპის ანალიზები ეხმარება გაგებაში, მაგრამ არ ცვლის ექიმის კონსულტაციას, დანიშნულებას ან სასწრაფო დახმარებას. ციკლის პროგნოზი არ არის კონტრაცეფცია. თუ მდგომარეობა მძიმეა — მიმართე სპეციალისტს ან დარეკე 112-ზე.";

const DISCLAIMER_EN = {
  [DISCLAIMER_APP]:
    "Medi and the app's analyses help you understand, but they don't replace a doctor's consultation, a prescription or emergency care. If it's serious, see a specialist or call 112.",
  [DISCLAIMER_CALC]:
    "The calculators, Medi and the app's analyses help you understand, but they don't replace a doctor's consultation, a prescription or emergency care. A cycle forecast is not contraception. If it's serious, see a specialist or call 112.",
};

export function siteFooter({ disclaimer, disclaimerEn = DISCLAIMER_EN[disclaimer], current = "" } = {}) {
  const links = FOOT_LINKS.map(
    ([href, label, en]) =>
      `          <a href="${href}"${href === current ? ' aria-current="page"' : ""} data-en="${enAttr(en)}">${label}</a>`,
  ).join("\n");
  const disclaimerAttr = disclaimerEn
    ? ` data-en-html="${enAttr(`<strong>This is not a diagnosis.</strong> ${disclaimerEn}`)}"`
    : "";
  return `  <footer class="sf-foot">
    <div class="wrap">
      <p class="disclaimer" id="disclaimer"${disclaimerAttr}><strong>ეს არ არის დიაგნოზი.</strong> ${disclaimer}</p>
      <div class="sf-row">
        <a class="sf-brand" href="/"><img src="/icon.png" width="28" height="28" alt="" /><span data-en="MEDICARD">მედიქარდი</span></a>
        <nav class="sf-links" aria-label="საიტის ბმულები" data-en-aria-label="Site links">
${links}
        </nav>
        <p class="sf-copy">© <span id="y">2026</span> Medicard.GE</p>
      </div>
    </div>
  </footer>`;
}
