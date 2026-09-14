import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { saveUpload } from '../lib/storage.js';
import { unlinkStoredUpload } from '../lib/privateUploads.js';
import { publicPetsCatalog } from '../lib/petsCatalog.js';
import {
  MAX_PETS_PER_USER,
  mergePetUpdate,
  normalizePetIdentity,
  petTodayYmd,
  publicPet,
} from '../lib/petsAge.js';
import { isPetsSchemaMissing, petsSchemaUnavailable, PET_NOT_FOUND } from '../lib/petsOwnership.js';
import { petsHealthRouter } from './petsHealth.routes.js';
import { petsCareRouter } from './petsCare.routes.js';
import { petsChatRouter } from './petsChat.routes.js';

export const petsRouter = Router();

petsRouter.use(requireAuth);

const idParam = z.object({ petId: z.string().uuid('არასწორი იდენტიფიკატორი') });

const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function sniffImageMime(buffer, declared) {
  if (!buffer?.length) return declared;
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) return 'image/png';
  if (buffer.length > 12 && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.length > 8 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'image/heic';
  return declared;
}

function acceptPetPhoto(_req, file, cb) {
  const mime = String(file.mimetype || '').toLowerCase();
  if (mime === 'image/heic' || mime === 'image/heif') {
    cb(Object.assign(new Error('ატვირთეთ JPEG, PNG ან WEBP ფოტო.'), { status: 400 }));
    return;
  }
  if (!ALLOWED_IMAGE.has(mime) && mime !== 'image/jpg') {
    cb(Object.assign(new Error('დაშვებულია მხოლოდ JPG, PNG, WEBP ან GIF ფოტო.'), { status: 400 }));
    return;
  }
  cb(null, true);
}

const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: acceptPetPhoto,
});

function writableCreateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const {
    name,
    speciesId,
    breedId,
    customBreed,
    sex,
    neutered,
    ageKind,
    birthDate,
    approxAgeYears,
    approxAgeMonths,
    approxAgeRecordedOn,
    vetClinicName,
    vetName,
    vetPhone,
    vetAddress,
    vetNotes,
  } = body;
  return {
    name,
    speciesId,
    breedId,
    customBreed,
    sex,
    neutered,
    ageKind,
    birthDate,
    approxAgeYears,
    approxAgeMonths,
    approxAgeRecordedOn,
    vetClinicName,
    vetName,
    vetPhone,
    vetAddress,
    vetNotes,
  };
}

async function findOwnedActivePet(userId, petId) {
  const row = await prisma.pet.findFirst({ where: { id: petId, userId } });
  if (!row || row.archivedAt) return null;
  return row;
}

petsRouter.get(
  '/catalog',
  asyncHandler(async (_req, res) => {
    return res.json(publicPetsCatalog());
  }),
);

petsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    try {
      const todayYmd = petTodayYmd(req);
      const rows = await prisma.pet.findMany({
        where: { userId: req.user.id, archivedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      return res.json({
        schemaReady: true,
        pets: rows.map((row) => publicPet(row, { todayYmd })),
      });
    } catch (error) {
      if (isPetsSchemaMissing(error)) {
        const unavailable = petsSchemaUnavailable();
        return res.status(unavailable.status).json(unavailable.body);
      }
      throw error;
    }
  }),
);

petsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const todayYmd = petTodayYmd(req);
    let data;
    try {
      data = normalizePetIdentity(writableCreateBody(req.body), { todayYmd, partial: false });
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ error: error.message });
      throw error;
    }

    try {
      const total = await prisma.pet.count({ where: { userId: req.user.id } });
      if (total >= MAX_PETS_PER_USER) {
        return res.status(409).json({ error: 'ერთ ანგარიშზე მაქსიმუმ 20 ცხოველია.' });
      }
      const pet = await prisma.pet.create({
        data: {
          userId: req.user.id,
          ...data,
        },
      });
      return res.status(201).json({ schemaReady: true, pet: publicPet(pet, { todayYmd }) });
    } catch (error) {
      if (isPetsSchemaMissing(error)) {
        const unavailable = petsSchemaUnavailable();
        return res.status(unavailable.status).json(unavailable.body);
      }
      throw error;
    }
  }),
);

petsRouter.get(
  '/:petId',
  asyncHandler(async (req, res) => {
    const { petId } = idParam.parse(req.params);
    try {
      const row = await findOwnedActivePet(req.user.id, petId);
      if (!row) return res.status(404).json(PET_NOT_FOUND);
      return res.json({ schemaReady: true, pet: publicPet(row, { todayYmd: petTodayYmd(req) }) });
    } catch (error) {
      if (isPetsSchemaMissing(error)) {
        const unavailable = petsSchemaUnavailable();
        return res.status(unavailable.status).json(unavailable.body);
      }
      throw error;
    }
  }),
);

petsRouter.patch(
  '/:petId',
  asyncHandler(async (req, res) => {
    const { petId } = idParam.parse(req.params);
    const todayYmd = petTodayYmd(req);
    try {
      const current = await findOwnedActivePet(req.user.id, petId);
      if (!current) return res.status(404).json(PET_NOT_FOUND);
      let data;
      try {
        data = mergePetUpdate(current, writableCreateBody(req.body), todayYmd);
      } catch (error) {
        if (error.status === 400) return res.status(400).json({ error: error.message });
        throw error;
      }
      await prisma.pet.updateMany({
        where: { id: petId, userId: req.user.id, archivedAt: null },
        data,
      });
      const pet = await prisma.pet.findFirst({ where: { id: petId, userId: req.user.id } });
      if (!pet || pet.archivedAt) return res.status(404).json(PET_NOT_FOUND);
      return res.json({ schemaReady: true, pet: publicPet(pet, { todayYmd }) });
    } catch (error) {
      if (isPetsSchemaMissing(error)) {
        const unavailable = petsSchemaUnavailable();
        return res.status(unavailable.status).json(unavailable.body);
      }
      throw error;
    }
  }),
);

petsRouter.post(
  '/:petId/archive',
  asyncHandler(async (req, res) => {
    const { petId } = idParam.parse(req.params);
    try {
      const { count } = await prisma.pet.updateMany({
        where: { id: petId, userId: req.user.id, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      if (count === 0) return res.status(404).json(PET_NOT_FOUND);
      return res.json({ schemaReady: true, archived: true });
    } catch (error) {
      if (isPetsSchemaMissing(error)) {
        const unavailable = petsSchemaUnavailable();
        return res.status(unavailable.status).json(unavailable.body);
      }
      throw error;
    }
  }),
);

petsRouter.post(
  '/:petId/photo',
  uploadPhoto.single('file'),
  asyncHandler(async (req, res) => {
    const { petId } = idParam.parse(req.params);
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'ფოტო არ არის ატვირთული.' });
    }
    const mime = sniffImageMime(req.file.buffer, String(req.file.mimetype || '').toLowerCase());
    if (mime === 'image/heic') {
      return res.status(400).json({ error: 'ატვირთეთ JPEG, PNG ან WEBP ფოტო.' });
    }
    if (!ALLOWED_IMAGE.has(mime)) {
      return res.status(400).json({ error: 'დაშვებულია მხოლოდ JPG, PNG, WEBP ან GIF ფოტო.' });
    }
    try {
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const photoUrl = await saveUpload(req.file.buffer, mime);
      await prisma.pet.updateMany({
        where: { id: petId, userId: req.user.id, archivedAt: null },
        data: { photoUrl },
      });
      if (pet.photoUrl && pet.photoUrl !== photoUrl) {
        await unlinkStoredUpload(pet.photoUrl);
      }
      const updated = await prisma.pet.findFirst({ where: { id: petId, userId: req.user.id } });
      return res.json({ schemaReady: true, pet: publicPet(updated, { todayYmd: petTodayYmd(req) }) });
    } catch (error) {
      if (isPetsSchemaMissing(error)) {
        const unavailable = petsSchemaUnavailable();
        return res.status(unavailable.status).json(unavailable.body);
      }
      throw error;
    }
  }),
);

petsRouter.delete(
  '/:petId/photo',
  asyncHandler(async (req, res) => {
    const { petId } = idParam.parse(req.params);
    try {
      const pet = await findOwnedActivePet(req.user.id, petId);
      if (!pet) return res.status(404).json(PET_NOT_FOUND);
      const previous = pet.photoUrl;
      await prisma.pet.updateMany({
        where: { id: petId, userId: req.user.id, archivedAt: null },
        data: { photoUrl: null },
      });
      if (previous) await unlinkStoredUpload(previous);
      const updated = await prisma.pet.findFirst({ where: { id: petId, userId: req.user.id } });
      return res.json({ schemaReady: true, pet: publicPet(updated, { todayYmd: petTodayYmd(req) }) });
    } catch (error) {
      if (isPetsSchemaMissing(error)) {
        const unavailable = petsSchemaUnavailable();
        return res.status(unavailable.status).json(unavailable.body);
      }
      throw error;
    }
  }),
);

petsRouter.use(petsHealthRouter);
petsRouter.use(petsCareRouter);
petsRouter.use(petsChatRouter);
