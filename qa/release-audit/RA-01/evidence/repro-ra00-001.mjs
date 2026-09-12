/**
 * RA-01 reproduction of RA00-001 — unauthenticated GET /uploads/* .
 * Mirrors server/src/server.js express.static(UPLOAD_DIR, { maxAge: '7d' }).
 * Uses a sanitized fixture. Does not print file bytes.
 */
import { createServer } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';

const FIXTURE_NAME = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';
const FIXTURE_BYTES = Buffer.from('SANITIZED_FIXTURE_NOT_PHI');

const dir = await mkdtemp(path.join(tmpdir(), 'ra00-001-'));
await writeFile(path.join(dir, FIXTURE_NAME), FIXTURE_BYTES);

const app = express();
app.use('/uploads', express.static(dir, { maxAge: '7d' }));

const server = createServer(app);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const url = `http://127.0.0.1:${port}/uploads/${FIXTURE_NAME}`;
const response = await fetch(url);
const buf = Buffer.from(await response.arrayBuffer());
const headers = {};
response.headers.forEach((value, key) => {
  headers[key] = value;
});

const evidence = {
  id: 'RA00-001',
  reproducedBeforeFix: true,
  request: {
    method: 'GET',
    url: `/uploads/${FIXTURE_NAME}`,
    authorization: null,
    cookie: null,
  },
  response: {
    status: response.status,
    contentType: headers['content-type'] || null,
    cacheControl: headers['cache-control'] || null,
    contentLength: headers['content-length'] || String(buf.length),
    headers,
  },
  fileBytesReturned: buf.equals(FIXTURE_BYTES),
  byteLength: buf.length,
  authAbsent: true,
  arbitraryLocalHttpAccess: true,
  source: {
    file: 'server/src/server.js',
    pattern: "app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }))",
  },
  note: 'Fixture bytes only. No medical content captured.',
};

console.log(JSON.stringify(evidence, null, 2));

server.close();
await rm(dir, { recursive: true, force: true });

if (response.status !== 200 || !buf.equals(FIXTURE_BYTES)) {
  process.exitCode = 1;
}
