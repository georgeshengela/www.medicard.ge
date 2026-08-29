import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Minus, Plus, X } from 'lucide-react-native';
import { WeightRulerPicker } from '@/components/assessment/WeightRulerPicker';
import { Button } from '@/components/ui/Button';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { useFigmaHomeDashboard } from '@/constants/figmaHomeDashboardLayout';
import { ka } from '@/i18n/ka';
import { BMI_ZONE_COLORS, bmiCategory, bmiFromWeight } from '@/lib/bmi';
import { logManualHealthMetric } from '@/lib/logManualHealthMetric';
import type { HealthProfile } from '@/lib/api';

const WEIGHT_KG = Array.from({ length: 171 }, (_, i) => 30 + i);
const MIN_KG = 30;
const MAX_KG = 200;

type Props = {
  visible: boolean;
  profile: HealthProfile | null | undefined;
  initialKg: number;
  onClose: () => void;
  onSaved: () => void;
};

function clampKg(value: number) {
  return Math.min(MAX_KG, Math.max(MIN_KG, Math.round(value * 10) / 10));
}

function ModalRoot({ children }: { children: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1 }}>{children}</View>;
  }
  return <GestureHandlerRootView style={{ flex: 1 }}>{children}</GestureHandlerRootView>;
}

export function HomeWeightLogSheet({ visible, profile, initialKg, onClose, onSaved }: Props) {
  const FIGMA_HOME_DASHBOARD = useFigmaHomeDashboard();
  const insets = useSafeAreaInsets();
  const [kg, setKg] = useState(clampKg(initialKg));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setKg(clampKg(initialKg));
    setError(null);
    setSaving(false);
  }, [initialKg, visible]);

  const liveBmi = useMemo(() => bmiFromWeight(kg, profile?.heightCm), [kg, profile?.heightCm]);
  const category = liveBmi != null ? bmiCategory(liveBmi) : null;
  const categoryColor = category ? BMI_ZONE_COLORS[category] : FIGMA_HOME_DASHBOARD.brand;

  const nudge = (delta: number) => {
    setKg((current) => clampKg(current + delta));
    Haptics.selectionAsync().catch(() => undefined);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await logManualHealthMetric('weight', kg, undefined, profile);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onSaved();
      onClose();
    } catch {
      setError(ka.common.error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <ModalRoot>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={ka.common.close}
            activeOpacity={1}
            onPress={onClose}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
          />

          <View
            style={{
              backgroundColor: FIGMA_HOME_DASHBOARD.cardBg,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 20),
            }}
          >
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: FIGMA_HOME_DASHBOARD.border }} />
            </View>

            <View
              style={{
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 20,
                  lineHeight: 28,
                  color: FIGMA_HOME_DASHBOARD.textPrimary,
                  paddingRight: 12,
                }}
              >
                {ka.home.bmi.sheetTitle}
              </Text>
              <TouchableOpacity accessibilityRole="button" onPress={onClose} hitSlop={12} activeOpacity={0.8}>
                <View
                  pointerEvents="none"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: FIGMA_HOME_DASHBOARD.setupCardBg,
                    borderWidth: 1,
                    borderColor: FIGMA_HOME_DASHBOARD.border,
                  }}
                >
                  <X size={18} color={FIGMA_HOME_DASHBOARD.textPrimary} strokeWidth={2.2} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={{ alignItems: 'center', paddingHorizontal: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 48,
                    lineHeight: 54,
                    color: FIGMA_HOME_DASHBOARD.textPrimary,
                    letterSpacing: -1.2,
                  }}
                >
                  {kg.toFixed(1)}
                </Text>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 16,
                    lineHeight: 24,
                    color: FIGMA_HOME_DASHBOARD.textSecondary,
                    paddingBottom: 8,
                  }}
                >
                  {ka.home.bmi.kg}
                </Text>
              </View>

              {liveBmi != null && category ? (
                <View
                  style={{
                    marginTop: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: `${categoryColor}14`,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: categoryColor }}>
                    BMI {liveBmi.toFixed(1)}
                  </Text>
                  <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: categoryColor }}>
                    {ka.home.bmi.categories[category]}
                  </Text>
                </View>
              ) : (
                <Text
                  style={{
                    marginTop: 6,
                    fontFamily: 'NotoSansGeorgian_400Regular',
                    fontSize: 12,
                    color: FIGMA_HOME_DASHBOARD.textSecondary,
                  }}
                >
                  {ka.home.bmi.noHeight}
                </Text>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, marginBottom: 8 }}>
                <NudgeChip label="− 0.1" icon={Minus} onPress={() => nudge(-0.1)} />
                <NudgeChip label="+ 0.1" icon={Plus} onPress={() => nudge(0.1)} />
              </View>
            </View>

            <WeightRulerPicker
              values={WEIGHT_KG}
              selected={Math.round(kg)}
              onSelect={(value) => setKg(value)}
              labelEvery={5}
              labelOrigin={30}
            />

            {error ? (
              <Text
                style={{
                  marginTop: 8,
                  textAlign: 'center',
                  fontFamily: 'NotoSansGeorgian_500Medium',
                  fontSize: 13,
                  color: '#F43F5E',
                }}
              >
                {error}
              </Text>
            ) : null}

            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <Button label={ka.common.save} onPress={() => void save()} loading={saving} size="lg" />
            </View>
          </View>
        </View>
      </ModalRoot>
    </Modal>
  );
}

function NudgeChip({
  label,
  icon: Icon,
  onPress,
}: {
  label: string;
  icon: typeof Minus;
  onPress: () => void;
}) {
  const FIGMA_HOME_DASHBOARD = useFigmaHomeDashboard();
  return (
    <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.85}>
      <View
        pointerEvents="none"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: FIGMA_HOME_DASHBOARD.brandQuaternary,
          borderWidth: 1,
          borderColor: FIGMA_HOME_DASHBOARD.brandBorder,
        }}
      >
        <Icon size={14} color={FIGMA_HOME_DASHBOARD.brand} strokeWidth={2.4} />
        <Text
          style={{
            fontFamily: 'NotoSansGeorgian_600SemiBold',
            fontSize: 13,
            color: FIGMA_HOME_DASHBOARD.brand,
          }}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
