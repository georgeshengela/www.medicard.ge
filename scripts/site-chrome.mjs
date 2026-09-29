// Shared header/footer for the generated public pages (calculators, privacy, terms).
// The navigation itself is rendered by server/public/site-nav.js so every page gets the same menu.

export const SITE_STYLES = `  <link rel="stylesheet" href="/site-nav.css?v=7" />
  <link rel="stylesheet" href="/site-refresh.css?v=2" />`;

export const SITE_HEADER = `  <header class="tb" id="topbar"></header>
  <script src="/site-nav.js?v=8"></script>`;

const FOOT_LINKS = [
  ["/about", "ჩვენ შესახებ"],
  ["/contact", "კონტაქტი"],
  ["/privacy", "კონფიდენციალურობა"],
  ["/terms", "წესები"],
  ["/delete-account", "ანგარიშის წაშლა"],
  ["/calculators", "კალკულატორები"],
];

export function siteFooter({ disclaimer, current = "" } = {}) {
  const links = FOOT_LINKS.map(
    ([href, label]) => `          <a href="${href}"${href === current ? ' aria-current="page"' : ""}>${label}</a>`,
  ).join("\n");
  return `  <footer class="sf-foot">
    <div class="wrap">
      <p class="disclaimer" id="disclaimer"><strong>ეს არ არის დიაგნოზი.</strong> ${disclaimer}</p>
      <div class="sf-row">
        <a class="sf-brand" href="/"><img src="/icon.png" width="28" height="28" alt="" /><span>მედიქარდი</span></a>
        <nav class="sf-links" aria-label="საიტის ბმულები">
${links}
        </nav>
        <p class="sf-copy">© <span id="y">2026</span> Medicard.GE</p>
      </div>
    </div>
  </footer>`;
}

export const DISCLAIMER_APP =
  "Medi და აპის ანალიზები ეხმარება გაგებაში, მაგრამ არ ცვლის ექიმის კონსულტაციას, დანიშნულებას ან სასწრაფო დახმარებას. თუ მდგომარეობა მძიმეა — მიმართე სპეციალისტს ან დარეკე 112-ზე.";

export const DISCLAIMER_CALC =
  "კალკულატორები, Medi და აპის ანალიზები ეხმარება გაგებაში, მაგრამ არ ცვლის ექიმის კონსულტაციას, დანიშნულებას ან სასწრაფო დახმარებას. ციკლის პროგნოზი არ არის კონტრაცეფცია. თუ მდგომარეობა მძიმეა — მიმართე სპეციალისტს ან დარეკე 112-ზე.";
