/** Exact digital silence in PCM WAV is never sent to a generative transcriber. */
export function isSilentPcmWav(bytes) {
  if (bytes.length < 44 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') return false;
  let pcm = false;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const name = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > bytes.length) return false;
    if (name === 'fmt ' && size >= 16) pcm = bytes.readUInt16LE(start) === 1 && bytes.readUInt16LE(start + 14) === 16;
    if (name === 'data' && pcm && size >= 2) {
      for (let i = start; i + 1 < start + size; i += 2) if (bytes.readInt16LE(i) !== 0) return false;
      return true;
    }
    offset = start + size + (size % 2);
  }
  return false;
}
