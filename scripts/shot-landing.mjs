import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const require = createRequire(new URL("../server/package.json", import.meta.url));
const { chromium } = require("playwright");

const outDir = fileURLToPath(new URL("./qa/", import.meta.url));
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

async function shot(name, viewport) {
  const page = await browser.newPage({ viewport, colorScheme: "dark", isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  await page.goto("http://localhost:4000/?v=9", { waitUntil: "networkidle" });
  await page.addStyleTag({ content: ".reveal{opacity:1;transform:none}" });
  await page.waitForSelector(".iphone-chrome");
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: false });
  if (name === "mobile") {
    await page.click("#menu-toggle");
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${outDir}/mobile-menu.png`, fullPage: false });
    await page.click("#menu-toggle");
    await page.evaluate(() => document.getElementById("features")?.scrollIntoView());
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${outDir}/mobile-features.png`, fullPage: false });
  }
  await page.close();
}

await shot("hero", { width: 1504, height: 980 });
await shot("mobile", { width: 390, height: 844 });
await shot("tablet", { width: 768, height: 1024 });
await browser.close();
console.log("ok");
