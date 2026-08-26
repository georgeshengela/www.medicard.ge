import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AssessmentResultCheckCircle,
  AssessmentResultChevronDown,
  AssessmentResultShare,
  HealthScoreConfidenceBadge,
  HealthScoreGauge,
} from '@/components/profile/HealthScoreGauge';
import { ProfileSetupPrimaryButton } from '@/components/profile/ProfileSetupButtons';
import { AVATAR_SOURCES, isAvatarId, normalizeAvatarForGender } from '@/constants/avatarAssets';
import { FIGMA_SHADOW_COLLAPSED } from '@/constants/assessmentResultAssets';
import {
  FIGMA_ASSESSMENT_RESULT,
  FIGMA_ASSESSMENT_RESULT_SHADOW,
  SCORE_RANGE_DOT_COLORS,
} from '@/constants/figmaAssessmentResultLayout';
import { ka } from '@/i18n/ka';
import { useOnboardingDevPreview, onboardingScreenBlocked } from '@/lib/onboardingDevPreview';
import { finishOnboarding } from '@/lib/profileSetupFlow';
import { useAuth } from '@/store/AuthContext';
import { analysisFromProfile, type OnboardingScoreRange } from '@/types/onboardingAnalysis';
import { welcomeTopInset } from '@/constants/figmaWelcomeLayout';

function SectionHeader({ title }: { title: string }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 4 }}>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: FIGMA_ASSESSMENT_RESULT.sectionTitleSize,
          lineHeight: FIGMA_ASSESSMENT_RESULT.sectionTitleLineHeight,
          color: FIGMA_ASSESSMENT_RESULT.titleColor,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

function ScoreRangeRow({
  range,
  dotColor,
  expanded,
  onToggle,
  grouped,
}: {
  range: OnboardingScoreRange;
  dotColor: string;
  expanded: boolean;
  onToggle: () => void;
  grouped?: boolean;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: FIGMA_ASSESSMENT_RESULT.rangeCardBg,
        borderWidth: grouped ? 0 : 1,
        borderColor: FIGMA_ASSESSMENT_RESULT.rangeCardBorder,
        borderRadius: grouped ? 0 : FIGMA_ASSESSMENT_RESULT.rangeCardRadius,
        ...(grouped ? {} : FIGMA_SHADOW_COLLAPSED),
        position: grouped ? 'relative' : undefined,
      }}
    >
      <View style={{ padding: 1 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: 'NotoSansGeorgian_600SemiBold',
          fontSize: 14,
          lineHeight: 20,
          color: '#1F2937',
        }}
      >
        {range.min} - {range.max}
      </Text>
      <Text
        style={{
          fontFamily: 'NotoSansGeorgian_400Regular',
          fontSize: 14,
          lineHeight: 20,
          color: '#1F2937',
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {range.labelKa}
      </Text>
      <View style={{ flexShrink: 0 }}>
        <AssessmentResultChevronDown rotated={expanded} />
      </View>
      {grouped ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            backgroundColor: FIGMA_ASSESSMENT_RESULT.rangeCardBorder,
          }}
        />
      ) : null}
    </Pressable>
  );
}

/** Assessment result — Figma 8845:313440 */
export default function ProfileSetupResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const preview = useOnboardingDevPreview();
  const { ready, user, healthProfile, setHealthProfile, setUser } = useAuth();

  const analysis = analysisFromProfile(healthProfile?.extraAnswers as Record<string, unknown> | undefined);

  const [expandedRange, setExpandedRange] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-bg-100">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user || !healthProfile) return <Redirect href="/(auth)/sign-in" />;
  const blocked = onboardingScreenBlocked(preview, user, healthProfile);
  if (blocked === 'assessment') return <Redirect href="/(auth)/assessment" />;
  if (blocked === 'home') return <Redirect href="/(tabs)/home" />;
  if (!analysis) {
    return (
      <Redirect
        href={preview ? '/(auth)/profile-setup/analyzing?preview=1' : '/(auth)/profile-setup/analyzing'}
      />
    );
  }

  const extra = (healthProfile.extraAnswers ?? {}) as Record<string, unknown>;
  const avatarId = normalizeAvatarForGender(typeof extra.avatarId === 'string' ? extra.avatarId : null, user.gender);
  const avatarSource = isAvatarId(avatarId) ? AVATAR_SOURCES[avatarId] : AVATAR_SOURCES['avatar-1'];
  const bc = analysis.bodyComposition;
  const dateLabel = new Date().toLocaleDateString('ka-GE', { month: 'short', day: 'numeric', year: 'numeric' });

  const finish = async () => {
    if (preview) {
      router.replace('/(tabs)/home');
      return;
    }
    setBusy(true);
    try {
      const result = await finishOnboarding(healthProfile, user);
      setHealthProfile(result.profile);
      setUser(result.user);
      router.replace('/(tabs)/home');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: welcomeTopInset(insets.top) }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Title — Figma py 24 px 16 */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 24 }}>
          <Text
            style={{
              fontFamily: 'NotoSansGeorgian_700Bold',
              fontSize: FIGMA_ASSESSMENT_RESULT.titleSize,
              lineHeight: FIGMA_ASSESSMENT_RESULT.titleLineHeight,
              color: FIGMA_ASSESSMENT_RESULT.titleColor,
              textAlign: 'center',
              letterSpacing: -0.25,
            }}
          >
            {ka.profileSetup.resultsTitle}
          </Text>
        </View>

        <HealthScoreGauge score={analysis.score} labelKa={analysis.labelKa} />

        {/* Confidence badge + summary — Figma 8845:313570 */}
        <View style={{ padding: 16, gap: 16, alignItems: 'center' }}>
          <HealthScoreConfidenceBadge confidence={analysis.confidence} />
          <View style={{ gap: 12, width: '100%' }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: FIGMA_ASSESSMENT_RESULT.summaryTitleSize,
                lineHeight: FIGMA_ASSESSMENT_RESULT.summaryTitleLineHeight,
                color: FIGMA_ASSESSMENT_RESULT.titleColor,
                textAlign: 'center',
                letterSpacing: -0.25,
              }}
            >
              {analysis.summaryTitleKa}
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: FIGMA_ASSESSMENT_RESULT.summaryBodySize,
                lineHeight: FIGMA_ASSESSMENT_RESULT.summaryBodyLineHeight,
                color: FIGMA_ASSESSMENT_RESULT.labelColor,
                textAlign: 'center',
              }}
            >
              {analysis.summaryBodyKa}
            </Text>
          </View>
        </View>

        {/* Score Range */}
        <View style={{ paddingVertical: 8 }}>
          <SectionHeader title={ka.profileSetup.scoreRange} />
          <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 8 }}>
            {analysis.scoreRanges.map((range, idx) => {
              const dotColor = SCORE_RANGE_DOT_COLORS[idx] ?? range.color;
              const open = expandedRange === idx;

              if (open) {
                return (
                  <View
                    key={`${range.min}-${range.max}`}
                    style={{
                      borderRadius: FIGMA_ASSESSMENT_RESULT.rangeGroupRadius,
                      borderWidth: 1,
                      borderColor: FIGMA_ASSESSMENT_RESULT.rangeCardBorder,
                      backgroundColor: '#FFFFFF',
                      overflow: 'hidden',
                      ...FIGMA_ASSESSMENT_RESULT_SHADOW,
                    }}
                  >
                    <ScoreRangeRow
                      range={range}
                      dotColor={dotColor}
                      expanded
                      grouped
                      onToggle={() => setExpandedRange(null)}
                    />
                    <View
                      style={{
                        marginTop: -1,
                        backgroundColor: FIGMA_ASSESSMENT_RESULT.rangeCardBg,
                        borderTopWidth: 1,
                        borderTopColor: FIGMA_ASSESSMENT_RESULT.rangeCardBorder,
                        padding: 16,
                        borderBottomLeftRadius: FIGMA_ASSESSMENT_RESULT.rangeGroupRadius,
                        borderBottomRightRadius: FIGMA_ASSESSMENT_RESULT.rangeGroupRadius,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_400Regular',
                          fontSize: 14,
                          lineHeight: 22,
                          color: FIGMA_ASSESSMENT_RESULT.labelColor,
                        }}
                      >
                        {range.detailKa}
                      </Text>
                    </View>
                  </View>
                );
              }

              return (
                <ScoreRangeRow
                  key={`${range.min}-${range.max}`}
                  range={range}
                  dotColor={dotColor}
                  expanded={false}
                  onToggle={() => setExpandedRange(idx)}
                />
              );
            })}
          </View>
        </View>

        {/* Body Composition */}
        <View style={{ paddingVertical: 8 }}>
          <SectionHeader title={ka.profileSetup.bodyComposition} />
          <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
            <View
              style={{
                backgroundColor: FIGMA_ASSESSMENT_RESULT.bodyCardBg,
                borderRadius: FIGMA_ASSESSMENT_RESULT.bodyCardRadius,
                borderWidth: 1,
                borderColor: FIGMA_ASSESSMENT_RESULT.rangeCardBorder,
                overflow: 'hidden',
                ...FIGMA_ASSESSMENT_RESULT_SHADOW,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  padding: 16,
                }}
              >
                <Image
                  source={avatarSource}
                  style={{ width: 48, height: 48, borderRadius: 8 }}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_500Medium',
                      fontSize: 14,
                      lineHeight: 20,
                      color: FIGMA_ASSESSMENT_RESULT.labelColor,
                    }}
                  >
                    {dateLabel}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <AssessmentResultCheckCircle />
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_600SemiBold',
                        fontSize: 16,
                        lineHeight: 22,
                        color: FIGMA_ASSESSMENT_RESULT.physiqueColor,
                      }}
                    >
                      {bc.physiqueLabelKa}
                    </Text>
                  </View>
                </View>
                <AssessmentResultShare />
              </View>

              <View style={{ height: 1, backgroundColor: FIGMA_ASSESSMENT_RESULT.rangeCardBorder, marginHorizontal: 16 }} />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  minHeight: 78,
                  gap: 16,
                }}
              >
                {[
                  { label: ka.profileSetup.metricFat, value: `${bc.fatPct}%` },
                  { label: ka.profileSetup.metricWeight, value: `${bc.weightKg}kg` },
                  { label: ka.profileSetup.metricMuscle, value: `${bc.musclePct}%` },
                ].map((m) => (
                  <View key={m.label} style={{ flex: 1, gap: 6 }}>
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_500Medium',
                        fontSize: 14,
                        lineHeight: 20,
                        color: FIGMA_ASSESSMENT_RESULT.labelColor,
                      }}
                    >
                      {m.label}
                    </Text>
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_600SemiBold',
                        fontSize: 20,
                        lineHeight: 28,
                        color: FIGMA_ASSESSMENT_RESULT.titleColor,
                        letterSpacing: -0.25,
                      }}
                    >
                      {m.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Footer — Figma 8845:313449 px 16 py 24 gap 24 */}
      <View
        style={{
          width: '100%',
          paddingHorizontal: 16,
          paddingTop: 24,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <ProfileSetupPrimaryButton
          label={ka.profileSetup.startUsingApp}
          onPress={() => void finish()}
          loading={busy}
          icon="check"
        />
      </View>
    </View>
  );
}
