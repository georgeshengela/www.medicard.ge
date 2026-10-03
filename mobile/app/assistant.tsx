import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { MediChat } from '@/components/medi/MediChat';
import { featureForHref, featureMessage, isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { mediModeFromParam, mediRoute } from '@/lib/mediModes';
import { useAuth } from '@/store/AuthContext';

/**
 * The one Medi chat (owner 2026-10-03): Medi, the doctor and the consilium are one conversation with a
 * consilium switch on the composer. Old links keep working: ?mode=doctor sends the first question
 * straight to the clinical model, ?mode=deep opens with the consilium on, ?sessionId reopens any saved
 * Medi thread or consultation. A paused mode (admin „მოდულები“) opens the regular chat with its message.
 */
export default function AssistantScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ mode?: string; sessionId?: string; prefill?: string; handoff?: string }>();
  const features = useFeatureState();
  if (!user) return null;
  const requested = mediModeFromParam(params.mode);
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId : undefined;
  const requestedOn = requested === 'medi' || isHrefAvailable(mediRoute({ mode: requested }), features);
  const pausedMessage = requestedOn ? undefined : featureMessage(featureForHref(mediRoute({ mode: requested })) ?? 'medi', features);
  return (
    <MediChat
      key={`${user.id}:${sessionId ?? 'new'}`}
      owner={user.id}
      sessionId={sessionId}
      startConsilium={requestedOn && requested === 'deep'}
      directDoctor={requestedOn && requested === 'doctor'}
      prefill={requestedOn && typeof params.prefill === 'string' ? params.prefill : undefined}
      handoff={requestedOn && params.handoff === '1'}
      pausedMessage={pausedMessage}
    />
  );
}
