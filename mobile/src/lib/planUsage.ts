import { ka } from '@/i18n/ka';
import { formatDate, formatResetSentence } from '@/lib/format';
import type { Usage } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

export type PlanCode = 'FREE' | 'STANDARD' | 'ULTIMATE';

export function planMeta(code: PlanCode) {
  if (code === 'ULTIMATE') {
    return { title: ka.profile.ultimatePlan, detail: ka.profile.ultimatePlanDetail, accent: 'success' as const };
  }
  if (code === 'STANDARD') {
    return { title: ka.profile.standardPlan, detail: ka.profile.standardPlanDetail, accent: 'brand' as const };
  }
  return { title: ka.profile.freePlan, detail: ka.profile.freePlanDetail, accent: 'neutral' as const };
}

export type PlanUsageSnapshot = {
  code: PlanCode;
  meta: ReturnType<typeof planMeta>;
  usage: Usage | null;
  limit: number;
  unlimited: boolean;
  remaining: number | null;
  used: number;
  exhausted: boolean;
  progress: number;
  started: string | null;
  expires: string | null;
  expired: boolean;
  quotaLabel: string;
  resetLabel: string | null;
};

/** Same rule as server resolveConsumeLimit — daily cap, not the marketing monthly number. */
function consumeLimitFromPackage(pkg: { monthlyAiLimit?: number; dailyAiLimit?: number; unlimited?: boolean } | null | undefined) {
  if (!pkg) return 3;
  if (pkg.unlimited) return -1;
  const monthly = pkg.monthlyAiLimit;
  const daily = pkg.dailyAiLimit;
  if ((monthly != null && monthly < 0) || (daily != null && daily < 0)) return -1;
  if (daily != null && daily > 0) return daily;
  if (monthly != null && monthly > 0) return monthly;
  return 3;
}

export function buildPlanUsage(user: ReturnType<typeof useAuth>['user'], usage: Usage | null): PlanUsageSnapshot {
  const code = (user?.package?.code ?? 'FREE') as PlanCode;
  const meta = planMeta(code);
  const pkgLimit = consumeLimitFromPackage(user?.package ?? null);

  const unlimited = Boolean(
    usage?.unlimited || user?.package?.unlimited || (usage?.limit != null && usage.limit < 0) || pkgLimit < 0,
  );

  const limit = unlimited ? -1 : (usage && usage.limit >= 0 ? usage.limit : pkgLimit);
  const used = usage?.used ?? 0;
  const remaining = unlimited ? null : usage ? Math.max(0, usage.remaining) : limit;
  const exhausted = !unlimited && usage != null && (Boolean(usage.exceeded) || remaining === 0);
  const progress = unlimited ? 1 : limit > 0 ? Math.min(1, Math.max(0, (remaining ?? 0) / limit)) : 0;

  const started = user?.packageStartedAt ? formatDate(user.packageStartedAt) : null;
  const expires = user?.packageExpiresAt ? formatDate(user.packageExpiresAt) : null;
  const expired =
    Boolean(user?.packageExpiresAt && new Date(user.packageExpiresAt).getTime() < Date.now());

  const quotaLabel = exhausted
    ? ka.usage.exhaustedTitle
    : unlimited
      ? ka.usage.unlimitedBanner
      : ka.usage.remainingQueries(remaining ?? 0, limit);

  const resetLabel = exhausted
    ? usage?.resetAt
      ? formatResetSentence(usage.resetAt)
      : usage?.resetsInMs
        ? `${ka.usage.resetsIn} ${formatResetSentence(new Date(Date.now() + usage.resetsInMs).toISOString())}`
        : ka.usage.exhaustedBody
    : null;

  return {
    code,
    meta,
    usage,
    limit,
    unlimited,
    remaining,
    used,
    exhausted,
    progress,
    started,
    expires,
    expired,
    quotaLabel,
    resetLabel,
  };
}

export function usePlanUsage(): PlanUsageSnapshot {
  const { user, usage } = useAuth();
  return buildPlanUsage(user, usage);
}
