// Picks the age guide for one child: milestone checkpoint, feeding stage, tips, foods. Pure functions.
import { DAYS_PER_MONTH } from './age.js';
import { FEEDING, FOODS, MILESTONES, MILESTONE_DOMAINS, MILESTONE_NOTE, MONTH_NOTES, TIPS, TIP_TOPICS } from './guideData.js';

const pick = (pair, lang) => (pair ? pair[lang === 'en' ? 'en' : 'ka'] : null);

/**
 * The checkpoint a parent should look at now: the latest one the child has reached (corrected age under
 * two years), plus the next one ahead. Before 2 months the first checkpoint is shown as „ahead“.
 */
export function milestoneCheckpoints(ageDays) {
  const months = ageDays / DAYS_PER_MONTH;
  let current = null;
  let next = null;
  for (const cp of MILESTONES) {
    if (cp.months <= months + 0.25) current = cp;
    else { next = cp; break; }
  }
  return { current, next };
}

export function milestoneView(checkpoint, statuses, lang) {
  if (!checkpoint) return null;
  const marks = statuses || {};
  const items = checkpoint.items.map((item) => ({
    key: item.key,
    domain: item.domain,
    text: pick(item, lang),
    status: marks[item.key]?.status || null,
  }));
  return {
    key: checkpoint.key,
    months: checkpoint.months,
    screen: Boolean(checkpoint.screen),
    done: items.filter((i) => i.status === 'YES').length,
    total: items.length,
    items,
  };
}

export function milestoneGuide(ageDays, statuses, lang = 'ka') {
  const { current, next } = milestoneCheckpoints(ageDays);
  return {
    current: milestoneView(current, statuses, lang),
    next: milestoneView(next, statuses, lang),
    domains: Object.fromEntries(Object.entries(MILESTONE_DOMAINS).map(([k, v]) => [k, pick(v, lang)])),
    note: pick(MILESTONE_NOTE, lang),
    // Every checkpoint (for the full list screen) — keys and months only.
    all: MILESTONES.map((cp) => ({ key: cp.key, months: cp.months, screen: Boolean(cp.screen) })),
  };
}

export function milestoneCheckpoint(key, statuses, lang = 'ka') {
  return milestoneView(MILESTONES.find((cp) => cp.key === key) || null, statuses, lang);
}

export function isMilestoneKey(key) {
  return MILESTONES.some((cp) => cp.items.some((item) => item.key === key));
}

export function feedingGuide(stage, lang = 'ka') {
  const block = FEEDING[stage] || FEEDING.school;
  return { stage, title: pick(block.title, lang), points: block.points.map((p) => pick(p, lang)) };
}

export function stageTips(stage, lang = 'ka') {
  return (TIPS[stage] || []).map((tip) => ({ topic: tip.topic, label: pick(TIP_TOPICS[tip.topic], lang), text: pick(tip.text, lang) }));
}

/** Foods with the child's own marks; allergens first. Shown from 4 months (allergens never before). */
export function foodList(marks, lang = 'ka') {
  const byKey = new Map((marks || []).map((row) => [row.foodKey, row]));
  return FOODS.map((food) => {
    const mark = byKey.get(food.key);
    return {
      key: food.key,
      allergen: Boolean(food.allergen),
      name: pick(food.name, lang),
      how: pick(food.how, lang),
      status: mark?.status || null,
      firstOn: mark?.firstOn ? String(mark.firstOn instanceof Date ? mark.firstOn.toISOString().slice(0, 10) : mark.firstOn).slice(0, 10) : null,
      note: mark?.note || null,
    };
  });
}

export function isFoodKey(key) {
  return FOODS.some((f) => f.key === key);
}

export function monthNote(month, lang = 'ka') {
  return pick(MONTH_NOTES[month], lang);
}

export function monthNoteMonths() {
  return Object.keys(MONTH_NOTES).map(Number);
}
