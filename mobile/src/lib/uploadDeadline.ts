export class UploadTimeoutError extends Error {}

/** Cancel the native transfer too, instead of only hiding its spinner. */
export async function uploadWithDeadline<T>(task: { uploadAsync: () => Promise<T | null | undefined>; cancelAsync: () => Promise<unknown> }, timeoutMs = 180_000): Promise<NonNullable<T>> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      task.uploadAsync(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new UploadTimeoutError('ატვირთვის მოლოდინის დრო ამოიწურა. გთხოვ, სცადე ხელახლა.'));
          void task.cancelAsync().catch(() => undefined);
        }, timeoutMs);
      }),
    ]);
    if (result == null) throw new Error('Upload was cancelled');
    return result;
  } finally { if (timeout) clearTimeout(timeout); }
}
