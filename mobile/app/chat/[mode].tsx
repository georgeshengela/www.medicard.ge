import { Redirect, useLocalSearchParams } from 'expo-router';
import { mediModeFromParam, mediRoute } from '@/lib/mediModes';

/** One Medi: old /chat/doctor and /chat/consilium links (any case) open the matching /assistant mode. */
export default function LegacyChatRedirect() {
  const params = useLocalSearchParams<{ mode?: string; sessionId?: string; prefill?: string }>();
  const mode = mediModeFromParam(params.mode);
  return <Redirect href={mediRoute({ mode: mode === 'medi' ? 'doctor' : mode, sessionId: params.sessionId, prefill: params.prefill }) as never} />;
}
