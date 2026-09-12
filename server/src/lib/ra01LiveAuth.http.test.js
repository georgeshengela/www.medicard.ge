import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from './prisma.js';
import { UPLOAD_DIR } from './storage.js';
import { denyLegacyPublicUploads } from './privateUploads.js';
import { deleteUserAccount } from './deleteUser.js';
import { signToken } from '../middleware/auth.js';
import { filesRouter } from '../routes/files.routes.js';
import { recordsRouter } from '../routes/records.routes.js';
import { authRouter } from '../routes/auth.routes.js';
import { adminRouter } from '../routes/admin.routes.js';
import { errorHandler } from '../middleware/error.js';

const FIXTURE = Buffer.from('SANITIZED_FIXTURE_NOT_PHI');

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}

describe('RA-01 live auth + private files', { timeout: 90_000 }, () => {
  it('enforces owner file access, IDOR 404, login fail-closed, and admin boundary', async () => {
    const filename = `${randomUUID()}.jpg`;
    const stamp = Date.now();
    const ownerEmail = `ra01.owner.${stamp}@medicard.test`;
    const otherEmail = `ra01.other.${stamp}@medicard.test`;
    let owner = null;
    let other = null;
    let http = null;

    try {
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, filename), FIXTURE);

      owner = await prisma.user.create({
        data: {
          email: ownerEmail,
          fullName: 'RA01 Owner',
          passwordHash: await bcrypt.hash('Ra01OwnerPass!', 12),
        },
      });
      other = await prisma.user.create({
        data: {
          email: otherEmail,
          fullName: 'RA01 Other',
          passwordHash: await bcrypt.hash('Ra01OtherPass!', 12),
        },
      });

      const record = await prisma.medicalRecord.create({
        data: {
          userId: owner.id,
          type: 'LAB',
          imageUrl: `/uploads/${filename}`,
          aiAnalysis: 'SANITIZED',
        },
      });

      const app = express();
      app.use(express.json());
      app.use('/uploads', denyLegacyPublicUploads);
      app.use('/api/auth', authRouter);
      app.use('/api/files', filesRouter);
      app.use('/api/records', recordsRouter);
      app.use('/api/admin', adminRouter);
      app.use((err, req, res, next) => errorHandler(err, req, res, next));
      http = await listen(app);

      const ownerToken = signToken(owner);
      const otherToken = signToken(other);
      const expired = jwt.sign({ sub: owner.id, email: owner.email }, env.JWT_SECRET, { expiresIn: -30 });

      const ownerFile = await fetch(`${http.origin}/api/files/${filename}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const ownerBytes = Buffer.from(await ownerFile.arrayBuffer());
      assert.equal(ownerFile.status, 200);
      assert.equal(ownerBytes.equals(FIXTURE), true);
      assert.match(ownerFile.headers.get('cache-control') || '', /no-store/);

      const unauthFile = await fetch(`${http.origin}/api/files/${filename}`);
      assert.equal(unauthFile.status, 401);
      assert.equal(Buffer.from(await unauthFile.arrayBuffer()).equals(FIXTURE), false);

      const legacy = await fetch(`${http.origin}/uploads/${filename}`);
      assert.equal(legacy.status, 401);
      assert.equal(Buffer.from(await legacy.arrayBuffer()).equals(FIXTURE), false);

      const wrongFile = await fetch(`${http.origin}/api/files/${filename}`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      assert.equal(wrongFile.status, 404);
      assert.equal(Buffer.from(await wrongFile.arrayBuffer()).equals(FIXTURE), false);

      const expiredFile = await fetch(`${http.origin}/api/files/${filename}`, {
        headers: { Authorization: `Bearer ${expired}` },
      });
      assert.equal(expiredFile.status, 401);

      const idor = await fetch(`${http.origin}/api/records/${record.id}`, {
        headers: { Authorization: `Bearer ${otherToken}` },
      });
      const idorBody = await idor.json();
      assert.equal(idor.status, 404);
      assert.equal(JSON.stringify(idorBody).includes('SANITIZED'), false);

      const ownerRecord = await fetch(`${http.origin}/api/records/${record.id}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.equal(ownerRecord.status, 200);

      const badLogin = await fetch(`${http.origin}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ownerEmail, password: 'wrong-password' }),
      });
      const badLoginBody = await badLogin.json();
      assert.equal(badLogin.status, 401);
      assert.equal(Boolean(badLoginBody.token), false);
      assert.equal(JSON.stringify(badLoginBody).includes('passwordHash'), false);
      assert.equal(JSON.stringify(badLoginBody).includes('stack'), false);

      const emptyLogin = await fetch(`${http.origin}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email', password: 'x' }),
      });
      const emptyBody = await emptyLogin.text();
      assert.equal(emptyLogin.status, 400, emptyBody);
      assert.equal(emptyBody.includes('token'), false);
      assert.equal(emptyBody.includes('passwordHash'), false);

      const userVsAdmin = await fetch(`${http.origin}/api/admin/me`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.ok(userVsAdmin.status === 401 || userVsAdmin.status === 403);

      const deleted = await fetch(`${http.origin}/api/records/${record.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.equal(deleted.status, 200);
      const afterDelete = await fetch(`${http.origin}/api/files/${filename}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.equal(afterDelete.status, 404);
    } finally {
      if (http) await http.close();
      if (other?.id) await deleteUserAccount(other.id);
      if (owner?.id) await deleteUserAccount(owner.id);
    }
  });
});
