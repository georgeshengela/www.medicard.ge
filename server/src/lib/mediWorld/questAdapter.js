import { QUEST_TEMPLATE_ADAPTERS, adapterById } from './contract.js';
import { isMediWorldEnabled } from './flags.js';
import { isPrismaMissing, processWorldActivityInTx, reportWorldSchemaMissing } from './engine.js';

function questIdempotencyKey(userQuestId) {
  return `quest-completion:${userQuestId}`;
}

export function worldAdapterFromQuest(quest) {
  const key = quest?.template?.key || quest?.templateKey;
  const adapterId = QUEST_TEMPLATE_ADAPTERS[key];
  if (!adapterId) return null;
  const adapter = adapterById(adapterId);
  if (!adapter) return null;
  return { adapterId, energyType: adapter.energyType };
}

/**
 * Narrow Quest → Medi World boundary. Called inside completeQuestInTx after a
 * new QuestCompletion row. Historical completions never enter this function.
 */
export async function applyQuestCompletionToMediWorld(tx, userId, quest, options = {}) {
  if (!isMediWorldEnabled(options.flags)) return null;
  if (typeof tx?.mediWorldLedger?.create !== 'function') {
    reportWorldSchemaMissing('quest_completion');
    return null;
  }
  const mapped = worldAdapterFromQuest(quest);
  if (!mapped) return null;

  const target = Math.max(0, Math.floor(Number(quest.target) || 0));
  const progress = Math.max(0, Math.floor(Number(quest.progress) || 0));
  if (target <= 0) return null;

  try {
    return await processWorldActivityInTx(
      tx,
      userId,
      {
        sourceType: 'QUEST_COMPLETION',
        sourceId: quest.id,
        idempotencyKey: questIdempotencyKey(quest.id),
        adapterId: mapped.adapterId,
        energyType: mapped.energyType,
        progressState: 'verified',
        personalTarget: target,
        completedAmount: progress,
        metadata: {
          templateKey: quest.template?.key || quest.templateKey || null,
          periodKey: quest.periodKey || null,
          cadence: quest.template?.cadence || quest.cadence || null,
        },
      },
      options,
    );
  } catch (error) {
    if (isPrismaMissing(error) || error?.code === 'WORLD_UNAVAILABLE') {
      reportWorldSchemaMissing('quest_completion', error);
      return null;
    }
    throw error;
  }
}
