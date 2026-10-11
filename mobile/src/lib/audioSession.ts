import { setAudioModeAsync, type AudioMode } from 'expo-audio';

/**
 * One audio session for the whole app. MEDISLEEP owns it while sleep sounds play (background playback,
 * lock-screen controls → `doNotMix`); any other player (Medi's voice, MEDIRUN's heartbeat) that sets its own
 * mode meanwhile must not switch background playback off under the sleep sounds.
 */
let sleepOwnsSession = false;

export function setSleepAudioOwner(active: boolean): void {
  sleepOwnsSession = active;
}

export function sleepAudioOwnsSession(): boolean {
  return sleepOwnsSession;
}

/** setAudioModeAsync for every caller outside MEDISLEEP. */
export function setAppAudioMode(mode: Partial<AudioMode>): Promise<void> {
  if (!sleepOwnsSession) return setAudioModeAsync(mode);
  return setAudioModeAsync({ ...mode, shouldPlayInBackground: true, interruptionMode: 'doNotMix', playsInSilentMode: true });
}

/** RFC 4122 v4 id for client-made rows (the server checks the format). */
export function randomUuid(): string {
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += hex[(Math.random() * 4) | 8];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}
