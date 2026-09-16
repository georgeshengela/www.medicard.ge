/**
 * Proposed (not legally mandated) retention for AiInteraction prompt/reply bodies.
 * Default: redact after 90 days, delete redacted rows after 365 days if they have
 * no eval results. Scripts default to dry-run. Do not wire this into API startup.
 */

export const AI_PROMPT_REDACTED = '[redacted]';

export function aiInteractionRetentionPolicy(env = process.env) {
  const redactAfterDays = Math.max(1, Number(env.AI_INTERACTION_REDACT_AFTER_DAYS || 90) || 90);
  const deleteAfterDays = Math.max(
    redactAfterDays,
    Number(env.AI_INTERACTION_DELETE_AFTER_DAYS || 365) || 365,
  );
  return { redactAfterDays, deleteAfterDays };
}

export function aiInteractionRetentionCutoffs(now = new Date(), policy = aiInteractionRetentionPolicy()) {
  const redactBefore = new Date(now.getTime() - policy.redactAfterDays * 24 * 60 * 60 * 1000);
  const deleteBefore = new Date(now.getTime() - policy.deleteAfterDays * 24 * 60 * 60 * 1000);
  return { redactBefore, deleteBefore };
}

export function shouldRedactAiInteraction(row, { redactBefore, deleteBefore }) {
  const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
  if (Number.isNaN(created.getTime()) || created >= redactBefore) return false;
  const prompt = row.userPrompt == null ? '' : String(row.userPrompt);
  const reply = row.assistantReply == null ? '' : String(row.assistantReply);
  if (!prompt && !reply) return false;
  if (prompt === AI_PROMPT_REDACTED && reply === AI_PROMPT_REDACTED) return false;
  return created < redactBefore;
}

export function shouldDeleteAiInteraction(row, { deleteBefore }) {
  const created = row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt);
  if (Number.isNaN(created.getTime()) || created >= deleteBefore) return false;
  if (row.evalResultCount > 0) return false;
  return true;
}

export async function runAiInteractionRetention(prisma, { dryRun = true, now = new Date(), limit = 500 } = {}) {
  const policy = aiInteractionRetentionPolicy();
  const cutoffs = aiInteractionRetentionCutoffs(now, policy);
  const take = Math.min(2000, Math.max(1, Number(limit) || 500));

  const redactCandidates = await prisma.aiInteraction.findMany({
    where: {
      createdAt: { lt: cutoffs.redactBefore },
      OR: [
        { userPrompt: { not: null } },
        { assistantReply: { not: null } },
      ],
    },
    select: { id: true, userPrompt: true, assistantReply: true, createdAt: true },
    take,
  });
  const redactIds = redactCandidates.filter((row) => shouldRedactAiInteraction(row, cutoffs)).map((row) => row.id);

  const deleteCandidates = await prisma.aiInteraction.findMany({
    where: { createdAt: { lt: cutoffs.deleteBefore } },
    select: { id: true, createdAt: true, _count: { select: { evalResults: true } } },
    take,
  });
  const deleteIds = deleteCandidates
    .filter((row) => shouldDeleteAiInteraction({ ...row, evalResultCount: row._count.evalResults }, cutoffs))
    .map((row) => row.id);

  let redacted = 0;
  let deleted = 0;
  if (!dryRun) {
    if (redactIds.length) {
      const updated = await prisma.aiInteraction.updateMany({
        where: { id: { in: redactIds } },
        data: { userPrompt: AI_PROMPT_REDACTED, assistantReply: AI_PROMPT_REDACTED },
      });
      redacted = updated.count;
    }
    if (deleteIds.length) {
      const removed = await prisma.aiInteraction.deleteMany({ where: { id: { in: deleteIds } } });
      deleted = removed.count;
    }
  }

  return {
    dryRun,
    policy,
    cutoffs,
    wouldRedact: redactIds.length,
    wouldDelete: deleteIds.length,
    redacted,
    deleted,
  };
}
