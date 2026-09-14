import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { clientTimezoneFromReq } from '../lib/cycleCivilDate.js';
import { petTodayYmd } from '../lib/petsAge.js';
import {
  EVENT_CAP_PER_PET,
  EVENT_LIST_DEFAULT,
  EVENT_LIST_MAX,
  PET_CARE_NOT_FOUND,
  PRODUCT_CAP_PER_PET,
  SCHEDULE_CAP_PER_PET,
  mergeProductUpdate,
  mergeScheduleUpdate,
  normalizeCompleteInput,
  normalizeEventInput,
  normalizeProductInput,
  normalizeScheduleInput,
  productWriteData,
  publicEvent,
  publicOccurrence,
  publicProduct,
  publicSchedule,
  scheduleWriteData,
} from '../lib/petsCare.js';
import { decideOwnedChild } from '../lib/petsHealth.js';
import {
  PET_NOT_FOUND,
  isPetsCareSchemaMissing,
  isPetsReminderSchemaMissing,
  isPetsSchemaMissing,
  petsCareSchemaUnavailable,
  petsSchemaUnavailable,
} from '../lib/petsOwnership.js';
import { normalizeReminderPatch, reminderWriteData, sanitizeReminderTelemetry } from '../lib/petsReminders.js';
import {
  buildOccurrence,
  completePayloadHash,
  derivedNextFromSeries,
  eventPayloadHash,
  generateOccurrences,
  idempotencyDecision,
  isGeneratedOccurrence,
  nextAfterCompletion,
  nextAfterVoidingAdministration,
  parseOccurrenceKey,
  scheduleDerivedFields,
} from '../lib/petsSchedule.js';

export const petsCareRouter = Router();

const petParam = z.object({ petId: z.string().uuid('არასწორი იდენტიფიკატორი') });
const productParam = petParam.extend({ productId: z.string().uuid('არასწორი იდენტიფიკატორი') });
const scheduleParam = petParam.extend({ scheduleId: z.string().uuid('არასწორი იდენტიფიკატორი') });
const eventParam = petParam.extend({ eventId: z.string().uuid('არასწორი იდენტიფიკატორი') });

const PRODUCT_KEYS = ['kind', 'name', 'formulation', 'batchId', 'notes', 'expiresOn', 'clientRequestId'];
const SCHEDULE_KEYS = [
  'kind',
  'title',
  'productId',
  'dose',
  'doseUnit',
  'route',
  'startOn',
  'dueTime',
  'times',
  'recurrenceKind',
  'intervalCount',
  'recurrenceBasis',
  'source',
  'sourceNote',
  'courseEndsOn',
  'occurrenceLimit',
  'timeMode',
  'timezone',
  'clientRequestId',
];
const EVENT_KEYS = [
  'kind',
  'title',
  'productId',
  'scheduleId',
  'dose',
  'doseUnit',
  'route',
  'administeredOn',
  'administeredTime',
  'timezone',
  'utcOffsetMinutes',
  'notes',
  'clientRequestId',
];
const COMPLETE_KEYS = [
  'occurrenceKey',
  'revision',
  'administeredOn',
  'administeredTime',
  'timezone',
  'utcOffsetMinutes',
  'notes',
  'dose',
  'doseUnit',
  'route',
  'clientRequestId',
];

function pick(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
}

function sendSchemaError(res, error) {
  if (isPetsCareSchemaMissing(error)) {
    const unavailable = petsCareSchemaUnavailable();
    return res.status(unavailable.status).json(unavailable.body);
  }
  if (isPetsSchemaMissing(error)) {
    const unavailable = petsSchemaUnavailable();
    return res.status(unavailable.status).json(unavailable.body);
  }
  throw error;
}

function sendValidation(res, error) {
  if (error.status === 400) return res.status(400).json({ error: error.message });
  throw error;
}

function sendConflict(res, message, code, extra = {}) {
  return res.status(409).json({ error: message, code, careSchemaReady: true, schemaReady: true, ...extra });
}

function ready(payload) {
  return { schemaReady: true, careSchemaReady: true, ...payload };
}

async function findOwnedActivePet(userId, petId) {
  const row = await prisma.pet.findFirst({ where: { id: petId, userId } });
  if (!row || row.archivedAt) return null;
  return row;
}

async function requireActivePet(req, res) {
  const { petId } = petParam.parse(req.params);
  const pet = await findOwnedActivePet(req.user.id, petId);
  if (!pet) {
    res.status(404).json(PET_NOT_FOUND);
    return null;
  }
  return pet;
}

async function replayOrCreate(findExisting, create) {
  try {
    return { created: true, row: await create() };
  } catch (error) {
    if (error?.code === 'P2002') {
      const existing = await findExisting();
      if (existing) return { created: false, row: existing };
    }
    throw error;
  }
}

async function requireSamePetProduct(userId, petId, productId, { allowArchived = false } = {}) {
  if (!productId) return null;
  const row = await prisma.petProduct.findFirst({ where: { id: productId } });
  if (!row || row.userId !== userId || row.petId !== petId) {
    const error = new Error('პროდუქტი ამ ცხოველს არ ეკუთვნის.');
    error.status = 404;
    throw error;
  }
  if (!allowArchived && row.archivedAt) {
    const error = new Error('ეს პროდუქტი არქივშია.');
    error.status = 400;
    throw error;
  }
  return row;
}

async function lockCareSchedule(tx, scheduleId) {
  await tx.$queryRaw`SELECT id FROM "PetCareSchedule" WHERE id = ${scheduleId} FOR UPDATE`;
}

async function resolvedKeySet(scheduleId) {
  const rows = await prisma.petCareOccurrence.findMany({
    where: { scheduleId, status: { in: ['ADMINISTERED', 'SKIPPED', 'CANCELLED'] } },
    select: { occurrenceKey: true },
  });
  return new Set(rows.map((row) => row.occurrenceKey));
}

function firstOccurrence(schedule) {
  return buildOccurrence(schedule, {
    plannedOn: schedule.startOn,
    plannedTime: schedule.dueTime || (Array.isArray(schedule.times) ? schedule.times[0] : null),
    sequence: 0,
  });
}

function applyDerived(data, todayYmd) {
  const draft = { ...data, revision: 1, status: 'ACTIVE', id: data.id, userId: data.userId, petId: data.petId };
  const next = firstOccurrence({ ...draft, revision: 1 });
  return scheduleDerivedFields({ ...draft, status: 'ACTIVE' }, next);
}

async function publicEventWithOccurrence(row) {
  const occurrence = row.occurrence
    ? row.occurrence
    : await prisma.petCareOccurrence.findFirst({ where: { eventId: row.id } });
  return publicEvent({
    ...row,
    occurrenceId: occurrence?.id ?? null,
    occurrenceKey: occurrence?.occurrenceKey ?? null,
    occurrence,
  });
}

petsCareRouter.get(
  '/reminders/feed',
  asyncHandler(async (req, res) => {
    try {
      const today = petTodayYmd(req);
      const pets = await prisma.pet.findMany({
        where: { userId: req.user.id, archivedAt: null },
        select: { id: true, name: true },
      });
      const items = [];
      for (const pet of pets) {
        const schedules = await prisma.petCareSchedule.findMany({
          where: { petId: pet.id, userId: req.user.id, status: 'ACTIVE', reminderEnabled: true },
        });
        for (const schedule of schedules) {
          const resolved = await resolvedKeySet(schedule.id);
          const generated = generateOccurrences(schedule, { today, resolvedKeys: resolved });
          for (const row of [...generated.overdue, ...generated.due, ...generated.upcoming]) {
            items.push({
              petId: pet.id,
              petName: pet.name,
              petArchived: false,
              schedule: publicSchedule(schedule),
              occurrence: publicOccurrence(row, schedule),
            });
            if (items.length >= 80) break;
          }
          if (items.length >= 80) break;
        }
        if (items.length >= 80) break;
      }
      return res.json(ready({ items, fetchedAt: new Date().toISOString() }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.get(
  '/:petId/products',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      const items = await prisma.petProduct.findMany({
        where: { petId: pet.id, userId: req.user.id, archivedAt: null },
        orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
      });
      return res.json(ready({ items: items.map(publicProduct) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.post(
  '/:petId/products',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      let data;
      try {
        data = normalizeProductInput(pick(req.body, PRODUCT_KEYS), { todayYmd: petTodayYmd(req) });
      } catch (error) {
        return sendValidation(res, error);
      }
      if (data.clientRequestId) {
        const existing = await prisma.petProduct.findFirst({
          where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
        });
        if (existing) return res.json(ready({ replayed: true, product: publicProduct(existing) }));
      }
      const total = await prisma.petProduct.count({ where: { petId: pet.id, userId: req.user.id } });
      if (total >= PRODUCT_CAP_PER_PET) {
        return res.status(409).json({ error: 'პროდუქტების ლიმიტი ამოვწურა.' });
      }
      const result = await replayOrCreate(
        () =>
          data.clientRequestId
            ? prisma.petProduct.findFirst({
                where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
              })
            : null,
        () => prisma.petProduct.create({ data: productWriteData(req.user.id, pet.id, data) }),
      );
      return res.status(result.created ? 201 : 200).json(ready({ replayed: !result.created, product: publicProduct(result.row) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.get(
  '/:petId/products/:productId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, productId } = productParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petProduct.findFirst({ where: { id: productId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      return res.json(ready({ product: publicProduct(row) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.patch(
  '/:petId/products/:productId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, productId } = productParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petProduct.findFirst({ where: { id: productId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      let data;
      try {
        data = mergeProductUpdate(row, pick(req.body, PRODUCT_KEYS), petTodayYmd(req));
      } catch (error) {
        return sendValidation(res, error);
      }
      const updated = await prisma.petProduct.update({
        where: { id: row.id },
        data: {
          kind: data.kind,
          name: data.name,
          formulation: data.formulation,
          batchId: data.batchId,
          notes: data.notes,
          expiresOn: data.expiresOn,
        },
      });
      return res.json(ready({ product: publicProduct(updated) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.post(
  '/:petId/products/:productId/archive',
  asyncHandler(async (req, res) => {
    try {
      const { petId, productId } = productParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petProduct.findFirst({ where: { id: productId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      const updated = await prisma.petProduct.update({
        where: { id: row.id },
        data: { archivedAt: row.archivedAt || new Date() },
      });
      return res.json(ready({ archived: true, product: publicProduct(updated) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.get(
  '/:petId/schedules',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      const items = await prisma.petCareSchedule.findMany({
        where: { petId: pet.id, userId: req.user.id },
        orderBy: [{ status: 'asc' }, { nextDueOn: 'asc' }, { createdAt: 'desc' }],
      });
      return res.json(ready({ items: items.map(publicSchedule) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.post(
  '/:petId/schedules',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      let data;
      try {
        data = normalizeScheduleInput(pick(req.body, SCHEDULE_KEYS), { todayYmd: petTodayYmd(req) });
        await requireSamePetProduct(req.user.id, pet.id, data.productId);
      } catch (error) {
        if (error.status === 404) return res.status(404).json(PET_CARE_NOT_FOUND);
        return sendValidation(res, error);
      }
      if (data.clientRequestId) {
        const existing = await prisma.petCareSchedule.findFirst({
          where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
        });
        if (existing) return res.json(ready({ replayed: true, schedule: publicSchedule(existing) }));
      }
      const total = await prisma.petCareSchedule.count({ where: { petId: pet.id, userId: req.user.id } });
      if (total >= SCHEDULE_CAP_PER_PET) {
        return res.status(409).json({ error: 'გეგმების ლიმიტი ამოვწურა.' });
      }
      const derived = applyDerived({ ...data, userId: req.user.id, petId: pet.id });
      const result = await replayOrCreate(
        () =>
          data.clientRequestId
            ? prisma.petCareSchedule.findFirst({
                where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
              })
            : null,
        () => prisma.petCareSchedule.create({ data: scheduleWriteData(req.user.id, pet.id, data, derived) }),
      );
      return res
        .status(result.created ? 201 : 200)
        .json(ready({ replayed: !result.created, schedule: publicSchedule(result.row) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.get(
  '/:petId/schedules/:scheduleId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, scheduleId } = scheduleParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petCareSchedule.findFirst({ where: { id: scheduleId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      return res.json(ready({ schedule: publicSchedule(row) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.patch(
  '/:petId/schedules/:scheduleId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, scheduleId } = scheduleParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petCareSchedule.findFirst({ where: { id: scheduleId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      if (row.status === 'CANCELLED') {
        return sendConflict(res, 'გეგმა გაუქმებულია. განაახლეთ სია.', 'PET_CARE_SCHEDULE_CANCELLED');
      }
      let data;
      try {
        data = mergeScheduleUpdate(row, pick(req.body, SCHEDULE_KEYS), petTodayYmd(req));
        await requireSamePetProduct(req.user.id, pet.id, data.productId);
      } catch (error) {
        if (error.status === 404) return res.status(404).json(PET_CARE_NOT_FOUND);
        return sendValidation(res, error);
      }
      const revision = row.revision + 1;
      const draft = { ...row, ...data, revision, userId: req.user.id, petId: pet.id, id: row.id, status: 'ACTIVE' };
      const next = firstOccurrence(draft);
      const derived = scheduleDerivedFields(draft, next);
      const updated = await prisma.$transaction(async (tx) => {
        await lockCareSchedule(tx, row.id);
        await tx.petCareOccurrence.updateMany({
          where: { scheduleId: row.id, status: 'OPEN' },
          data: { status: 'CANCELLED' },
        });
        return tx.petCareSchedule.update({
          where: { id: row.id },
          data: {
            ...scheduleWriteData(
              req.user.id,
              pet.id,
              {
                ...data,
                reminderEnabled: row.reminderEnabled,
                reminderOffsetsDays: row.reminderOffsetsDays,
              },
              { ...derived, revision },
            ),
            clientRequestId: row.clientRequestId,
            revision,
          },
        });
      });
      return res.json(ready({ schedule: publicSchedule(updated) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.post(
  '/:petId/schedules/:scheduleId/cancel',
  asyncHandler(async (req, res) => {
    try {
      const { petId, scheduleId } = scheduleParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petCareSchedule.findFirst({ where: { id: scheduleId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      const updated = await prisma.$transaction(async (tx) => {
        await lockCareSchedule(tx, row.id);
        await tx.petCareOccurrence.updateMany({
          where: { scheduleId: row.id, status: 'OPEN' },
          data: { status: 'CANCELLED' },
        });
        return tx.petCareSchedule.update({
          where: { id: row.id },
          data: { status: 'CANCELLED', nextDueOn: null, nextDueTime: null, nextSequence: null },
        });
      });
      return res.json(ready({ schedule: publicSchedule(updated) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.patch(
  '/:petId/schedules/:scheduleId/reminders',
  asyncHandler(async (req, res) => {
    try {
      const { petId, scheduleId } = scheduleParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petCareSchedule.findFirst({ where: { id: scheduleId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      if (row.status === 'CANCELLED') {
        return sendConflict(res, 'გეგმა გაუქმებულია. განაახლეთ სია.', 'PET_CARE_SCHEDULE_CANCELLED');
      }
      let patch;
      try {
        patch = normalizeReminderPatch(req.body || {});
      } catch (error) {
        return sendValidation(res, error);
      }
      const updated = await prisma.petCareSchedule.update({
        where: { id: row.id },
        data: reminderWriteData(patch),
      });
      if (updated.revision !== row.revision || updated.nextDueOn !== row.nextDueOn) {
        return sendConflict(res, 'შეხსენებამ გეგმა არ უნდა შეცვალოს.', 'PET_CARE_REMINDER_MUTATED_SCHEDULE');
      }
      return res.json(ready({ schedule: publicSchedule(updated), revisionUnchanged: true }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.post(
  '/:petId/schedules/:scheduleId/reminder-delivery',
  asyncHandler(async (req, res) => {
    try {
      const { petId, scheduleId } = scheduleParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petCareSchedule.findFirst({ where: { id: scheduleId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      let data;
      try {
        data = sanitizeReminderTelemetry(req.body || {});
      } catch (error) {
        return sendValidation(res, error);
      }
      try {
        await prisma.$executeRaw`
          INSERT INTO "PetReminderDelivery" ("id", "userId", "petId", "scheduleId", "occurrenceKey", "alertKind", "identity", "installId", "status", "fireAtMs", "createdAt")
          VALUES (${randomUUID()}, ${req.user.id}, ${pet.id}, ${row.id}, ${data.occurrenceKey}, ${data.alertKind}, ${data.identity}, ${data.installId}, ${data.status}, ${data.fireAtMs}, ${new Date()})
        `;
        return res.status(202).json(ready({ accepted: true, reminderSchemaReady: true }));
      } catch (error) {
        if (isPetsReminderSchemaMissing(error) || /PetReminderDelivery|does not exist/i.test(error?.message || '')) {
          return res.status(202).json(ready({ accepted: false, reminderSchemaReady: false }));
        }
        throw error;
      }
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.get(
  '/:petId/care/upcoming',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      const today = petTodayYmd(req);
      const schedules = await prisma.petCareSchedule.findMany({
        where: { petId: pet.id, userId: req.user.id, status: 'ACTIVE' },
      });
      const overdue = [];
      const due = [];
      const upcoming = [];
      for (const schedule of schedules) {
        const resolved = await resolvedKeySet(schedule.id);
        const generated = generateOccurrences(schedule, { today, resolvedKeys: resolved });
        for (const row of generated.overdue) overdue.push(publicOccurrence(row, schedule));
        for (const row of generated.due) due.push(publicOccurrence(row, schedule));
        for (const row of generated.upcoming) upcoming.push(publicOccurrence(row, schedule));
      }
      return res.json(
        ready({
          overdue,
          due,
          upcoming,
          plannedDisclaimer: true,
        }),
      );
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.post(
  '/:petId/schedules/:scheduleId/complete',
  asyncHandler(async (req, res) => {
    try {
      const { petId, scheduleId } = scheduleParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      let data;
      try {
        data = normalizeCompleteInput(pick(req.body, COMPLETE_KEYS), { todayYmd: petTodayYmd(req) });
      } catch (error) {
        return sendValidation(res, error);
      }
      const parsed = parseOccurrenceKey(data.occurrenceKey);
      if (!parsed) return res.status(400).json({ error: 'მოვლის შემთხვევა არასწორია.' });
      const hash = completePayloadHash(data);
      const timezone = data.timezone || clientTimezoneFromReq(req);

      const result = await prisma.$transaction(async (tx) => {
        await lockCareSchedule(tx, scheduleId);
        const schedule = await tx.petCareSchedule.findFirst({ where: { id: scheduleId } });
        if (decideOwnedChild(schedule, pet.id, req.user.id).status !== 200) return { missing: true };
        if (schedule.status === 'CANCELLED') {
          return { conflict: { message: 'გეგმა გაუქმებულია. განაახლეთ სია.', code: 'PET_CARE_SCHEDULE_CANCELLED' } };
        }
        if (schedule.status !== 'ACTIVE') {
          return { conflict: { message: 'გეგმა აღარ არის აქტიური. განაახლეთ სია.', code: 'PET_CARE_SCHEDULE_INACTIVE' } };
        }
        if (schedule.revision !== data.revision || parsed.revision !== schedule.revision) {
          return { conflict: { message: 'გეგმა შეიცვალა. განაახლეთ სია და სცადეთ ხელახლა.', code: 'PET_CARE_REVISION_CONFLICT' } };
        }
        if (!isGeneratedOccurrence(schedule, parsed, { today: petTodayYmd(req) })) {
          return { conflict: { message: 'ეს შემთხვევა ამ გეგმას აღარ ეკუთვნის.', code: 'PET_CARE_OCCURRENCE_STALE' } };
        }

        if (data.clientRequestId) {
          const existingEvent = await tx.petCareEvent.findFirst({
            where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
          });
          if (existingEvent) {
            if (idempotencyDecision(existingEvent.idempotencyHash, hash) === 'conflict') {
              return {
                conflict: {
                  message: 'იგივე მოთხოვნა სხვა მონაცემებით უკვე გამოყენებულია.',
                  code: 'PET_CARE_IDEMPOTENCY_CONFLICT',
                },
              };
            }
            const occurrence = await tx.petCareOccurrence.findFirst({ where: { eventId: existingEvent.id } });
            return { replayed: true, event: existingEvent, schedule, occurrence };
          }
        }

        const existingOcc = await tx.petCareOccurrence.findFirst({
          where: { scheduleId: schedule.id, occurrenceKey: data.occurrenceKey },
        });
        if (existingOcc?.status === 'ADMINISTERED') {
          return {
            conflict: { message: 'ეს შემთხვევა უკვე აღრიცხულია.', code: 'PET_CARE_OCCURRENCE_COMPLETED' },
          };
        }
        if (existingOcc?.status === 'SKIPPED' || existingOcc?.status === 'CANCELLED') {
          return {
            conflict: { message: 'ეს შემთხვევა უკვე დასრულებულია. განაახლეთ სია.', code: 'PET_CARE_OCCURRENCE_RESOLVED' },
          };
        }

        const product = schedule.productId
          ? await tx.petProduct.findFirst({ where: { id: schedule.productId } })
          : null;
        const event = await tx.petCareEvent.create({
          data: {
            userId: req.user.id,
            petId: pet.id,
            kind: schedule.kind,
            productId: schedule.productId,
            scheduleId: schedule.id,
            titleSnapshot: schedule.title,
            productNameSnapshot: product?.name || null,
            doseSnapshot: data.dose || schedule.dose,
            doseUnitSnapshot: data.doseUnit || schedule.doseUnit,
            routeSnapshot: data.route || schedule.route,
            administeredOn: data.administeredOn,
            administeredTime: data.administeredTime,
            timezone,
            utcOffsetMinutes: data.utcOffsetMinutes,
            notes: data.notes,
            status: 'RECORDED',
            previousNextDueOn: schedule.nextDueOn,
            source: 'app',
            idempotencyHash: hash,
            clientRequestId: data.clientRequestId,
          },
        });

        const occurrenceData = {
          userId: req.user.id,
          petId: pet.id,
          scheduleId: schedule.id,
          revision: schedule.revision,
          plannedOn: parsed.plannedOn,
          plannedTime: parsed.plannedTime,
          sequence: parsed.sequence,
          occurrenceKey: data.occurrenceKey,
          status: 'ADMINISTERED',
          eventId: event.id,
          clientRequestId: data.clientRequestId,
        };
        const occurrence = existingOcc
          ? await tx.petCareOccurrence.update({ where: { id: existingOcc.id }, data: occurrenceData })
          : await tx.petCareOccurrence.create({ data: occurrenceData });

        const planned = buildOccurrence(schedule, parsed);
        const next = nextAfterCompletion(schedule, { planned, administeredOn: data.administeredOn });
        const derived = scheduleDerivedFields(schedule, next);
        const bumped = await tx.petCareSchedule.updateMany({
          where: { id: schedule.id, revision: schedule.revision, status: 'ACTIVE' },
          data: derived,
        });
        if (bumped.count !== 1) {
          return { conflict: { message: 'გეგმა შეიცვალა. განაახლეთ სია და სცადეთ ხელახლა.', code: 'PET_CARE_REVISION_CONFLICT' } };
        }
        const updatedSchedule = await tx.petCareSchedule.findFirst({ where: { id: schedule.id } });
        return { event, schedule: updatedSchedule, occurrence };
      });

      if (result.missing) return res.status(404).json(PET_CARE_NOT_FOUND);
      if (result.conflict) return sendConflict(res, result.conflict.message, result.conflict.code);
      return res.status(result.replayed ? 200 : 201).json(
        ready({
          replayed: Boolean(result.replayed),
          event: await publicEventWithOccurrence(result.event),
          schedule: publicSchedule(result.schedule),
          occurrence: publicOccurrence(result.occurrence, result.schedule),
        }),
      );
    } catch (error) {
      if (error?.code === 'P2002') {
        return sendConflict(res, 'ეს შემთხვევა უკვე აღრიცხულია.', 'PET_CARE_OCCURRENCE_COMPLETED');
      }
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.post(
  '/:petId/schedules/:scheduleId/skip',
  asyncHandler(async (req, res) => {
    try {
      const { petId, scheduleId } = scheduleParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const occurrenceKeyValue = String(req.body?.occurrenceKey || '').trim();
      const revision = Number(req.body?.revision);
      const clientRequestId = req.body?.clientRequestId ? String(req.body.clientRequestId).trim() : null;
      const parsed = parseOccurrenceKey(occurrenceKeyValue);
      if (!parsed || !Number.isInteger(revision)) {
        return res.status(400).json({ error: 'მოვლის შემთხვევა არასწორია.' });
      }

      const result = await prisma.$transaction(async (tx) => {
        await lockCareSchedule(tx, scheduleId);
        const schedule = await tx.petCareSchedule.findFirst({ where: { id: scheduleId } });
        if (decideOwnedChild(schedule, pet.id, req.user.id).status !== 200) return { missing: true };
        if (schedule.status !== 'ACTIVE') {
          return { conflict: { message: 'გეგმა აღარ არის აქტიური. განაახლეთ სია.', code: 'PET_CARE_SCHEDULE_INACTIVE' } };
        }
        if (schedule.revision !== revision || parsed.revision !== schedule.revision) {
          return { conflict: { message: 'გეგმა შეიცვალა. განაახლეთ სია და სცადეთ ხელახლა.', code: 'PET_CARE_REVISION_CONFLICT' } };
        }
        if (clientRequestId) {
          const existing = await tx.petCareOccurrence.findFirst({
            where: { petId: pet.id, clientRequestId },
          });
          if (existing) return { replayed: true, occurrence: existing, schedule };
        }
        const existingOcc = await tx.petCareOccurrence.findFirst({
          where: { scheduleId: schedule.id, occurrenceKey: occurrenceKeyValue },
        });
        if (existingOcc && existingOcc.status !== 'OPEN') {
          return { conflict: { message: 'ეს შემთხვევა უკვე დასრულებულია.', code: 'PET_CARE_OCCURRENCE_RESOLVED' } };
        }
        const occurrence = existingOcc
          ? await tx.petCareOccurrence.update({
              where: { id: existingOcc.id },
              data: { status: 'SKIPPED', skippedAt: new Date(), skipNote: req.body?.note || null, clientRequestId },
            })
          : await tx.petCareOccurrence.create({
              data: {
                userId: req.user.id,
                petId: pet.id,
                scheduleId: schedule.id,
                revision: schedule.revision,
                plannedOn: parsed.plannedOn,
                plannedTime: parsed.plannedTime,
                sequence: parsed.sequence,
                occurrenceKey: occurrenceKeyValue,
                status: 'SKIPPED',
                skippedAt: new Date(),
                skipNote: req.body?.note || null,
                clientRequestId,
              },
            });

        const resolved = new Set(
          (
            await tx.petCareOccurrence.findMany({
              where: { scheduleId: schedule.id, status: { in: ['ADMINISTERED', 'SKIPPED', 'CANCELLED'] } },
              select: { occurrenceKey: true },
            })
          ).map((row) => row.occurrenceKey),
        );
        let derived;
        if (schedule.recurrenceBasis === 'FROM_ADMINISTRATION') {
          derived = { nextDueOn: null, nextDueTime: null, nextSequence: null, status: 'ACTIVE' };
        } else {
          derived = scheduleDerivedFields(schedule, derivedNextFromSeries(schedule, resolved, petTodayYmd(req)));
          if (!derived.nextDueOn) derived.status = 'ACTIVE';
        }
        const updated = await tx.petCareSchedule.update({ where: { id: schedule.id }, data: derived });
        return { occurrence, schedule: updated };
      });

      if (result.missing) return res.status(404).json(PET_CARE_NOT_FOUND);
      if (result.conflict) return sendConflict(res, result.conflict.message, result.conflict.code);
      return res.status(result.replayed ? 200 : 201).json(
        ready({
          replayed: Boolean(result.replayed),
          occurrence: publicOccurrence(result.occurrence, result.schedule),
          schedule: publicSchedule(result.schedule),
        }),
      );
    } catch (error) {
      if (error?.code === 'P2002') {
        return sendConflict(res, 'ეს შემთხვევა უკვე დასრულებულია.', 'PET_CARE_OCCURRENCE_RESOLVED');
      }
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.get(
  '/:petId/events',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      const limitRaw = Number(req.query?.limit);
      const offsetRaw = Number(req.query?.offset);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), EVENT_LIST_MAX) : EVENT_LIST_DEFAULT;
      const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
      const [total, items] = await Promise.all([
        prisma.petCareEvent.count({ where: { petId: pet.id, userId: req.user.id } }),
        prisma.petCareEvent.findMany({
          where: { petId: pet.id, userId: req.user.id },
          orderBy: [{ administeredOn: 'desc' }, { createdAt: 'desc' }],
          skip: offset,
          take: limit,
          include: { occurrence: true },
        }),
      ]);
      return res.json(
        ready({
          items: items.map((row) =>
            publicEvent({
              ...row,
              occurrenceId: row.occurrence?.id ?? null,
              occurrenceKey: row.occurrence?.occurrenceKey ?? null,
            }),
          ),
          total,
          limit,
          offset,
        }),
      );
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.post(
  '/:petId/events',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      let data;
      let product;
      try {
        data = normalizeEventInput(pick(req.body, EVENT_KEYS), { todayYmd: petTodayYmd(req) });
        product = await requireSamePetProduct(req.user.id, pet.id, data.productId, { allowArchived: true });
        if (data.scheduleId) {
          const schedule = await prisma.petCareSchedule.findFirst({ where: { id: data.scheduleId } });
          if (decideOwnedChild(schedule, pet.id, req.user.id).status !== 200) {
            const error = new Error('გეგმა ამ ცხოველს არ ეკუთვნის.');
            error.status = 404;
            throw error;
          }
        }
      } catch (error) {
        if (error.status === 404) return res.status(404).json(PET_CARE_NOT_FOUND);
        return sendValidation(res, error);
      }
      const hash = eventPayloadHash(data);
      if (data.clientRequestId) {
        const existing = await prisma.petCareEvent.findFirst({
          where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
        });
        if (existing) {
          if (idempotencyDecision(existing.idempotencyHash, hash) === 'conflict') {
            return sendConflict(res, 'იგივე მოთხოვნა სხვა მონაცემებით უკვე გამოყენებულია.', 'PET_CARE_IDEMPOTENCY_CONFLICT');
          }
          return res.json(ready({ replayed: true, event: await publicEventWithOccurrence(existing) }));
        }
      }
      const total = await prisma.petCareEvent.count({ where: { petId: pet.id, userId: req.user.id } });
      if (total >= EVENT_CAP_PER_PET) {
        return res.status(409).json({ error: 'ისტორიის ლიმიტი ამოვწურა.' });
      }
      const created = await prisma.petCareEvent.create({
        data: {
          userId: req.user.id,
          petId: pet.id,
          kind: data.kind,
          productId: data.productId,
          scheduleId: data.scheduleId,
          titleSnapshot: data.title,
          productNameSnapshot: product?.name || null,
          doseSnapshot: data.dose,
          doseUnitSnapshot: data.doseUnit,
          routeSnapshot: data.route,
          administeredOn: data.administeredOn,
          administeredTime: data.administeredTime,
          timezone: data.timezone || clientTimezoneFromReq(req),
          utcOffsetMinutes: data.utcOffsetMinutes,
          notes: data.notes,
          status: 'RECORDED',
          source: 'app',
          idempotencyHash: hash,
          clientRequestId: data.clientRequestId,
        },
      });
      return res.status(201).json(ready({ event: await publicEventWithOccurrence(created) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.get(
  '/:petId/events/:eventId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, eventId } = eventParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petCareEvent.findFirst({ where: { id: eventId }, include: { occurrence: true } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      return res.json(
        ready({
          event: publicEvent({
            ...row,
            occurrenceId: row.occurrence?.id ?? null,
            occurrenceKey: row.occurrence?.occurrenceKey ?? null,
          }),
        }),
      );
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsCareRouter.patch(
  '/:petId/events/:eventId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, eventId } = eventParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petCareEvent.findFirst({ where: { id: eventId }, include: { occurrence: true } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      if (row.status !== 'RECORDED') {
        return sendConflict(res, 'გაუქმებული ჩანაწერი აღარ იცვლება.', 'PET_CARE_EVENT_VOIDED');
      }
      let nextValues;
      try {
        nextValues = normalizeEventInput(
          {
            kind: req.body?.kind !== undefined ? req.body.kind : row.kind,
            title: req.body?.title !== undefined ? req.body.title : row.titleSnapshot,
            productId: req.body?.productId !== undefined ? req.body.productId : row.productId,
            dose: req.body?.dose !== undefined ? req.body.dose : row.doseSnapshot,
            doseUnit: req.body?.doseUnit !== undefined ? req.body.doseUnit : row.doseUnitSnapshot,
            route: req.body?.route !== undefined ? req.body.route : row.routeSnapshot,
            administeredOn: req.body?.administeredOn !== undefined ? req.body.administeredOn : row.administeredOn,
            administeredTime: req.body?.administeredTime !== undefined ? req.body.administeredTime : row.administeredTime,
            timezone: req.body?.timezone !== undefined ? req.body.timezone : row.timezone,
            utcOffsetMinutes: req.body?.utcOffsetMinutes !== undefined ? req.body.utcOffsetMinutes : row.utcOffsetMinutes,
            notes: req.body?.notes !== undefined ? req.body.notes : row.notes,
          },
          { todayYmd: petTodayYmd(req) },
        );
      } catch (error) {
        return sendValidation(res, error);
      }

      const schedule = row.scheduleId
        ? await prisma.petCareSchedule.findFirst({ where: { id: row.scheduleId } })
        : null;
      const confirmRecalculate = Boolean(req.body?.confirmRecalculate);
      if (schedule?.recurrenceBasis === 'FROM_ADMINISTRATION' && schedule.status === 'ACTIVE') {
        const others = await prisma.petCareEvent.findMany({
          where: { scheduleId: schedule.id, status: 'RECORDED', id: { not: row.id } },
        });
        const proposed = nextAfterVoidingAdministration(schedule, [
          ...others,
          { ...row, ...nextValues, status: 'RECORDED', administeredOn: nextValues.administeredOn, administeredTime: nextValues.administeredTime },
        ]);
        const changesAdminDate = nextValues.administeredOn !== row.administeredOn;
        if (changesAdminDate && !confirmRecalculate) {
          return sendConflict(res, 'დადასტურებული მიღებიდან გამეორება შეიცვლება.', 'PET_CARE_RECALCULATE_REQUIRED', {
            proposedConsequence: proposed
              ? { nextDueOn: proposed.plannedOn, nextDueTime: plannedTime(proposed), nextSequence: proposed.sequence }
              : { nextDueOn: null, nextDueTime: null, nextSequence: null },
          });
        }
        if (changesAdminDate && confirmRecalculate) {
          const derived = scheduleDerivedFields(schedule, proposed);
          await prisma.petCareSchedule.update({ where: { id: schedule.id }, data: derived });
        }
      }

      const updated = await prisma.petCareEvent.update({
        where: { id: row.id },
        data: {
          kind: nextValues.kind,
          titleSnapshot: nextValues.title,
          doseSnapshot: nextValues.dose,
          doseUnitSnapshot: nextValues.doseUnit,
          routeSnapshot: nextValues.route,
          administeredOn: nextValues.administeredOn,
          administeredTime: nextValues.administeredTime,
          timezone: nextValues.timezone,
          utcOffsetMinutes: nextValues.utcOffsetMinutes,
          notes: nextValues.notes,
          correctionMeta: {
            previous: {
              administeredOn: row.administeredOn,
              administeredTime: row.administeredTime,
              notes: row.notes,
              doseSnapshot: row.doseSnapshot,
              doseUnitSnapshot: row.doseUnitSnapshot,
            },
            confirmRecalculate,
            at: new Date().toISOString(),
          },
        },
        include: { occurrence: true },
      });
      return res.json(
        ready({
          event: publicEvent({
            ...updated,
            occurrenceId: updated.occurrence?.id ?? null,
            occurrenceKey: updated.occurrence?.occurrenceKey ?? null,
          }),
        }),
      );
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

function plannedTime(occurrence) {
  return occurrence?.plannedTime ?? null;
}

petsCareRouter.post(
  '/:petId/events/:eventId/void',
  asyncHandler(async (req, res) => {
    try {
      const { petId, eventId } = eventParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petCareEvent.findFirst({ where: { id: eventId }, include: { occurrence: true } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_CARE_NOT_FOUND);
      }
      if (row.status === 'VOIDED') return res.json(ready({ event: await publicEventWithOccurrence(row) }));

      const schedule = row.scheduleId
        ? await prisma.petCareSchedule.findFirst({ where: { id: row.scheduleId } })
        : null;
      const confirmRecalculate = Boolean(req.body?.confirmRecalculate);
      if (schedule?.recurrenceBasis === 'FROM_ADMINISTRATION' && schedule.status === 'ACTIVE') {
        const others = await prisma.petCareEvent.findMany({
          where: { scheduleId: schedule.id, status: 'RECORDED', id: { not: row.id } },
        });
        const proposed = nextAfterVoidingAdministration(schedule, others);
        if (!confirmRecalculate) {
          return sendConflict(res, 'დადასტურებული მიღებიდან გამეორება შეიცვლება.', 'PET_CARE_RECALCULATE_REQUIRED', {
            proposedConsequence: proposed
              ? { nextDueOn: proposed.plannedOn, nextDueTime: proposed.plannedTime, nextSequence: proposed.sequence }
              : { nextDueOn: null, nextDueTime: null, nextSequence: null },
          });
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        if (row.occurrence) {
          await tx.petCareOccurrence.update({
            where: { id: row.occurrence.id },
            data: { status: 'OPEN', eventId: null },
          });
        }
        const event = await tx.petCareEvent.update({
          where: { id: row.id },
          data: {
            status: 'VOIDED',
            voidedAt: new Date(),
            voidReason: req.body?.reason ? String(req.body.reason).slice(0, 500) : null,
            correctionMeta: {
              ...(row.correctionMeta && typeof row.correctionMeta === 'object' ? row.correctionMeta : {}),
              voided: true,
              confirmRecalculate,
              at: new Date().toISOString(),
            },
          },
        });
        if (schedule?.recurrenceBasis === 'FROM_ADMINISTRATION' && schedule.status === 'ACTIVE' && confirmRecalculate) {
          const others = await tx.petCareEvent.findMany({
            where: { scheduleId: schedule.id, status: 'RECORDED', id: { not: row.id } },
          });
          const proposed = nextAfterVoidingAdministration(schedule, others);
          await tx.petCareSchedule.update({
            where: { id: schedule.id },
            data: scheduleDerivedFields(schedule, proposed),
          });
        }
        return event;
      });
      return res.json(ready({ event: await publicEventWithOccurrence(updated) }));
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);
