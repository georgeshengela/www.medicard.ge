import type { CycleOfflineStore } from './cycleOfflineCore';

export function bytesToB64(bytes: Uint8Array | ArrayBuffer): string;
export function b64ToBytes(b64: string): Uint8Array;
export function generateDekBytes(): Uint8Array;
export function aesGcmEncrypt(
  keyBytes: Uint8Array,
  plaintext: string,
): Promise<{ iv: string; ciphertext: string }>;
export function aesGcmDecrypt(keyBytes: Uint8Array, ivB64: string, ciphertextB64: string): Promise<string>;
export function encryptStore(store: CycleOfflineStore, keyBytes: Uint8Array): Promise<string>;
export function decryptStore(
  envelopeRaw: string | Record<string, unknown>,
  keyBytes: Uint8Array,
): Promise<CycleOfflineStore>;
export function migratePlaintextToEncrypted(
  plaintextRaw: string,
  keyBytes: Uint8Array,
  io: {
    writeEncrypted: (envelope: string) => Promise<void>;
    readEncrypted: () => Promise<string | null>;
    deletePlaintext: () => Promise<void>;
  },
): Promise<{
  migrated: boolean;
  store: CycleOfflineStore;
  keptPlaintext: boolean;
  code?: string;
}>;
