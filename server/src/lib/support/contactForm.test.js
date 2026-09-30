import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactSchema, submitContactForm } from './contactForm.js';

function fakeDb() {
  const threads = [];
  const messages = [];
  const db = {
    threads,
    messages,
    user: { findFirst: async () => null },
    supportMessage: { findFirst: async () => null, create: async ({ data }) => (messages.push(data), data) },
    supportThread: {
      findFirst: async ({ where }) => threads.find((t) => t.counterpartEmail === where.counterpartEmail && t.subjectKey === where.subjectKey) || null,
      findUnique: async ({ where }) => threads.find((t) => t.id === where.id) || null,
      create: async ({ data }) => (threads.push({ ...data }), threads[threads.length - 1]),
      update: async ({ where, data }) => Object.assign(threads.find((t) => t.id === where.id), data),
    },
  };
  db.$transaction = (fn) => fn(db);
  return db;
}

const valid = { topic: 'app', name: 'ნინო', email: 'Nino@Example.com', message: 'შესვლა ვერ მოვახერხე.', website: '' };

test('a form message becomes an unread support thread with the visitor as counterpart', async () => {
  const db = fakeDb();
  let kicked = 0;
  const result = await submitContactForm(contactSchema.parse(valid), { db, kick: () => (kicked += 1) });
  assert.equal(result.ok, true);
  assert.equal(db.threads.length, 1);
  const [thread] = db.threads;
  assert.equal(thread.counterpartEmail, 'nino@example.com');
  assert.equal(thread.counterpartName, 'ნინო');
  assert.equal(thread.mailbox, 'support@medicard.ge');
  assert.equal(thread.unread, true);
  assert.match(thread.subject, /დახმარება აპში/);
  const [message] = db.messages;
  assert.equal(message.direction, 'inbound');
  assert.equal(message.bodyStatus, 'ok');
  assert.equal(message.isAuto, false);
  assert.match(message.textBody, /შესვლა ვერ მოვახერხე/);
  assert.equal(kicked, 1);
});

test('a second message on the same topic joins the same thread', async () => {
  const db = fakeDb();
  await submitContactForm(contactSchema.parse(valid), { db, kick: null });
  await submitContactForm(contactSchema.parse({ ...valid, message: 'კიდევ ერთი კითხვა.' }), { db, kick: null });
  assert.equal(db.threads.length, 1);
  assert.equal(db.messages.length, 2);
  assert.equal(db.threads[0].messageCount, 2);
});

test('honeypot submissions store nothing; bad or own-domain addresses are refused', async () => {
  const db = fakeDb();
  assert.deepEqual(await submitContactForm(contactSchema.parse({ ...valid, website: 'http://spam' }), { db, kick: null }), { ok: true, spam: true });
  assert.equal((await submitContactForm(contactSchema.parse({ ...valid, email: 'not-an-email' }), { db, kick: null })).code, 'CONTACT_EMAIL');
  assert.equal((await submitContactForm(contactSchema.parse({ ...valid, email: 'x@medicard.ge' }), { db, kick: null })).code, 'CONTACT_EMAIL');
  assert.equal(db.threads.length, 0);
});

test('schema rejects unknown topics and empty messages', () => {
  assert.equal(contactSchema.safeParse({ ...valid, topic: 'hack' }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, message: '  ' }).success, false);
  assert.equal(contactSchema.safeParse({ ...valid, name: '' }).success, false);
});
