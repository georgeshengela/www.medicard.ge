import multer from 'multer';
import { ZodError } from 'zod';
import { AiEngineError } from '../lib/evidencemd.js';
import { env } from '../config/env.js';
import { recordServerError } from '../lib/errorMonitor.js';
import { isEnglish, t } from '../lib/i18n.js';
import { MIN_USER_AGE_MESSAGE, MIN_USER_AGE_MESSAGE_EN } from '../lib/patient.js';

/**
 * English for Georgian validation messages written in route/lib schemas (zod `.min(1, '…')` etc.).
 * Schemas are built once at import, so they cannot see the request; English requests are mapped here.
 */
const FIELD_MESSAGES_EN = Object.freeze({
  [MIN_USER_AGE_MESSAGE]: MIN_USER_AGE_MESSAGE_EN,
  'ტელეფონის ნომერი უნდა იყოს ფორმატში +9955XXXXXXXX': 'The phone number must look like +9955XXXXXXXX',
  'სახელი და გვარი სავალდებულოა': 'Your full name is required',
  'შეიყვანე სახელი და გვარი': 'Enter your full name',
  'ელ-ფოსტის ფორმატი არასწორია': 'The email address is not valid',
  'პაროლი უნდა შეიცავდეს მინიმუმ 8 სიმბოლოს': 'The password must be at least 8 characters',
  'შეიყვანე პაროლი': 'Enter your password',
  'კოდი უნდა შედგებოდეს 6 ციფრისგან': 'The code must be 6 digits',
  'კოდი უნდა შედგებოდეს 4 ციფრისგან': 'The code must be 4 digits',
  'პაროლები არ ემთხვევა': 'The passwords do not match',
  'პაროლები არ ემთხვევა.': 'The passwords do not match.',
  'განსაახლებელი ველი არ არის მითითებული': 'There is nothing to update',
  'აირჩიე სქესი': 'Choose your sex',
  'შეიყვანე დაბადების თარიღი': 'Enter your date of birth',
  'დაბადების თარიღი უნდა იყოს ფორმატში წწწწ-თთ-დდ': 'The date of birth must be in YYYY-MM-DD format',
  'ასეთი თარიღი არ არსებობს': 'This date does not exist',
  'დაბადების თარიღი მომავალში ვერ იქნება': 'The date of birth cannot be in the future',
  'შეამოწმე დაბადების თარიღი': 'Please check your date of birth',
  'მიუთითე მიღების დრო': 'Add a dose time',
  'დღეში დასაშვებია 1-დან 8 მიღებამდე': 'You can add 1 to 8 doses a day',
  'დრო უნდა იყოს ფორმატში 09:00': 'Times must look like 09:00',
  'მიუთითე მედიკამენტის დასახელება': 'Enter the medication name',
  'მიუთითე დოზა': 'Enter the dose',
  'არასწორი იდენტიფიკატორი': 'Invalid ID',
  'არასწორი თარიღი': 'Invalid date',
  'დრო უნდა იყოს HH:mm': 'Time must be HH:mm',
  'არასწორი თარიღის ფორმატი': 'Invalid date format',
  'არასწორი Expo push token': 'Invalid Expo push token',
  'Instagram-ის სახელი არასწორია.': 'The Instagram handle is not valid.',
  'აირჩიე მინიმუმ ერთი დარბაზი.': 'Choose at least one gym.',
  'ტრენერი არ არის მითითებული.': 'No trainer was given.',
});
const GEORGIAN_LETTER = /[\u10D0-\u10FF]/;

/** A validation message for the request language (unknown Georgian text gets a plain English fallback). */
function fieldMessage(req, message) {
  if (!isEnglish(req) || !GEORGIAN_LETTER.test(String(message || ''))) return message;
  return FIELD_MESSAGES_EN[message] || 'This field is not valid.';
}

/** A path segment starting with a dot (/.git, /.env, /x/.htaccess); /.well-known stays reachable. */
export function isHiddenPath(path) {
  return /(^|\/)\.(?!well-known(\/|$))/.test(String(path || ''));
}

export function notFound(req, res) {
  res.status(404).json({ error: t(req, 'მოთხოვნილი მისამართი ვერ მოიძებნა.', 'The requested address was not found.'), path: req.originalUrl });
}

/**
 * The visitor closed the connection mid-response (scanner bots, lost signal): nothing failed on our side.
 * `send`/`sendFile` reports it as ECONNABORTED "Request aborted"; an outbound axios timeout shares the code
 * but not the message, so it still counts as a real error.
 */
export function isClientAbort(error, req) {
  return (error?.code === 'ECONNABORTED' && error?.message === 'Request aborted') || req?.socket?.destroyed === true;
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(error, req, res, next) {
  if (isClientAbort(error, req)) {
    if (!res.headersSent && !res.destroyed) res.end();
    return;
  }
  if (res.headersSent) {
    console.error('[medicard] Unhandled error after response started:', error?.message || error);
    return;
  }
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: t(req, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.'),
      fields: error.issues.map((i) => ({ field: i.path.join('.'), message: fieldMessage(req, i.message) })),
    });
  }

  if (error instanceof AiEngineError) {
    return res.status(error.status).json({ error: t(req, error.message, error.messageEn || error.message), code: 'AI_ENGINE_ERROR' });
  }

  if (typeof error?.status === 'number' && error.status >= 400 && error.status < 600) {
    // Libraries without `req` attach `messageEn` to their Georgian error; English requests get it.
    const english = typeof error.messageEn === 'string' && error.messageEn ? error.messageEn : null;
    return res.status(error.status).json({
      error: t(req, error.message || 'მოთხოვნა უარყოფილია.', english || error.message || 'The request was declined.'),
      ...(error.code ? { code: error.code } : {}),
    });
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === 'LIMIT_FILE_SIZE'
        ? t(req, 'ფაილი ძალიან დიდია. მაქსიმალური ზომაა 12 მეგაბაიტი.', 'The file is too large. The maximum size is 12 MB.')
        : t(req, 'ფაილის ატვირთვა ვერ მოხერხდა.', 'The file could not be uploaded.');
    return res.status(400).json({ error: message });
  }

  if (error?.code === 'P2002') {
    return res.status(409).json({ error: t(req, 'ასეთი ჩანაწერი უკვე არსებობს.', 'This entry already exists.') });
  }
  if (error?.code === 'P2025') {
    return res.status(404).json({ error: t(req, 'ჩანაწერი ვერ მოიძებნა.', 'Entry not found.') });
  }

  console.error('[medicard] Unhandled error:', error);
  // Fire-and-forget: a scrubbed summary goes to ErrorEvent (#/errors); never throws or delays the response.
  recordServerError(error, req);
  return res.status(500).json({
    error: t(req, 'სერვერზე მოხდა შეცდომა. სცადე მოგვიანებით.', 'Something went wrong on our side. Please try again later.'),
    ...(env.NODE_ENV === 'development' ? { detail: error?.message } : {}),
  });
}

/** Removes the try/catch boilerplate from every async route handler. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(async error => {
  // A retry should see the failed request's slot released before it receives the error.
  if (typeof req.releaseAiCredit === 'function') {
    await req.releaseAiCredit().catch(() => console.warn('[ai] reservation cleanup failed'));
  }
  next(error);
});
