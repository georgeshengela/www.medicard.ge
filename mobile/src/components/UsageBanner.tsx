import React from 'react';
import { Text, View } from 'react-native';
import { Sparkles, TriangleAlert } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { formatCountdown } from '@/lib/format';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

/**
 * Persistent free-tier counter. Renders as three pips so the remaining quota is
 * readable at a glance without parsing the number.
 */
export function UsageBanner({ compact = false }: { compact?: boolean }) {
  const { usage } = useAuth();
  const colors = useThemeColors();
  if (!usage) return null;

  const exhausted = usage.remaining === 0;

  return (
    <View
      className={`flex-row items-center justify-between rounded-2xl border px-3.5 ${compact ? 'py-2' : 'py-3'} ${
        exhausted ? 'border-state-warning/25 bg-state-warningBg' : 'border-accent-200/50 bg-accent-100/25'
      }`}
    >
      <View className="flex-1 flex-row items-center">
        {exhausted ? (
          <TriangleAlert size={16} color={colors.warning} strokeWidth={2.2} />
        ) : (
          <Sparkles size={16} color={colors.primary200} strokeWidth={2.2} />
        )}

        <View className="ml-2.5 flex-1">
          <Text
            numberOfLines={1}
            className={`text-sm font-semibold ${exhausted ? 'text-state-warning' : 'text-primary-100'}`}
          >
            {exhausted
              ? ka.usage.exhaustedTitle
              : `${ka.usage.bannerPrefix}: ${usage.remaining}/${usage.limit} ${ka.usage.freeQueries}`}
          </Text>
          {exhausted ? (
            <Text className="text-xs text-state-warning/80">
              {ka.usage.resetsIn} {formatCountdown(usage.resetsInMs)}
            </Text>
          ) : null}
        </View>
      </View>

      <View className="ml-3 flex-row">
        {Array.from({ length: usage.limit }).map((_, index) => (
          <View
            key={index}
            className={`ml-1 h-2 w-2 rounded-full ${index < usage.remaining ? 'bg-primary-200' : 'bg-primary-200/20'}`}
          />
        ))}
      </View>
    </View>
  );
}
