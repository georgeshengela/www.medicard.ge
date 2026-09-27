import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ageOn, bodyOf, buildHealthPassportHtml, PASSPORT_LIMITS, type PassportData } from './healthPassport.ts';

const base: PassportData = {
  person: { name: 'ნინო <b>', sex: 'FEMALE', birthDate: '1994-05-10', heightCm: 168, weightKg: 62.34, bloodType: 'A+' },
  allergies: ['პენიცილინი'],
  conditions: [],
  medications: [{ name: 'იბუპროფენი', dose: '400 მგ', schedule: '09:00, 21:00' }],
  labs: { date: '2026-09-20', rows: [{ name: 'CRP', value: '73', unit: 'mg/L', refLow: 0, refHigh: 5, flag: 'H' }] },
  visits: [{ date: '2026-09-01', doctor: 'თერაპევტი', notes: null }],
  generatedOn: '2026-09-27',
};

describe('health passport', () => {
  it('has every section in Georgian, with escaped input and flagged labs', () => {
    const html = buildHealthPassportHtml(base, 'ka');
    for (const s of ['ჯანმრთელობის პასპორტი', 'ალერგიები', 'დაავადება არ არის მითითებული', 'მიმდინარე მედიკამენტები', 'ბოლო ლაბორატორიული ანალიზები', 'ბოლო ვიზიტები']) assert.ok(html.includes(s), s);
    assert.ok(html.includes('ნინო &lt;b&gt;'));
    assert.ok(!html.includes('ნინო <b>'));
    assert.ok(html.includes('32 წლის'));
    assert.ok(html.includes('0–5') && html.includes('flag-H'));
    assert.ok(html.includes('62.3 kg'));
  });

  it('English version and an optional cycle part', () => {
    const html = buildHealthPassportHtml({ ...base, cycleHtml: '<html><body><p>cycle-part</p></body></html>' }, 'en');
    assert.ok(html.includes('Health passport') && html.includes('Current medications'));
    assert.ok(html.includes('<p>cycle-part</p>') && !html.includes('<html><body><p>cycle-part'));
    assert.ok(!buildHealthPassportHtml(base, 'en').includes('Cycle summary'));
  });

  it('caps long lists and handles missing data', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ name: 'p' + i, value: '1' }));
    const html = buildHealthPassportHtml({ ...base, labs: { date: '2026-09-20', rows }, visits: [], medications: [] }, 'ka');
    assert.equal((html.match(/<td>p\d+<\/td>/g) || []).length, PASSPORT_LIMITS.labs);
    assert.ok(html.includes('ვიზიტი არ არის ჩაწერილი') && html.includes('აქტიური მედიკამენტი არ არის'));
    assert.equal(ageOn(null, '2026-09-27'), null);
    assert.equal(ageOn('2008-09-28', '2026-09-27'), 17);
    assert.equal(bodyOf('no body'), 'no body');
  });
});
