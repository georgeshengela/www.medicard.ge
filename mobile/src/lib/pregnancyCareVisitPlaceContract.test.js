import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PLANNED_PLACE_MAX,
  calendarEventLocationField,
  calendarExportIncludesVisitPlace,
  calendarPayloadHasLocation,
  normalizePlannedPlace,
  placeChangeCreatesCalendarMismatch,
  placeRequiresPlannedDate,
  reminderCopyIncludesPlace,
  reminderSchedulingUsesPlannedPlace,
  resolvePlannedDateAndPlace,
  resolvePlannedPlace,
  storedPlaceCoordinates,
  unicodeLength,
  visitPlaceGeocodingApis,
  visitPlaceHasClinicSearch,
  visitPlaceHasMapUi,
  visitPlaceInfersProvider,
  visitPlaceIsVerifiedProviderData,
  visitPlaceParsesAddress,
  visitPlaceRequestsLocationPermission,
  visitPlaceUsesGeolocation,
  xssLikePlaceSample,
} from './pregnancyCareVisitPlaceContract.js';
import {
  buildCalendarEventPayload,
  calendarPlanDiffers,
} from './pregnancyCareCalendarExportContract.js';
import {
  buildPregnancyCareReminderCandidates,
  pregnancyCareMaskedCopy,
  pregnancyCareReminderCopy,
  resolvePrenatalCareReminderSchedule,
} from './pregnancyCareReminderContract.js';

const TZ = 'Europe/Brussels';

function item(place) {
  return {
    id: 'anatomy_ultrasound',
    userState: {
      status: 'PLANNED',
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      plannedPlace: place,
      reminderEnabled: true,
      reminderOffset: 1,
      reminderMode: 'DATE_BASED',
    },
  };
}

describe('Phase 37 owner-entered prenatal visit place', () => {
  it('TEST A: place without plannedDate is rejected/cleared', () => {
    assert.equal(placeRequiresPlannedDate(), true);
    assert.equal(resolvePlannedPlace({ plannedDate: null, plannedPlace: 'CHC' }), null);
    const cleared = resolvePlannedDateAndPlace({
      plannedDate: null,
      plannedPlace: 'CHC',
      existing: { plannedDate: '2026-09-22', plannedPlace: 'CHC' },
    });
    assert.equal(cleared.plannedDate, null);
    assert.equal(cleared.plannedPlace, null);
  });

  it('TEST B: date + place persists exact canonical text', () => {
    const next = resolvePlannedDateAndPlace({
      plannedDate: '2026-09-22',
      plannedPlace: 'CHC MontLégia — Radiologie',
    });
    assert.equal(next.plannedPlace, 'CHC MontLégia — Radiologie');
  });

  it('TEST C: date + time + place coexist', () => {
    const next = resolvePlannedDateAndPlace({
      plannedDate: '2026-09-22',
      plannedPlace: 'Cabinet médical',
      existing: { plannedDate: '2026-09-22', plannedTime: '14:30' },
    });
    assert.equal(next.plannedDate, '2026-09-22');
    assert.equal(next.plannedPlace, 'Cabinet médical');
  });

  it('TEST D: place-only edit keeps date', () => {
    const next = resolvePlannedDateAndPlace({
      plannedPlace: 'Dr Martin',
      existing: { plannedDate: '2026-09-22', plannedPlace: 'CHC' },
    });
    assert.equal(next.plannedDate, '2026-09-22');
    assert.equal(next.plannedPlace, 'Dr Martin');
  });

  it('TEST E: date change keeps place unless date is cleared', () => {
    const moved = resolvePlannedDateAndPlace({
      plannedDate: '2026-09-23',
      existing: { plannedDate: '2026-09-22', plannedPlace: 'CHC MontLégia' },
    });
    assert.equal(moved.plannedDate, '2026-09-23');
    assert.equal(moved.plannedPlace, 'CHC MontLégia');
  });

  it('TEST F: date clear also clears place', () => {
    const cleared = resolvePlannedDateAndPlace({
      plannedDate: null,
      existing: { plannedDate: '2026-09-22', plannedPlace: 'CHC' },
    });
    assert.equal(cleared.plannedPlace, null);
  });

  it('TEST G: clearing place keeps date', () => {
    const next = resolvePlannedDateAndPlace({
      plannedDate: '2026-09-22',
      plannedPlace: '',
      existing: { plannedDate: '2026-09-22', plannedPlace: 'CHC' },
    });
    assert.equal(next.plannedDate, '2026-09-22');
    assert.equal(next.plannedPlace, null);
  });

  it('TEST H: whitespace is trimmed and collapsed', () => {
    assert.equal(normalizePlannedPlace('   CHC MontLégia   '), 'CHC MontLégia');
    assert.equal(normalizePlannedPlace('CHC\nMontLégia'), 'CHC MontLégia');
  });

  it('TEST I: whitespace-only becomes null', () => {
    assert.equal(normalizePlannedPlace('   \n\t  '), null);
  });

  it('TEST J: too long is rejected', () => {
    const tooLong = 'ა'.repeat(PLANNED_PLACE_MAX + 1);
    assert.throws(() => normalizePlannedPlace(tooLong), (err) => err.status === 400);
  });

  it('TEST K/L: Unicode Georgian, French, Cyrillic', () => {
    assert.equal(normalizePlannedPlace('CHC MontLégia — რადიოლოგია'), 'CHC MontLégia — რადიოლოგია');
    assert.equal(normalizePlannedPlace('Больница Святой Екатерины'), 'Больница Святой Екатерины');
    assert.equal(normalizePlannedPlace('ტელეკონსულტაცია'), 'ტელეკონსულტაცია');
    assert.ok(unicodeLength('CHC MontLégia — რადიოლოგია') <= PLANNED_PLACE_MAX);
  });

  it('TEST M: XSS-like text stays plain text', () => {
    assert.equal(normalizePlannedPlace(xssLikePlaceSample()), xssLikePlaceSample());
  });

  it('TEST N/O: reminder fire time and identity ignore place', () => {
    assert.equal(reminderSchedulingUsesPlannedPlace(), false);
    const without = resolvePrenatalCareReminderSchedule({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      reminderEnabled: true,
      reminderOffset: 1,
      reminderMode: 'DATE_BASED',
    }, { timeZone: TZ });
    const withPlace = resolvePrenatalCareReminderSchedule({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      plannedPlace: 'CHC MontLégia',
      reminderEnabled: true,
      reminderOffset: 1,
      reminderMode: 'DATE_BASED',
    }, { timeZone: TZ });
    assert.equal(without.fireAtMs, withPlace.fireAtMs);
    assert.equal(without.fireClock, '09:00');
    const a = buildPregnancyCareReminderCandidates({
      userId: 'user-a',
      episodeId: 'ep-a',
      mode: 'PREGNANCY',
      pregnancyActive: true,
      episodeStatus: 'ACTIVE',
      items: [item(null)],
      today: '2026-09-10',
      now: new Date(2026, 8, 10, 8, 0, 0),
      timeZone: TZ,
    });
    const b = buildPregnancyCareReminderCandidates({
      userId: 'user-a',
      episodeId: 'ep-a',
      mode: 'PREGNANCY',
      pregnancyActive: true,
      episodeStatus: 'ACTIVE',
      items: [item('CHC MontLégia')],
      today: '2026-09-10',
      now: new Date(2026, 8, 10, 8, 0, 0),
      timeZone: TZ,
    });
    assert.equal(a[0].candidateId, b[0].candidateId);
    assert.equal(a[0].fireAtMs, b[0].fireAtMs);
    assert.equal(Object.hasOwn(a[0], 'plannedPlace'), false);
    assert.equal(reminderCopyIncludesPlace(pregnancyCareMaskedCopy(), 'CHC MontLégia'), false);
    assert.equal(
      reminderCopyIncludesPlace(pregnancyCareReminderCopy({ offset: 1, itemTitle: 'ანატომია' }), 'CHC MontLégia'),
      false,
    );
  });

  it('TEST P/Q: calendar payload has no location; place change is not a mismatch', () => {
    assert.equal(calendarExportIncludesVisitPlace(), false);
    assert.equal(calendarEventLocationField(), null);
    assert.equal(placeChangeCreatesCalendarMismatch(), false);
    const payload = buildCalendarEventPayload({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      titleMode: 'generic',
    });
    assert.equal(calendarPayloadHasLocation(payload), false);
    assert.equal(payload.location, undefined);
    const ownership = {
      eventId: '2',
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      exportMode: 'TIMED',
    };
    assert.equal(
      calendarPlanDiffers(ownership, {
        plannedDate: '2026-09-22',
        plannedTime: '14:30',
        plannedPlace: 'CHC MontLégia',
      }),
      false,
    );
  });

  it('hard rules: no geo/map/clinic/provider inference', () => {
    assert.equal(visitPlaceIsVerifiedProviderData(), false);
    assert.equal(visitPlaceUsesGeolocation(), false);
    assert.equal(visitPlaceRequestsLocationPermission(), false);
    assert.deepEqual(visitPlaceGeocodingApis(), []);
    assert.equal(visitPlaceHasMapUi(), false);
    assert.equal(visitPlaceHasClinicSearch(), false);
    assert.deepEqual(storedPlaceCoordinates({ plannedPlace: 'CHC' }), {
      latitude: null,
      longitude: null,
      placeId: null,
    });
    assert.equal(visitPlaceParsesAddress(), false);
    assert.equal(visitPlaceInfersProvider(), false);
  });
});
