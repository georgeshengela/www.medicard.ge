import { COMPANION_MOODS } from './catalog.js';

const DAYPART = {
  morning: [5, 11],
  day: [11, 17],
  evening: [17, 21],
  night: [21, 5],
};

export function resolveDaypart(localHour) {
  const h = ((Number(localHour) % 24) + 24) % 24;
  if (h >= 5 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/**
 * Deterministic mood — never clinical, never guilt.
 * Priority:
 * 1 important recent event
 * 2 welcome back
 * 3 proud (all daily complete)
 * 4 focused (meaningful progress)
 * 5 cheerful
 * 6 resting (evening/night)
 * 7 calm
 */
export function resolveMediCompanionMood(context = {}) {
  const {
    recentEventKey = null,
    isComeback = false,
    allDailyComplete = false,
    meaningfulQuestProgress = false,
    localHour = 12,
    weatherKey = null,
  } = context;

  let mood = 'CALM';
  let messageKey = 'COMPANION_CALM';

  const daypart = resolveDaypart(localHour);
  const resting = daypart === 'evening' || daypart === 'night';

  if (recentEventKey === 'LEVEL_UP') {
    mood = 'EXCITED';
    messageKey = 'COMPANION_LEVEL_UP';
  } else if (recentEventKey === 'ACHIEVEMENT_RARE_PLUS') {
    mood = 'PROUD';
    messageKey = 'COMPANION_ACHIEVEMENT';
  } else if (recentEventKey === 'REWARD_REDEEMED') {
    mood = 'CHEERFUL';
    messageKey = 'COMPANION_REWARD_REDEEMED';
  } else if (isComeback) {
    mood = 'WELCOME_BACK';
    messageKey = 'COMPANION_COMEBACK';
  } else if (allDailyComplete) {
    mood = 'PROUD';
    messageKey = 'COMPANION_ALL_COMPLETE';
  } else if (meaningfulQuestProgress) {
    mood = 'FOCUSED';
    messageKey = 'COMPANION_QUEST_PROGRESS';
  } else if (weatherKey === 'rain' || weatherKey === 'RAIN') {
    mood = 'CURIOUS';
    messageKey = 'COMPANION_RAIN';
  } else if (daypart === 'morning') {
    mood = 'CHEERFUL';
    messageKey = 'COMPANION_MORNING_READY';
  } else if (resting) {
    mood = 'RESTING';
    messageKey = 'COMPANION_EVENING';
  } else {
    mood = 'CHEERFUL';
    messageKey = 'COMPANION_CHEERFUL';
  }

  if (!COMPANION_MOODS.includes(mood)) mood = 'CALM';
  return { moodKey: mood, messageKey, daypart, environmentKey: daypartEnvironment(daypart, weatherKey) };
}

function daypartEnvironment(daypart, weatherKey) {
  if (weatherKey === 'rain' || weatherKey === 'RAIN') return 'env.rain';
  if (daypart === 'morning') return 'env.sunrise';
  if (daypart === 'evening') return 'env.dusk';
  if (daypart === 'night') return 'env.night';
  return 'env.day';
}

export { DAYPART };
