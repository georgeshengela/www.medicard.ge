import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import {
  parseUploadFilename,
  resolveUploadPath,
  filenameFromStoredUrl,
  denyLegacyPublicUploads,
  authorizePrivateUpload,
  servePrivateUpload,
  unlinkStoredUpload,
} from './privateUploads.js';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const FILE = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';
const FIXTURE = Buffer.from('SANITIZED_FIXTURE_NOT_PHI');

async function withUploadDir(run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'ra01-uploads-'));
  try {
    await writeFile(path.join(dir, FILE), FIXTURE);
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function listen(app) {
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        port,
        close: () =>
          new Promise((done, fail) => server.close((err) => (err ? fail(err) : done()))),
      });
    });
  });
}

function fakeAuth(userId) {
  return (req, _res, next) => {
    if (userId) req.user = { id: userId };
    next();
  };
}

function ownerMap(dir) {
  return async (userId, filename) => {
    if (userId === OWNER_ID && filename === FILE) return { id: 'rec-owner' };
    return null;
  };
}

describe('RA00-001 legacy public static (vulnerable pattern)', () => {
  it('serves fixture bytes without Authorization and with a 7-day public cache', async () => {
    await withUploadDir(async (dir) => {
      const app = express();
      app.use('/uploads', express.static(dir, { maxAge: '7d' }));
      const { port, close } = await listen(app);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/uploads/${FILE}`);
        const buf = Buffer.from(await res.arrayBuffer());
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('authorization'), null);
        assert.match(res.headers.get('cache-control') || '', /public/);
        assert.match(res.headers.get('cache-control') || '', /max-age=604800/);
        assert.equal(buf.equals(FIXTURE), true);
      } finally {
        await close();
      }
    });
  });
});

describe('private upload filename parser', () => {
  it('accepts UUID filenames and rejects traversal / malformed ids', () => {
    assert.equal(parseUploadFilename(FILE), FILE);
    assert.equal(parseUploadFilename(`../${FILE}`), null);
    assert.equal(parseUploadFilename(`..%2F${FILE}`), null);
    assert.equal(parseUploadFilename(`%2e%2e%2f${FILE}`), null);
    assert.equal(parseUploadFilename('not-a-uuid.jpg'), null);
    assert.equal(parseUploadFilename(`${FILE}%00.jpg`), null);
    assert.equal(parseUploadFilename(''), null);
    assert.equal(filenameFromStoredUrl(`/uploads/${FILE}`), FILE);
    assert.equal(filenameFromStoredUrl(`/api/files/${FILE}`), FILE);
    assert.equal(filenameFromStoredUrl('https://cdn.example/x.png'), null);
  });

  it('keeps resolved paths inside the upload directory', async () => {
    await withUploadDir(async (dir) => {
      const ok = resolveUploadPath(FILE, dir);
      assert.equal(ok, path.resolve(dir, FILE));
      assert.equal(resolveUploadPath(`../${FILE}`, dir), null);
      assert.equal(resolveUploadPath('..\\windows.txt', dir), null);
    });
  });
});

describe('GET /uploads after RA-01', () => {
  it('denies unauthenticated legacy URLs without returning bytes', async () => {
    await withUploadDir(async (dir) => {
      const app = express();
      app.use('/uploads', denyLegacyPublicUploads);
      app.use('/uploads', express.static(dir, { maxAge: '7d' }));
      const { port, close } = await listen(app);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/uploads/${FILE}`);
        const buf = Buffer.from(await res.arrayBuffer());
        assert.equal(res.status, 401);
        assert.equal(buf.equals(FIXTURE), false);
        assert.match(res.headers.get('cache-control') || '', /no-store/);
        const json = JSON.parse(buf.toString('utf8'));
        assert.equal(typeof json.error, 'string');
        assert.equal(String(json.error).includes(dir), false);
      } finally {
        await close();
      }
    });
  });
});

describe('GET /api/files/:filename', () => {
  async function filesApp(dir, userId) {
    const app = express();
    app.get(
      '/api/files/:filename',
      fakeAuth(userId),
      (req, res, next) => {
        servePrivateUpload(req, res, { uploadDir: dir, findOwner: ownerMap(dir) }).catch(next);
      },
    );
    return listen(app);
  }

  it('owner authenticated → file available with private cache and nosniff', async () => {
    await withUploadDir(async (dir) => {
      const { port, close } = await filesApp(dir, OWNER_ID);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/files/${FILE}`);
        const buf = Buffer.from(await res.arrayBuffer());
        assert.equal(res.status, 200);
        assert.equal(buf.equals(FIXTURE), true);
        assert.equal(res.headers.get('content-type'), 'image/jpeg');
        assert.match(res.headers.get('cache-control') || '', /private/);
        assert.match(res.headers.get('cache-control') || '', /no-store/);
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        assert.match(res.headers.get('content-disposition') || '', /inline/);
      } finally {
        await close();
      }
    });
  });

  it('unauthenticated → denied', async () => {
    await withUploadDir(async (dir) => {
      const { port, close } = await filesApp(dir, null);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/files/${FILE}`);
        const buf = Buffer.from(await res.arrayBuffer());
        assert.equal(res.status, 401);
        assert.equal(buf.equals(FIXTURE), false);
      } finally {
        await close();
      }
    });
  });

  it('wrong user → denied without file bytes', async () => {
    await withUploadDir(async (dir) => {
      const { port, close } = await filesApp(dir, OTHER_ID);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/files/${FILE}`);
        const buf = Buffer.from(await res.arrayBuffer());
        assert.equal(res.status, 404);
        assert.equal(buf.equals(FIXTURE), false);
      } finally {
        await close();
      }
    });
  });

  it('invalid and malformed ids are safe 400/404 and block traversal', async () => {
    await withUploadDir(async (dir) => {
      const { port, close } = await filesApp(dir, OWNER_ID);
      try {
        const probes = [
          '../package.json',
          '..\\windows.txt',
          '..%2Fpackage.json',
          '%2e%2e%2fpackage.json',
          'not-a-uuid.jpg',
          `${FILE}/../${FILE}`,
        ];
        for (const probe of probes) {
          const res = await fetch(`http://127.0.0.1:${port}/api/files/${encodeURIComponent(probe)}`);
          const buf = Buffer.from(await res.arrayBuffer());
          const text = buf.toString('utf8');
          assert.ok(res.status === 400 || res.status === 404, `${probe} → ${res.status}`);
          assert.equal(buf.equals(FIXTURE), false);
          assert.equal(text.includes(dir), false);
        }
      } finally {
        await close();
      }
    });
  });

  it('deleted disk file is unavailable after ownership would have matched', async () => {
    await withUploadDir(async (dir) => {
      await unlinkStoredUpload(`/uploads/${FILE}`, dir);
      const { port, close } = await filesApp(dir, OWNER_ID);
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/files/${FILE}`);
        assert.equal(res.status, 404);
      } finally {
        await close();
      }
    });
  });
});

describe('authorizePrivateUpload', () => {
  it('does not treat UUID secrecy as authorization', async () => {
    await withUploadDir(async (dir) => {
      const denied = await authorizePrivateUpload({
        userId: OTHER_ID,
        filename: FILE,
        findOwner: ownerMap(dir),
        uploadDir: dir,
      });
      assert.equal(denied.ok, false);
      assert.equal(denied.status, 404);
      const missingUser = await authorizePrivateUpload({
        userId: null,
        filename: FILE,
        findOwner: ownerMap(dir),
        uploadDir: dir,
      });
      assert.equal(missingUser.status, 401);
    });
  });
});
