import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PREGNANCY_CARE_COPY_KA } from '../i18n/cycle/pregnancyCare.js';
import {
  PREGNANCY_CARE_CATALOG_REVIEWED_AT,
  PREGNANCY_CARE_CATALOG_SOURCE_SET,
  PREGNANCY_CARE_CATALOG_VERSION,
  PREGNANCY_CARE_CATEGORIES,
  PREGNANCY_CARE_ITEMS,
  PREGNANCY_CARE_SOURCES,
  careWindowRelation,
  isRenderableCareItem,
  pregnancyCareItemById,
  renderablePregnancyCareItems,
} from './pregnancyCareCatalog.js';

describe('Pregnancy care catalog validator', () => {
  it('is versioned with a review date and source set', () => {
    assert.equal(PREGNANCY_CARE_CATALOG_VERSION, 'prenatal-care-v1');
    assert.equal(PREGNANCY_CARE_CATALOG_REVIEWED_AT, '2026-09-10');
    assert.equal(PREGNANCY_CARE_CATALOG_SOURCE_SET, 'who-nhs-nice-acog-2026');
  });

  it('has unique IDs, known categories, valid weeks, and at least one source', () => {
    const ids = PREGNANCY_CARE_ITEMS.map((row) => row.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const row of PREGNANCY_CARE_ITEMS) {
      assert.equal(isRenderableCareItem(row), true, row.id);
      assert.equal(PREGNANCY_CARE_CATEGORIES.includes(row.category), true, row.id);
      assert.ok(Number.isInteger(row.startWeek));
      assert.ok(row.endWeek >= row.startWeek);
      assert.ok(row.sourceRefs.length >= 1);
      for (const ref of row.sourceRefs) {
        const src = PREGNANCY_CARE_SOURCES[ref];
        assert.ok(src, `${row.id} missing ${ref}`);
        assert.ok(src.organization);
        assert.ok(src.title);
        assert.ok(src.reviewedAt);
        assert.ok(src.url);
      }
    }
  });

  it('has Georgian copy keys for every catalog field', () => {
    for (const row of PREGNANCY_CARE_ITEMS) {
      assert.equal(typeof PREGNANCY_CARE_COPY_KA[row.titleKey], 'string', row.titleKey);
      assert.ok(PREGNANCY_CARE_COPY_KA[row.titleKey].length > 8, row.titleKey);
      assert.equal(typeof PREGNANCY_CARE_COPY_KA[row.descriptionKey], 'string', row.descriptionKey);
      assert.equal(typeof PREGNANCY_CARE_COPY_KA[row.whyKey], 'string', row.whyKey);
      if (row.disclaimerKey) {
        assert.equal(typeof PREGNANCY_CARE_COPY_KA[row.disclaimerKey], 'string', row.disclaimerKey);
      }
    }
  });

  it('does not include medication, kick-count, or risk-score items', () => {
    const blob = JSON.stringify(PREGNANCY_CARE_ITEMS).toLowerCase();
    assert.equal(blob.includes('aspirin'), false);
    assert.equal(blob.includes('insulin'), false);
    assert.equal(blob.includes('anti-d'), false);
    assert.equal(blob.includes('folic'), false);
    assert.equal(PREGNANCY_CARE_ITEMS.some((row) => /kick|contraction|birth_bag|hospital_checklist/.test(row.id)), false);
  });

  it('marks GBS as jurisdiction-dependent', () => {
    const gbs = pregnancyCareItemById('gbs_screening_discussion');
    assert.equal(gbs.regionalVariation, true);
    assert.ok(gbs.sourceRefs.includes('src_nhs_gbs'));
    assert.ok(gbs.sourceRefs.includes('src_acog_gbs'));
  });

  it('fails closed when a source is missing', () => {
    const row = {
      ...PREGNANCY_CARE_ITEMS[0],
      sourceRefs: ['src_does_not_exist'],
    };
    assert.equal(isRenderableCareItem(row), false);
    assert.equal(
      renderablePregnancyCareItems().every((item) => item.sourceRefs.every((id) => PREGNANCY_CARE_SOURCES[id])),
      true,
    );
  });

  it('maps completed-week windows: start, end, one day before, one day after', () => {
    const anatomy = pregnancyCareItemById('anatomy_ultrasound');
    assert.equal(anatomy.startWeek, 18);
    assert.equal(anatomy.endWeek, 22);
    assert.equal(
      careWindowRelation({ week: anatomy.startWeek, startWeek: 18, endWeek: 22, reviewRequired: false }),
      'IN_WINDOW',
    );
    assert.equal(
      careWindowRelation({ week: anatomy.startWeek - 1, startWeek: 18, endWeek: 22, reviewRequired: false }),
      'BEFORE_WINDOW',
    );
    assert.equal(
      careWindowRelation({ week: anatomy.endWeek, startWeek: 18, endWeek: 22, reviewRequired: false }),
      'IN_WINDOW',
    );
    assert.equal(
      careWindowRelation({ week: anatomy.endWeek + 1, startWeek: 18, endWeek: 22, reviewRequired: false }),
      'AFTER_WINDOW',
    );
    assert.equal(
      careWindowRelation({ week: 20, startWeek: 18, endWeek: 22, reviewRequired: true }),
      null,
    );
  });
});
