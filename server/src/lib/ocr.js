import { createRequire } from 'node:module';
import { createWorker } from 'tesseract.js';

const require = createRequire(import.meta.url);
// Import the library entry point directly: pdf-parse's index.js runs a debug harness
// that reads a fixture file from disk when it is not required as a child module.
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

export const SUPPORTED_DOCUMENT_TYPES = ['application/pdf'];

/** Georgian + English + Russian — the three languages Georgian lab printouts actually use. */
const OCR_LANGS = 'kat+eng+rus';

let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(OCR_LANGS).catch((error) => {
      // Reset so a transient traineddata download failure doesn't poison the process.
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

export async function shutdownOcr() {
  if (!workerPromise) return;
  try {
    const worker = await workerPromise;
    await worker.terminate();
  } catch {
    /* nothing useful to do while shutting down */
  } finally {
    workerPromise = null;
  }
}

/**
 * Tesseract OCR over a raster image. Returns null instead of throwing — OCR is a
 * best-effort complement to the vision model, never a hard dependency.
 * @param {Buffer} buffer
 * @returns {Promise<string|null>}
 */
export async function ocrImage(buffer) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(buffer);
    const text = normalise(data?.text ?? '');
    return text.length >= 24 ? text : null;
  } catch (error) {
    console.warn('[medicard] OCR failed:', error?.message ?? error);
    return null;
  }
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{text: string, pages: number}>}
 */
export async function extractPdfText(buffer) {
  const result = await pdfParse(buffer);
  return { text: normalise(result.text ?? ''), pages: result.numpages ?? 0 };
}

function normalise(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
