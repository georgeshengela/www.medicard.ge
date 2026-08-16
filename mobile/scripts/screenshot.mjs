/**
 * Visual smoke test: drives the web build in a phone-sized Chromium viewport,
 * signs a throwaway user up and screenshots each screen.
 *
 *   node scripts/screenshot.mjs [webUrl]
 *
 * Requires both the Expo web dev server and the API to be running.
 *
 * Note: the router keeps previous screens mounted but hidden, so every locator
 * is filtered to `visible=true` — otherwise Playwright grabs the offscreen copy.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const WEB = process.argv[2] ?? 'http://localhost:8081';
const OUT = 'screenshots';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2 });

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

const visibleText = (text) => page.getByText(text, { exact: true }).locator('visible=true').last();
const visiblePlaceholder = (text) => page.getByPlaceholder(text, { exact: true }).locator('visible=true').last();

const tap = async (text, wait = 1500) => {
  await visibleText(text).click({ timeout: 20_000 });
  await page.waitForTimeout(wait);
};

const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`  ${name}.png`);
};

const email = `visual_${Date.now()}@medicard.ge`;

console.log(`\nVisual walkthrough -> ${WEB}\n`);

await page.goto(WEB, { waitUntil: 'networkidle', timeout: 180_000 });
await page.waitForTimeout(4000);
await shot('01-sign-in');

await tap('რეგისტრაცია');
await shot('02-sign-up');

await visiblePlaceholder('მაგ. ნინო ბერიძე').fill('ნინო ბერიძე');
await visiblePlaceholder('name@example.com').fill(email);
await visiblePlaceholder('მინიმუმ 8 სიმბოლო').fill('Test12345!');
await tap('ქალი', 300);
await page.getByTestId('birth-date-field').locator('visible=true').last().click({ timeout: 20_000 });
await page.waitForTimeout(600);
await shot('02c-calendar');
await page.getByTestId('calendar-year-toggle').locator('visible=true').last().click();
await page.waitForTimeout(300);
await page.getByTestId('calendar-prev').locator('visible=true').last().click();
await page.waitForTimeout(200);
await page.getByTestId('calendar-year-1990').locator('visible=true').last().click();
await page.waitForTimeout(300);
await page.getByTestId('calendar-day-15').locator('visible=true').last().click();
await page.getByTestId('calendar-confirm').locator('visible=true').last().click();
await page.waitForTimeout(400);
await shot('02b-sign-up-filled');
await tap('რეგისტრაცია', 6000);
await shot('03-home');

await tap('მედიკამენტები', 2500);
await shot('04-medications-empty');

await tap('ახალი მედიკამენტი');
await visiblePlaceholder('მაგ. ამოქსიცილინი').fill('ამოქსიცილინი');
await visiblePlaceholder('მაგ. 500 მგ, 1 ტაბლეტი').fill('500 მგ');
await visiblePlaceholder('მაგ. ჭამის შემდეგ, უხვი წყლით').fill('ჭამის შემდეგ');
await tap('დღეში 3-ჯერ', 600);
await shot('05-medication-editor');

await tap('შენახვა', 3500);
await shot('06-medications-schedule');

await tap('მთავარი', 2000);
await tap('კანის მოვლა', 2500);
await tap('აკნე', 300);
await tap('სიწითლე', 600);
await shot('07-skincare');

await page.goBack();
await page.waitForTimeout(2000);
await tap('გაშიფრე ანალიზები', 2500);
await shot('08-lab-upload');

await page.goBack();
await page.waitForTimeout(2000);
await tap('AI ექიმი', 2500);
await shot('09-ai-doctor');

await page.goBack();
await page.waitForTimeout(2000);
await tap('პროფილი', 3000);
await shot('10-profile');

await tap('მუქი', 1500);
await shot('11-profile-dark');
await tap('მთავარი', 2000);
await shot('12-home-dark');

await browser.close();

console.log(`\nconsole errors: ${consoleErrors.length}`);
for (const error of [...new Set(consoleErrors)].slice(0, 12)) console.log(`  ! ${error}`);
console.log('');
