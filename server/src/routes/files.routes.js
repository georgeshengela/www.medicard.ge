import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/error.js';
import { servePrivateUpload } from '../lib/privateUploads.js';

export const filesRouter = Router();

filesRouter.use(requireAuth);

filesRouter.get(
  '/:filename',
  asyncHandler(async (req, res) => servePrivateUpload(req, res)),
);
