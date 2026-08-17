import { prisma } from './prisma.js';
import { PROMPT_VERSION } from './prompts.js';

const MAX_SNIPPET = 2000;

export function truncateSnippet(text, max = MAX_SNIPPET) {
  if (!text) return null;
  const value = String(text).trim();
  if (!value) return null;
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * Persist one AI call for admin quality review and automated eval runs.
 */
export async function logAiInteraction({
  userId,
  mode,
  status = 'OK',
  errorMessage = null,
  chatSessionId = null,
  medicalRecordId = null,
  userPrompt = null,
  assistantReply = null,
  visionProvider = null,
  visionModel = null,
  reasoningModel = null,
  latencyMs = null,
  tokenUsage = null,
}) {
  return prisma.aiInteraction.create({
    data: {
      userId,
      mode,
      status,
      errorMessage: errorMessage ? truncateSnippet(errorMessage, 500) : null,
      promptVersion: PROMPT_VERSION,
      chatSessionId,
      medicalRecordId,
      userPrompt: truncateSnippet(userPrompt),
      assistantReply: truncateSnippet(assistantReply),
      visionProvider,
      visionModel,
      reasoningModel,
      latencyMs,
      tokenUsage: tokenUsage ?? undefined,
    },
  });
}

/**
 * Wrap an AI engine call with timing, error capture, and interaction logging.
 */
export async function runTrackedAi({
  userId,
  mode,
  chatSessionId = null,
  medicalRecordId = null,
  userPrompt = null,
  visionProvider = null,
  visionModel = null,
  fn,
}) {
  const started = Date.now();
  try {
    const result = await fn();
    const interaction = await logAiInteraction({
      userId,
      mode,
      chatSessionId,
      medicalRecordId,
      userPrompt,
      assistantReply: result.content,
      visionProvider,
      visionModel,
      reasoningModel: result.model ?? null,
      latencyMs: Date.now() - started,
      tokenUsage: result.usage ?? null,
    });
    return { ...result, interactionId: interaction.id };
  } catch (error) {
    await logAiInteraction({
      userId,
      mode,
      status: 'ERROR',
      errorMessage: error?.message ?? 'Unknown AI error',
      chatSessionId,
      medicalRecordId,
      userPrompt,
      visionProvider,
      visionModel,
      latencyMs: Date.now() - started,
    });
    throw error;
  }
}

export async function getAiQualityStats() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    last24h,
    last7d,
    errors24h,
    byMode,
    feedbackAgg,
    lastEval,
    avgLatency,
  ] = await Promise.all([
    prisma.aiInteraction.count(),
    prisma.aiInteraction.count({ where: { createdAt: { gte: since24h } } }),
    prisma.aiInteraction.count({ where: { createdAt: { gte: since7d } } }),
    prisma.aiInteraction.count({ where: { createdAt: { gte: since24h }, status: 'ERROR' } }),
    prisma.aiInteraction.groupBy({
      by: ['mode'],
      where: { createdAt: { gte: since7d } },
      _count: true,
    }),
    prisma.aiFeedback.groupBy({
      by: ['rating'],
      _count: true,
    }),
    prisma.aiEvalRun.findFirst({ where: { status: 'DONE' }, orderBy: { finishedAt: 'desc' } }),
    prisma.aiInteraction.aggregate({
      where: { createdAt: { gte: since7d }, status: 'OK', latencyMs: { not: null } },
      _avg: { latencyMs: true },
    }),
  ]);

  const feedback = { up: 0, down: 0 };
  for (const row of feedbackAgg) {
    if (row.rating > 0) feedback.up += row._count;
    else feedback.down += row._count;
  }

  return {
    total,
    last24h,
    last7d,
    errors24h,
    errorRate24h: last24h ? Math.round((errors24h / last24h) * 100) : 0,
    byMode: byMode
      .map((row) => ({ mode: row.mode, count: row._count }))
      .sort((a, b) => b.count - a.count),
    feedback,
    promptVersion: PROMPT_VERSION,
    avgLatencyMs: Math.round(avgLatency._avg.latencyMs ?? 0),
    lastEval: lastEval
      ? {
          id: lastEval.id,
          avgScore: lastEval.avgScore,
          lowScoreCount: lastEval.lowScoreCount,
          sampleSize: lastEval.sampleSize,
          finishedAt: lastEval.finishedAt,
          summary: lastEval.summary,
        }
      : null,
  };
}
