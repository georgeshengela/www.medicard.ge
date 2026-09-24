import { nutritionDashboard } from './nutritionProgramStore.js';
import { prisma } from './prisma.js';
import { serializeCycleLogForAi } from './cycleAiContext.js';
import { OBSERVATION_REGISTRY } from './cycleObservationRegistry.js';
import { publicPetsCatalog } from './petsCatalog.js';

export const ASSISTANT_CONTEXT_DOMAINS = ['profile', 'metrics', 'goals', 'medications', 'visits', 'cycle', 'records', 'consultations', 'activity', 'pets', 'nutrition'];
const pick = (row, keys) => row ? Object.fromEntries(keys.filter(k => row[k] !== undefined).map(k => [k, row[k]])) : null;
const trim = (value, max = 1800) => typeof value === 'string' ? value.slice(0, max) : value;

/** Every query is owner-scoped. Unknown/private fields are excluded, not merely hidden in the prompt. */
export async function loadAssistantContext(user, domains, scope, db = prisma, petId = null, today = new Date().toISOString().slice(0,10)) {
  const userId = user.id;
  const requested = new Set(domains);
  const context = { scope, limits: 'Relevant recent records only. Absence is unknown, not a negative finding.' };
  if (scope === 'pet') {
    // Return before any human health query; even a malicious domains array cannot change this.
    const pets = await db.pet.findMany({ where: { userId, archivedAt: null, ...(petId ? { id: petId } : {}) }, take: 20, orderBy: { createdAt: 'desc' } });
    context.pets = await Promise.all(pets.map(async pet => ({
      ...pick(pet, ['id', 'name', 'speciesId', 'breedId', 'customBreed', 'sex', 'neutered', 'ageKind', 'birthDate', 'approxAgeYears', 'approxAgeMonths']),
      weight: (await db.petWeightLog.findMany({ where: { userId, petId: pet.id }, take: 3, orderBy: { recordedOn: 'desc' } })).map(r => pick(r, ['id', 'recordedOn', 'weightKg'])),
      allergies: (await db.petAllergy.findMany({ where: { userId, petId: pet.id }, take: 20 })).map(r => pick(r, ['id', 'name', 'category', 'reaction', 'reportedStatus'])),
      carePlans: (await db.petCareSchedule.findMany({ where: { userId, petId: pet.id }, take: 12, orderBy: { updatedAt: 'desc' } })).map(r => pick(r, ['id', 'title', 'status', 'nextDueOn', 'nextDueTime', 'dose', 'doseUnit', 'recurrenceKind', 'courseEndsOn'])),
      products: (await db.petProduct.findMany({ where: { userId, petId: pet.id, archivedAt: null }, take: 12, orderBy: { updatedAt: 'desc' } })).map(r => pick(r, ['id', 'name', 'kind', 'formulation', 'expiresOn'])),
      conditions: (await db.petCondition.findMany({ where: { userId, petId: pet.id }, take: 20 })).map(r => pick(r, ['id', 'name', 'status', 'reportedBasis'])),
    })));
    context.speciesCatalog = publicPetsCatalog();
    return context;
  }
  if (requested.has('profile') || requested.has('goals') || requested.has('activity')) {
    const p = await db.healthProfile.findUnique({ where: { userId } });
    if (requested.has('profile')) context.profile = { gender: user.gender, birthDate: user.birthDate,
      ...pick(p, ['heightCm', 'weightKg', 'bloodType', 'chronicConditions', 'allergies', 'medications', 'familyHistory', 'healthGoals', 'activityLevel', 'sleepHours', 'dietType', 'smokingStatus', 'alcoholUse']) };
    const state = p?.extraAnswers?.appState || {};
    if (requested.has('goals')) context.goals = pick(state, ['weightGoal', 'stepsGoal']);
    if (requested.has('activity')) {
      context.activity = { source: 'MEDIRUN saved sessions; at most 10 recent sessions; no GPS coordinates', sessions: (await db.medipulsiSession.findMany({ where: { userId }, take: 10, orderBy: { startedAt: 'desc' } })).map(r => pick(r, ['id', 'phase', 'startedAt', 'endedAt', 'meters', 'seconds', 'steps', 'newMeters', 'excluded'])) };
    }
  }
  if (requested.has('nutrition')) {
    const d = await nutritionDashboard(user,today,db);
    context.nutrition = { date:today, targets:d.targets, today:d.today, mealCount:d.mealCount, remaining:d.remaining,
      needsReview:d.needsReview, active:!!d.program?.active, days:d.days,
      mealPlanningAvailable:d.mealPlanning?.eligible !== false,
      goal:d.facts.weightGoal,currentWeight:d.facts.current,
      diet:d.program?.config?.diet,allergens:d.program?.config?.allergens,
      professionalReviewNeeded:d.facts.professionalReviewNeeded,
      planned:d.planned.map(p=>({id:p.id,type:p.type,title:p.data.title,eaten:p.eaten,totals:p.data.totals})),
      instruction:'Only saved diary meals count as intake. Unlogged food is unknown. Planned meals are not consumed. Do not infer protected health details from a review flag.' };
  }
  if (requested.has('metrics')) context.metrics = (await db.healthMetricDaily.findMany({ where: { userId }, take: 14, orderBy: { date: 'desc' } }))
    .map(r => pick(r, ['date', 'weightKg', 'hydrationMl', 'steps', 'sleepHours', 'nutritionKcal', 'heartRate', 'bloodPressureSystolic', 'bloodPressureDiastolic']));
  if (requested.has('medications')) context.medications = (await db.medicationSchedule.findMany({ where: { userId }, take: 40, orderBy: { createdAt: 'desc' } }))
    .map(r => ({ ...pick(r, ['id', 'medName', 'dosage', 'frequency', 'active']), course: pick(r.config, ['startDate', 'endDate', 'frequencyKind', 'weekdays', 'everyNDays']) }));
  if (requested.has('visits')) context.visits = (await db.doctorVisit.findMany({ where: { userId }, take: 30, orderBy: { visitDate: 'desc' } }))
    .map(r => pick(r, ['id', 'doctorType', 'doctorFirstName', 'doctorLastName', 'visitDate', 'visitTime', 'address', 'active']));
  if (requested.has('cycle')) {
    const profile = await db.cycleProfile.findUnique({ where: { userId } });
    context.cycle = profile?.privacyEnabled ? { locked: true, instruction: 'Open cycle screen to unlock. Do not read or write cycle through assistant.' } : {
      profile: pick(profile, ['mode', 'avgCycleLength', 'avgPeriodLength', 'lastPeriodStart', 'dueDate', 'isIrregular', 'conditions']),
      logs: (await db.cycleLog.findMany({ where: { userId }, take: 45, orderBy: { date: 'desc' } }))
        .map(r => ({ date: r.date, ...serializeCycleLogForAi(r) })),
      observationKeys: Object.values(OBSERVATION_REGISTRY).filter(r => r.aiDefaultAllowed).map(r => pick(r, ['key', 'labelKa', 'label', 'storage', 'category'])),
    };
  }
  if (requested.has('records')) context.records = (await db.medicalRecord.findMany({ where: { userId }, take: 12, orderBy: { createdAt: 'desc' } }))
    .map(r => ({ id: r.id, type: r.type, createdAt: r.createdAt, analysisExcerpt: trim(r.aiAnalysis) }));
  if (requested.has('consultations')) context.consultations = (await db.chatSession.findMany({ where: { userId }, take: 6, orderBy: { updatedAt: 'desc' } }))
    .map(r => ({ id: r.id, title: r.title, mode: r.mode, updatedAt: r.updatedAt,
      messages: (Array.isArray(r.messages) ? r.messages : []).slice(-4).map(m => ({ role: m.role, content: trim(m.content, 700) })) }));
  return context;
}
