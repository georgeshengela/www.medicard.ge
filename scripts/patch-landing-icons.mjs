import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../server/public/index.html", import.meta.url);
let h = readFileSync(path, "utf8");

h = h.replace("/landing.css?v=2", "/landing.css?v=3");
h = h.replace("/landing.js?v=2", "/landing.js?v=3");

h = h.replace('<a href="#product">', '<a href="#product"><span class="ic ic-house" aria-hidden="true"></span>');
h = h.replace('<a href="#medi">', '<a href="#medi"><span class="ic ic-chat" aria-hidden="true"></span>');
h = h.replace('<a href="#cycle">', '<a href="#cycle"><span class="ic ic-cycle" aria-hidden="true"></span>');
h = h.replace('<a href="#features">', '<a href="#features"><span class="ic ic-health" aria-hidden="true"></span>');
h = h.replace('<a href="#plans">', '<a href="#plans"><span class="ic ic-wallet" aria-hidden="true"></span>');

h = h.replace(
  /(<button class="theme-btn"[^>]*>)[\s\S]*?(<\/button>)/,
  `$1
          <span class="ic ic-moon icon-moon" aria-hidden="true"></span>
          <span class="ic ic-sun icon-sun" aria-hidden="true"></span>
        $2`,
);
h = h.replace(
  /(<button class="menu-btn"[^>]*>)[\s\S]*?(<\/button>)/,
  `$1
          <span class="ic ic-menu" aria-hidden="true"></span>
        $2`,
);
h = h.replace(
  /<a class="btn btn-cta" href="#download">(?!<span class="ic)/g,
  '<a class="btn btn-cta" href="#download"><span class="ic ic-download" aria-hidden="true"></span>',
);
h = h.replace(
  '<a class="btn btn-ghost" href="#features">',
  '<a class="btn btn-ghost" href="#features"><span class="ic ic-health" aria-hidden="true"></span>',
);

const dayIcons = {
  home: "house",
  meds: "pill",
  metrics: "steps",
  cycle: "cycle",
  medi: "chat",
  streak: "medal",
};
for (const [key, icon] of Object.entries(dayIcons)) {
  const re = new RegExp(`(<button type="button" data-day="${key}"[^>]*>)`);
  h = h.replace(re, `$1<span class="ic ic-${icon}" aria-hidden="true"></span>`);
}

h = h.replace(
  /<div class="phone-wrap">[\s\S]*?<div class="phone-screen">/,
  `<div class="phone-wrap">
            <figure class="iphone" id="stage-phone">
              <span class="iphone-btn action" aria-hidden="true"></span>
              <span class="iphone-btn vol-up" aria-hidden="true"></span>
              <span class="iphone-btn vol-down" aria-hidden="true"></span>
              <span class="iphone-btn power" aria-hidden="true"></span>
              <div class="iphone-bezel">
              <div class="phone-screen">`,
);
h = h.replace(
  /<\/div>\s*<\/figure>\s*<\/div>\s*<div class="phone-meta">/,
  `</div>
              </div>
            </figure>
          </div>
          <div class="phone-meta">`,
);

const dockIcons = {
  home: "house",
  medi: "chat",
  cycle: "cycle",
  symptoms: "body",
  metrics: "weight",
  meds: "pill",
  streak: "medal",
  profile: "user",
};
for (const [key, icon] of Object.entries(dockIcons)) {
  const re = new RegExp(`(<button type="button" data-screen="${key}"[^>]*>)`);
  h = h.replace(re, `$1<span class="ic ic-sm ic-${icon}" aria-hidden="true"></span>`);
}

h = h.replace(
  '<div class="stat reveal"><b>',
  '<div class="stat reveal"><span class="ic ic-lg ic-chat" aria-hidden="true"></span><b>',
);
h = h.replace(
  '<div class="stat reveal delay-1"><b>',
  '<div class="stat reveal delay-1"><span class="ic ic-lg ic-health" aria-hidden="true"></span><b>',
);
h = h.replace(
  '<div class="stat reveal delay-2"><b>',
  '<div class="stat reveal delay-2"><span class="ic ic-lg ic-wallet" aria-hidden="true"></span><b>',
);
h = h.replace(
  '<div class="stat reveal delay-3"><b>',
  '<div class="stat reveal delay-3"><span class="ic ic-lg ic-lock" aria-hidden="true"></span><b>',
);

const cardIcons = [
  "chat",
  "flask",
  "xray",
  "skin",
  "body",
  "stethoscope",
  "pill",
  "pharmacy",
  "cycle",
  "steps",
  "weight",
  "hospital",
  "health",
  "medal",
  "lock",
];
let n = 0;
h = h.replace(/<div class="icon"><svg[\s\S]*?<\/svg><\/div>/g, () => {
  const name = cardIcons[n++];
  if (!name) throw new Error("ran out of card icons");
  return `<div class="icon"><span class="ic ic-lg ic-${name}" aria-hidden="true"></span></div>`;
});
if (n !== cardIcons.length) throw new Error(`card icon count ${n}`);

h = h.replace('<div class="n">1</div>', '<div class="n"><span class="ic ic-download" aria-hidden="true"></span></div>');
h = h.replace('<div class="n">2</div>', '<div class="n"><span class="ic ic-user" aria-hidden="true"></span></div>');
h = h.replace('<div class="n">3</div>', '<div class="n"><span class="ic ic-check" aria-hidden="true"></span></div>');

h = h.replace(/<span>\s*<svg width="18" height="18"[\s\S]*?<\/svg>/, '<span>\n                <span class="ic ic-apple" aria-hidden="true"></span>');
h = h.replace(/<span>\s*<svg width="18" height="18"[\s\S]*?<\/svg>/, '<span>\n                <span class="ic ic-play" aria-hidden="true"></span>');

h = h.replace(
  '<a class="btn btn-cta" href="mailto:support@medicard.ge">',
  '<a class="btn btn-cta" href="mailto:support@medicard.ge"><span class="ic ic-chat" aria-hidden="true"></span>',
);

if (h.includes("phone-aura") || h.includes("phone-notch") || h.includes('class="phone"')) {
  throw new Error("old phone chrome still present");
}
if (h.includes("<svg")) throw new Error("inline svg still present");
if (!h.includes('class="iphone"')) throw new Error("iphone frame missing");
if ((h.match(/class="ic /g) || []).length < 40) throw new Error("too few icons");

writeFileSync(path, h);
console.log("patched", (h.match(/class="ic /g) || []).length, "icons");
