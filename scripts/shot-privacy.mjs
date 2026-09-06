import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const require = createRequire(new URL("../server/package.json", import.meta.url));
const { chromium } = require("playwright");

const outDir = fileURLToPath(new URL("./qa/", import.meta.url));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

async function shot(name, viewport, theme) {
  const page = await browser.newPage({
    viewport,
    colorScheme: theme,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
  });
  await page.goto("http://localhost:4000/privacy", { waitUntil: "networkidle" });
  await page.evaluate((next) => {
    localStorage.setItem("medicard.landing.theme", next);
    document.documentElement.dataset.theme = next;
  }, theme);
  await page.waitForSelector(".legal-hero .lead");
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false });
  if (name === "privacy-desktop") {
    await page.locator("#s7").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/privacy-nosell.png`, fullPage: false });
    await page.locator("#s32").scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/privacy-warning.png`, fullPage: false });
  }
  await page.close();
}

await shot("privacy-desktop", { width: 1504, height: 980 }, "light");
await shot("privacy-dark", { width: 1504, height: 980 }, "dark");
await shot("privacy-mobile", { width: 390, height: 844 }, "light");
await browser.close();
console.log("ok");
