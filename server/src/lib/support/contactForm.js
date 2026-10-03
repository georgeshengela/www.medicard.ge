/**
 * Site contact form (medicard.ge/contact) → support inbox.
 *
 * The message lands in the same SupportThread/SupportMessage tables as mail to
 * support@medicard.ge, with the visitor's address as the counterpart, so a reply from admin
 * #/support goes straight to them and the owner gets the usual "new support mail" notice.
 * (Mailing support@ from our own domain would not work: own-domain mail is treated as automatic,
 * never notified, and replies would go back to our own sender.)
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { isDeliverableEmail, isReservedTestDomain, normalizeEmail } from '../email/address.js';
import { findThread, kickSupportInbound, linkUserId, threadAfterInbound } from './inbound.js';
import { isOwnDomain, subjectKey } from './threading.js';

export const CONTACT_TOPICS = Object.freeze({
  app: { ka: 'დახმარება აპში', en: 'Help with the app' },
  privacy: { ka: 'მონაცემები და კონფიდენციალურობა', en: 'Data and privacy' },
  partnership: { ka: 'პარტნიორობა', en: 'Partnerships' },
  coach: { ka: 'ტრენერისთვის (MEDICOACH)', en: 'For trainers (MEDICOACH)' },
  other: { ka: 'სხვა', en: 'Other' },
});

export const CONTACT_MESSAGE_MAX = 5000;
const SUPPORT_MAILBOX = 'support@medicard.ge';

export const contactSchema = z.object({
  topic: z.enum(Object.keys(CONTACT_TOPICS)),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().max(254),
  message: z.string().trim().min(5).max(CONTACT_MESSAGE_MAX),
  // Honeypot: a hidden field people never fill in.
  website: z.string().max(200).optional().default(''),
});

export function contactSubject(topicKey, name) {
  const topic = CONTACT_TOPICS[topicKey]?.ka || CONTACT_TOPICS.other.ka;
  return `საიტიდან: ${topic} — ${name}`.replace(/[\r\n]+/g, ' ').slice(0, 300);
}

/**
 * @returns {Promise<{ ok: true, threadId?: string, spam?: true } | { ok: false, code: string }>}
 */
export async function submitContactForm(input, { db = prisma, now = new Date(), kick = kickSupportInbound } = {}) {
  const { topic, name, message, website } = input;
  if (website) return { ok: true, spam: true }; // answer like a success; store nothing
  const email = normalizeEmail(input.email);
  if (!isDeliverableEmail(email) || isOwnDomain(email) || isReservedTestDomain(email)) return { ok: false, code: 'CONTACT_EMAIL' };

  const subject = contactSubject(topic, name);
  const key = subjectKey(subject);
  const text = `${message}\n\n— ${name} <${email}>\nთემა: ${CONTACT_TOPICS[topic].ka}\nგამოგზავნილია medicard.ge/contact ფორმიდან`;

  const threadId = await db.$transaction(async (tx) => {
    let thread = await findThread(tx, { counterpart: email, key, now });
    if (!thread) {
      thread = await tx.supportThread.create({
        data: {
          id: randomUUID(),
          subject,
          subjectKey: key,
          counterpartEmail: email,
          counterpartName: name,
          mailbox: SUPPORT_MAILBOX,
          status: 'new',
          userId: await linkUserId(tx, email),
          unread: true,
          messageCount: 0,
          lastMessageAt: now,
          createdAt: now,
        },
      });
    }
    await tx.supportMessage.create({
      data: {
        id: randomUUID(),
        threadId: thread.id,
        direction: 'inbound',
        messageId: `contact-${randomUUID()}@medicard.ge`,
        fromEmail: email,
        fromName: name,
        toEmails: [SUPPORT_MAILBOX],
        ccEmails: [],
        subject,
        textBody: text,
        bodyStatus: 'ok',
        attachments: [],
        isAuto: false,
        createdAt: now,
      },
    });
    await tx.supportThread.update({ where: { id: thread.id }, data: threadAfterInbound(thread, now) });
    return thread.id;
  });

  kick?.(); // owner notice goes out on the support worker's next tick
  return { ok: true, threadId };
}
