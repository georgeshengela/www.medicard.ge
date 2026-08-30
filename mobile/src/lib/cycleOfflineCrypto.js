/**
 * AES-256-GCM for Cycle offline state.
 * Uses the platform Web Crypto API (Node 20+, Hermes / Expo 54).
 * Never log keys, plaintext, or ciphertext contents.
 */

'use strict';

const {
  CYCLE_OFFLINE_ENCRYPTION_VERSION,
  CYCLE_OFFLINE_SCHEMA_VERSION,
  isEncryptedEnvelope,
  isLegacyPlaintextStore,
  parseOfflineStore,
  persistStore,
} = require('./cycleOfflineCore.js');

function bytesToB64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof Buffer !== 'undefined') return Buffer.from(u8).toString('base64');
  let bin = '';
  for (let i = 0; i < u8.length; i += 1) bin += String.fromCharCode(u8[i]);
  return btoa(bin);
}

function b64ToBytes(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(String(b64), 'base64'));
  const bin = atob(String(b64));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function requireSubtle() {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle || typeof globalThis.crypto.getRandomValues !== 'function') {
    const err = new Error('cycle_offline_crypto_unavailable');
    err.code = 'cycle_offline_crypto_unavailable';
    throw err;
  }
  return subtle;
}

function generateDekBytes() {
  requireSubtle();
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

async function aesGcmEncrypt(keyBytes, plaintext) {
  const subtle = requireSubtle();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const encoded = new TextEncoder().encode(plaintext);
  const buf = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return { iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(buf)) };
}

async function aesGcmDecrypt(keyBytes, ivB64, ciphertextB64) {
  const subtle = requireSubtle();
  const iv = b64ToBytes(ivB64);
  const ct = b64ToBytes(ciphertextB64);
  const key = await subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  try {
    const buf = await subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
    return new TextDecoder().decode(buf);
  } catch {
    const err = new Error('cycle_offline_decrypt_failed');
    err.code = 'cycle_offline_decrypt_failed';
    throw err;
  }
}

async function encryptStore(store, keyBytes) {
  const sealed = await aesGcmEncrypt(keyBytes, persistStore(store));
  return JSON.stringify({
    schemaVersion: CYCLE_OFFLINE_SCHEMA_VERSION,
    encryptionVersion: CYCLE_OFFLINE_ENCRYPTION_VERSION,
    alg: 'AES-256-GCM',
    iv: sealed.iv,
    ciphertext: sealed.ciphertext,
  });
}

async function decryptStore(envelopeRaw, keyBytes) {
  if (!isEncryptedEnvelope(envelopeRaw)) {
    const err = new Error('cycle_offline_decrypt_failed');
    err.code = 'cycle_offline_decrypt_failed';
    throw err;
  }
  const envelope = typeof envelopeRaw === 'string' ? JSON.parse(envelopeRaw) : envelopeRaw;
  const plain = await aesGcmDecrypt(keyBytes, envelope.iv, envelope.ciphertext);
  return parseOfflineStore(plain);
}

/**
 * Encrypt v1 plaintext only after a verified encrypted write.
 * On any failure, keep the original plaintext (do not delete).
 */
async function migratePlaintextToEncrypted(plaintextRaw, keyBytes, io) {
  if (!isLegacyPlaintextStore(plaintextRaw)) {
    return { migrated: false, store: parseOfflineStore(null), keptPlaintext: false };
  }
  const store = parseOfflineStore(plaintextRaw);
  const envelope = await encryptStore(store, keyBytes);
  try {
    await io.writeEncrypted(envelope);
    const readBack = await io.readEncrypted();
    const verified = await decryptStore(readBack, keyBytes);
    if (!verified || typeof verified.accounts !== 'object') {
      throw new Error('cycle_offline_migrate_verify_failed');
    }
    await io.deletePlaintext();
    return { migrated: true, store: verified, keptPlaintext: false };
  } catch (error) {
    return {
      migrated: false,
      store,
      keptPlaintext: true,
      code: error?.code || 'cycle_offline_migrate_failed',
    };
  }
}

module.exports = {
  bytesToB64,
  b64ToBytes,
  generateDekBytes,
  aesGcmEncrypt,
  aesGcmDecrypt,
  encryptStore,
  decryptStore,
  migratePlaintextToEncrypted,
};
