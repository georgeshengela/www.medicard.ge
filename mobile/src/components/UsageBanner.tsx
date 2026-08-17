import React from 'react';
import { Text, View } from 'react-native';
import { Crown, Sparkles, TriangleAlert } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { formatCountdown } from '@/lib/format';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

/**
 * Monthly AI quota strip. Handles FREE calendar month and paid 30-day subscriptions.
 */
export function UsageBanner({ compact = false }: { compact?: boolean }) {
  const { usage, user } = useAuth();
  const colors = useThemeColors();
  if (!usage) return null;

  const unlimited = usage.unlimited || usage.limit < 0;
  const exhausted = !unlimited && usage.remaining === 0;
  const packageCode = user?.package?.code ?? 'FREE';
  const pipCount = unlimited ? 0 : Math.min(Math.max(usage.limit, 0), 8);
  const prefix =
    usage.periodType === 'subscription' ? ka.usage.subscriptionPrefix : ka.usage.bannerPrefix;

  const label = exhausted
    ? ka.usage.exhaustedTitle
    : unlimited
      ? ka.usage.unlimitedBanner
      : `${prefix}: ${usage.remaining}/${usage.limit} ${ka.usage.queries}`;

  return (
    <View
      className={`flex-row items-center justify-between rounded-2xl border px-3.5 ${compact ? 'py-2' : 'py-3'} ${
        exhausted
          ? 'border-state-warning/25 bg-state-warningBg'
          : unlimited
            ? 'border-primary-200/30 bg-primary-200/10'
            : 'border-accent-200/50 bg-accent-100/25'
      }`}
    >
      <View className="flex-1 flex-row items-center">
        {exhausted ? (
          <TriangleAlert size={16} color={colors.warning} strokeWidth={2.2} />
        ) : unlimited ? (
          <Crown size={16} color={colors.primary200} strokeWidth={2.2} />
        ) : (
          <Sparkles size={16} color={colors.primary200} strokeWidth={2.2} />
        )}

        <View className="ml-2.5 flex-1">
          <Text
            numberOfLines={1}
            className={`text-sm font-semibold ${
              exhausted ? 'text-state-warning' : 'text-primary-100'
            }`}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            className={`mt-0.5 text-xs ${exhausted ? 'text-state-warning/80' : 'text-text-300'}`}
          >
            {exhausted
              ? `${ka.usage.resetsIn} ${formatCountdown(usage.resetsInMs)}`
              : `${ka.profile.planLabel}: ${packageCode}`}
          </Text>
        </View>
      </View>

      {pipCount > 0 ? (
        <View className="ml-3 flex-row">
          {Array.from({ length: pipCount }).map((_, index) => {
            const filled =
              usage.limit <= 8
                ? index < usage.remaining
                : index < Math.round((usage.remaining / usage.limit) * pipCount);
            return (
              <View
                key={index}
                className={`ml-1 h-2 w-2 rounded-full ${
                  filled ? 'bg-primary-200' : 'bg-primary-200/20'
                }`}
              />
            );
          })}
        </View>
      ) : unlimited ? (
        <View className="ml-3 rounded-full bg-primary-200/15 px-2.5 py-1">
          <Text className="text-[10px] font-bold text-primary-100">∞</Text>
        </View>
      ) : null}
    </View>
  );
}
