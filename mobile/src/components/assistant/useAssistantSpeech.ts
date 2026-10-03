import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { assistantRequest } from '@/lib/api';
import { localAccountId } from '@/lib/localAccount';
import { discardAssistantAudio } from './useAssistantVoice';
import { tx } from '@/i18n/locale';
import { aiConsentDeclinedText, isAiConsentDeclined } from '@/lib/aiConsentDecline';

export function useAssistantSpeech(owner: string, available: boolean, onNotice: (text: string) => void) {
  const player = useAudioPlayer(null, { updateInterval: 150 });
  const [phase, setPhase] = useState<'idle' | 'loading' | 'speaking'>('idle');
  const [muted, setMuted] = useState(false);
  const latest = useRef({ available, muted, onNotice }); latest.current = { available, muted, onNotice };
  const alive = useRef(true), focused = useRef(true), epoch = useRef(0), uri = useRef<string | null>(null);
  const completion = useRef<((played: boolean) => void) | null>(null);
  const deadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = useCallback((played = false) => {
    epoch.current++;
    if (deadline.current) clearTimeout(deadline.current);
    deadline.current = null;
    try { player.pause(); player.replace(null); } catch { /* Already released on unmount. */ }
    const old = uri.current; uri.current = null; void discardAssistantAudio(old);
    completion.current?.(played); completion.current = null;
    if (alive.current) setPhase('idle');
  }, [player]);
  const active = () => alive.current && focused.current && localAccountId() === owner && (Platform.OS === 'web' || AppState.currentState === 'active');
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', status => {
      if (status.didJustFinish) stop(true);
      else if (status.error) { stop(); if (active()) latest.current.onNotice(tx('ხმის დაკვრა შეფერხდა. პასუხი ტექსტად წაიკითხე.', 'Playback stopped. You can read the reply as text.')); }
      else if (status.playing && alive.current) setPhase('speaking');
    });
    return () => sub.remove();
  }, [player, stop]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; stop(); }; }, [stop]);
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; stop(); }; }, [stop]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => sub.remove();
  }, [stop]);
  async function say(text: string): Promise<boolean> {
    stop();
    if (!active() || !latest.current.available || latest.current.muted || !text.trim()) return false;
    const id = epoch.current;
    setPhase('loading');
    try {
      const sound = await assistantRequest<{ data: string; format: string }>('speak', owner, { text: text.slice(0, 2000) });
      if (!active() || id !== epoch.current) return false;
      if (sound.format !== 'mp3' || sound.data.length > 2000000) throw new Error('invalid_audio');
      let next: string;
      if (Platform.OS === 'web') {
        const bytes = Uint8Array.from(atob(sound.data), char => char.charCodeAt(0));
        next = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      } else {
        next = `${FileSystem.cacheDirectory}medi-reply-${Date.now()}-${id}.mp3`;
        await FileSystem.writeAsStringAsync(next, sound.data, { encoding: FileSystem.EncodingType.Base64 });
      }
      if (!active() || id !== epoch.current) { await discardAssistantAudio(next); return false; }
      uri.current = next;
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' });
      if (!active() || id !== epoch.current) return false;
      return await new Promise<boolean>((resolve, reject) => {
        completion.current = resolve;
        deadline.current = setTimeout(() => { stop(); if (active()) latest.current.onNotice(tx('ხმა შეწყდა. ტექსტით ან საუბრის ღილაკით გააგრძელე.', 'The audio stopped. Continue by text or with the talk button.')); }, 120000);
        try { player.replace(next); player.play(); } catch (e) { reject(e); }
      });
    } catch (error) {
      // Declining the disclosure for speech output is a choice, not a playback failure (App Review 2026-09-22).
      if (active() && id === epoch.current) { stop(); latest.current.onNotice(isAiConsentDeclined(error) ? aiConsentDeclinedText() : tx('ხმოვანი პასუხი ახლა ვერ ჩაირთო. პასუხი ტექსტად რჩება.', "The voice reply couldn't start right now. The reply stays as text.")); }
      return false;
    }
  }
  return { phase, muted, say, stop: () => stop(), toggle: () => {
    stop();
    if (!latest.current.available) { latest.current.onNotice(tx('ქართული ხმოვანი პასუხი ჯერ არ არის ჩართული. საუბარი და ტექსტური პასუხები მუშაობს.', "Voice replies aren't turned on yet. Talking and text replies work.")); return; }
    setMuted(!latest.current.muted);
  } };
}
