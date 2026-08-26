import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Crown, Sparkles, TriangleAlert, Zap } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { ka } from '@/i18n/ka';
import { formatCountdown } from '@/lib/format';
import { usePlanUsage, type PlanCode } from '@/lib/planUsage';
import { useThemeColors, type Palette } from '@/theme/colors';

function ProgressBar({
  progress,
  tone,
  colors,
}: {
  progress: number;
  tone: 'default' | 'warning' | 'success';
  colors: Palette;
}) {
  const fill =
    tone === 'warning' ? colors.warning : tone === 'success' ? colors.success : colors.primary200;

  return (
    <View
      style={{
        height: 6,
        borderRadius: 999,
        backgroundColor: colors.bg300,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.round(progress * 100)}%`,
          height: '100%',
          borderRadius: 999,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}

function PlanPill({ code, colors }: { code: PlanCode; colors: Palette }) {
  const styles: Record<PlanCode, { bg: string; text: string }> = {
    FREE: { bg: colors.bg200, text: colors.text200 },
    STANDARD: { bg: `${colors.primary200}18`, text: colors.primary100 },
    ULTIMATE: { bg: colors.successBg, text: colors.success },
  };
  const style = styles[code];

  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: style.bg,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: style.text }}>{code}</Text>
    </View>
  );
}

/** Compact strip for home. */
export function UsageBanner({ compact = false }: { compact?: boolean }) {
  const colors = useThemeColors();
  const data = usePlanUsage();
  if (!data.usage) return null;

  const { code, unlimited, remaining, limit, exhausted, progress, usage } = data;
  const tone = exhausted ? 'warning' : unlimited ? 'success' : 'default';

  const quotaLabelCompact = exhausted
    ? ka.usage.exhaustedTitle
    : unlimited
      ? ka.usage.unlimitedBanner
      : `${remaining} / ${limit} ${ka.usage.queries}`;

  return (
    <View
      className="border border-bg-300 bg-surface"
      style={{ borderRadius: 18, paddingHorizontal: 14, paddingTop: compact ? 10 : 12, paddingBottom: compact ? 10 : 14 }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          {exhausted ? (
            <TriangleAlert size={15} color={colors.warning} strokeWidth={2.2} />
          ) : unlimited ? (
            <Crown size={15} color={colors.success} strokeWidth={2.2} />
          ) : (
            <Sparkles size={15} color={colors.primary200} strokeWidth={2.2} />
          )}
          <Text className="ml-2 text-[13px] font-bold text-text-100">{quotaLabelCompact}</Text>
        </View>
        <PlanPill code={code} colors={colors} />
      </View>

      <View className={compact ? 'mt-2' : 'mt-2.5'}>
        <ProgressBar progress={progress} tone={tone} colors={colors} />
      </View>

      <Text className="mt-2 text-[11px] leading-4 text-text-300">
        {exhausted
          ? `${ka.usage.resetsIn} ${formatCountdown(usage!.resetsInMs)}`
          : `${ka.profile.planLabel} · ${code}`}
      </Text>
    </View>
  );
}

/** Full plan card for profile. */
export function PlanDetailCard() {
  const colors = useThemeColors();
  const data = usePlanUsage();
  if (!data.usage) return null;

  const { code, meta, unlimited, remaining, limit, exhausted, progress, started, expires, expired, usage } =
    data;
  const tone = exhausted ? 'warning' : unlimited ? 'success' : 'default';

  return (
    <Card padded={false}>
      <View className="p-4">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <View className="flex-row items-center">
              <View
                className="mr-2.5 h-9 w-9 items-center justify-center"
                style={{
                  borderRadius: 999,
                  backgroundColor: unlimited ? colors.successBg : `${colors.primary200}14`,
                }}
              >
                {unlimited ? (
                  <Crown size={17} color={colors.success} strokeWidth={2.1} />
                ) : (
                  <Zap size={17} color={colors.primary200} strokeWidth={2.1} />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-text-100">{meta.title}</Text>
                <Text className="mt-0.5 text-xs text-text-300">{meta.detail}</Text>
              </View>
            </View>
          </View>
          <PlanPill code={code} colors={colors} />
        </View>

        <View className="mt-4">
          <View className="mb-1.5 flex-row items-baseline justify-between">
            <Text className="text-[11px] font-bold uppercase tracking-wide text-text-300">AI</Text>
            <Text className="text-sm font-bold text-text-100">
              {exhausted
                ? ka.usage.exhaustedTitle
                : unlimited
                  ? `∞ ${ka.usage.perMonth}`
                  : `${remaining} / ${limit}`}
            </Text>
          </View>
          <ProgressBar progress={progress} tone={tone} colors={colors} />
          <Text className="mt-1.5 text-[11px] text-text-300">
            {exhausted
              ? `${ka.usage.resetsIn} ${formatCountdown(usage!.resetsInMs)}`
              : ka.profile.billingMonthly}
          </Text>
        </View>

        {started || expires ? (
          <View className="mt-3 flex-row flex-wrap">
            {started && code !== 'FREE' ? (
              <View style={{ marginRight: 8, marginBottom: 8 }}>
                <MetaChip label={`${ka.profile.planStarted}: ${started}`} colors={colors} />
              </View>
            ) : null}
            {expires ? (
              <View style={{ marginRight: 8, marginBottom: 8 }}>
                <MetaChip
                  label={`${ka.profile.planExpires}: ${expires}`}
                  colors={colors}
                  warn={expired}
                />
              </View>
            ) : null}
            {expired ? (
              <View style={{ marginBottom: 8 }}>
                <MetaChip label={ka.profile.planExpired} colors={colors} warn />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {code === 'FREE' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert(ka.usage.upsellTitle, ka.usage.premiumSoon)}
          className="mx-4 mb-4 flex-row items-center justify-center active:opacity-85"
          style={{
            borderRadius: 999,
            backgroundColor: colors.primary200,
            paddingVertical: 12,
            paddingHorizontal: 16,
          }}
        >
          <Crown size={16} color={colors.onPrimary} strokeWidth={2.2} />
          <Text className="ml-2 text-sm font-bold text-white">{ka.usage.upsellCta}</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function MetaChip({
  label,
  colors,
  warn = false,
}: {
  label: string;
  colors: Palette;
  warn?: boolean;
}) {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        backgroundColor: warn ? colors.warningBg : colors.bg200,
      }}
    >
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          color: warn ? colors.warning : colors.text300,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
