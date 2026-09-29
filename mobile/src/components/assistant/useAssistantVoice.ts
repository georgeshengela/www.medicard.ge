import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { assistantRequest, ensureAiSharingConsentForRequest } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { createVoiceCapture, type VoicePhase } from '@/lib/assistantVoiceSession';
import { tx } from '@/i18n/locale';

export function assistantHaptic(kind: 'start' | 'stop' | 'success' | 'error') {
  if (Platform.OS === 'web') return;
  const effect = kind === 'success' || kind === 'error'
    ? Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning)
    : Haptics.impactAsync(kind === 'start' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Soft);
  void effect.catch(() => undefined);
}
export async function discardAssistantAudio(uri: string | null) {
  if (!uri) return;
  if (Platform.OS === 'web') { if (uri.startsWith('blob:')) URL.revokeObjectURL(uri); }
  else await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

export function useAssistantVoice(options: {
  owner: string; blocked: boolean; beforeStart: () => void;
  onTranscript: (text: string) => void; onError: (message: string) => void; onNotice: (message: string) => void;
}) {
  const latest = useRef(options); latest.current = options;
  const alive = useRef(true), focused = useRef(true), peakDb = useRef<number | null>(null);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  // Speech-grade audio: 16 kHz mono AAC at 32 kbps is plenty for transcription and uploads ~4× faster.
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, sampleRate: 16000, numberOfChannels: 1, bitRate: 32000, isMeteringEnabled: true });
  const audio = useAudioRecorderState(recorder, 100);
  useEffect(() => { if (audio.isRecording && typeof audio.metering === 'number') peakDb.current = Math.max(peakDb.current ?? -160, audio.metering); }, [audio.isRecording, audio.metering]);
  /**
   * End of speech: once the person has spoken and then stays quiet ~1.6 s, send automatically — no more
   * waiting for a release or a second tap. The threshold adapts to the room's noise floor.
   */
  const vad = useRef({ floor: 0, spoke: false, lastLoud: 0, since: 0, sent: false });
  useEffect(() => {
    const v = vad.current;
    if (!audio.isRecording) { v.since = 0; return; }
    const now = Date.now();
    if (!v.since) Object.assign(v, { floor: 0, spoke: false, lastLoud: now, since: now, sent: false });
    const level = typeof audio.metering === 'number' ? audio.metering : -160;
    if (level > -120) v.floor = Math.min(v.floor, level); // quietest moment ≈ the room's noise floor
    if (now - v.since < 500) return;
    const speechAt = Math.max(-45, Math.min(-25, v.floor + 15));
    if (level >= speechAt) { v.spoke = true; v.lastLoud = now; return; }
    if (v.spoke && !v.sent && now - v.lastLoud > 1600 && now - v.since > 1200) {
      v.sent = true;
      void capture.release();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- metering ticks drive this
  }, [audio.isRecording, audio.metering]);
  const capture = useMemo(() => createVoiceCapture({
    active: () => alive.current && focused.current && localAccountId() === options.owner && (Platform.OS === 'web' || AppState.currentState === 'active'),
    onPhase: p => { if (alive.current) setPhase(p); },
    onTranscript: value => latest.current.onTranscript(value),
    onError: message => { assistantHaptic('error'); latest.current.onError(message); },
    onNotice: message => latest.current.onNotice(message), feedback: assistantHaptic,
    prepare: async current => {
      latest.current.beforeStart();
      await ensureAiSharingConsentForRequest('/api/assistant/transcribe');
      if (!current()) return;
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) throw new Error(tx('მიკროფონის ნებართვა არ არის ჩართული. შეგიძლია ტექსტით გააგრძელო.', "Microphone access isn't on. You can continue by text."));
      if (!current()) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false });
      if (!current()) return;
      await recorder.prepareToRecordAsync(); peakDb.current = null;
    },
    record: () => recorder.record(),
    stop: async () => {
      try { await recorder.stop(); } catch { /* Permission may have been dismissed before preparation. */ }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false });
      return recorder.uri;
    },
    discard: discardAssistantAudio,
    transcribe: async (uri, current) => {
      if (peakDb.current !== null && peakDb.current < -55) throw new Error(tx('ხმა ვერ გავიგე. სცადე მიკროფონთან უფრო ახლოს ან ტექსტით გააგრძელე.', "I couldn't hear you. Try closer to the mic or continue by text."));
      let data: string, format: string;
      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        format = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(blob); });
      } else {
        format = 'm4a'; data = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      }
      if (data.length > 1750000) throw new Error(tx('ჩანაწერი დიდია. სცადე უფრო მოკლე წინადადება.', 'The recording is too long. Try a shorter sentence.'));
      if (!current()) return '';
      return (await assistantRequest<{ text: string }>('transcribe', options.owner, { data, format })).text;
    },
  }), [recorder, options.owner]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; void capture.cancel(); }; }, [capture]);
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; void capture.cancel(); }; }, [capture]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') void capture.cancel(); });
    return () => sub.remove();
  }, [capture]);
  return { phase, duration: audio.durationMillis, metering: audio.metering,
    start: () => { if (!latest.current.blocked) void capture.start(); },
    release: () => void capture.release(), cancel: () => void capture.cancel(),
    isBusy: () => capture.phase !== 'idle',
  };
}
