import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PREGNANCY_TIMELINE_COPY_KA } from '../i18n/cycle/pregnancyTimeline.js';
import {
  PREGNANCY_STANDARD_TERM_WEEKS,
  PREGNANCY_TIMELINE_CATEGORIES,
  PREGNANCY_TIMELINE_MILESTONES,
  PREGNANCY_TIMELINE_REVIEW_DATE,
  PREGNANCY_TIMELINE_SOURCE_SET,
  PREGNANCY_TIMELINE_SOURCES,
  PREGNANCY_TIMELINE_VERSION,
  PREGNANCY_TRIMESTER_BANDS,
} from './pregnancyTimelineData.js';

describe('Pregnancy timeline catalog', () => {
  it('has unique ids, ordered weeks, valid categories, and sources', () => {
    const ids = PREGNANCY_TIMELINE_MILESTONES.map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.length >= 10 && ids.length <= 18);
    let prev = -1;
    for (const row of PREGNANCY_TIMELINE_MILESTONES) {
      assert.ok(PREGNANCY_TIMELINE_CATEGORIES.includes(row.category));
      assert.ok(Number.isInteger(row.week));
      assert.ok(row.week >= 0 && row.week <= PREGNANCY_STANDARD_TERM_WEEKS);
      assert.ok(row.week > prev);
      prev = row.week;
      assert.equal(typeof row.titleKey, 'string');
      assert.equal(typeof row.bodyKey, 'string');
      assert.equal(typeof row.sourceKey, 'string');
      assert.ok(PREGNANCY_TIMELINE_SOURCES[row.sourceKey]);
      assert.ok(PREGNANCY_TIMELINE_SOURCES[row.sourceKey].citation);
      if (row.weekRange) {
        assert.equal(row.weekRange.length, 2);
        assert.ok(row.weekRange[0] <= row.week && row.week <= row.weekRange[1]);
      }
    }
    assert.equal(PREGNANCY_TIMELINE_VERSION, 'cycle.pregnancy-timeline.v1');
    assert.equal(PREGNANCY_TIMELINE_REVIEW_DATE, '2026-09-10');
    assert.equal(PREGNANCY_TIMELINE_SOURCE_SET, 'who-nhs-acog-williams-2026');
  });

  it('exposes NHS-aligned trimester bands matching Phase 18', () => {
    assert.deepEqual(
      PREGNANCY_TRIMESTER_BANDS.map((band) => [band.trimester, band.fromWeek, band.toWeek]),
      [
        [1, 0, 12],
        [2, 13, 26],
        [3, 27, 40],
      ],
    );
  });

  it('has a Georgian string for every title, body, and source key', () => {
    for (const row of PREGNANCY_TIMELINE_MILESTONES) {
      assert.ok(PREGNANCY_TIMELINE_COPY_KA[row.titleKey], row.titleKey);
      assert.ok(PREGNANCY_TIMELINE_COPY_KA[row.bodyKey], row.bodyKey);
      assert.ok(PREGNANCY_TIMELINE_COPY_KA[row.sourceKey], row.sourceKey);
    }
  });

  it('does not use outcome, overdue, or live-birth copy', () => {
    const blob = JSON.stringify(PREGNANCY_TIMELINE_COPY_KA);
    assert.doesNotMatch(
      blob,
      /overdue|miscarriage|ectopic|miracle|perfect little|when you meet|completed successfully|გადაცილებული|წარმატებით დასრულ|როცა ბავშვს გაიცნობთ|უნდა გააკეთოთ|უნდა გაიკეთოთ/i,
    );
  });

  it('does not duplicate Phase 19 baby-size fields', () => {
    const blob = JSON.stringify(PREGNANCY_TIMELINE_MILESTONES);
    assert.doesNotMatch(blob, /comparisonKey|lengthCm|weightGrams|illustrationKey|raspberry|მარწყვ/);
  });
});
