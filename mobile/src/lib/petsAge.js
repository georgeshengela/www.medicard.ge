/**
 * Client-side age display for Pets Phase 2.
 * Does not invent a birth date. Server remains the validator.
 */

export function formatPetAgeKa(age, copy) {
  if (!age || age.kind === 'UNKNOWN' || (age.years == null && age.months == null)) {
    return copy.ageUnknown;
  }
  const years = age.years ?? 0;
  const months = age.months ?? 0;
  if (years <= 0 && months <= 0) return copy.ageUnknown;
  if (years <= 0) return copy.ageMonthsOnly(months);
  if (months <= 0) return copy.ageYearsOnly(years);
  return copy.ageYearsMonths(years, months);
}

/** Approximate birth year+month → age years/months the API stores. */
export function approxBirthToAge(year, month, now = new Date()) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  const total = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  if (total < 1) return null;
  return { years: Math.floor(total / 12), months: total % 12 };
}

export function ageToApproxBirth(years, months, now = new Date()) {
  const y = Number(years);
  const m = Number(months);
  const total = (Number.isFinite(y) ? y : 0) * 12 + (Number.isFinite(m) ? m : 0);
  if (total < 1) return null;
  const d = new Date(now.getFullYear(), now.getMonth() - total, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function approxBirthYears(now = new Date(), span = 40) {
  const max = now.getFullYear();
  const min = max - span;
  const years = [];
  for (let year = max; year >= min; year -= 1) years.push(year);
  return years;
}
