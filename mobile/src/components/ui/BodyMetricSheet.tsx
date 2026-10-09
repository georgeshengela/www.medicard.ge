import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarDays, ChevronRight, Ruler, X } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Modal, APP_MODAL_OVERLAY, APP_MODAL_PROPS } from '@/components/ui/appModal';
import { DateWheelPicker } from '@/components/assessment/DateWheelPicker';
import { UnitSegment } from '@/components/assessment/UnitSegment';
import {
  HEIGHT_CM_VALUES,
  HEIGHT_IN_VALUES,
  HeightWheelPicker,
  cmToInches,
  formatHeightInches,
  inchesToCm,
} from '@/components/assessment/HeightWheelPicker';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import { MIN_USER_AGE, ageFromBirthDate, isoToDisplay, normalizeIsoDate, parseBirthDate } from '@/lib/birthdate';
import { useThemeColors } from '@/theme/colors';
import { hubText } from '@/theme/hub';

/**
 * Height and date of birth the app's way (the profile's MedicalEditSheet look): a bottom sheet with the
 * wheel pickers from onboarding, instead of typing „1990-05-21“ or „168“ into a text field.
 * `onDone` gets centimetres (height) or an ISO date (birth); saving stays with the caller.
 */
export function BodyMetricSheet({ kind, value, onDone, onClose }: {
  kind: 'height' | 'birth' | null;
  value: { heightCm?: number | null; birthIso?: string | null };
  onDone: (next: { heightCm?: number; birthIso?: string }) => void;
  onClose: () => void;
}) {
  const c = useThemeColors();
  const safe = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const [shown, setShown] = useState(kind);
  const [unit, setUnit] = useState<'cm' | 'ft'>('cm');
  const [heightCm, setHeightCm] = useState(170);
  const [birth, setBirth] = useState({ y: 1990, m: 1, d: 1 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!kind) return;
    setShown(kind);
    setError(null);
    const h = Number(value.heightCm);
    setHeightCm(h >= 100 && h <= 250 ? Math.round(h) : 165);
    const iso = normalizeIsoDate(value.birthIso || '');
    const [y, m, d] = iso ? iso.split('-').map(Number) : [1990, 1, 1];
    setBirth({ y, m, d });
  }, [kind, value.heightCm, value.birthIso]);

  const birthIso = `${birth.y}-${String(birth.m).padStart(2, '0')}-${String(birth.d).padStart(2, '0')}`;
  const age = ageFromBirthDate(new Date(birth.y, birth.m - 1, birth.d));

  const done = () => {
    if (shown === 'birth') {
      const parsed = parseBirthDate(isoToDisplay(birthIso) ?? '');
      if (!parsed.ok) return setError(parsed.error);
      onDone({ birthIso: parsed.iso });
    } else {
      onDone({ heightCm: Math.round(heightCm * 10) / 10 });
    }
    onClose();
  };

  const isCm = unit === 'cm';
  return (
    <Modal visible={kind != null} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={ka.common.cancel} onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]} />
        <View style={[s.sheet, { backgroundColor: c.surface, maxHeight: windowH * 0.9, paddingBottom: Math.max(safe.bottom, 16) }]}>
          <View style={[s.grabber, { backgroundColor: c.bg300 }]} />
          <View style={s.header}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[hubText.sectionTitle, { color: c.text100 }]}>{shown === 'birth' ? tx('დაბადების თარიღი', 'Date of birth') : tx('სიმაღლე', 'Height')}</Text>
              <Text style={[hubText.caption, { color: c.text300 }]}>
                {shown === 'birth' ? tx('ასაკი კალორიების გამოთვლისთვის გვჭირდება.', 'Your age is needed to calculate calories.') : tx('გადაატრიალე ბორბალი შენს სიმაღლემდე.', 'Turn the wheel to your height.')}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} hitSlop={8} style={[s.close, { backgroundColor: c.bg200 }]}>
              <X size={18} color={c.text200} strokeWidth={2.2} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
            {shown === 'birth' ? (
              <View style={{ alignItems: 'center', gap: 12 }}>
                <DateWheelPicker
                  month={birth.m}
                  day={birth.d}
                  year={birth.y}
                  maxYear={new Date().getFullYear() - MIN_USER_AGE}
                  onChange={(next) => setBirth((b) => ({ y: next.year ?? b.y, m: next.month ?? b.m, d: next.day ?? b.d }))}
                />
                <Text style={[hubText.link, { color: c.primary200 }]}>{ka.assessment.yearsOld(age)}</Text>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                <UnitSegment
                  value={unit}
                  options={[{ value: 'cm', label: ka.assessment.cm }, { value: 'ft', label: ka.assessment.ft }]}
                  onChange={(u) => setUnit(u as 'cm' | 'ft')}
                />
                <HeightWheelPicker
                  values={isCm ? HEIGHT_CM_VALUES : HEIGHT_IN_VALUES}
                  selected={isCm ? Math.round(heightCm) : cmToInches(heightCm)}
                  formatLabel={(v) => (isCm ? String(v) : formatHeightInches(v))}
                  onSelect={(n) => setHeightCm(isCm ? n : inchesToCm(n))}
                />
              </View>
            )}
          </ScrollView>
          <View style={{ paddingHorizontal: 20, paddingTop: 6, gap: 8 }}>
            {error ? <Text style={[hubText.caption, { color: c.danger, textAlign: 'center' }]}>{error}</Text> : null}
            <Button label={tx('მზადაა', 'Done')} onPress={done} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** A form row that opens a picker: label above, the value (or a prompt) in a field-like tile, an icon. */
export function PickerField({ label, value, placeholder, icon = 'ruler', onPress, on = 'surface' }: {
  label: string;
  value: string | null;
  placeholder: string;
  icon?: 'ruler' | 'calendar';
  onPress: () => void;
  on?: 'surface' | 'card';
}) {
  const c = useThemeColors();
  const Icon = icon === 'calendar' ? CalendarDays : Ruler;
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: c.text200, marginHorizontal: 2 }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || placeholder}`}
        onPress={onPress}
        style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: on === 'card' ? c.bg200 : c.surface }}
      >
        <Icon size={18} strokeWidth={1.8} color={value ? c.primary200 : c.text300} />
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: value ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_400Regular', fontSize: 16, color: value ? c.text100 : c.text300 }}>{value || placeholder}</Text>
        <ChevronRight size={18} color={c.text300} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: { width: '100%', maxWidth: 760, alignSelf: 'center', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
