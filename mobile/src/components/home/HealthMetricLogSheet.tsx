import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Activity,
  Droplets,
  Footprints,
  HeartPulse,
  Moon,
  Scale,
  Utensils,
  X,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { FIGMA_HEALTH_METRICS, METRIC_COLORS } from '@/constants/figmaHealthMetricsLayout';
import { FIGMA_STEPS } from '@/constants/figmaStepsLayout';
import { ka } from '@/i18n/ka';
import { logManualHealthMetric, type LoggableMetricKey } from '@/lib/logManualHealthMetric';
import { useAuth } from '@/store/AuthContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
};

type MetricOption = {
  key: LoggableMetricKey;
  icon: LucideIcon;
  color: string;
  label: string;
  unit: string;
  dual?: boolean;
};

const OPTIONS: MetricOption[] = [
  { key: 'steps', icon: Footprints, color: FIGMA_STEPS.brand, label: ka.steps.homePreview, unit: ka.healthMetrics.logUnits.steps },
  { key: 'heartRate', icon: HeartPulse, color: METRIC_COLORS.heartRate, label: ka.healthMetrics.metrics.heartRate, unit: 'bpm' },
  { key: 'weight', icon: Scale, color: METRIC_COLORS.weight, label: ka.healthMetrics.metrics.weight, unit: 'kg' },
  { key: 'bloodPressure', icon: Activity, color: METRIC_COLORS.bloodPressure, label: ka.healthMetrics.metrics.bloodPressure, unit: 'mmHg', dual: true },
  { key: 'sleep', icon: Moon, color: METRIC_COLORS.sleep, label: ka.healthMetrics.metrics.sleep, unit: ka.healthMetrics.hoursUnit },
  { key: 'nutrition', icon: Utensils, color: METRIC_COLORS.nutrition, label: ka.healthMetrics.metrics.nutrition, unit: 'kcal' },
  { key: 'hydration', icon: Droplets, color: METRIC_COLORS.hydration, label: ka.healthMetrics.metrics.hydration, unit: 'ml' },
];

export function HealthMetricLogSheet({ visible, onClose, onSaved }: Props) {
  const { healthProfile } = useAuth();
  const [selected, setSelected] = useState<MetricOption | null>(null);
  const [value, setValue] = useState('');
  const [valueSecondary, setValueSecondary] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setSelected(null);
      setValue('');
      setValueSecondary('');
      setError(null);
    }
  }, [visible]);

  const parsed = useMemo(() => {
    const primary = Number(value.replace(',', '.'));
    const secondary = Number(valueSecondary.replace(',', '.'));
    return { primary, secondary };
  }, [value, valueSecondary]);

  const canSave = useMemo(() => {
    if (!selected) return false;
    if (!Number.isFinite(parsed.primary) || parsed.primary <= 0) return false;
    if (selected.dual && (!Number.isFinite(parsed.secondary) || parsed.secondary <= 0)) return false;
    return true;
  }, [parsed.primary, parsed.secondary, selected]);

  const save = async () => {
    if (!selected || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      await logManualHealthMetric(selected.key, parsed.primary, selected.dual ? parsed.secondary : undefined, healthProfile);
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 28,
            maxHeight: '88%',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 20,
                lineHeight: 28,
                color: FIGMA_HEALTH_METRICS.textPrimary,
                letterSpacing: -0.25,
              }}
            >
              {selected ? ka.healthMetrics.logTitle : ka.healthMetrics.logPickMetric}
            </Text>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
                  borderWidth: 1,
                  borderColor: FIGMA_HEALTH_METRICS.border,
                }}
              >
                <X size={18} color={FIGMA_HEALTH_METRICS.textPrimary} strokeWidth={2.2} />
              </View>
            </Pressable>
          </View>

          {!selected ? (
            <>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 14,
                  lineHeight: 22,
                  color: FIGMA_HEALTH_METRICS.textSecondary,
                  marginBottom: 16,
                }}
              >
                {ka.healthMetrics.logHint}
              </Text>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                <View style={{ gap: 8, paddingBottom: 8 }}>
                  {OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <Pressable
                        key={opt.key}
                        accessibilityRole="button"
                        onPress={() => setSelected(opt)}
                        style={({ pressed }) => ({
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          paddingVertical: 14,
                          paddingHorizontal: 14,
                          borderRadius: 16,
                          backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
                          borderWidth: 1,
                          borderColor: FIGMA_HEALTH_METRICS.border,
                          opacity: pressed ? 0.9 : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: `${opt.color}18`,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon size={22} color={opt.color} strokeWidth={2.1} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontFamily: 'NotoSansGeorgian_600SemiBold',
                              fontSize: 15,
                              color: FIGMA_HEALTH_METRICS.textPrimary,
                            }}
                          >
                            {opt.label}
                          </Text>
                          <Text
                            style={{
                              fontFamily: 'NotoSansGeorgian_400Regular',
                              fontSize: 13,
                              color: FIGMA_HEALTH_METRICS.textSecondary,
                              marginTop: 2,
                            }}
                          >
                            {opt.unit}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </>
          ) : (
            <View style={{ gap: 16 }}>
              <Pressable accessibilityRole="button" onPress={() => setSelected(null)}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 14,
                    color: FIGMA_HEALTH_METRICS.brand,
                  }}
                >
                  ← {ka.common.back}
                </Text>
              </Pressable>

              <View style={{ gap: 10 }}>
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 14,
                    color: FIGMA_HEALTH_METRICS.textPrimary,
                  }}
                >
                  {selected.dual ? ka.healthMetrics.logSystolic : selected.label}
                </Text>
                <TextInput
                  value={value}
                  onChangeText={setValue}
                  keyboardType="decimal-pad"
                  placeholder={selected.dual ? '120' : '0'}
                  placeholderTextColor="#9CA3AF"
                  style={{
                    fontFamily: 'NotoSansGeorgian_600SemiBold',
                    fontSize: 18,
                    color: FIGMA_HEALTH_METRICS.textPrimary,
                    backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
                    borderWidth: 1,
                    borderColor: FIGMA_HEALTH_METRICS.border,
                    borderRadius: 14,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                />
              </View>

              {selected.dual ? (
                <View style={{ gap: 10 }}>
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 14,
                      color: FIGMA_HEALTH_METRICS.textPrimary,
                    }}
                  >
                    {ka.healthMetrics.logDiastolic}
                  </Text>
                  <TextInput
                    value={valueSecondary}
                    onChangeText={setValueSecondary}
                    keyboardType="decimal-pad"
                    placeholder="80"
                    placeholderTextColor="#9CA3AF"
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 18,
                      color: FIGMA_HEALTH_METRICS.textPrimary,
                      backgroundColor: FIGMA_HEALTH_METRICS.cardBg,
                      borderWidth: 1,
                      borderColor: FIGMA_HEALTH_METRICS.border,
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                    }}
                  />
                </View>
              ) : null}

              {error ? (
                <Text
                  style={{
                    fontFamily: 'NotoSansGeorgian_500Medium',
                    fontSize: 13,
                    color: '#F43F5E',
                    textAlign: 'center',
                  }}
                >
                  {error}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                disabled={!canSave || saving}
                onPress={() => void save()}
                style={({ pressed }) => ({
                  backgroundColor: FIGMA_HEALTH_METRICS.brand,
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: 'center',
                  opacity: !canSave || saving || pressed ? 0.85 : 1,
                })}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 16,
                      color: '#FFFFFF',
                    }}
                  >
                    {ka.healthMetrics.logSave}
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
