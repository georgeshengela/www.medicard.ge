import { io, type Socket } from 'socket.io-client';
import { getToken } from '@/lib/storage';
import { QUEST_SOCKET_URL } from './api';
import { requestQuestRefresh } from './cache';
import { celebrationKey, shouldCelebrate } from './logic.js';

type CompletedPayload = {
  questId: string;
  key?: string;
  completedAt?: string;
};

type ClaimedPayload = {
  questId: string;
  coinsAwarded?: number;
};

const seen = new Set<string>();
let socket: Socket | null = null;
let lastCompleted: CompletedPayload | null = null;
const completedListeners = new Set<(payload: CompletedPayload) => void>();

export function onQuestSocketCompleted(listener: (payload: CompletedPayload) => void) {
  completedListeners.add(listener);
  return () => completedListeners.delete(listener);
}

export function markQuestCelebration(kind: string, questId: string, stamp?: string) {
  return shouldCelebrate(seen, celebrationKey(kind, questId, stamp));
}

export async function connectQuestSocket() {
  const token = await getToken();
  if (!token) return;
  if (socket?.connected) return;
  socket = io(QUEST_SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1500,
  });
  socket.on('connect', () => {
    requestQuestRefresh();
  });
  socket.io.on('reconnect_attempt', async () => {
    const next = await getToken();
    if (socket && next) socket.auth = { token: next };
  });
  socket.on('quest:completed', (payload: CompletedPayload) => {
    if (!payload?.questId) return;
    lastCompleted = payload;
    requestQuestRefresh();
    completedListeners.forEach((fn) => fn(payload));
  });
  socket.on('quest:reward_claimed', (payload: ClaimedPayload) => {
    if (!payload?.questId) return;
    markQuestCelebration('claimed-socket', payload.questId);
    requestQuestRefresh();
  });
}

export function disconnectQuestSocket() {
  socket?.disconnect();
  socket = null;
}

export function lastSocketCompletion() {
  return lastCompleted;
}
