import { useSyncExternalStore } from 'react';
import { localAccountId } from '@/lib/localAccount';

export type AiConsentStatus = {
  version: string; accepted: boolean; decision: string | null; updatedAt: string | null;
  manifest: { title: string; purpose: string; categories: string[]; recipients: { name: string; role: string; url: string }[]; privacyUrl: string; retention: string; choice: string };
};
type Prompt = { owner: string; status: AiConsentStatus; settings: boolean; busy: boolean; error: string | null;
  save: (decision: 'accepted' | 'declined' | 'revoked', version: string) => Promise<AiConsentStatus>;
  resolve: (accepted: boolean) => void; promise: Promise<boolean> };
let pending: Prompt | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
export function cancelAiSharingPrompt() {
  const current = pending; pending = null; current?.resolve(false); emit();
}
export function requestAiSharingPrompt(owner: string, status: AiConsentStatus, save: Prompt['save'], settings = false): Promise<boolean> {
  if (owner !== localAccountId()) return Promise.resolve(false);
  if (pending?.owner === owner && pending.status.version === status.version) return pending.promise;
  if (pending) cancelAiSharingPrompt();
  let resolve!: Prompt['resolve'];
  const promise = new Promise<boolean>(done => { resolve = done; });
  pending = { owner, status, save, settings, busy: false, error: null, resolve, promise }; emit();
  return promise;
}
export async function decideAiSharing(allow: boolean) {
  const current = pending;
  if (!current || current.busy) return;
  if (current.owner !== localAccountId()) { cancelAiSharingPrompt(); return; }
  pending = { ...current, busy: true, error: null }; emit();
  try {
    const saved = await current.save(allow ? 'accepted' : current.status.accepted ? 'revoked' : 'declined', current.status.version);
    if (pending?.promise !== current.promise || current.owner !== localAccountId()) return;
    pending = null; current.resolve(allow && saved.accepted); emit();
  } catch (error) {
    if (pending?.promise !== current.promise) return;
    const updated = error && typeof error === 'object' && 'consentStatus' in error ? error.consentStatus as AiConsentStatus : null;
    pending = { ...current, status: updated || current.status, busy: false, error: error instanceof Error ? error.message : 'არჩევანი ვერ შეინახა. სცადე ხელახლა.' }; emit();
  }
}
export function useAiSharingPrompt() {
  return useSyncExternalStore(fn => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => pending, () => null);
}
export function isAiSharingRequest(path: string, method = 'POST') {
  return method === 'POST' && (/^\/api\/ai\/(?!feedback(?:\?|$))/.test(path)
    || /^\/api\/assistant\/(plan|transcribe|speak)(?:\?|$)/.test(path)
    || path.split('?')[0] === '/api/health-profile/onboarding-analysis'
    || path.split('?')[0] === '/api/cycle/insights'
    || /^\/api\/pets\/[^/]+\/chat\/query(?:\?|$)/.test(path));
}
