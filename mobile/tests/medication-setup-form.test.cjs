const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const loader = require('./helpers/loadTs.cjs');

// MEDIPILL setup fixes from the launch bug hunt (habits F4, F10, F11).
const mobile = join(__dirname, '..');
const read = (file) => readFileSync(join(mobile, file), 'utf8');
const form = read('src/components/medications/MedicationSetupForm.tsx');

function saveBody() {
  const start = form.indexOf('const save = async () => {');
  assert.ok(start > 0, 'save() is in the form');
  return form.slice(start, form.indexOf('return (', start));
}

// F4: the switch defaulted to on and promised „შეგახსენებთ, როცა ამდენი დარჩება“, but nothing counts
// the pills left or ever sends a refill reminder. Hidden on the app and the web until it really works.
test('no refill reminder is promised or switched on by default', () => {
  assert.doesNotMatch(form, /refillReminder|refillThreshold|ka\.meds\.refillLabel|sectionReminder/);
  assert.doesNotMatch(form, /შეგახსენებთ, როცა ამდენი დარჩება/);
  const detail = read('src/components/medications/MedicationDoseScreen.tsx');
  assert.doesNotMatch(detail, /ka\.meds\.refillLabel|cfg\.refillReminder|ka\.meds\.pillsLeft|remainingCount/);
  // The last detail row still closes the card without a stray divider.
  assert.match(detail, /label=\{ka\.meds\.daysOfWeekLabel\} value=\{daysLabel\} isLast=\{!course && !meal\}/);
  const web = read('../server/public/app/js/pages/medications.js');
  assert.doesNotMatch(web, /refillOn|refillFields|name: 'refillThreshold'|name: 'remainingCount'/);
  assert.doesNotMatch(web, /t\('შევსების შეხსენება', 'Refill reminder'\)/);
  assert.doesNotMatch(web, /refillReminder: |refillThreshold: |remainingCount: /);
  assert.doesNotMatch(web, /cfg\.remainingCount/);
  // An edit keeps whatever an older version stored.
  assert.match(web, /const config = \{\n\s+\.\.\.cfg,/);
});

// F10: with every day deselected the form saved `daysOfWeek: []`, which every reader takes as „every day“.
test('a schedule with no day chosen is never saved', () => {
  const body = saveBody();
  const guard = body.indexOf('if (days.length === 0)');
  assert.ok(guard > 0, 'save() checks the days');
  assert.ok(guard < body.indexOf('api.medications.create'), 'before the request');
  assert.match(body, /if \(days\.length === 0\) \{\n\s+Alert\.alert\(ka\.common\.error, ka\.meds\.noDaysSelected\);\n\s+return;/);
  // Readers still treat a missing or empty list as daily (older builds and Medi send none).
  assert.match(read('src/lib/home/todayDoses.ts'), /if \(!cfg\.daysOfWeek\?\.length\) return true;/);
});

// F11: the sheet offered 1–12 doses a day; the server takes 1–8 and answered 9–12 with a generic error.
test('the frequency sheet offers no more doses a day than the server takes', () => {
  const load = loader();
  const shared = load('src/lib/medications.shared.ts');
  assert.equal(shared.MAX_TIMES_PER_DAY, 8);
  assert.equal(shared.defaultTimesForCount(12).length, 8);
  assert.equal(shared.defaultTimesForCount(8).length, 8);
  assert.equal(new Set(shared.defaultTimesForCount(8)).size, 8, 'eight different default times');
  assert.deepEqual([...shared.defaultTimesForCount(0)], ['08:00']);
  const sheet = read('src/components/medications/MedicationFrequencySheet.tsx');
  assert.match(sheet, /const OPTIONS = Array\.from\(\{ length: MAX_TIMES_PER_DAY \}/);
  assert.doesNotMatch(sheet, /length: 12/);
  // The server: 1–8 (keep the two in step).
  const routes = read('../server/src/routes/medications.routes.js');
  assert.match(routes, /times\.length > 0 && times\.length <= 8/);
});

test('a refused save shows the server’s own reason, not only the generic line', () => {
  const body = saveBody();
  assert.match(body, /Alert\.alert\(ka\.common\.error, saveErrorMessage\(err\)\)/);
  const helper = form.slice(form.indexOf('function saveErrorMessage'), form.indexOf('function Divider'));
  assert.match(helper, /err\.fields\?\.find/);
  assert.match(helper, /field\?\.message \|\| err\.message \|\| ka\.common\.error/);
});
