import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dedupeLabPanelsByRecord, isAutoLabPanel, mergeLabPanelLists, reconstructLabPanels } from './appState.js';
import { extractLabFromText, isCredibleLabRow } from './labExtract.js';
import { mediaPart, VISION_EFFORTS, VISION_MAX_TOKENS } from './vision.js';
import { reasoningHeadroom, withReasoningHeadroom } from './reasoningBudget.js';
import { consentedAiFetch } from './consentedAiFetch.js';

const row = (key, value = 5) => ({ key, nameKa: key, nameEn: key, value, display: String(value), unit: 'u', refLow: 1, refHigh: 9, flag: 'N' });
const panel = (id, date, recordIds, keys, extra = {}) => ({ id, date, createdAt: `${date}T00:00:00.000Z`, recordIds, analysis: '', parameters: keys.map((k) => row(k)), ...extra });

describe('lab panels: one record is one panel (2026-10-06 incident)', () => {
  it('the app panel wins over server-made copies of the same record under other dates', () => {
    const merged = mergeLabPanelLists(
      [
        panel('lab-2026-10-06-rec1', '2026-10-06', ['rec1'], ['mcv'], { auto: true }),
        panel('lab-2026-09-30-rec1', '2026-09-30', ['rec1'], ['mcv']),
      ],
      [panel('lab-2010-11-19-1759740000000', '2010-11-19', ['rec1'], ['mcv', 'hemoglobin'])],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].date, '2010-11-19');
  });

  it('a later app panel (date changed by the person) replaces the earlier one', () => {
    const merged = mergeLabPanelLists(
      [panel('lab-2026-10-01-1', '2026-10-01', ['rec1'], ['mcv'])],
      [panel('lab-2026-09-29-2', '2026-09-29', ['rec1'], ['mcv'])],
    );
    assert.deepEqual(merged.map((p) => p.date), ['2026-09-29']);
  });

  it('a server-made panel stays when the app has none for that record', () => {
    const merged = mergeLabPanelLists([], [panel('lab-2026-10-06-rec9', '2026-10-06', ['rec9'], ['tsh'], { auto: true })]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].auto, true);
  });

  it('same record, same date: merged, not dropped, and the app id survives', () => {
    const merged = mergeLabPanelLists(
      [panel('lab-2026-10-01-rec1', '2026-10-01', ['rec1'], ['mcv'], { auto: true })],
      [panel('lab-2026-10-01-1759740000000', '2026-10-01', ['rec1'], ['hemoglobin'])],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].parameters.length, 2);
    assert.equal(merged[0].id, 'lab-2026-10-01-1759740000000');
    assert.equal(isAutoLabPanel(merged[0]), false);
  });

  it('different records on different dates are untouched', () => {
    const out = dedupeLabPanelsByRecord([panel('a', '2026-01-01', ['r1'], ['mcv']), panel('b', '2026-02-01', ['r2'], ['mcv'])]);
    assert.equal(out.length, 2);
  });

  it('panels rebuilt from records are marked as server-made', () => {
    const [rebuilt] = reconstructLabPanels([{ id: 'rec1', createdAt: new Date('2026-10-06T09:14:15Z'), aiAnalysis: 'Hemoglobin (ჰემოგლობინი) | 11.2 | g/dL | 12-16 | L' }]);
    assert.equal(rebuilt.auto, true);
  });
});

describe('lab reading', () => {
  it('OCR noise rows do not count as lab values', () => {
    assert.equal(isCredibleLabRow({ value: 4, refLow: null, refHigh: null }), false);
    assert.equal(isCredibleLabRow({ value: 84.1, refLow: 80, refHigh: 96 }), true);
    assert.equal(isCredibleLabRow({ value: 11.3, refLow: null, refHigh: 35 }), true);
  });

  it('an analyte written as a table row and a labjson row counts once', () => {
    const text = [
      'ედს (ESR) [Erythrocyte Sedimentation Rate] | 24 | მმ/სთ | 0-20 | H',
      'ალანინამინოტრანსფერაზა (ALT) [Alanine Aminotransferase] | 11.3 | ერთ/ლ | 0-35 | N',
      '```labjson',
      '{"date":"2026-10-01","parameters":[{"key":"esr","nameKa":"ედს","nameEn":"ESR","value":24,"display":"24","unit":"mm/h","refLow":0,"refHigh":20,"flag":"H"},{"key":"alt","nameKa":"ALT","nameEn":"ALT","value":11.3,"display":"11.3","unit":"U/L","refLow":0,"refHigh":35,"flag":"N"}]}',
      '```',
    ].join('\n');
    assert.deepEqual(extractLabFromText(text).parameters.map((r) => r.key).sort(), ['alt', 'esr']);
  });

  it('a full sheet gets room: fast pass first, then a deeper one', () => {
    assert.ok(VISION_MAX_TOKENS >= 8000);
    assert.deepEqual([...VISION_EFFORTS], ['minimal', 'medium']);
  });

  it('a scanned PDF goes to the model as a file, a photo as an image', () => {
    assert.equal(mediaPart('application/pdf', 'QQ==').type, 'file');
    assert.equal(mediaPart('image/jpeg', 'QQ==').type, 'image_url');
  });
});

describe('reasoning headroom (Gemini 3 thinks inside max_tokens)', () => {
  it('adds thinking room on top of the visible budget', () => {
    assert.equal(withReasoningHeadroom({ model: 'google/gemini-3.8-flash', max_tokens: 2400, reasoning: { effort: 'medium' } }).max_tokens, 2400 + 12000);
    assert.equal(withReasoningHeadroom({ model: 'google/gemini-3.8-flash', max_tokens: 2000 }).max_tokens, 2000 + 16000);
    assert.equal(withReasoningHeadroom({ model: 'google/gemini-3.8-flash', max_tokens: 12000, reasoning: { effort: 'minimal' } }).max_tokens, 12000 + 2048);
  });

  it('leaves other models, explicit thinking budgets and huge requests alone or capped', () => {
    assert.equal(reasoningHeadroom({ model: 'inclusionai/ling-3.0-flash-sante:free', max_tokens: 100 }), 0);
    assert.equal(withReasoningHeadroom({ model: 'google/gemini-3.8-flash', max_tokens: 500, reasoning: { max_tokens: 300 } }).max_tokens, 500);
    assert.equal(withReasoningHeadroom({ model: 'google/gemini-3.8-flash', max_tokens: 60000 }).max_tokens, 64000);
  });

  it('every OpenRouter request leaves consentedAiFetch with the headroom', async () => {
    let sent = null;
    const guarded = consentedAiFetch('openrouter', {
      account: () => 'A',
      check: async () => undefined,
      language: () => 'ka',
      transport: async (_input, init) => { sent = JSON.parse(init.body); return new Response('{}'); },
    });
    await guarded('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', body: JSON.stringify({ model: 'google/gemini-3.8-flash', max_tokens: 2400, messages: [] }) });
    assert.equal(sent.max_tokens, 2400 + 16000);
    assert.ok(sent.provider);
  });
});

describe('document header lines are never lab values', async () => {
  const { isLabMetadataRow } = await import('./labExtract.js');
  const { sanitizeLabPanel } = await import('./appState.js');
  it('drops the OCR rows from the 2026-10-06 sheet and keeps real analytes', () => {
    assert.equal(isLabMetadataRow({ key: 'დაბადების_თარიღი_11_11_1987_avers', nameKa: 'დაბადების თარიღი: 11.11.1987 AVERS' }), true);
    assert.equal(isLabMetadataRow({ key: 'ლაბორატორიის_ექიმი', nameKa: 'ლაბორატორიის ექიმი' }), true);
    for (const name of ['ბიოქიმიური ანალიზი', 'Alkaline phosphatase', 'ტუტე ფოსფატაზა', 'MCV', 'Phosphorus']) {
      assert.equal(isLabMetadataRow({ key: name, nameKa: name, nameEn: name }), false, name);
    }
    const saved = sanitizeLabPanel(panel('p', '2010-11-19', ['rec1'], ['mcv'], {
      parameters: [row('mcv'), { ...row('დაბადების_თარიღი_11_11_1987_avers'), nameKa: 'დაბადების თარიღი: 11.11.1987 AVERS' }],
    }));
    assert.deepEqual(saved.parameters.map((r) => r.key), ['mcv']);
  });
});
