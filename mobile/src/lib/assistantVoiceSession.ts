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
    if (error && typeof error === 'object' && 'code' in error && error.code === 'AI_CONSENT_DECLINED') {
      d.onNotice('AI-სთან გაზიარება გამორთულია. არჩევანის შეცვლა პროფილის პარამეტრებიდან შეგიძლია.');
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
        if (duration < 450) d.onNotice('ცოტა ხანს გააჩერე ღილაკი და თქვი შენი სათქმელი.');
        else if (uri) {
          text = await d.transcribe(uri, () => current(id));
          if (!text.trim() && current(id)) d.onNotice('ხმა მკაფიოდ ვერ გავიგე. სცადე თავიდან ან ჩაწერე ტექსტი.');
        }
      }
    } catch (error) {
      if (submit && current(id)) reportError(error, 'ხმა ვერ დამუშავდა.');
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
          if (current(id)) d.onNotice('საუბრის დასაწყებად ღილაკს ხელახლა დააჭირე და გააჩერე.');
          return;
        }
        d.feedback('start'); d.record(); started = now(); change('recording');
        timer = setTimeout(() => { void finish(true); }, d.maxMs ?? 60000);
      } catch (error) {
        await d.discard(await d.stop().catch(() => null)).catch(() => undefined);
        if (current(id)) reportError(error, 'მიკროფონი ვერ ჩაირთო.');
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
