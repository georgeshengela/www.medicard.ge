import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DOCUMENT_MAX_EDGE, PHOTO_MAX_EDGE, fitWithin, isCompressibleImage, resizeActionFor } from './imageCompress.ts';

describe('image upload sizing', () => {
  it('caps the long side and keeps the aspect ratio', () => {
    assert.deepEqual(fitWithin(4032, 3024, PHOTO_MAX_EDGE), { width: 1600, height: 1200 });
    assert.deepEqual(fitWithin(3024, 4032, PHOTO_MAX_EDGE), { width: 1200, height: 1600 });
    assert.deepEqual(fitWithin(3024, 4032, DOCUMENT_MAX_EDGE), { width: 1800, height: 2400 });
    assert.deepEqual(fitWithin(8000, 8000, PHOTO_MAX_EDGE), { width: 1600, height: 1600 });
    assert.deepEqual(fitWithin(10000, 3, PHOTO_MAX_EDGE), { width: 1600, height: 1 });
  });

  it('never upscales and ignores unknown sizes', () => {
    assert.equal(fitWithin(1600, 900, PHOTO_MAX_EDGE), null);
    assert.equal(fitWithin(800, 600, PHOTO_MAX_EDGE), null);
    assert.equal(fitWithin(0, 600, PHOTO_MAX_EDGE), null);
    assert.equal(fitWithin(undefined, 600, PHOTO_MAX_EDGE), null);
    assert.equal(fitWithin(Number.NaN, 600, PHOTO_MAX_EDGE), null);
  });

  it('resizes along one dimension only', () => {
    assert.deepEqual(resizeActionFor(4032, 3024, PHOTO_MAX_EDGE), { width: 1600 });
    assert.deepEqual(resizeActionFor(3024, 4032, PHOTO_MAX_EDGE), { height: 1600 });
    assert.equal(resizeActionFor(1200, 1600, PHOTO_MAX_EDGE), null);
  });

  it('leaves PDFs alone', () => {
    assert.equal(isCompressibleImage('application/pdf'), false);
    assert.equal(isCompressibleImage('image/png'), true);
    assert.equal(isCompressibleImage('image/heic'), true);
    assert.equal(isCompressibleImage(null), false);
  });
});
