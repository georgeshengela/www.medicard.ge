import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../middleware/error.js';
import { petTodayYmd } from '../lib/petsAge.js';
import {
  ALLERGY_CAP_PER_PET,
  CONDITION_CAP_PER_PET,
  PET_HEALTH_NOT_FOUND,
  WEIGHT_CAP_PER_PET,
  decideOwnedChild,
  mergeAllergyUpdate,
  mergeConditionUpdate,
  mergeWeightUpdate,
  normalizeAllergyInput,
  normalizeConditionInput,
  normalizeWeightInput,
  parseListBounds,
  publicAllergy,
  publicCondition,
  publicWeightLog,
  weightWriteData,
} from '../lib/petsHealth.js';
import {
  PET_NOT_FOUND,
  isPetsHealthSchemaMissing,
  isPetsSchemaMissing,
  petsHealthSchemaUnavailable,
  petsSchemaUnavailable,
} from '../lib/petsOwnership.js';

export const petsHealthRouter = Router();

const petParam = z.object({ petId: z.string().uuid('არასწორი იდენტიფიკატორი') });
const weightParam = petParam.extend({ logId: z.string().uuid('არასწორი იდენტიფიკატორი') });
const allergyParam = petParam.extend({ allergyId: z.string().uuid('არასწორი იდენტიფიკატორი') });
const conditionParam = petParam.extend({ conditionId: z.string().uuid('არასწორი იდენტიფიკატორი') });

function pick(body, keys) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const out = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
}

const WEIGHT_KEYS = ['recordedOn', 'inputValue', 'inputUnit', 'note', 'clientRequestId'];
const ALLERGY_KEYS = ['name', 'category', 'reaction', 'reportedStatus', 'notedOn', 'notes', 'clientRequestId'];
const CONDITION_KEYS = ['name', 'status', 'reportedBasis', 'onsetOn', 'resolvedOn', 'notes', 'clientRequestId'];

function sendSchemaError(res, error) {
  if (isPetsHealthSchemaMissing(error)) {
    const unavailable = petsHealthSchemaUnavailable();
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

petsHealthRouter.get(
  '/:petId/weight',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      const { limit, offset } = parseListBounds(req.query);
      const [total, items] = await Promise.all([
        prisma.petWeightLog.count({ where: { petId: pet.id, userId: req.user.id } }),
        prisma.petWeightLog.findMany({
          where: { petId: pet.id, userId: req.user.id },
          orderBy: [{ recordedOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          skip: offset,
          take: limit,
        }),
      ]);
      const latest =
        offset === 0
          ? items[0] || null
          : await prisma.petWeightLog.findFirst({
              where: { petId: pet.id, userId: req.user.id },
              orderBy: [{ recordedOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
            });
      return res.json({
        schemaReady: true,
        healthSchemaReady: true,
        latest: latest ? publicWeightLog(latest) : null,
        items: items.map(publicWeightLog),
        total,
        limit,
        offset,
      });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.post(
  '/:petId/weight',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      let data;
      try {
        data = normalizeWeightInput(pick(req.body, WEIGHT_KEYS), { todayYmd: petTodayYmd(req) });
      } catch (error) {
        return sendValidation(res, error);
      }
      if (data.clientRequestId) {
        const existing = await prisma.petWeightLog.findFirst({
          where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
        });
        if (existing) {
          return res.json({ schemaReady: true, healthSchemaReady: true, replayed: true, log: publicWeightLog(existing) });
        }
      }
      const total = await prisma.petWeightLog.count({ where: { petId: pet.id, userId: req.user.id } });
      if (total >= WEIGHT_CAP_PER_PET) {
        return res.status(409).json({ error: 'წონის ჩანაწერების ლიმიტი ამოვწურა.' });
      }
      const result = await replayOrCreate(
        () =>
          data.clientRequestId
            ? prisma.petWeightLog.findFirst({
                where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
              })
            : null,
        () => prisma.petWeightLog.create({ data: weightWriteData(req.user.id, pet.id, data) }),
      );
      return res.status(result.created ? 201 : 200).json({
        schemaReady: true,
        healthSchemaReady: true,
        replayed: !result.created,
        log: publicWeightLog(result.row),
      });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.get(
  '/:petId/weight/:logId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, logId } = weightParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petWeightLog.findFirst({ where: { id: logId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_HEALTH_NOT_FOUND);
      }
      return res.json({ schemaReady: true, healthSchemaReady: true, log: publicWeightLog(row) });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.patch(
  '/:petId/weight/:logId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, logId } = weightParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const current = await prisma.petWeightLog.findFirst({ where: { id: logId } });
      if (decideOwnedChild(current, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_HEALTH_NOT_FOUND);
      }
      let data;
      try {
        data = mergeWeightUpdate(current, pick(req.body, WEIGHT_KEYS), petTodayYmd(req));
      } catch (error) {
        return sendValidation(res, error);
      }
      const { count } = await prisma.petWeightLog.updateMany({
        where: { id: logId, petId: pet.id, userId: req.user.id },
        data: {
          recordedOn: data.recordedOn,
          weightKg: data.weightKg.toFixed(5),
          inputValue: String(data.inputValue),
          inputUnit: data.inputUnit,
          note: data.note,
        },
      });
      if (count === 0) return res.status(404).json(PET_HEALTH_NOT_FOUND);
      const row = await prisma.petWeightLog.findFirst({ where: { id: logId, petId: pet.id, userId: req.user.id } });
      return res.json({ schemaReady: true, healthSchemaReady: true, log: publicWeightLog(row) });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.delete(
  '/:petId/weight/:logId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, logId } = weightParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const current = await prisma.petWeightLog.findFirst({ where: { id: logId } });
      if (decideOwnedChild(current, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_HEALTH_NOT_FOUND);
      }
      const { count } = await prisma.petWeightLog.deleteMany({
        where: { id: logId, petId: pet.id, userId: req.user.id },
      });
      if (count === 0) return res.status(404).json(PET_HEALTH_NOT_FOUND);
      const latest = await prisma.petWeightLog.findFirst({
        where: { petId: pet.id, userId: req.user.id },
        orderBy: [{ recordedOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      });
      return res.json({
        schemaReady: true,
        healthSchemaReady: true,
        deleted: true,
        latest: latest ? publicWeightLog(latest) : null,
      });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.get(
  '/:petId/allergies',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      const items = await prisma.petAllergy.findMany({
        where: { petId: pet.id, userId: req.user.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: ALLERGY_CAP_PER_PET,
      });
      return res.json({
        schemaReady: true,
        healthSchemaReady: true,
        items: items.map(publicAllergy),
      });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.post(
  '/:petId/allergies',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      let data;
      try {
        data = normalizeAllergyInput(pick(req.body, ALLERGY_KEYS), { todayYmd: petTodayYmd(req) });
      } catch (error) {
        return sendValidation(res, error);
      }
      if (data.clientRequestId) {
        const existing = await prisma.petAllergy.findFirst({
          where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
        });
        if (existing) {
          return res.json({
            schemaReady: true,
            healthSchemaReady: true,
            replayed: true,
            allergy: publicAllergy(existing),
          });
        }
      }
      const total = await prisma.petAllergy.count({ where: { petId: pet.id, userId: req.user.id } });
      if (total >= ALLERGY_CAP_PER_PET) {
        return res.status(409).json({ error: 'ალერგიების ლიმიტი ამოვწურა.' });
      }
      const result = await replayOrCreate(
        () =>
          data.clientRequestId
            ? prisma.petAllergy.findFirst({
                where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
              })
            : null,
        () =>
          prisma.petAllergy.create({
            data: { userId: req.user.id, petId: pet.id, ...data },
          }),
      );
      return res.status(result.created ? 201 : 200).json({
        schemaReady: true,
        healthSchemaReady: true,
        replayed: !result.created,
        allergy: publicAllergy(result.row),
      });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.get(
  '/:petId/allergies/:allergyId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, allergyId } = allergyParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petAllergy.findFirst({ where: { id: allergyId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_HEALTH_NOT_FOUND);
      }
      return res.json({ schemaReady: true, healthSchemaReady: true, allergy: publicAllergy(row) });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.patch(
  '/:petId/allergies/:allergyId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, allergyId } = allergyParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const current = await prisma.petAllergy.findFirst({ where: { id: allergyId } });
      if (decideOwnedChild(current, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_HEALTH_NOT_FOUND);
      }
      let data;
      try {
        data = mergeAllergyUpdate(current, pick(req.body, ALLERGY_KEYS), petTodayYmd(req));
      } catch (error) {
        return sendValidation(res, error);
      }
      const { count } = await prisma.petAllergy.updateMany({
        where: { id: allergyId, petId: pet.id, userId: req.user.id },
        data: {
          name: data.name,
          category: data.category,
          reaction: data.reaction,
          reportedStatus: data.reportedStatus,
          notedOn: data.notedOn,
          notes: data.notes,
        },
      });
      if (count === 0) return res.status(404).json(PET_HEALTH_NOT_FOUND);
      const row = await prisma.petAllergy.findFirst({ where: { id: allergyId, petId: pet.id, userId: req.user.id } });
      return res.json({ schemaReady: true, healthSchemaReady: true, allergy: publicAllergy(row) });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.delete(
  '/:petId/allergies/:allergyId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, allergyId } = allergyParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const current = await prisma.petAllergy.findFirst({ where: { id: allergyId } });
      if (decideOwnedChild(current, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_HEALTH_NOT_FOUND);
      }
      const { count } = await prisma.petAllergy.deleteMany({
        where: { id: allergyId, petId: pet.id, userId: req.user.id },
      });
      if (count === 0) return res.status(404).json(PET_HEALTH_NOT_FOUND);
      return res.json({ schemaReady: true, healthSchemaReady: true, deleted: true });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.get(
  '/:petId/conditions',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      const items = await prisma.petCondition.findMany({
        where: { petId: pet.id, userId: req.user.id },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: CONDITION_CAP_PER_PET,
      });
      return res.json({
        schemaReady: true,
        healthSchemaReady: true,
        items: items.map(publicCondition),
      });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.post(
  '/:petId/conditions',
  asyncHandler(async (req, res) => {
    try {
      const pet = await requireActivePet(req, res);
      if (!pet) return;
      let data;
      try {
        data = normalizeConditionInput(pick(req.body, CONDITION_KEYS), { todayYmd: petTodayYmd(req) });
      } catch (error) {
        return sendValidation(res, error);
      }
      if (data.clientRequestId) {
        const existing = await prisma.petCondition.findFirst({
          where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
        });
        if (existing) {
          return res.json({
            schemaReady: true,
            healthSchemaReady: true,
            replayed: true,
            condition: publicCondition(existing),
          });
        }
      }
      const total = await prisma.petCondition.count({ where: { petId: pet.id, userId: req.user.id } });
      if (total >= CONDITION_CAP_PER_PET) {
        return res.status(409).json({ error: 'მდგომარეობების ლიმიტი ამოვწურა.' });
      }
      const result = await replayOrCreate(
        () =>
          data.clientRequestId
            ? prisma.petCondition.findFirst({
                where: { petId: pet.id, userId: req.user.id, clientRequestId: data.clientRequestId },
              })
            : null,
        () => prisma.petCondition.create({ data: { userId: req.user.id, petId: pet.id, ...data } }),
      );
      return res.status(result.created ? 201 : 200).json({
        schemaReady: true,
        healthSchemaReady: true,
        replayed: !result.created,
        condition: publicCondition(result.row),
      });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.get(
  '/:petId/conditions/:conditionId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, conditionId } = conditionParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const row = await prisma.petCondition.findFirst({ where: { id: conditionId } });
      if (decideOwnedChild(row, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_HEALTH_NOT_FOUND);
      }
      return res.json({ schemaReady: true, healthSchemaReady: true, condition: publicCondition(row) });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.patch(
  '/:petId/conditions/:conditionId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, conditionId } = conditionParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const current = await prisma.petCondition.findFirst({ where: { id: conditionId } });
      if (decideOwnedChild(current, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_HEALTH_NOT_FOUND);
      }
      let data;
      try {
        data = mergeConditionUpdate(current, pick(req.body, CONDITION_KEYS), petTodayYmd(req));
      } catch (error) {
        return sendValidation(res, error);
      }
      const { count } = await prisma.petCondition.updateMany({
        where: { id: conditionId, petId: pet.id, userId: req.user.id },
        data: {
          name: data.name,
          status: data.status,
          reportedBasis: data.reportedBasis,
          onsetOn: data.onsetOn,
          resolvedOn: data.resolvedOn,
          notes: data.notes,
        },
      });
      if (count === 0) return res.status(404).json(PET_HEALTH_NOT_FOUND);
      const row = await prisma.petCondition.findFirst({
        where: { id: conditionId, petId: pet.id, userId: req.user.id },
      });
      return res.json({ schemaReady: true, healthSchemaReady: true, condition: publicCondition(row) });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);

petsHealthRouter.delete(
  '/:petId/conditions/:conditionId',
  asyncHandler(async (req, res) => {
    try {
      const { petId, conditionId } = conditionParam.parse(req.params);
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const current = await prisma.petCondition.findFirst({ where: { id: conditionId } });
      if (decideOwnedChild(current, pet.id, req.user.id).status !== 200) {
        return res.status(404).json(PET_HEALTH_NOT_FOUND);
      }
      const { count } = await prisma.petCondition.deleteMany({
        where: { id: conditionId, petId: pet.id, userId: req.user.id },
      });
      if (count === 0) return res.status(404).json(PET_HEALTH_NOT_FOUND);
      return res.json({ schemaReady: true, healthSchemaReady: true, deleted: true });
    } catch (error) {
      return sendSchemaError(res, error);
    }
  }),
);
