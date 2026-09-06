import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUSH_TEMPLATE_DEFAULTS,
  applyPushTemplate,
  interpolatePushCopy,
  templateByKey,
  validatePushTemplatePlaceholders,
} from './pushTemplates.js';

const FORBIDDEN_MASK = ['მენსტრუაცია', 'ოვულაცია', 'PMS', 'ორსულობა', 'მედიკამენტ'];

describe('pushTemplates', () => {
  it('keeps a unique key for every reminder family', () => {
    const keys = PUSH_TEMPLATE_DEFAULTS.map((row) => row.key);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(keys.includes('medication'));
    assert.ok(keys.includes('admin-push'));
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

  it('rejects malformed placeholders before save', () => {
    assert.equal(validatePushTemplatePlaceholders('Hello {name}', 'Take {dosage}').ok, true);
    assert.equal(validatePushTemplatePlaceholders('Hello {name', 'ok').ok, false);
    assert.equal(validatePushTemplatePlaceholders('Hello', 'unclosed {').ok, false);
    assert.equal(validatePushTemplatePlaceholders('{not-valid}', 'ok').ok, false);
  });
});
