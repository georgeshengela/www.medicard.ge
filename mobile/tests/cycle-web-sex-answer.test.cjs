const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// IR-9: she answers „არ მქონია“ (sexualActivity false). Train 3 keeps it across later app saves
// (sexualActivityForSave), but medicard.ge/app loaded it as „not answered“ and sent null with the next
// save of that day (a mood change), and the ♥ one-tap's undo wrote null over it too. The web page now
// mirrors the app rule. These run the page's own helpers, cut out of server/public/app/js/pages/cycle.js.

const WEB = join(__dirname, '..', '..', 'server', 'public', 'app', 'js', 'pages', 'cycle.js');
const src = readFileSync(WEB, 'utf8');

/** `function name(…) { … }` from the page source (braces counted; these helpers hold no brace in a string). */
function cut(name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in the web cycle page`);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`${name} is not closed`);
}

const SEX_ACTIVITY_IDS = new Set(['protected', 'unprotected', 'oral_sex', 'anal_sex', 'sensual_touch', 'masturbation', 'sex_toys', 'orgasm', 'pain_sex']);
const SEX_IDS = new Set([...SEX_ACTIVITY_IDS, 'high_drive', 'neutral_drive', 'low_drive']);
const helpers = new Function(
  'SEX_IDS',
  'SEX_ACTIVITY_IDS',
  'SYMPTOMS',
  'canonicalChecklist',
  't',
  `${cut('formFromLog')}\n${src.includes('function sexualActivityForSave(') ? cut('sexualActivityForSave') : ''}\n${cut('payloadFromForm')}\nreturn { formFromLog, payloadFromForm };`,
)(SEX_IDS, SEX_ACTIVITY_IDS, [{ id: 'cramps' }], (ids) => (Array.isArray(ids) ? ids : []), (ka) => ka);

const day = (patch) => ({ date: '2026-10-09', flow: null, symptoms: [], moods: [], sexualActivity: null, bbt: null, notes: null, ...patch });

test('IR-9: a stored „არ მქონია“ survives a later web save of the day', () => {
  const f = helpers.formFromLog(day({ sexualActivity: false, moods: ['calm'] }));
  const initial = JSON.stringify(helpers.payloadFromForm(f));
  assert.equal(JSON.parse(initial).sexualActivity, false, 'an untouched save sends it back as it was');
  f.moods = ['calm', 'happy'];
  const payload = helpers.payloadFromForm(f);
  assert.notEqual(JSON.stringify(payload), initial, 'the mood change is saved');
  assert.equal(payload.sexualActivity, false);
});

test('IR-9: her own answer still wins; clearing a „yes“ still clears it', () => {
  // „არ მქონია“ on an unanswered day.
  const fresh = helpers.formFromLog(day({}));
  assert.equal(helpers.payloadFromForm(fresh).sexualActivity, null);
  fresh.sexual = false;
  assert.equal(helpers.payloadFromForm(fresh).sexualActivity, false);
  // A stored „yes“ she unticks.
  const yes = helpers.formFromLog(day({ sexualActivity: true, symptoms: ['protected'] }));
  assert.equal(helpers.payloadFromForm(yes).sexualActivity, true);
  yes.sexual = null;
  yes.sexTags = [];
  assert.equal(helpers.payloadFromForm(yes).sexualActivity, null);
  // A stored „no“ changed to „yes“.
  const no = helpers.formFromLog(day({ sexualActivity: false }));
  no.sexual = true;
  assert.equal(helpers.payloadFromForm(no).sexualActivity, true);
});

test('IR-9: the web ♥ one-tap undo puts the stored answer back, a „no“ included', () => {
  const start = src.indexOf('const logSexNow = async');
  assert.ok(start >= 0);
  const body = src.slice(start, src.indexOf('const openDayLog', start));
  assert.match(body, /const before = v\.todayLog\?\.sexualActivity \?\? null;/);
  // A stored „yes“ still opens the sheet instead of a second one-tap.
  assert.match(body, /if \(before === true \|\|/);
  assert.match(body, /put\(`\/api\/cycle\/logs\/\$\{v\.today\}`, \{ sexualActivity: before \}\)/);
});
