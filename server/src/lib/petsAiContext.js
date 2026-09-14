import { prisma } from './prisma.js';
import { displayAgeParts, publicPet } from './petsAge.js';
import { getSpecies, isSentinelBreedId } from './petsCatalog.js';
import { isPetsCareSchemaMissing, isPetsHealthSchemaMissing } from './petsOwnership.js';
import { generateOccurrences, UPCOMING_DAYS } from './petsSchedule.js';
import { addDays } from './petsCivilDate.js';

export const PETS_AI_CONTEXT_VERSION = 'pets-ai-context-v1';
export const PET_RECORD_CHAR_MAX = 6000;
export const RECENT_EVENT_LIMIT = 8;
export const UPCOMING_PLAN_LIMIT = 8;
export const VALIDATED_VET_SPECIES = Object.freeze(['dog', 'cat']);

const FORBIDDEN_SNAPSHOT_RE =
  /HealthProfile|MedicationSchedule|DoctorVisit|ChatSession|CycleLog|withPatientAiContext|microchip|vetPhone|vetAddress|vetClinicName|vetName|birthDate.*user/i;

export function wrapUntrustedBlock(tag, text, max = PET_RECORD_CHAR_MAX) {
  const cleaned = String(text || '')
    .replace(/<\s*\/?\s*pet_record\s*>/gi, '')
    .replace(/<\s*\/?\s*owner_message\s*>/gi, '')
    .replace(/<\s*\/?\s*retrieved_references\s*>/gi, '')
    .slice(0, max);
  return `<${tag}>\n${cleaned}\n</${tag}>`;
}

export function speciesCoverage(speciesId) {
  const species = getSpecies(speciesId);
  if (!species) return { id: null, validated: false, coverage: 'unknown' };
  return {
    id: species.id,
    validated: VALIDATED_VET_SPECIES.includes(species.id),
    coverage: species.coverage,
    labelKa: species.labelKa,
  };
}

function breedRepresentation(pet) {
  if (pet.breedId === 'custom') return { kind: 'custom', label: pet.customBreed || 'custom' };
  if (pet.breedId === 'mixed') return { kind: 'mixed', label: 'mixed' };
  if (pet.breedId === 'unknown' || isSentinelBreedId(pet.breedId)) {
    return { kind: 'unknown', label: pet.breedId || 'unknown' };
  }
  const species = getSpecies(pet.speciesId);
  const breed = species?.breeds?.find((row) => row.id === pet.breedId);
  return { kind: 'catalog', id: pet.breedId, label: breed?.label || pet.breedId };
}

function ageBlock(pet, todayYmd) {
  const parts = displayAgeParts(pet, todayYmd);
  if (parts.kind === 'UNKNOWN' || pet.ageKind === 'UNKNOWN') {
    return {
      kind: 'UNKNOWN',
      years: null,
      months: null,
      label: 'უცნობი — ჩანაწერი არ არის. ეს არ ნიშნავს, რომ ცხოველი ახალგაზრდაა ან ჯანმრთელი.',
    };
  }
  if (parts.kind === 'APPROXIMATE') {
    return {
      kind: 'APPROXIMATE',
      years: parts.years,
      months: parts.months,
      label: `დაახლოებით ${parts.years} წელი ${parts.months} თვე (მიახლოებითი; ზუსტი დაბადების თარიღი არ არის)`,
    };
  }
  return {
    kind: 'EXACT',
    years: parts.years,
    months: parts.months,
    label: `ზუსტი — ${parts.years} წელი ${parts.months} თვე (დაბადების თარიღიდან)`,
  };
}

function sexBlock(pet) {
  return {
    sex: pet.sex || 'UNKNOWN',
    neutered: pet.neutered === true ? true : pet.neutered === false ? false : null,
  };
}

export function assertPetContextIsolated(snapshot) {
  const blob = JSON.stringify(snapshot);
  if (FORBIDDEN_SNAPSHOT_RE.test(blob)) {
    throw new Error('pet AI context contains forbidden human or contact fields');
  }
  if (snapshot.vetPhone || snapshot.vetAddress || snapshot.microchip || snapshot.ownerHealth) {
    throw new Error('pet AI context leaked contact or owner health');
  }
  return true;
}

export function buildPetAiSnapshotFromRecords(pet, extras = {}) {
  const todayYmd = extras.todayYmd;
  const coverage = speciesCoverage(pet.speciesId);
  const snapshot = {
    version: PETS_AI_CONTEXT_VERSION,
    petId: pet.id,
    name: pet.name,
    speciesId: pet.speciesId,
    speciesCoverage: coverage,
    breed: breedRepresentation(pet),
    age: ageBlock(pet, todayYmd),
    sex: sexBlock(pet),
    latestWeight: extras.latestWeight
      ? {
          recordedOn: extras.latestWeight.recordedOn,
          weightKg: extras.latestWeight.weightKg,
          inputValue: extras.latestWeight.inputValue,
          inputUnit: extras.latestWeight.inputUnit,
        }
      : null,
    allergies: extras.allergies || [],
    conditionsActive: extras.conditionsActive || [],
    conditionsResolved: extras.conditionsResolved || [],
    administrations: extras.administrations || [],
    upcomingPlans: extras.upcomingPlans || [],
    healthSchemaReady: extras.healthSchemaReady !== false,
    careSchemaReady: extras.careSchemaReady !== false,
    honesty: {
      missingAllergiesNotAbsence: !extras.allergies?.length,
      missingConditionsNotAbsence: !(extras.conditionsActive?.length || extras.conditionsResolved?.length),
      plansAreNotAdministered: true,
    },
  };
  assertPetContextIsolated(snapshot);
  return snapshot;
}

export function formatPetAiRecordText(snapshot) {
  const lines = [
    `context_version: ${snapshot.version}`,
    `species_id: ${snapshot.speciesId}`,
    `species_coverage: ${snapshot.speciesCoverage.validated ? 'validated-limited' : 'unsupported'}`,
    `name: ${snapshot.name}`,
    `breed: ${snapshot.breed.label} (${snapshot.breed.kind})`,
    `age: ${snapshot.age.label}`,
    `sex: ${snapshot.sex.sex}`,
    `neutered: ${snapshot.sex.neutered === true ? 'yes' : snapshot.sex.neutered === false ? 'no' : 'unknown'}`,
  ];
  if (snapshot.latestWeight) {
    lines.push(
      `latest_weight: ${snapshot.latestWeight.inputValue} ${snapshot.latestWeight.inputUnit} on ${snapshot.latestWeight.recordedOn} (normalized_kg=${snapshot.latestWeight.weightKg})`,
    );
  } else {
    lines.push('latest_weight: none recorded. Missing weight is not a clinical finding.');
  }

  if (!snapshot.allergies.length) {
    lines.push('allergies: no records. This does not mean the animal has no allergies.');
  } else {
    for (const row of snapshot.allergies) {
      lines.push(`allergy: ${row.name} status=${row.reportedStatus} category=${row.category || 'unknown'}`);
      if (row.notes) lines.push(`allergy_note (untrusted): ${String(row.notes).slice(0, 280)}`);
    }
  }

  if (!snapshot.conditionsActive.length && !snapshot.conditionsResolved.length) {
    lines.push('conditions: no records. This does not mean absence of disease.');
  } else {
    for (const row of snapshot.conditionsActive) {
      lines.push(`condition_active: ${row.name} basis=${row.reportedBasis || 'unknown'}`);
    }
    for (const row of snapshot.conditionsResolved) {
      lines.push(`condition_resolved: ${row.name}`);
    }
  }

  if (!snapshot.administrations.length) {
    lines.push('actual_administrations: none recorded in the recent window.');
  } else {
    for (const row of snapshot.administrations) {
      lines.push(
        `ADMINISTERED (actual event, not a plan): ${row.titleSnapshot} on ${row.administeredOn}${row.doseSnapshot ? ` dose=${row.doseSnapshot}${row.doseUnitSnapshot ? ` ${row.doseUnitSnapshot}` : ''}` : ''}`,
      );
    }
  }

  if (!snapshot.upcomingPlans.length) {
    lines.push('upcoming_plans: none listed. Planned care is never administered.');
  } else {
    for (const row of snapshot.upcomingPlans) {
      lines.push(
        `PLAN (not administered): ${row.title} plannedOn=${row.plannedOn}${row.plannedTime ? ` ${row.plannedTime}` : ''}`,
      );
    }
  }

  if (!snapshot.healthSchemaReady) lines.push('health_records: schema unavailable; do not infer empty health.');
  if (!snapshot.careSchemaReady) lines.push('care_records: schema unavailable; do not infer empty care history.');

  return lines.join('\n').slice(0, PET_RECORD_CHAR_MAX);
}

export function petContextProvenance(snapshot) {
  return {
    version: snapshot.version,
    petId: snapshot.petId,
    speciesId: snapshot.speciesId,
    allergyCount: snapshot.allergies.length,
    conditionCount: snapshot.conditionsActive.length + snapshot.conditionsResolved.length,
    administrationCount: snapshot.administrations.length,
    planCount: snapshot.upcomingPlans.length,
    healthSchemaReady: snapshot.healthSchemaReady,
    careSchemaReady: snapshot.careSchemaReady,
  };
}

function kgNumber(value) {
  if (value == null) return null;
  const n = typeof value === 'object' && typeof value.toNumber === 'function' ? value.toNumber() : Number(value);
  return Number.isFinite(n) ? n : String(value);
}

export async function loadPetAiContext(userId, petId, { todayYmd } = {}) {
  const pet = await prisma.pet.findFirst({ where: { id: petId, userId } });
  if (!pet) return null;

  let healthSchemaReady = true;
  let careSchemaReady = true;
  let latestWeight = null;
  let allergies = [];
  let conditions = [];
  let administrations = [];
  let upcomingPlans = [];

  try {
    const [weightRow, allergyRows, conditionRows] = await Promise.all([
      prisma.petWeightLog.findFirst({ where: { petId, userId }, orderBy: [{ recordedOn: 'desc' }, { createdAt: 'desc' }] }),
      prisma.petAllergy.findMany({ where: { petId, userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.petCondition.findMany({ where: { petId, userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    if (weightRow) {
      latestWeight = {
        recordedOn: weightRow.recordedOn,
        weightKg: kgNumber(weightRow.weightKg),
        inputValue: kgNumber(weightRow.inputValue),
        inputUnit: weightRow.inputUnit,
      };
    }
    allergies = allergyRows.map((row) => ({
      name: row.name,
      category: row.category,
      reportedStatus: row.reportedStatus,
      notes: row.notes,
    }));
    conditions = conditionRows;
  } catch (error) {
    if (!isPetsHealthSchemaMissing(error)) throw error;
    healthSchemaReady = false;
  }

  try {
    const events = await prisma.petCareEvent.findMany({
      where: { petId, userId, status: 'RECORDED', voidedAt: null },
      orderBy: [{ administeredOn: 'desc' }, { createdAt: 'desc' }],
      take: RECENT_EVENT_LIMIT,
    });
    administrations = events.map((row) => ({
      titleSnapshot: row.titleSnapshot,
      administeredOn: row.administeredOn,
      doseSnapshot: row.doseSnapshot,
      doseUnitSnapshot: row.doseUnitSnapshot,
      kind: row.kind,
    }));

    const schedules = await prisma.petCareSchedule.findMany({
      where: { petId, userId, status: 'ACTIVE' },
    });
    const horizon = addDays(todayYmd, UPCOMING_DAYS);
    for (const schedule of schedules) {
      const resolved = await prisma.petCareOccurrence.findMany({
        where: { scheduleId: schedule.id, status: { in: ['ADMINISTERED', 'SKIPPED', 'CANCELLED'] } },
        select: { occurrenceKey: true },
      });
      const generated = generateOccurrences(schedule, {
        today: todayYmd,
        to: horizon,
        resolvedKeys: new Set(resolved.map((row) => row.occurrenceKey)),
      });
      for (const row of [...generated.due, ...generated.upcoming].slice(0, UPCOMING_PLAN_LIMIT)) {
        upcomingPlans.push({
          title: schedule.title,
          kind: schedule.kind,
          plannedOn: row.plannedOn,
          plannedTime: row.plannedTime,
        });
      }
    }
    upcomingPlans = upcomingPlans.slice(0, UPCOMING_PLAN_LIMIT);
  } catch (error) {
    if (!isPetsCareSchemaMissing(error)) throw error;
    careSchemaReady = false;
  }

  const snapshot = buildPetAiSnapshotFromRecords(
    {
      id: pet.id,
      name: pet.name,
      speciesId: pet.speciesId,
      breedId: pet.breedId,
      customBreed: pet.customBreed,
      sex: pet.sex,
      neutered: pet.neutered,
      ageKind: pet.ageKind,
      birthDate: pet.birthDate,
      approxAgeYears: pet.approxAgeYears,
      approxAgeMonths: pet.approxAgeMonths,
      approxAgeRecordedOn: pet.approxAgeRecordedOn,
    },
    {
      todayYmd,
      latestWeight,
      allergies,
      conditionsActive: conditions.filter((row) => row.status === 'active').map((row) => ({
        name: row.name,
        reportedBasis: row.reportedBasis,
      })),
      conditionsResolved: conditions.filter((row) => row.status === 'resolved').map((row) => ({ name: row.name })),
      administrations,
      upcomingPlans,
      healthSchemaReady,
      careSchemaReady,
    },
  );

  return {
    snapshot,
    text: formatPetAiRecordText(snapshot),
    provenance: petContextProvenance(snapshot),
    publicPet: publicPet(pet, { todayYmd }),
  };
}
