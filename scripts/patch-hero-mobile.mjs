import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../server/public/index.html", import.meta.url);
let h = readFileSync(path, "utf8");

if (h.includes('class="hero-copy"')) {
  console.log("already patched");
  process.exit(0);
}

h = h.replace(
  '<article class="chapter is-on" id="hero-chapter" data-screen="home">',
  '<article class="chapter is-on" id="hero-chapter" data-screen="home">\n            <div class="hero-copy">',
);
h = h.replace(
  '<div class="day" role="tablist" aria-label="Day">',
  '</div>\n            <div class="day" role="tablist" aria-label="Day">',
);
if (!h.includes('class="hero-copy"')) throw new Error("wrap failed");
writeFileSync(path, h);
console.log("ok");
