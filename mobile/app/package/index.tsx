import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { ArrowLeft, ArrowRight, Check, Crown } from 'lucide-react-native';
import { useFigmaPlans } from '@/constants/figmaPlansLayout';
import { PackagePageSkeleton } from '@/components/ui/Skeleton';
import { ka } from '@/i18n/ka';
import { api, type UserPackage } from '@/lib/api';
import { usePlanUsage, type PlanCode } from '@/lib/planUsage';
import { useAuth } from '@/store/AuthContext';

const FEATURE_ORDER = [
  'doctorChat',
  'consilium',
  'labAnalysis',
  'imaging',
  'skin',
  'skincare',
  'medicationReview',
  'prioritySupport',
] as const;

function PlanCheckbox({ checked }: { checked: boolean }) {
  const FIGMA_PLANS = useFigmaPlans();
  if (!checked) {
    return (
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: FIGMA_PLANS.borderTertiary,
          backgroundColor: FIGMA_PLANS.pageBg,
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        backgroundColor: FIGMA_PLANS.brand,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
      }}
    >
      <Svg width={16} height={16} viewBox="0 0 12 12">
        <Path
          d="M10.1113 2.88867C10.3775 3.15488 10.3775 3.586 10.1113 3.85221L4.88867 9.07487C4.62246 9.34108 4.19134 9.34108 3.92513 9.07487L1.88867 7.03841C1.62246 6.7722 1.62246 6.34108 1.88867 6.07487C2.15488 5.80866 2.58599 5.80866 2.85221 6.07487L4.4069 7.62955L9.14779 2.88867C9.414 2.62246 9.84512 2.62246 10.1113 2.88867Z"
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  );
}

function formatAiLimit(pkg: UserPackage): string {
  if (pkg.unlimited || pkg.monthlyAiLimit < 0) return ka.plans.unlimited;
  return `${pkg.monthlyAiLimit} ${ka.usage.queries}`;
}

function formatPrice(pkg: UserPackage): string {
  if (pkg.priceGel <= 0) return ka.plans.freePrice;
  return `${pkg.priceGel.toFixed(2)} ${ka.plans.gel}`;
}

function featureLabel(key: string): string {
  return ka.plans.featureLabels[key] ?? key;
}

function enabledFeatures(pkg: UserPackage): string[] {
  const features = pkg.features ?? {};
  return FEATURE_ORDER.filter((key) => features[key]).map(featureLabel);
}

/** Figma 8846:137103 — package details & upgrade. */
export default function PackageScreen() {
  const FIGMA_PLANS = useFigmaPlans();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const usageData = usePlanUsage();

  const [packages, setPackages] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCode, setSelectedCode] = useState<PlanCode>(usageData.code);
  const [annual, setAnnual] = useState(false);

  const currentCode = (user?.package?.code ?? 'FREE') as PlanCode;

  const loadPackages = useCallback(async () => {
    setLoading(true);
    try {
      const version = Constants.expoConfig?.version ?? '1.0.0';
      const status = await api.app.status(version);
      const list = (status.packages ?? []).filter((pkg) => pkg.code !== 'FREE' || pkg.priceGel === 0);
      if (list.length) {
        setPackages(list);
      } else if (user?.package) {
        setPackages([user.package]);
      }
    } catch {
      if (user?.package) setPackages([user.package]);
    } finally {
      setLoading(false);
    }
  }, [user?.package]);

  useEffect(() => {
    void loadPackages();
  }, [loadPackages]);

  useEffect(() => {
    setSelectedCode(currentCode);
  }, [currentCode]);

  const sortedPackages = useMemo(
    () => [...packages].sort((a, b) => (a.monthlyAiLimit < 0 ? 9999 : a.monthlyAiLimit) - (b.monthlyAiLimit < 0 ? 9999 : b.monthlyAiLimit)),
    [packages],
  );

  const selectedPackage = sortedPackages.find((pkg) => pkg.code === selectedCode) ?? sortedPackages[0];
  const bestValueCode: PlanCode = 'ULTIMATE';

  const onUpgrade = () => {
    if (selectedCode === currentCode) {
      Alert.alert(ka.plans.selectedPlan, ka.profile.planActive);
      return;
    }
    Alert.alert(ka.usage.upsellTitle, ka.usage.premiumSoon);
  };

  const progressTone = usageData.exhausted
    ? FIGMA_PLANS.warning
    : usageData.unlimited
      ? '#22C55E'
      : FIGMA_PLANS.brand;

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA_PLANS.pageBg, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          hitSlop={12}
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: FIGMA_PLANS.cardBg,
            borderWidth: 1,
            borderColor: FIGMA_PLANS.border,
          }}
        >
          <ArrowLeft size={20} color={FIGMA_PLANS.textPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      {loading ? (
        <PackagePageSkeleton />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {/* Current usage */}
          {usageData.usage ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <View
                style={{
                  backgroundColor: FIGMA_PLANS.brandQuaternary,
                  borderRadius: FIGMA_PLANS.cardRadius,
                  borderWidth: 1,
                  borderColor: '#99F6E4',
                  padding: 16,
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 12,
                    lineHeight: 16,
                    letterSpacing: 1,
                    color: FIGMA_PLANS.textSecondary,
                    textTransform: 'uppercase',
                  }}
                >
                  {ka.plans.usageTitle}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 28,
                      lineHeight: 34,
                      color: usageData.exhausted ? FIGMA_PLANS.warning : FIGMA_PLANS.brand,
                    }}
                  >
                    {usageData.unlimited
                      ? ka.plans.unlimited
                      : usageData.exhausted
                        ? ka.usage.exhaustedTitle
                        : ka.usage.remainingQueries(usageData.remaining ?? 0, usageData.limit)}
                  </Text>
                  <View
                    style={{
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      backgroundColor: FIGMA_PLANS.pageBg,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'NotoSansGeorgian_700Bold',
                        fontSize: 11,
                        color: FIGMA_PLANS.textSecondary,
                      }}
                    >
                      {currentCode}
                    </Text>
                  </View>
                </View>
                {!usageData.unlimited ? (
                  <View
                    style={{
                      height: 8,
                      borderRadius: 999,
                      backgroundColor: FIGMA_PLANS.border,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        width: `${Math.round(usageData.progress * 100)}%`,
                        height: '100%',
                        borderRadius: 999,
                        backgroundColor: progressTone,
                      }}
                    />
                  </View>
                ) : null}
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 13,
                    lineHeight: 18,
                    color: FIGMA_PLANS.textSecondary,
                  }}
                >
                  {usageData.exhausted
                    ? usageData.resetLabel
                    : ka.plans.billingNote}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 24, alignItems: 'center' }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 30,
                lineHeight: 38,
                color: FIGMA_PLANS.textPrimary,
                textAlign: 'center',
                letterSpacing: -0.25,
              }}
            >
              {ka.plans.title}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 16,
                  color: !annual ? FIGMA_PLANS.textPrimary : FIGMA_PLANS.textSecondary,
                }}
              >
                {ka.plans.monthly}
              </Text>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: annual }}
                onPress={() => setAnnual((v) => !v)}
                style={{
                  width: 52,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: annual ? FIGMA_PLANS.brand : FIGMA_PLANS.border,
                  padding: 2,
                  justifyContent: 'center',
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: '#FFFFFF',
                    alignSelf: annual ? 'flex-end' : 'flex-start',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                />
              </Pressable>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 16,
                  color: annual ? FIGMA_PLANS.textPrimary : FIGMA_PLANS.textSecondary,
                }}
              >
                {ka.plans.annually}
              </Text>
              {!annual ? (
                <View
                  style={{
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    backgroundColor: FIGMA_PLANS.cardBg,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_500Medium',
                      fontSize: 11,
                      color: FIGMA_PLANS.textSecondary,
                    }}
                  >
                    {ka.plans.annuallySoon}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}>
            {sortedPackages.map((pkg) => {
              const selected = selectedCode === pkg.code;
              const isCurrent = currentCode === pkg.code;
              const isBest = pkg.code === bestValueCode;

              return (
                <Pressable
                  key={pkg.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedCode(pkg.code as PlanCode)}
                  style={{
                    backgroundColor: selected ? FIGMA_PLANS.brandQuaternary : FIGMA_PLANS.cardBg,
                    borderRadius: FIGMA_PLANS.cardRadius,
                    borderWidth: 1,
                    borderColor: selected ? FIGMA_PLANS.brand : FIGMA_PLANS.border,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 16,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                >
                  {isBest ? (
                    <View
                      style={{
                        position: 'absolute',
                        top: -14,
                        right: 28,
                        backgroundColor: FIGMA_PLANS.badgeBg,
                        borderRadius: 10,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.08,
                        shadowRadius: 3,
                        elevation: 2,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_500Medium',
                          fontSize: 14,
                          color: '#FFFFFF',
                        }}
                      >
                        {ka.plans.bestValue}
                      </Text>
                    </View>
                  ) : null}

                  <View style={{ flex: 1, gap: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_700Bold',
                          fontSize: 12,
                          lineHeight: 16,
                          letterSpacing: 1,
                          color: FIGMA_PLANS.textSecondary,
                          textTransform: 'uppercase',
                        }}
                      >
                        {pkg.nameKa}
                      </Text>
                      {isCurrent ? (
                        <View
                          style={{
                            borderRadius: 999,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            backgroundColor: FIGMA_PLANS.pageBg,
                            borderWidth: 1,
                            borderColor: FIGMA_PLANS.border,
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: 'NotoSansGeorgian_600SemiBold',
                              fontSize: 10,
                              color: FIGMA_PLANS.brand,
                            }}
                          >
                            {ka.plans.currentPlan}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={{ gap: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
                        <Text
                          style={{
                            fontFamily: 'NotoSansGeorgian_700Bold',
                            fontSize: 24,
                            lineHeight: 32,
                            color: FIGMA_PLANS.textPrimary,
                            letterSpacing: -0.25,
                          }}
                        >
                          {formatPrice(pkg)}
                        </Text>
                        {pkg.priceGel > 0 ? (
                          <Text
                            style={{
                              fontFamily: 'NotoSansGeorgian_400Regular',
                              fontSize: 14,
                              lineHeight: 20,
                              color: FIGMA_PLANS.textSecondary,
                              paddingBottom: 2,
                            }}
                          >
                            {ka.plans.perMonth}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_400Regular',
                          fontSize: 14,
                          lineHeight: 20,
                          color: FIGMA_PLANS.textSecondary,
                        }}
                      >
                        {pkg.descriptionKa}
                      </Text>
                      <Text
                        style={{
                          fontFamily: 'NotoSansGeorgian_600SemiBold',
                          fontSize: 13,
                          color: FIGMA_PLANS.brand,
                        }}
                      >
                        {formatAiLimit(pkg)} · {ka.profile.billingMonthly}
                      </Text>
                    </View>
                  </View>

                  <PlanCheckbox checked={selected} />
                </Pressable>
              );
            })}
          </View>

          {/* Feature comparison */}
          {selectedPackage ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 16,
                  color: FIGMA_PLANS.textPrimary,
                }}
              >
                {ka.plans.includesTitle} — {selectedPackage.nameKa}
              </Text>
              {enabledFeatures(selectedPackage).map((label) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: FIGMA_PLANS.brandQuaternary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Check size={14} color={FIGMA_PLANS.brand} strokeWidth={2.5} />
                  </View>
                  <Text
                    style={{
                      flex: 1,
                      fontFamily: 'NotoSansGeorgian_400Regular',
                      fontSize: 15,
                      lineHeight: 22,
                      color: FIGMA_PLANS.textPrimary,
                    }}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={{ paddingHorizontal: 16, paddingTop: 24, gap: 24 }}>
            <Pressable
              accessibilityRole="button"
              onPress={onUpgrade}
              style={{
                minHeight: 48,
                borderRadius: 16,
                backgroundColor: FIGMA_PLANS.brand,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                paddingHorizontal: 20,
                paddingVertical: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              {selectedCode === 'ULTIMATE' ? (
                <Crown size={20} color="#FFFFFF" strokeWidth={2.2} />
              ) : null}
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 16,
                  color: '#FFFFFF',
                }}
              >
                {selectedCode === currentCode ? ka.plans.currentPlan : ka.plans.upgradeCta}
              </Text>
              <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.2} />
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/profile/privacy')}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 16,
                    color: FIGMA_PLANS.brand,
                  }}
                >
                  {ka.plans.privacyPolicy}
                </Text>
              </Pressable>
              <View
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: FIGMA_PLANS.border,
                }}
              />
              <Pressable accessibilityRole="button" onPress={() => router.push('/profile/terms')}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 16,
                    color: FIGMA_PLANS.brand,
                  }}
                >
                  {ka.plans.terms}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
