/**
 * Ranking helpers — dense rank on the competitive key only.
 * Secondary fields are for stable pagination/display, never to split a tie.
 */

export function districtGoalRatio(eligibleStepsSum, target) {
  const steps = Number(eligibleStepsSum) || 0;
  const goal = Number(target) || 0;
  if (goal <= 0) return 0;
  return steps / goal;
}

export function denseRanksByValue(sortedItems, valueFn) {
  let dense = 0;
  let prev = null;
  return sortedItems.map((item, index) => {
    const value = valueFn(item);
    if (index === 0 || value !== prev) {
      dense += 1;
      prev = value;
    }
    return { item, rank: dense };
  });
}

export function compareDistrictDisplay(a, b) {
  const ratioA = districtGoalRatio(a.eligibleStepsSum, a.target);
  const ratioB = districtGoalRatio(b.eligibleStepsSum, b.target);
  if (ratioA !== ratioB) return ratioB - ratioA;
  const orderA = Number(a.sortOrder) || 0;
  const orderB = Number(b.sortOrder) || 0;
  if (orderA !== orderB) return orderA - orderB;
  return String(a.slug || '').localeCompare(String(b.slug || ''));
}

export function comparePeopleDisplay(a, b) {
  const stepsA = Number(a.eligibleSteps) || 0;
  const stepsB = Number(b.eligibleSteps) || 0;
  if (stepsA !== stepsB) return stepsB - stepsA;
  const handle = String(a.publicHandle || '').localeCompare(String(b.publicHandle || ''), 'ka');
  if (handle !== 0) return handle;
  return String(a.userId || '').localeCompare(String(b.userId || ''));
}

export function rankDistricts(districts, { minParticipantsForRank, competitionPaused = false } = {}) {
  const min = Math.max(1, Number(minParticipantsForRank) || 5);
  const sorted = [...districts].sort(compareDistrictDisplay);
  const eligible = sorted.filter((row) => Number(row.contributorCount) >= min);
  const ranked = denseRanksByValue(eligible, (row) => districtGoalRatio(row.eligibleStepsSum, row.target));
  const rankById = new Map(ranked.map(({ item, rank }) => [item.id || item.districtId, rank]));

  return sorted.map((row) => {
    const ratio = districtGoalRatio(row.eligibleStepsSum, row.target);
    const participantsOk = Number(row.contributorCount) >= min;
    const contestActive = !competitionPaused;
    const rank = contestActive && participantsOk ? rankById.get(row.id || row.districtId) ?? null : null;
    return {
      ...row,
      goalRatio: ratio,
      goalPctDisplay: Math.round(ratio * 1000) / 10,
      goalReached: Number(row.eligibleStepsSum) >= Number(row.target),
      rank,
      unranked: contestActive && !participantsOk,
      contestActive,
    };
  });
}

export function rankPeople(rows, { competitionPaused = false } = {}) {
  const competitive = rows.filter((row) => Number(row.eligibleSteps) > 0 && !row.excludedAt);
  const sorted = [...competitive].sort(comparePeopleDisplay);
  const ranked = denseRanksByValue(sorted, (row) => Number(row.eligibleSteps) || 0);
  return ranked.map(({ item, rank }, index) => ({
    ...item,
    rank: competitionPaused ? null : rank,
    displayIndex: index,
    contestActive: !competitionPaused,
  }));
}

export function ownPeopleRow(ranked, you, { offset = 0, limit = 50 } = {}) {
  if (!you) return { page: ranked.slice(offset, offset + limit), you: null, total: ranked.length };
  const youRanked = ranked.find((row) => row.userId === you.userId) || null;
  const page = ranked.slice(offset, offset + limit);
  const onPage = page.some((row) => row.userId === you.userId);
  return {
    page,
    you: youRanked
      ? {
          userId: youRanked.userId,
          publicHandle: youRanked.publicHandle,
          publicAvatarId: youRanked.publicAvatarId,
          eligibleSteps: youRanked.eligibleSteps,
          rank: youRanked.rank,
          onPage,
        }
      : {
          userId: you.userId,
          publicHandle: you.publicHandle,
          publicAvatarId: you.publicAvatarId,
          eligibleSteps: Number(you.eligibleSteps) || 0,
          rank: null,
          onPage: false,
          unranked: true,
        },
    total: ranked.length,
  };
}
