/**
 * Pregnancy timeline presenter (Phase 21).
 * Consumes Phase 18 dating fields. Does not recompute gestational age or due date.
 */

import {
  PREGNANCY_STANDARD_TERM_WEEKS,
  PREGNANCY_TIMELINE_MILESTONES,
  PREGNANCY_TIMELINE_REVIEW_DATE,
  PREGNANCY_TIMELINE_SOURCE_SET,
  PREGNANCY_TIMELINE_VERSION,
  PREGNANCY_TRIMESTER_BANDS,
  calendarProgressFraction,
  calendarRailPosition,
  milestoneStatusForWeek,
} from './pregnancyTimelineData.js';

function meta() {
  return {
    version: PREGNANCY_TIMELINE_VERSION,
    reviewDate: PREGNANCY_TIMELINE_REVIEW_DATE,
    sourceSet: PREGNANCY_TIMELINE_SOURCE_SET,
  };
}

function shapeMilestone(row, currentWeek) {
  return {
    id: row.id,
    week: row.week,
    weekRange: row.weekRange ? [...row.weekRange] : null,
    category: row.category,
    titleKey: row.titleKey,
    bodyKey: row.bodyKey,
    sourceKey: row.sourceKey,
    status: milestoneStatusForWeek(row.week, currentWeek),
  };
}

/**
 * @param {{
 *   mode?: string,
 *   pregnancyActive?: boolean,
 *   dating?: {
 *     reviewRequired?: boolean,
 *     estimatedGestationalAge?: { week: number, day: number, trimester?: number } | null,
 *     estimatedDueDate?: { date: string, estimated?: boolean } | null,
 *   } | null,
 * }} input
 */
export function presentPregnancyTimeline({ mode, pregnancyActive, dating } = {}) {
  if (mode !== 'PREGNANCY' || pregnancyActive !== true) return null;

  const reviewRequired = Boolean(dating?.reviewRequired) || !dating?.estimatedGestationalAge;
  if (reviewRequired) {
    return {
      ...meta(),
      available: false,
      reviewRequired: true,
      currentWeek: null,
      currentDay: null,
      trimester: null,
      progress: null,
      currentMarker: null,
      currentMilestoneId: null,
      nextMilestone: null,
      beyondStandardTerm: false,
      estimatedDueDate: null,
      trimesterBands: PREGNANCY_TRIMESTER_BANDS,
      milestones: [],
    };
  }

  const age = dating.estimatedGestationalAge;
  const week = age.week;
  const day = age.day;
  const trimester = age.trimester;
  const milestones = PREGNANCY_TIMELINE_MILESTONES.map((row) => shapeMilestone(row, week));
  const current = milestones.find((row) => row.status === 'CURRENT') || null;
  const next = milestones.find((row) => row.status === 'UPCOMING') || null;
  const railPosition = calendarRailPosition(week, day);
  const fraction = calendarProgressFraction(week, day, PREGNANCY_STANDARD_TERM_WEEKS);
  const beyondStandardTerm = week > PREGNANCY_STANDARD_TERM_WEEKS;
  const due = dating.estimatedDueDate?.date
    ? { date: dating.estimatedDueDate.date, estimated: true }
    : null;

  return {
    ...meta(),
    available: true,
    reviewRequired: false,
    currentWeek: week,
    currentDay: day,
    trimester,
    progress: {
      kind: 'gestational_calendar',
      currentWeek: week,
      currentDay: day,
      ofWeeks: PREGNANCY_STANDARD_TERM_WEEKS,
      fraction,
    },
    currentMarker: {
      week,
      day,
      railPosition,
      betweenMilestones: !current,
    },
    currentMilestoneId: current ? current.id : null,
    nextMilestone: next
      ? { id: next.id, week: next.week, titleKey: next.titleKey, sourceKey: next.sourceKey }
      : null,
    beyondStandardTerm,
    estimatedDueDate: due,
    trimesterBands: PREGNANCY_TRIMESTER_BANDS,
    milestones,
  };
}
