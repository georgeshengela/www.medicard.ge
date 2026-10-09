const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// MEDISCAN F8 (2026-10-09): she attached 3 pages and page 1 was a cover page or blurry. Page 1 went
// without append, the server answered 422 LAB_UNREADABLE, the whole read failed with „retake the photo“
// and pages 2-3 were never read. The page loop now lives in scanThread.readLabPages (tested there): an
// unreadable first page is skipped and the next readable page starts the record. F4: a page the reader
// could not look at (the service was down) asks for the same photo later, never a retake.

const src = readFileSync(join(__dirname, '..', 'src', 'components', 'scan', 'ScanChat.tsx'), 'utf8');
const lab = src.slice(src.indexOf("if (scan === 'LAB') {"), src.indexOf('} else {', src.indexOf("if (scan === 'LAB') {")));

test('ScanChat reads lab pages through readLabPages, appending only once a record exists', () => {
  assert.match(lab, /await readLabPages\(sent\.length,/);
  assert.match(lab, /append: !!recordId/);
  assert.doesNotMatch(src, /append: i > 0/, 'page 2 is a first page when page 1 was skipped');
});

test('pages that were not read are named; the reader being down keeps the same photo for later', () => {
  assert.match(lab, /labPagesNotice\(read\.unreadPages, read\.laterPages\)/);
  assert.match(lab, /setFiles\(sent\.filter\(\(_, i\) => read\.laterPages\.includes\(i \+ 1\)\)\)/);
});
