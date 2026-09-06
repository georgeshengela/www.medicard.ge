import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const require = createRequire(new URL("../server/package.json", import.meta.url));
const { chromium } = require("playwright");

const outDir = fileURLToPath(new URL("./qa/", import.meta.url));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

async function shot(name, viewport, theme, extra) {
  const page = await browser.newPage({
    viewport,
    colorScheme: theme,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
  });
  await page.goto("http://localhost:4000/terms", { waitUntil: "networkidle" });
  await page.evaluate((next) => {
    localStorage.setItem("medicard.landing.theme", next);
    document.documentElement.dataset.theme = next;
  }, theme);
  await page.waitForSelector(".legal-hero .lead");
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false });
  if (extra) await extra(page);
  await page.close();
}

await shot("terms-desktop", { width: 1504, height: 980 }, "light", async (page) => {
  await page.locator("#s3").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/terms-warning.png`, fullPage: false });
  await page.locator("#s51").scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${outDir}/terms-confirm.png`, fullPage: false });
});
await shot("terms-dark", { width: 1504, height: 980 }, "dark");
await shot("terms-mobile", { width: 390, height: 844 }, "light", async (page) => {
  await page.locator("#menu-toggle").click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${outDir}/terms-mobile-menu.png`, fullPage: false });
});
await browser.close();
console.log("ok");
