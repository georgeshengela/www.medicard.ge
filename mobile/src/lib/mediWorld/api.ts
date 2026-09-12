import { api } from '@/lib/api';
import type {
  AdventurePreferences,
  AdventurePreferencesResponse,
  AdventureResponse,
  CompanionWorldState,
  ExploreAreaResponse,
  ExploreCollectResponse,
  ExploreCollectionsResponse,
  ExploreConfigResponse,
  MediWorldLedgerItem,
  MediWorldProfileResponse,
  MovementHistoryResponse,
  MovementPreferencesResponse,
  MovementSession,
  MovementSessionResponse,
} from '@/lib/mediWorld/types';

export const mediWorldApi = {
  profile: () => api.mediWorld.profile(),
  ledger: (query?: { take?: number; cursor?: string | null }) => api.mediWorld.ledger(query),
  companion: () => api.mediWorld.companion(),
  renameCompanion: (displayName: string) => api.mediWorld.renameCompanion(displayName),
  careMoment: (interactionKey: string) => api.mediWorld.careMoment(interactionKey),
  selectStage: (stageKey: string) => api.mediWorld.selectStage(stageKey),
  equipCosmetic: (slot: string, catalogKey: string | null) => api.mediWorld.equipCosmetic(slot, catalogKey),
  unlockCosmetic: (catalogKey: string, idempotencyKey: string) =>
    api.mediWorld.unlockCosmetic(catalogKey, idempotencyKey),
  adventureToday: () => api.mediWorld.adventureToday(),
  adventurePreferences: () => api.mediWorld.adventurePreferences(),
  updateAdventurePreferences: (body: Partial<AdventurePreferences>) =>
    api.mediWorld.updateAdventurePreferences(body),
  adventureChoice: (optionKey: 'a' | 'b') => api.mediWorld.adventureChoice(optionKey),
  adventureSwap: (slotKey: 'anchor' | 'balance', idempotencyKey: string) =>
    api.mediWorld.adventureSwap(slotKey, idempotencyKey),
  adventureRestDay: () => api.mediWorld.adventureRestDay(),
  exploreConfig: () => api.mediWorld.exploreConfig(),
  exploreArea: (coarseKey: string, locale?: 'ka' | 'en') => api.mediWorld.exploreArea(coarseKey, locale),
  exploreSparks: (coarseKey: string, locale?: 'ka' | 'en') => api.mediWorld.exploreSparks(coarseKey, locale),
  collectSpark: (
    spawnId: string,
    body: {
      idempotencyKey: string;
      latitude: number;
      longitude: number;
      horizontalAccuracy: number;
      locationTimestamp: string | number;
      mockLocation?: boolean;
      speedMps?: number;
    },
  ) => api.mediWorld.collectSpark(spawnId, body),
  exploreCollections: (query?: { take?: number; cursor?: string | null; locale?: 'ka' | 'en' }) =>
    api.mediWorld.exploreCollections(query),
  movementPreferences: () => api.mediWorld.movementPreferences(),
  updateMovementPreferences: (body: { movementMode: string; targetMinutes: number }) =>
    api.mediWorld.updateMovementPreferences(body),
  movementCurrent: () => api.mediWorld.movementCurrent(),
  startMovementSession: (body: Record<string, unknown>) => api.mediWorld.startMovementSession(body),
  submitMovementSegment: (id: string, body: Record<string, unknown>) => api.mediWorld.submitMovementSegment(id, body),
  pauseMovementSession: (id: string, idempotencyKey: string) => api.mediWorld.pauseMovementSession(id, idempotencyKey),
  resumeMovementSession: (id: string, body: Record<string, unknown>) => api.mediWorld.resumeMovementSession(id, body),
  finishMovementSession: (id: string, idempotencyKey: string) => api.mediWorld.finishMovementSession(id, idempotencyKey),
  abandonMovementSession: (id: string, idempotencyKey: string) => api.mediWorld.abandonMovementSession(id, idempotencyKey),
  movementHistory: (query?: { take?: number; cursor?: string | null }) => api.mediWorld.movementHistory(query),
  garden: () => api.mediWorld.garden(),
  gardenCatalog: () => api.mediWorld.gardenCatalog(),
  gardenPlant: (plotIndex: number, catalogKey: string, idempotencyKey: string) =>
    api.mediWorld.gardenPlant(plotIndex, catalogKey, idempotencyKey),
  gardenMove: (plantId: string, plotIndex: number, idempotencyKey: string) =>
    api.mediWorld.gardenMove(plantId, plotIndex, idempotencyKey),
  gardenStore: (plantId: string, idempotencyKey: string) => api.mediWorld.gardenStore(plantId, idempotencyKey),
  gardenRestore: (plantId: string, plotIndex: number, idempotencyKey: string) =>
    api.mediWorld.gardenRestore(plantId, plotIndex, idempotencyKey),
  gardenHistory: (query?: { take?: number; cursor?: string | null }) => api.mediWorld.gardenHistory(query),
};

export type {
  AdventurePreferences,
  AdventurePreferencesResponse,
  AdventureResponse,
  CompanionWorldState,
  ExploreAreaResponse,
  ExploreCollectResponse,
  ExploreCollectionsResponse,
  ExploreConfigResponse,
  MovementHistoryResponse,
  MovementPreferencesResponse,
  MovementSession,
  MovementSessionResponse,
  MediWorldLedgerItem,
  MediWorldProfileResponse,
};
