import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Footprints, MapPin, Route, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hideFloatingTabBar } from '@/components/navigation/tabChrome';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { ka } from '@/i18n/ka';
import {
  caloriesKcal,
  estimateDurationMs,
  estimateSteps,
  formatThousands,
  targetMeters,
  type RunTarget,
  type RunTargetKind,
} from '@/lib/run/geo';
import { useIsDark, useThemeColors } from '@/theme/colors';

const KM_PRESETS = [1, 2, 3, 5, 10];
const STEP_PRESETS = [3000, 5000, 8000, 10000, 15000];

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (target: RunTarget) => void;
  heightCm?: number | null;
  weightKg?: number | null;
};

export function RunTargetSheet({ visible, onClose, onConfirm, heightCm, weightKg }: Props) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const customRef = useRef<TextInput>(null);
  const [kind, setKind] = useState<RunTargetKind>('km');
  const [preset, setPreset] = useState<number | null>(3);
  const [custom, setCustom] = useState('');
  const [customFocused, setCustomFocused] = useState(false);

  useEffect(() => {
    if (!visible) return;
    return hideFloatingTabBar();
  }, [visible]);

  useEffect(() => {
    if (visible) return;
    setCustomFocused(false);
    Keyboard.dismiss();
  }, [visible]);

  const value = useMemo(() => {
    if (preset != null) return preset;
    const n = Number(custom.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [preset, custom]);

  const target: RunTarget | null = value > 0 ? { kind, value } : null;
  const meters = target ? targetMeters(target, heightCm) : 0;
  const minutes = Math.max(1, Math.round(estimateDurationMs(meters) / 60000));
  const kcal = Math.round(caloriesKcal(meters, estimateDurationMs(meters), weightKg));
  const presets = kind === 'km' ? KM_PRESETS : STEP_PRESETS;
  const accent = dark ? '#5EEAD4' : colors.primary100;
  const ctaBg = dark ? '#0D9488' : colors.primary200;
  const customActive = preset == null || customFocused;

  const switchKind = (next: RunTargetKind) => {
    if (next === kind) return;
    void Haptics.selectionAsync();
    setKind(next);
    setPreset(next === 'km' ? 3 : 5000);
    setCustom('');
    setCustomFocused(false);
    customRef.current?.blur();
  };

  const choosePreset = (n: number) => {
    void Haptics.selectionAsync();
    setPreset(n);
    setCustom('');
    setCustomFocused(false);
    Keyboard.dismiss();
  };

  const openCustom = () => {
    void Haptics.selectionAsync();
    setCustomFocused(true);
    customRef.current?.focus();
  };

  const confirm = () => {
    if (!target) return;
    Keyboard.dismiss();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onConfirm(target);
  };

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.close}
          onPress={onClose}
          style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: APP_MODAL_OVERLAY }}
        />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ backgroundColor: 'transparent' }}>
          <View
            style={{
              backgroundColor: colors.surfaceRaised,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              overflow: 'hidden',
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: Math.max(insets.bottom, 16) + 12,
            }}
          >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.bg300 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 26, color: colors.text100 }}>
                {ka.run.chooseTarget}
              </Text>
              <Text style={{ marginTop: 4, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 18, color: colors.text300 }}>
                {ka.run.chooseTargetHint}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              hitSlop={10}
              style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg200 }}
            >
              <X size={18} color={colors.text200} strokeWidth={2.4} />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: 'row',
              marginTop: 18,
              padding: 4,
              borderRadius: 16,
              backgroundColor: colors.bg200,
              gap: 4,
            }}
          >
            {(['km', 'steps'] as RunTargetKind[]).map((k) => {
              const active = k === kind;
              const Icon = k === 'km' ? Route : Footprints;
              return (
                <Pressable
                  key={k}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => switchKind(k)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    paddingVertical: 12,
                    borderRadius: 12,
                    backgroundColor: active ? colors.surface : 'transparent',
                    borderWidth: active ? 1 : 0,
                    borderColor: colors.bg300,
                  }}
                >
                  <Icon size={16} color={active ? accent : colors.text300} strokeWidth={2.3} />
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_600SemiBold',
                      fontSize: 13.5,
                      color: active ? colors.text100 : colors.text300,
                    }}
                  >
                    {k === 'km' ? ka.run.kindKm : ka.run.kindSteps}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {presets.map((n) => {
              const active = preset === n;
              return (
                <Pressable
                  key={n}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => choosePreset(n)}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 999,
                    justifyContent: 'center',
                    backgroundColor: active ? (dark ? '#115E59' : colors.accent100) : colors.bg200,
                    borderWidth: 1,
                    borderColor: active ? (dark ? '#14B8A6' : colors.accent200) : colors.bg300,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'NotoSansGeorgian_700Bold',
                      fontSize: 14,
                      color: active ? (dark ? '#99F6E4' : colors.primary100) : colors.text200,
                    }}
                  >
                    {kind === 'km' ? `${n} ${ka.run.km}` : formatThousands(n)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View
            style={{
              marginTop: 10,
              minHeight: 56,
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 4,
              paddingRight: 14,
              borderRadius: 16,
              backgroundColor: customActive ? (dark ? '#115E59' : colors.accent100) : colors.bg200,
              borderWidth: 1.5,
              borderColor: customActive ? (dark ? '#14B8A6' : colors.accent200) : colors.bg300,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.run.custom}
              onPress={openCustom}
              hitSlop={6}
              style={{ minHeight: 56, paddingHorizontal: 12, justifyContent: 'center' }}
            >
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 14,
                  color: customActive ? (dark ? '#99F6E4' : colors.primary100) : colors.text200,
                }}
              >
                {ka.run.custom}
              </Text>
            </Pressable>
            <TextInput
              ref={customRef}
              value={custom}
              onChangeText={(t) => {
                setCustom(t);
                setPreset(null);
              }}
              onFocus={() => {
                setCustomFocused(true);
                setPreset(null);
              }}
              onBlur={() => setCustomFocused(false)}
              keyboardType={kind === 'km' ? 'decimal-pad' : 'number-pad'}
              placeholder={kind === 'km' ? ka.run.customKmPlaceholder : ka.run.customStepsPlaceholder}
              placeholderTextColor={colors.text300}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
              style={{
                flex: 1,
                minHeight: 56,
                paddingVertical: Platform.OS === 'ios' ? 16 : 12,
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 16,
                color: colors.text100,
                textAlign: 'right',
              }}
            />
            <Pressable onPress={openCustom} hitSlop={8} style={{ minHeight: 56, paddingLeft: 8, justifyContent: 'center' }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 13,
                  color: customActive ? (dark ? '#99F6E4' : colors.primary100) : colors.text300,
                }}
              >
                {kind === 'km' ? ka.run.km : ka.run.steps}
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 12,
              borderRadius: 16,
              backgroundColor: dark ? '#042F2E' : colors.accent100,
            }}
          >
            <MapPin size={18} color={accent} strokeWidth={2.3} />
            <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, lineHeight: 18, color: dark ? '#99F6E4' : colors.primary100 }}>
              {target
                ? [
                    kind === 'km'
                      ? ka.run.approxSteps(formatThousands(estimateSteps(meters, heightCm)))
                      : ka.run.approxKm((meters / 1000).toFixed(1)),
                    ka.run.approxTime(minutes),
                    ka.run.approxKcal(kcal),
                  ].join('  ·  ')
                : ka.run.chooseTarget}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!target}
            onPress={confirm}
            style={{
              marginTop: 14,
              height: 56,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 9,
              backgroundColor: target ? ctaBg : colors.bg300,
            }}
          >
            <MapPin size={18} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: '#FFFFFF' }}>{ka.run.dropPin}</Text>
          </Pressable>
        </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
