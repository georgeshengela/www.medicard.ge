import { tx } from '../i18n/locale.js';
import { aiConsentDeclinedText, isAiConsentDeclined } from './aiConsentDecline.ts';
export type VoicePhase = 'idle' | 'preparing' | 'recording' | 'transcribing';
type CaptureDependencies = {
  prepare: (current: () => boolean) => Promise<void>;
  record: () => void;
  stop: () => Promise<string | null>;
  transcribe: (uri: string, current: () => boolean) => Promise<string>;
  discard: (uri: string | null) => Promise<void>;
  active: () => boolean;
  onPhase: (phase: VoicePhase) => void;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  feedback: (kind: 'start' | 'stop') => void;
  now?: () => number;
  maxMs?: number;
};

/** Serial capture: releasing during permission/prepare never starts a hidden recording. */
export function createVoiceCapture(d: CaptureDependencies) {
  let phase: VoicePhase = 'idle', epoch = 0, held = false, started = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const now = d.now || Date.now;
  const getPhase = (): VoicePhase => phase;
  const change = (value: VoicePhase) => { phase = value; d.onPhase(value); };
  const clearTimer = () => { if (timer) clearTimeout(timer); timer = null; };
  const current = (id: number) => epoch === id && d.active();
  const reportError = (error: unknown, fallback: string) => {
    // Declining / closing the disclosure is a choice, not an error: the calm shared line (App Review 2026-09-22).
    if (isAiConsentDeclined(error)) {
      d.onNotice(aiConsentDeclinedText());
    } else d.onError(error instanceof Error ? error.message : fallback);
  };
  async function finish(submit: boolean) {
    if (phase !== 'recording') return;
    held = false; clearTimer();
    const id = epoch, duration = now() - started;
    change('transcribing');
    let uri: string | null = null, text = '';
    try {
      uri = await d.stop();
      if (submit && current(id)) {
        d.feedback('stop');
        if (duration < 450) d.onNotice(tx('ცოტა ხანს გააჩერე ღილაკი და თქვი შენი სათქმელი.', 'Hold the button a little longer and say what you want.'));
        else if (uri) {
          text = await d.transcribe(uri, () => current(id));
          if (!text.trim() && current(id)) d.onNotice(tx('ხმა მკაფიოდ ვერ გავიგე. სცადე თავიდან ან ჩაწერე ტექსტი.', "I couldn't hear that clearly. Try again or type it instead."));
        }
      }
    } catch (error) {
      if (submit && current(id)) reportError(error, tx('ხმა ვერ დამუშავდა.', "Couldn't process your voice."));
    } finally {
      await d.discard(uri).catch(() => undefined);
      change('idle');
    }
    // Cleanup finishes before a reply can play or another recording can begin.
    if (text.trim() && current(id)) d.onTranscript(text.trim());
  }
  return {
    get phase() { return phase; },
    async start() {
      if (phase !== 'idle' || !d.active()) return;
      const id = ++epoch; held = true; change('preparing');
      try {
        await d.prepare(() => current(id) && held);
        if (!current(id) || !held) {
          await d.discard(await d.stop().catch(() => null));
          if (current(id)) d.onNotice(tx('საუბრის დასაწყებად ღილაკს ხელახლა დააჭირე და გააჩერე.', 'To start talking, press and hold the button again.'));
          return;
        }
        d.feedback('start'); d.record(); started = now(); change('recording');
        timer = setTimeout(() => { void finish(true); }, d.maxMs ?? 60000);
      } catch (error) {
        await d.discard(await d.stop().catch(() => null)).catch(() => undefined);
        if (current(id)) reportError(error, tx('მიკროფონი ვერ ჩაირთო.', "Couldn't turn on the microphone."));
      } finally {
        if (getPhase() === 'preparing') change('idle');
      }
    },
    release() { held = false; return finish(true); },
    async cancel() {
      held = false; epoch++; clearTimer();
      await finish(false);
    },
  };
}
