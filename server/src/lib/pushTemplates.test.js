import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUSH_TEMPLATE_DEFAULTS,
  PUSH_TEMPLATE_EN,
  applyPushTemplate,
  localizePushTemplate,
  fertilityPushCopyUnsafe,
  interpolatePushCopy,
  resolvePushTemplateCopy,
  templateByKey,
  validateFertilityPushCopy,
  validatePushTemplatePlaceholders,
} from './pushTemplates.js';
import {
  CYCLE_TEMPLATE_BY_TYPE,
  maskedCopyIsSafe,
  redactCyclePushLog,
} from '../../../mobile/src/lib/cycleNotificationContract.js';
import {
  CYCLE_REMINDER_COPY_EN,
  CYCLE_REMINDER_COPY_KA,
  isCustomisedCycleTemplate,
} from '../../../mobile/src/lib/cycleReminderCopy.ts';
import { CYCLE_DEFAULT_ON_TYPES } from '../../../mobile/src/lib/cycleReminderDefaults.ts';

const FORBIDDEN_MASK = ['მენსტრუაცია', 'ოვულაცია', 'PMS', 'ორსულობა', 'მედიკამენტ'];

describe('pushTemplates', () => {
  it('keeps a unique key for every reminder family', () => {
    const keys = PUSH_TEMPLATE_DEFAULTS.map((row) => row.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.includes('medication'));
    assert.ok(keys.includes('admin-push'));
    assert.ok(keys.includes('quota-reset'));
    assert.ok(keys.includes('quota-reset-lock'));
    assert.equal(templateByKey(PUSH_TEMPLATE_DEFAULTS, 'quota-reset')?.group, 'quota');
    const ready = applyPushTemplate(templateByKey(PUSH_TEMPLATE_DEFAULTS, 'quota-reset'), { limit: '3' });
    assert.match(ready.title, /Medi/);
    assert.match(ready.body, /3/);
    assert.equal(templateByKey(PUSH_TEMPLATE_DEFAULTS, 'steps')?.group, 'activity');
    assert.equal(templateByKey(PUSH_TEMPLATE_DEFAULTS, 'weight')?.group, 'activity');
  });

  it('drops empty placeholders and leftover Georgian suffixes', () => {
    assert.equal(
      interpolatePushCopy('არ დაგავიწყდეს შენი {name} {dosage} 🤍', { name: 'ასპირინი' }),
      'არ დაგავიწყდეს შენი ასპირინი 🤍',
    );
    assert.equal(
      interpolatePushCopy('დღეს {time}-ზე {doctor}-თან ვიზიტი გაქვს{place}.', { time: '14:30' }),
      'დღეს 14:30-ზე ექიმთან ვიზიტი გაქვს.',
    );
    assert.equal(
      interpolatePushCopy('დღეს {time}-ზე {doctor}-თან ვიზიტი გაქვს{place}.', {
        time: '14:30',
        doctor: 'Dr. Smith',
        place: ' — CHC MontLégia',
      }),
      'დღეს 14:30-ზე Dr. Smith-თან ვიზიტი გაქვს — CHC MontLégia.',
    );
    assert.equal(interpolatePushCopy('ჰეი {missing}', {}), 'ჰეი');
  });

  it('applies Medi medication copy', () => {
    const med = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'medication');
    const copy = applyPushTemplate(med, { name: 'ვიტამინი D', dosage: '1 კაფსულა' });
    assert.match(copy.title, /ვიტამინი D/);
    assert.match(copy.body, /ვიტამინი D/);
    assert.match(copy.body, /1 კაფსულა/);
    assert.equal(interpolatePushCopy(med.body, { name: 'ვიტამინი D' }).includes('  '), false);
  });

  it('keeps discreet copy free of health details', () => {
    const masked = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-masked');
    const hay = `${masked.title} ${masked.body}`;
    for (const word of FORBIDDEN_MASK) {
      assert.equal(hay.includes(word), false, word);
    }
  });

  it('keeps pregnancy-care lock-screen copy user-planned and privacy-minimal', () => {
    const plan = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'pregnancy-care-plan');
    const masked = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'pregnancy-care-masked');
    const planHay = `${plan.title} ${plan.body}`;
    const maskedHay = `${masked.title} ${masked.body}`;
    assert.match(planHay, /დაგეგმე/);
    assert.equal(planHay.includes('დროა'), false);
    assert.equal(planHay.includes('გჭირდება'), false);
    assert.equal(planHay.includes('აუცილებელია'), false);
    assert.equal(planHay.includes('ვადაა'), false);
    assert.equal(planHay.includes('აგვიანდება'), false);
    for (const word of FORBIDDEN_MASK) {
      assert.equal(maskedHay.includes(word), false, word);
    }
    assert.equal(maskedHay.includes('ანატომ'), false);
    assert.equal(maskedCopyIsSafe(masked.title, masked.body), true);
    const redacted = redactCyclePushLog({
      key: 'pregnancy-care-plan',
      title: plan.title,
      body: plan.body,
    });
    assert.equal(redacted.title, '[cycle-redacted]');
  });

  it('keeps fertility lock-screen copy probabilistic and not contraceptive', () => {
    const ov = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-ovulation');
    const fertile = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-fertile');
    const periodStart = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-period-start');
    const periodSoon = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-period-soon');
    const pms = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-pms');
    const opk = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-opk');
    const engage = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'engage-insight-cycle');

    const ovHay = `${ov.title} ${ov.body}`;
    const fertileHay = `${fertile.title} ${fertile.body}`;
    const allCycle = [ov, fertile, periodStart, periodSoon, pms, opk]
      .map((row) => `${row.title} ${row.body}`)
      .join('\n');

    assert.match(ovHay, /სავარაუდო/);
    assert.match(fertileHay, /სავარაუდო/);
    assert.match(fertileHay, /შეიძლება/);
    assert.equal(ovHay.includes('ოვულირებთ'), false);
    assert.equal(ovHay.includes('დღეს ოვულაციის დღეა'), false);
    assert.equal(fertileHay.includes('ნაყოფიერი დღეები დაიწყო'), false);
    assert.equal(fertileHay.includes('შენ ნაყოფიერი ხარ'), false);
    for (const phrase of ['უსაფრთხო დღ', 'ინფერტილ', 'არ შეგიძლია დაორსულ', 'cannot get pregnant', 'safe days']) {
      assert.equal(allCycle.toLowerCase().includes(phrase.toLowerCase()), false, phrase);
    }
    assert.ok(engage);
    assert.equal(`${engage.title} ${engage.body}`.includes('ოვულირებთ'), false);
  });

  it('rejects malformed placeholders before save', () => {
    assert.equal(validatePushTemplatePlaceholders('Hello {name}', 'Take {dosage}').ok, true);
    assert.equal(validatePushTemplatePlaceholders('Hello {name', 'ok').ok, false);
    assert.equal(validatePushTemplatePlaceholders('Hello', 'unclosed {').ok, false);
    assert.equal(validatePushTemplatePlaceholders('{not-valid}', 'ok').ok, false);
  });
});

describe('fertility push template safety overlay', () => {
  const ov = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-ovulation');
  const fertile = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-fertile');
  const masked = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-masked');

  it('uses code defaults when no DB row exists', () => {
    const resolved = resolvePushTemplateCopy(ov, null);
    assert.equal(resolved.source, 'default');
    assert.equal(resolved.title, ov.title);
    assert.equal(fertilityPushCopyUnsafe(ov.title, ov.body), false);
  });

  it('serves a safe admin custom fertility template', () => {
    const custom = {
      title: 'სავარაუდო ოვულაცია',
      body: 'ეს სავარაუდო შეფასებაა და შეიძლება შეიცვალოს',
    };
    const resolved = resolvePushTemplateCopy(ov, custom);
    assert.equal(resolved.source, 'db');
    assert.equal(resolved.title, custom.title);
    assert.equal(validateFertilityPushCopy('cycle-ovulation', custom.title, custom.body).ok, true);
  });

  it('does not serve legacy certainty copy even if the DB row still exists', () => {
    const legacy = {
      title: 'ოვულაციის დრო ახლოვდება',
      body: 'დღეს ოვულაციის დღეა',
    };
    assert.equal(fertilityPushCopyUnsafe(legacy.title, legacy.body), true);
    const resolved = resolvePushTemplateCopy(ov, legacy);
    assert.equal(resolved.source, 'default_safety_override');
    assert.equal(resolved.title, ov.title);
    assert.equal(resolved.body, ov.body);
    assert.equal(validateFertilityPushCopy('cycle-ovulation', legacy.title, legacy.body).ok, false);
  });

  it('rejects a new admin fertility save that drops the hedge', () => {
    assert.equal(
      validateFertilityPushCopy('cycle-fertile', 'ნაყოფიერი დღეები დაიწყო', 'შენ ნაყოფიერი ხარ').ok,
      false,
    );
    assert.equal(validateFertilityPushCopy('medication', 'დროა', 'მიიღე').ok, true);
  });

  it('keeps discreet masked copy free of fertility claims', () => {
    const hay = `${masked.title} ${masked.body}`;
    assert.equal(hay.includes('ოვულაცია'), false);
    assert.equal(hay.includes('ნაყოფიერ'), false);
    const resolved = resolvePushTemplateCopy(masked, {
      title: masked.title,
      body: masked.body,
    });
    assert.equal(resolved.source, 'db');
  });

  it('defaults themselves stay estimated', () => {
    assert.equal(fertilityPushCopyUnsafe(ov.title, ov.body), false);
    assert.equal(fertilityPushCopyUnsafe(fertile.title, fertile.body), false);
  });

  it('cycle-masked copy is discreet and analytics redaction strips Cycle text', () => {
    assert.equal(maskedCopyIsSafe(masked.title, masked.body), true);
    const redacted = redactCyclePushLog({ key: 'cycle-ovulation', title: ov.title, body: ov.body });
    assert.equal(redacted.title, '[cycle-redacted]');
    assert.equal(maskedCopyIsSafe(redacted.title, redacted.body), true);
  });
});

describe('push templates in English', () => {
  it('has English copy for every template and keeps the same placeholders', () => {
    for (const def of PUSH_TEMPLATE_DEFAULTS) {
      const en = PUSH_TEMPLATE_EN[def.key];
      assert.ok(en, def.key);
      assert.equal(/[ა-ჿ]/.test(`${en.title} ${en.body}`), false, def.key);
      const vars = (text) => [...String(text).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort().join(',');
      assert.equal(vars(`${en.title} ${en.body}`), vars(`${def.title} ${def.body}`), def.key);
    }
  });

  it('localizes for English readers only and keeps fertility and masked copy safe', () => {
    const med = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'medication');
    assert.equal(localizePushTemplate(med, 'ka'), med);
    assert.match(applyPushTemplate(localizePushTemplate(med, 'en'), { name: 'Vitamin D' }).title, /Vitamin D/);
    for (const key of ['cycle-ovulation', 'cycle-fertile']) {
      assert.match(`${PUSH_TEMPLATE_EN[key].title} ${PUSH_TEMPLATE_EN[key].body}`, /estimate/i);
    }
    const masked = PUSH_TEMPLATE_EN['cycle-masked'];
    assert.equal(/period|ovulat|fertile|PMS|pregnan|medic/i.test(`${masked.title} ${masked.body}`), false);
    assert.equal(maskedCopyIsSafe(masked.title, masked.body), true);
  });
});

describe('cycle period reminders (default-on family)', () => {
  const PERIOD_KEYS = ['cycle-period-soon', 'cycle-period-start', 'cycle-period-late'];
  const SENSITIVE_KA = ['ნაყოფიერ', 'ოვულაც', 'სექს', 'ლიბიდო', 'გამონადენ'];
  const SENSITIVE_EN = ['fertil', 'ovulat', 'sex', 'libido', 'discharge'];

  it('ships cycle-period-late in the cycle group, ka + en', () => {
    const late = templateByKey(PUSH_TEMPLATE_DEFAULTS, 'cycle-period-late');
    assert.ok(late);
    assert.equal(late.group, 'cycle');
    assert.equal(late.title.startsWith('სავარაუდო თარიღი გავიდა — ყველაფერი რიგზეა?'), true);
    assert.ok(PUSH_TEMPLATE_EN['cycle-period-late']);
  });

  it('mirrors the app lock-screen copy exactly (ka + en)', () => {
    for (const key of PERIOD_KEYS) {
      const def = templateByKey(PUSH_TEMPLATE_DEFAULTS, key);
      assert.equal(def.title, CYCLE_REMINDER_COPY_KA[key].title, `ka title ${key}`);
      assert.equal(def.body, CYCLE_REMINDER_COPY_KA[key].body, `ka body ${key}`);
      assert.equal(PUSH_TEMPLATE_EN[key].title, CYCLE_REMINDER_COPY_EN[key].title, `en title ${key}`);
      assert.equal(PUSH_TEMPLATE_EN[key].body, CYCLE_REMINDER_COPY_EN[key].body, `en body ${key}`);
      // The app reads an untouched server default as "not customised", so its cautious body still wins.
      assert.equal(isCustomisedCycleTemplate(key, { title: def.title, body: def.body }), false, key);
    }
  });

  it('default-on templates never mention fertile / ovulation / sex / libido / discharge', () => {
    const defaultOnKeys = CYCLE_DEFAULT_ON_TYPES.map((type) => CYCLE_TEMPLATE_BY_TYPE[type]);
    assert.deepEqual([...defaultOnKeys].sort(), [...PERIOD_KEYS].sort());
    for (const key of defaultOnKeys) {
      const def = templateByKey(PUSH_TEMPLATE_DEFAULTS, key);
      const ka = `${def.label} ${def.title} ${def.body}`;
      const en = `${PUSH_TEMPLATE_EN[key].title} ${PUSH_TEMPLATE_EN[key].body}`.toLowerCase();
      for (const word of SENSITIVE_KA) assert.equal(ka.includes(word), false, `${key} ka ${word}`);
      for (const word of SENSITIVE_EN) assert.equal(en.includes(word), false, `${key} en ${word}`);
      assert.match(`${def.title} ${def.body}`, /სავარაუდო/);
    }
  });
});
