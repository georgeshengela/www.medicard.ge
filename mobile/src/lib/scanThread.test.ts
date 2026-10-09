import test from 'node:test';
import assert from 'node:assert/strict';
import { canAskAboutResult, isLabUnreadable, labPagesNotice, latestResultContext, readLabPages, scanHref, scanKindFromParam, type ScanTurn } from './scanThread.ts';

test('the choice comes from ?type= in any spelling, and back', () => {
  assert.equal(scanKindFromParam('lab'), 'LAB');
  assert.equal(scanKindFromParam(['IMAGING']), 'IMAGING');
  assert.equal(scanKindFromParam(' Skin '), 'SKIN');
  assert.equal(scanKindFromParam('xray'), null);
  assert.equal(scanKindFromParam(undefined), null);
  assert.equal(scanHref('IMAGING'), '/scan?type=imaging');
  assert.equal(scanHref(null), '/scan');
});

test('a follow-up question carries only the latest result, bounded', () => {
  const turns: ScanTurn[] = [
    { id: '1', kind: 'upload', scan: 'SKIN', files: [], note: '' },
    { id: '2', kind: 'result', scan: 'SKIN', text: 'ხალი სიმეტრიულია', recordId: 'r1' },
    { id: '3', kind: 'lab', recordId: 'r2', note: '', savedDate: '2026-10-01', extract: { date: '2026-10-01', parameters: [
      { key: 'hgb', nameKa: 'ჰემოგლობინი', nameEn: 'Hemoglobin', value: 11, display: '11', unit: 'g/dL', refLow: 12, refHigh: 16, flag: 'L' },
    ] } },
  ];
  const context = latestResultContext(turns)!;
  assert.match(context, /Lab results from 2026-10-01/);
  assert.match(context, /Hemoglobin: 11 g\/dL \(norm 12–16\) \[low\]/);
  assert.doesNotMatch(context, /ხალი/);
  assert.equal(latestResultContext(turns.slice(0, 2))!.startsWith('Skin photo review'), true);
  const long: ScanTurn[] = [{ id: 'x', kind: 'result', scan: 'IMAGING', text: 'ა'.repeat(9000), recordId: 'r' }];
  assert.ok(latestResultContext(long)!.length <= 3800);
  assert.equal(canAskAboutResult([{ id: '1', kind: 'upload', scan: 'LAB', files: [], note: '' }]), false);
  assert.equal(canAskAboutResult(turns), true);
});

// MEDISCAN F8 (2026-10-09): three pages with a blurry cover page used to fail completely — page 1 went
// without append, the server answered 422 LAB_UNREADABLE and pages 2-3 were never read.
const unreadable = () => Object.assign(new Error('ფურცლიდან მაჩვენებლები ვერ ამოვიკითხეთ.'), { status: 422, code: 'LAB_UNREADABLE' });
const readerDown = () => Object.assign(new Error('ანალიზი ახლა ვერ შესრულდა.'), { status: 503, code: 'AI_ENGINE_ERROR' });
type Answer = { record: { id: string }; unreadable?: boolean; unavailable?: boolean; page: number };

function server(script: Array<'ok' | 'unreadable' | 'down' | 'later'>) {
  const calls: Array<{ index: number; recordId: string | undefined }> = [];
  const readPage = async (index: number, recordId: string | undefined): Promise<Answer> => {
    calls.push({ index, recordId });
    const step = script[index];
    if (step === 'unreadable' && !recordId) throw unreadable();
    if (step === 'down' && !recordId) throw readerDown();
    const id = recordId ?? `rec-${index}`;
    if (step === 'unreadable') return { record: { id }, unreadable: true, page: index };
    if (step === 'later') return { record: { id }, unreadable: true, unavailable: true, page: index };
    return { record: { id }, page: index };
  };
  return { calls, readPage };
}

test('an unreadable first page is skipped; the next readable page starts the record', async () => {
  const { calls, readPage } = server(['unreadable', 'ok', 'ok']);
  const read = await readLabPages(3, readPage);
  assert.ok(read);
  assert.deepEqual(read.unreadPages, [1]);
  assert.deepEqual(read.laterPages, []);
  assert.deepEqual(read.answers.map(a => a.page), [1, 2]);
  // Page 2 is sent as a first page (no record yet); page 3 is appended to the record page 2 made.
  assert.deepEqual(calls, [{ index: 0, recordId: undefined }, { index: 1, recordId: undefined }, { index: 2, recordId: 'rec-1' }]);
  assert.match(labPagesNotice(read.unreadPages, read.laterPages)!, /^1 გვერდი ვერ წავიკითხეთ/);
});

test('the read fails only when every page is unreadable, with the server’s own message', async () => {
  await assert.rejects(readLabPages(2, server(['unreadable', 'unreadable']).readPage), (error: unknown) => isLabUnreadable(error));
  await assert.rejects(readLabPages(1, server(['unreadable']).readPage), (error: unknown) => isLabUnreadable(error));
});

test('the reader being down still stops the read: no retake copy, nothing skipped', async () => {
  const { calls, readPage } = server(['down', 'ok']);
  await assert.rejects(readLabPages(2, readPage), (error: unknown) => (error as { code?: string }).code === 'AI_ENGINE_ERROR');
  assert.equal(calls.length, 1);
  assert.equal(isLabUnreadable(readerDown()), false);
});

test('a later page the reader could not look at asks for the same photo later, never a retake', async () => {
  const read = await readLabPages(3, server(['ok', 'unreadable', 'later']).readPage);
  assert.ok(read);
  assert.deepEqual(read.unreadPages, [2]);
  assert.deepEqual(read.laterPages, [3]);
  const later = labPagesNotice([], [3])!;
  assert.match(later, /იგივე ფოტო/);
  assert.doesNotMatch(later, /გადაუღე/);
  const en = labPagesNotice([], [2, 3], (_ka, english) => english)!;
  assert.match(en, /page 2, 3 right now/);
  assert.match(en, /No need to retake/);
  assert.equal(labPagesNotice([], []), null);
});

test('leaving the screen stops the loop without a result', async () => {
  let alive = true;
  const read = await readLabPages(3, async (index: number) => { alive = false; return { record: { id: `r${index}` }, page: index }; }, () => alive);
  assert.equal(read, null);
});
