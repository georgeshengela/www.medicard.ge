const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const mobile = join(__dirname, '..');
const read = (file) => readFileSync(join(mobile, file), 'utf8');

// F5: with notifications denied, reminders silently did nothing and MEDIPILL never said so.
test('MEDIPILL says when notifications are off, asking only from its one button', () => {
  const hub = read('src/components/medications/MedicationHubScreen.tsx');
  assert.match(hub, /<MedicationRemindersNote activeCount=\{activeMeds\.length\}/);
  const note = read('src/components/medications/MedicationRemindersNote.tsx');
  // The status is read (focus, return from Settings) — never requested — outside the press.
  assert.match(note, /getNotificationPermissionStatus\(\)/);
  assert.match(note, /onReturnToForeground\(/);
  const effects = note.slice(0, note.indexOf('const continueToSystemSheet'));
  assert.doesNotMatch(effects, /requestNotificationPermission\(\)|Linking\.openSettings/);
  // Primer: one „გაგრძელება“ button whose press starts the OS request first.
  const press = note.slice(note.indexOf('const continueToSystemSheet'), note.indexOf('const openSettings'));
  assert.match(press, /busyRef\.current = true;\n\s+const asked = requestNotificationPermission\(\);/);
  assert.match(press, /markPrimerAsked\('notifications'\)/);
  assert.match(note, /label=\{primer\.cta\}/);
  assert.match(note, /primerCopy\('notifications'\)/);
  // Settings only once the OS already answered (kind === 'settings'), with the shared label.
  assert.match(note, /label=\{primerSettingsLabel\(\)\} onPress=\{openSettings\}/);
  assert.match(note, /settings \? \(\n\s+<MedsButton[^\n]*primerSettingsLabel\(\)[^\n]*\/>\n\s+\) : \(\n\s+<MedsButton[^\n]*primer\.cta[^\n]*\/>\n\s+\)/);
  assert.equal((note.match(/<MedsButton/g) || []).length, 2, 'one button in each state');
  assert.doesNotMatch(note, /ახლა არა|არა ახლა|მოგვიანებით|Not now|Later|<Modal|Alert\.alert/);
});
