import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const require = createRequire(new URL("../server/package.json", import.meta.url));
const { chromium } = require("playwright");

const outDir = fileURLToPath(new URL("./qa/", import.meta.url));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

async function shot(path, name) {
  const page = await browser.newPage({ viewport: { width: 1504, height: 900 } });
  await page.goto(`http://localhost:4000${path}`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
  });
  await page.locator("#request").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.locator("#request").screenshot({ path: `${outDir}/${name}.png` });
  await page.close();
}

await shot("/privacy", "privacy-cta");
await shot("/terms", "terms-cta");

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
await mobile.goto("http://localhost:4000/terms", { waitUntil: "networkidle" });
await mobile.locator("#request").scrollIntoViewIfNeeded();
await mobile.waitForTimeout(200);
await mobile.locator("#request").screenshot({ path: `${outDir}/terms-cta-m.png` });
await mobile.close();

const dark = await browser.newPage({ viewport: { width: 1504, height: 900 }, colorScheme: "dark" });
await dark.goto("http://localhost:4000/terms", { waitUntil: "networkidle" });
await dark.evaluate(() => {
  localStorage.setItem("medicard.landing.theme", "dark");
  document.documentElement.dataset.theme = "dark";
});
await dark.locator("#request").scrollIntoViewIfNeeded();
await dark.waitForTimeout(200);
await dark.locator("#request").screenshot({ path: `${outDir}/terms-cta-dark.png` });
await dark.close();

await browser.close();
console.log("ok");
